import bcrypt from "bcrypt";
import { CONFIG } from "../config/environment";
import jwt from "jsonwebtoken";

export class Response {
    data: any;
    message: string;
    status: number;
    constructor(data: any, message: string, status?: number) {
        this.data = data;
        this.message = message || 'Operation completed successfully';
        this.status = status || 200;
    }
}

export function throwError(message: string, statusCode: number) {
    let newError: any = new Error(message || 'Internal Server Error');
    newError['status'] = statusCode || 500;
    throw newError;
}

export class Utility {
    static comparePasswordHash(hash: string, plainText: string) {
        return bcrypt.compareSync(plainText, hash);
    }

    static createPasswordHash(password: string) {
        let salt = bcrypt.genSaltSync(CONFIG.BCRYPT_SALT_ROUNDS);
        return bcrypt.hashSync(password, salt);
    }

    // Generate JWT token
    static generateJwtToken(userUUID: string) {
        return jwt.sign(
            {
                id: userUUID,
            },
            CONFIG.jwt.secret,
            { expiresIn: "1h" }
        );
    }
}