import * as Express from 'express';
import { IServer } from '../lib/interfaces';

export default class ErrorHandler {
    static init(server: IServer) {
        server.app.use((error: any, req: Express.Request, res: Express.Response, next: Express.NextFunction) => {
            console.log(error, 'In error handler');

            // Mongo Error
            if (error.name == 'MongoError') {

                if (error.code == 11000) {
                    res.status(400).send(`${Object.values(error.keyValue)[0]} already exists in the system`);
                } else {
                    res.status(400).send("Bad Request");
                }
            }

            // JWT error
            if (error.name == 'JsonWebTokenError') {
                return res.status(401).send("Incorrect token");
            }

            if (error.name == 'TokenExpiredError') {
                return res.status(401).send("Token expired");
            }

            res.status(500).send(error.message || "Internal server error");
        });

    }

}