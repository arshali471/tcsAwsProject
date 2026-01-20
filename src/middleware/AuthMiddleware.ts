import express from 'express';
import { CONFIG } from '../config/environment';
import jwt from "jsonwebtoken";
import { UserService } from '../services/userService';
import { throwError } from '../util/util';



export function authMiddleware() {
    return async function (req: express.Request, res: express.Response, next: express.NextFunction) {
        try {

            if (!req.headers.authorization) {
                return throwError("Invalid token", 400);
            }

            // Strip "Bearer " prefix if present
            const token = req.headers.authorization.replace('Bearer ', '');
            const decoded: any = jwt.verify(token, CONFIG.jwt.secret);
            if (!decoded) {
                // Invalid token
                return res.status(401).send("Invalid Token")
            }
            const user = await UserService.getUserById(decoded.id);
            
            if (!user) {
                return res.status(404).send("no user found!!!");
            }

            if (!user.isActive) {
                return res.status(404).send("user not allowed.")
            }

            req.user = user;
            next();
        } catch (error) {
            next(error);
        }
    }
};
