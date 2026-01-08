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
    encKey: process.env.ENCRYPTION_SECRET,
    sigKey: process.env.SIGNING_SECRET,
    masterKey: process.env.MASTER_KEY,
    awsS3BucketName: process.env.AWS_S3_BUCKET_NAME,
    aws: {
        region: process.env.region,
        accessKeyId: process.env.accessKeyId,
        secretAccessKey: process.env.secretAccessKey
    },
    azure: {
        clientId: process.env.AZURE_CLIENT_ID || '',
        clientSecret: process.env.AZURE_CLIENT_SECRET || '',
        tenantId: process.env.AZURE_TENANT_ID || '',
        redirectUri: process.env.AZURE_REDIRECT_URI || 'http://localhost:5173/auth/callback',
    },
    uploadsFolderPath: path.resolve(__dirname, '../../uploads'),
    sshKeyFolderPath: path.resolve(__dirname, '../../ssh-key'),
    agentStatusFolderPath: path.resolve(__dirname, '../../agent-status'),
}