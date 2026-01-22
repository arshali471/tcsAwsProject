import { EksDashboardDao } from "../../lib/dao/eksDashboard.dao";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface QueryRequest {
    query: string;
    session_id?: string;
    encrypted_credentials?: string;
    eks_token_id?: string;
}

interface ActiveSession {
    agent: any;
    transport: any;
    mcpClient: any;
    lastAccessed: number;
    kubeconfigPath?: string;
}

export class EKSMCPService {
    private modelId: string;
    private sessions: Map<string, ActiveSession> = new Map();
    private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    private sdkPromise: Promise<any> | null = null;

    constructor() {
        this.modelId = process.env.MODEL_ID || "us.anthropic.claude-3-7-sonnet-20250219-v1:0";

        setInterval(() => this.cleanupExpiredSessions(), 60000);
    }

    private async loadSDK() {
        if (!this.sdkPromise) {
            this.sdkPromise = Promise.all([
                import('@modelcontextprotocol/sdk/client/stdio.js'),
                import('@strands-agents/sdk')
            ]).then(([mcpSdk, agentsSdk]) => ({
                StdioClientTransport: mcpSdk.StdioClientTransport,
                Agent: agentsSdk.Agent,
                BedrockModel: agentsSdk.BedrockModel,
                McpClient: agentsSdk.McpClient,
                SlidingWindowConversationManager: agentsSdk.SlidingWindowConversationManager
            }));
        }
        return this.sdkPromise;
    }

    async query(request: QueryRequest): Promise<string> {
        const sessionId = request.session_id || 'default';

        const session = await this.getSession(sessionId, request.encrypted_credentials, request.eks_token_id);

        try {
            const result: any = await session.agent.invoke(request.query);

            if (typeof result.output === 'string') return result.output;
            if (Array.isArray(result.messages)) {
                const lastMsg = result.messages[result.messages.length - 1];
                return typeof lastMsg.content === 'string' ? lastMsg.content : lastMsg.content[0]?.text || "";
            }
            return JSON.stringify(result);
        } catch (error) {
            console.error(`Error in session ${sessionId}:`, error);
            throw error;
        }
    }

    async *queryStream(request: QueryRequest): AsyncGenerator<string> {
        const sessionId = request.session_id || 'default';

        yield JSON.stringify({
            type: 'metadata',
            server_used: 'eks',
            session_id: sessionId
        });

        try {
            console.log('[EKS MCP] Getting session for ID:', sessionId);
            const session = await this.getSession(sessionId, request.encrypted_credentials, request.eks_token_id);
            console.log('[EKS MCP] Session established, streaming query...');

            for await (const chunk of session.agent.stream(request.query)) {
                if (chunk.type === 'modelContentBlockDeltaEvent') {
                    const delta = chunk.delta as any;
                    if (delta && 'text' in delta && typeof delta.text === 'string') {
                        yield JSON.stringify({ type: 'content', content: delta.text });
                    }
                }
            }
        } catch (error) {
            console.error("[EKS MCP] Streaming failed:", error);

            let errorMessage = 'Unknown streaming error';
            if (error instanceof Error) {
                errorMessage = error.message;

                // Provide more helpful error messages
                if (errorMessage.includes('timeout')) {
                    errorMessage = 'Connection to Kubernetes cluster timed out. Please verify:\n' +
                                 '1. Your kubeconfig has valid credentials\n' +
                                 '2. The cluster endpoint is accessible\n' +
                                 '3. Network connectivity is working';
                } else if (errorMessage.includes('ECONNREFUSED')) {
                    errorMessage = 'Unable to connect to Kubernetes cluster. Please check your cluster endpoint.';
                } else if (errorMessage.includes('unauthorized') || errorMessage.includes('forbidden')) {
                    errorMessage = 'Authentication failed. Please check your kubeconfig credentials.';
                }
            }

            yield JSON.stringify({
                type: 'error',
                content: errorMessage
            });
        }

        yield JSON.stringify({ type: 'done' });
    }

    private async getSession(sessionId: string, encryptedCredentials?: string, eksTokenId?: string): Promise<ActiveSession> {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId)!;
            session.lastAccessed = Date.now();
            return session;
        }

        const { mcpEnv, kubeconfigPath } = await this.prepareEnvironment(encryptedCredentials, eksTokenId);
        const { agent, transport, mcpClient } = await this.createAgent(mcpEnv);

        const newSession: ActiveSession = {
            agent,
            transport,
            mcpClient,
            lastAccessed: Date.now(),
            kubeconfigPath
        };

        this.sessions.set(sessionId, newSession);
        return newSession;
    }

    private async cleanupExpiredSessions() {
        const now = Date.now();

        this.sessions.forEach(async (session, id) => {
            if (now - session.lastAccessed > this.SESSION_TIMEOUT_MS) {
                console.log(`Closing expired session: ${id}`);
                try {
                    await session.transport.close();
                    // Cleanup kubeconfig file if it exists
                    if (session.kubeconfigPath && session.kubeconfigPath.startsWith(os.tmpdir())) {
                        fs.unlinkSync(session.kubeconfigPath);
                    }
                } catch (e) {
                    console.error(`Failed to close session ${id}`, e);
                }
                this.sessions.delete(id);
            }
        });
    }

    public async endSession(sessionId: string) {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId)!;
            await session.transport.close();
            // Cleanup kubeconfig file if it exists
            if (session.kubeconfigPath && session.kubeconfigPath.startsWith(os.tmpdir())) {
                try {
                    fs.unlinkSync(session.kubeconfigPath);
                } catch (e) {
                    console.error(`Failed to cleanup kubeconfig for session ${sessionId}`, e);
                }
            }
            this.sessions.delete(sessionId);
        }
    }

    private async prepareEnvironment(encryptedCredentials?: string, eksTokenId?: string): Promise<{ mcpEnv: Record<string, string>, kubeconfigPath?: string }> {
        const mcpEnv: Record<string, string> = {};
        Object.keys(process.env).forEach(key => {
             const value = process.env[key];
             if (value !== undefined) mcpEnv[key] = value;
        });

        if (encryptedCredentials) {
             const { decryptAWSCredentials } = await import("../../util/crypto.util");
             const creds = decryptAWSCredentials(encryptedCredentials);
             mcpEnv.AWS_ACCESS_KEY_ID = creds.access_key_id;
             mcpEnv.AWS_SECRET_ACCESS_KEY = creds.secret_access_key;
             mcpEnv.AWS_DEFAULT_REGION = creds.region;
             mcpEnv.AWS_REGION = creds.region;
        }

        let kubeconfigPath: string | undefined;

        // Handle kubeconfig from EKS token
        if (eksTokenId) {
            const eksToken = await EksDashboardDao.getEKSTokenById(eksTokenId);
            if (eksToken && eksToken.ymlFileContent) {
                // Log the first 100 characters to check if content is being retrieved properly
                console.log('Retrieved YML content (first 100 chars):', eksToken.ymlFileContent.substring(0, 100));
                console.log('YML content length:', eksToken.ymlFileContent.length);

                // Validate the YML content before writing
                try {
                    const { validateKubeConfigYml } = await import("../../helper/ymlValidator");
                    validateKubeConfigYml(eksToken.ymlFileContent);
                    console.log('YML validation passed');
                } catch (validationError: any) {
                    console.error('YML validation failed:', validationError.message);
                    throw new Error(`Invalid kubeconfig: ${validationError.message}`);
                }

                // Create a temporary kubeconfig file
                const tempDir = os.tmpdir();
                kubeconfigPath = path.join(tempDir, `kubeconfig-${eksTokenId}-${Date.now()}.yml`);

                // Write the kubeconfig content to the temporary file
                fs.writeFileSync(kubeconfigPath, eksToken.ymlFileContent, 'utf-8');
                console.log('Kubeconfig written to:', kubeconfigPath);

                // Set KUBECONFIG environment variable
                mcpEnv.KUBECONFIG = kubeconfigPath;
            } else {
                throw new Error('EKS token not found or has no configuration content');
            }
        } else {
            // Default kubeconfig path
            mcpEnv.KUBECONFIG = "/app/.kube/config";
        }

        mcpEnv.FASTMCP_LOG_LEVEL = "ERROR";
        return { mcpEnv, kubeconfigPath };
    }

    private async createAgent(env: Record<string, string>) {
        const { BedrockModel, Agent, McpClient, SlidingWindowConversationManager, StdioClientTransport } = await this.loadSDK();

        console.log('[EKS MCP] Creating agent with kubeconfig:', env.KUBECONFIG || 'default');

        const model = new BedrockModel({
            region: process.env.BEDROCK_REGION || 'us-east-1',
            modelId: this.modelId,
            maxTokens: 4096,
            temperature: 0.7,
            clientConfig: {
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ""
                }
            }
        });

        console.log('[EKS MCP] Starting kubernetes-mcp-server...');
        const transport = new StdioClientTransport({
            command: "npx",
            args: ["-y", "kubernetes-mcp-server@latest"],
            env
        });

        console.log('[EKS MCP] Initializing MCP client with 2-minute timeout...');
        const mcpClient = new McpClient({
            transport,
            timeout: 120000 // Increase timeout to 2 minutes for Kubernetes cluster connection
        });

        console.log('[EKS MCP] Creating agent...');
        const agent = new Agent({
            model,
            tools: [mcpClient as any],
            conversationManager: new SlidingWindowConversationManager({
                windowSize: 20 // Remembers last 20 messages
            })
        });

        console.log('[EKS MCP] Agent created successfully');
        return { agent, transport, mcpClient };
    }
}
