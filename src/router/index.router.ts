import express, { NextFunction, Request, Response } from 'express';
import { IServer } from '../lib/interfaces';
import AwsRouter from './aws.router';
import AwsKeysRouter from './awsKeys.router';
import UserRouter from './user.rouer';
import ApiLogsRouter from './apiLogs.router';
import AuthRouter from './auth.router';
import BedrockUsageRouter from './bedrockUsage.router';
import UserSessionRouter from './userSession.router';
import TerminalRouter from './terminal.router';

export default class Routes {

    static init(server: IServer): void {
        const router: express.Router = express.Router();

        server.app.use('/', router);
        // Health check
        server.app.get('/healthCheck', async (req: Request, res: Response, next: NextFunction) => {
            let healthcheck = {
                dbConnect: server.isDbConnected,
                uptime: process.uptime(),
                message: 'OK',
                time: new Date().toLocaleString()
            };
            try {
                res.send(healthcheck);
            } catch (e) {
                healthcheck.message = e as any;
                res.status(503).send(healthcheck);
            }
        });
        // apikey
        // server.app.use('/api/v1/apikey', new ApikeyRouter().router);
        server.app.use("/api/v1/aws", new AwsRouter().router);
        server.app.use("/api/v1/awsKey", new AwsKeysRouter().router);
        server.app.use("/api/v1/user", new UserRouter().router);
        server.app.use("/api/v1/api-logs", new ApiLogsRouter().router);
        server.app.use("/api/v1/auth", new AuthRouter().router);
        server.app.use("/api/v1/bedrock-usage", new BedrockUsageRouter().router);
        server.app.use("/api/v1/sessions", new UserSessionRouter().router);
        server.app.use("/api/v1/terminal", new TerminalRouter().router);


    }
}