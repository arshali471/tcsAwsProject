import { CloudTrailMCPService } from "./mcp/cloudtrailMcpService";
import { EKSMCPService } from "./mcp/eksMcpService";

interface QueryRequest {
    query: string;
    session_id?: string;
    server_name?: string;
    encrypted_credentials?: string;
    eks_token_id?: string;
}

type ServerType = 'cloudtrail' | 'eks';

export class MCPService {
    private cloudtrailService: CloudTrailMCPService;
    private eksService: EKSMCPService;

    constructor() {
        this.cloudtrailService = new CloudTrailMCPService();
        this.eksService = new EKSMCPService();
    }

    getActiveServers() {
        return [
            { name: 'cloudtrail', description: 'AWS CloudTrail analysis assistant', disabled: false },
            { name: 'eks', description: 'AWS EKS cluster management assistant', disabled: false }
        ];
    }

    async query(request: QueryRequest): Promise<string> {
        const serverType = (request.server_name || 'cloudtrail') as ServerType;
        const service = this.getService(serverType);
        return service.query(request);
    }

    async *queryStream(request: QueryRequest): AsyncGenerator<string> {
        const serverType = (request.server_name || 'cloudtrail') as ServerType;
        const service = this.getService(serverType);
        yield* service.queryStream(request);
    }

    private getService(serverType: ServerType) {
        switch (serverType) {
            case 'cloudtrail':
                return this.cloudtrailService;
            case 'eks':
                return this.eksService;
            default:
                throw new Error(`Unknown server type: ${serverType}`);
        }
    }
}
