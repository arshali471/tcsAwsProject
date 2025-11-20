const crypto = require('crypto');

// Get encryption key from environment variables
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
    console.warn('WARNING: ENCRYPTION_KEY not set or invalid length. Please set a 32-character key in .env file.');
}

/**
 * Derive a 256-bit key from the encryption key using PBKDF2
 */
function deriveKey(password) {
    const salt = 'aws-credentials-salt'; // Static salt for deterministic key derivation
    return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
}

/**
 * Encrypt data using AES-256-GCM
 * @param {any} data - Data to encrypt (string or object)
 * @returns {string} Base64 encoded encrypted string with IV and auth tag
 */
function encryptData(data) {
    try {
        // Convert data to string if it's an object
        const dataString = typeof data === 'string' ? data : JSON.stringify(data);

        // Generate random IV (12 bytes for GCM)
        const iv = crypto.randomBytes(12);

        // Derive encryption key
        const key = deriveKey(ENCRYPTION_KEY);

        // Create cipher
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

        // Encrypt data
        let encrypted = cipher.update(dataString, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        // Get authentication tag
        const authTag = cipher.getAuthTag();

        // Combine IV + encrypted data + auth tag
        const ivBase64 = iv.toString('base64');
        const authTagBase64 = authTag.toString('base64');

        // Format: iv:encrypted:authTag
        return `${ivBase64}:${encrypted}:${authTagBase64}`;
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt data');
    }
}

/**
 * Decrypt data using AES-256-GCM
 * @param {string} encryptedData - Base64 encoded encrypted string with IV and auth tag
 * @returns {string} Decrypted data as string
 */
function decryptData(encryptedData) {
    try {
        // Split into components
        const parts = encryptedData.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted data format');
        }

        const [ivBase64, encrypted, authTagBase64] = parts;

        // Convert from base64
        const iv = Buffer.from(ivBase64, 'base64');
        const authTag = Buffer.from(authTagBase64, 'base64');

        // Derive encryption key
        const key = deriveKey(ENCRYPTION_KEY);

        // Create decipher
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        // Decrypt data
        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt data');
    }
}

/**
 * Encrypt AWS credentials for secure transmission
 * @param {object} credentials - AWS credentials object
 * @returns {string} Encrypted Base64 string
 */
function encryptAWSCredentials(credentials) {
    return encryptData({
        access_key_id: credentials.accessKeyId,
        secret_access_key: credentials.secretAccessKey,
        region: credentials.region,
        environment: credentials.environment
    });
}

/**
 * Decrypt AWS credentials received from client
 * @param {string} encryptedCredentials - Encrypted Base64 string
 * @returns {object} Decrypted credentials object
 */
function decryptAWSCredentials(encryptedCredentials) {
    const decryptedString = decryptData(encryptedCredentials);
    const credentials = JSON.parse(decryptedString);

    // Validate required fields
    if (!credentials.access_key_id || !credentials.secret_access_key || !credentials.region) {
        throw new Error('Missing required credential fields');
    }

    return credentials;
}

/**
 * Check if data appears to be encrypted
 * @param {string} data - Data to check
 * @returns {boolean} True if data appears to be encrypted
 */
function isEncrypted(data) {
    // Check if data matches encrypted format (iv:encrypted:authTag)
    const parts = data.split(':');
    return parts.length === 3;
}

module.exports = {
    encryptData,
    decryptData,
    encryptAWSCredentials,
    decryptAWSCredentials,
    isEncrypted
};
