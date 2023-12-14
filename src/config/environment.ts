import * as dotenv from "dotenv";
dotenv.config();
import path from 'path';

export const CONFIG = {
    NODE_ENV: process.env.NODE_ENV,
    DB_CONNECTION_STRING: process.env.DB_STRING,
    BCRYPT_SALT_ROUNDS: process.env.BCRYPT_SALT_ROUNDS ? parseInt(process.env.BCRYPT_SALT_ROUNDS) : 10,
    jwt: {
        secret: 'SDKFJ9#R3IO90U3@#9DSFIN',
        options: {
            // audience: 'https://example.io',
            expiresIn: '1d', // 1d
            // issuer: 'example.io'
        },
        cookie: {
            httpOnly: true,
            sameSite: true,
            signed: true,
            secure: true
        }
    },
    cookie: {
        secret: "@#$@#4knshdf82#9382yrknjef9@#$"
    },
    uploadsFolderPath: path.resolve(__dirname, '../../uploads')
}