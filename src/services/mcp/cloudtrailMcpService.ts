interface QueryRequest {
    query: string;
    session_id?: string;
    encrypted_credentials?: string;
}

interface ActiveSession {
    agent: any;
    transport: any;
    mcpClient: any;
    lastAccessed: number;
}

export class CloudTrailMCPService {
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

        const session = await this.getSession(sessionId, request.encrypted_credentials);

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
            server_used: 'cloudtrail',
            session_id: sessionId
        });

        try {
            const session = await this.getSession(sessionId, request.encrypted_credentials);

            for await (const chunk of session.agent.stream(request.query)) {
                if (chunk.type === 'modelContentBlockDeltaEvent') {
                    const delta = chunk.delta as any;
                    if (delta && 'text' in delta && typeof delta.text === 'string') {
                        yield JSON.stringify({ type: 'content', content: delta.text });
                    }
                }
            }
        } catch (error) {
            console.error("Streaming failed:", error);
            yield JSON.stringify({
                type: 'error',
                content: error instanceof Error ? error.message : 'Unknown streaming error'
            });
        }

        yield JSON.stringify({ type: 'done' });
    }

    private async getSession(sessionId: string, encryptedCredentials?: string): Promise<ActiveSession> {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId)!;
            session.lastAccessed = Date.now();
            return session;
        }

        const mcpEnv = await this.prepareEnvironment(encryptedCredentials);
        const { agent, transport, mcpClient } = await this.createAgent(mcpEnv);

        const newSession: ActiveSession = {
            agent,
            transport,
            mcpClient,
            lastAccessed: Date.now()
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
                } catch (e) {
                    console.error(`Failed to close session ${id}`, e);
                }
                this.sessions.delete(id);
            }
        });
    }

    public async endSession(sessionId: string) {
        if (this.sessions.has(sessionId)) {
            await this.sessions.get(sessionId)?.transport.close();
            this.sessions.delete(sessionId);
        }
    }

    private async prepareEnvironment(encryptedCredentials?: string): Promise<Record<string, string>> {
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
        mcpEnv.FASTMCP_LOG_LEVEL = "ERROR";
        return mcpEnv;
    }

    private async createAgent(env: Record<string, string>) {
        const { BedrockModel, Agent, McpClient, SlidingWindowConversationManager, StdioClientTransport } = await this.loadSDK();

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

        const transport = new StdioClientTransport({
            command: "python3",
            args: ["-m", "awslabs.cloudtrail_mcp_server.server"],
            env
        });

        const mcpClient = new McpClient({ transport });

        const agent = new Agent({
            model,
            tools: [mcpClient as any],
            conversationManager: new SlidingWindowConversationManager({
                windowSize: 20 // Remembers last 20 messages
            })
        });

        return { agent, transport, mcpClient };
    }
}
