/**
 * TypeScript declaration file for crypto.util.js
 */

/**
 * Encrypt data using AES-256-GCM
 * @param data - Data to encrypt (string or object)
 * @returns Base64 encoded encrypted string with IV and auth tag
 */
export function encryptData(data: any): string;

/**
 * Decrypt data using AES-256-GCM
 * @param encryptedData - Base64 encoded encrypted string with IV and auth tag
 * @returns Decrypted data as string
 */
export function decryptData(encryptedData: string): string;

/**
 * Encrypt AWS credentials for secure transmission
 * @param credentials - AWS credentials object
 * @returns Encrypted Base64 string
 */
export function encryptAWSCredentials(credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    environment?: string;
}): string;

/**
 * Decrypt AWS credentials received from client
 * @param encryptedCredentials - Encrypted Base64 string
 * @returns Decrypted credentials object
 */
export function decryptAWSCredentials(encryptedCredentials: string): {
    access_key_id: string;
    secret_access_key: string;
    region: string;
    environment?: string;
};

/**
 * Check if data appears to be encrypted
 * @param data - Data to check
 * @returns True if data appears to be encrypted
 */
export function isEncrypted(data: string): boolean;
