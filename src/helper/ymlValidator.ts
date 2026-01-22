import * as yaml from 'js-yaml';

/**
 * Validates if a string is valid base64
 * @param str - The string to validate
 * @returns true if valid base64, false otherwise
 */
function isValidBase64(str: string): boolean {
    if (!str || str.trim() === '') return false;

    // Base64 regex pattern: only allows valid base64 characters
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;

    // Check if string matches base64 pattern
    if (!base64Regex.test(str)) {
        return false;
    }

    try {
        // Attempt to decode the base64 string
        const buffer = Buffer.from(str, 'base64');

        // If buffer length is 0, it might be invalid
        if (buffer.length === 0 && str.length > 0) {
            return false;
        }

        return true;
    } catch (e) {
        // If Buffer.from throws an error, it's invalid base64
        return false;
    }
}

/**
 * Validates if the uploaded YML file contains 'kind: Config' and has valid base64 encoded certificates
 * @param fileContent - The content of the YML file as a string
 * @returns true if valid, throws error if invalid
 */
export function validateKubeConfigYml(fileContent: string): boolean {
    try {
        // Parse the YAML content
        const parsedYml: any = yaml.load(fileContent);

        // Check if 'kind' field exists and equals 'Config'
        if (!parsedYml || typeof parsedYml !== 'object') {
            throw new Error('Invalid YAML format: must be a valid YAML object');
        }

        if (!parsedYml.kind) {
            throw new Error('Invalid kubeconfig file: missing "kind" field');
        }

        if (parsedYml.kind !== 'Config') {
            throw new Error(`Invalid kubeconfig file: "kind" must be "Config", but got "${parsedYml.kind}"`);
        }

        // Validate base64 encoded fields in clusters (if present)
        if (parsedYml.clusters && Array.isArray(parsedYml.clusters)) {
            for (let i = 0; i < parsedYml.clusters.length; i++) {
                const cluster = parsedYml.clusters[i];
                if (cluster.cluster && cluster.cluster['certificate-authority-data']) {
                    const certData = cluster.cluster['certificate-authority-data'];
                    // Skip validation for placeholder values
                    if (certData.startsWith('<') && certData.endsWith('>')) {
                        throw new Error(`Please replace placeholder "${certData}" with actual certificate data in clusters[${i}]`);
                    }
                    if (!isValidBase64(certData)) {
                        throw new Error(`Invalid base64 data in clusters[${i}].cluster.certificate-authority-data`);
                    }
                }
            }
        }

        // Validate base64 encoded fields in users (if present)
        if (parsedYml.users && Array.isArray(parsedYml.users)) {
            for (let i = 0; i < parsedYml.users.length; i++) {
                const user = parsedYml.users[i];
                if (user.user) {
                    // Check for placeholder values in token
                    if (user.user['token']) {
                        const token = user.user['token'];
                        if (token.startsWith('<') && token.endsWith('>')) {
                            throw new Error(`Please replace placeholder "${token}" with actual token in users[${i}]`);
                        }
                    }

                    if (user.user['client-certificate-data']) {
                        const certData = user.user['client-certificate-data'];
                        if (certData.startsWith('<') && certData.endsWith('>')) {
                            throw new Error(`Please replace placeholder "${certData}" with actual certificate data in users[${i}]`);
                        }
                        if (!isValidBase64(certData)) {
                            throw new Error(`Invalid base64 data in users[${i}].user.client-certificate-data`);
                        }
                    }
                    if (user.user['client-key-data']) {
                        const keyData = user.user['client-key-data'];
                        if (keyData.startsWith('<') && keyData.endsWith('>')) {
                            throw new Error(`Please replace placeholder "${keyData}" with actual key data in users[${i}]`);
                        }
                        if (!isValidBase64(keyData)) {
                            throw new Error(`Invalid base64 data in users[${i}].user.client-key-data`);
                        }
                    }
                }
            }
        }

        return true;
    } catch (error: any) {
        // If it's a YAML parsing error
        if (error.name === 'YAMLException') {
            throw new Error(`YAML parsing error: ${error.message}`);
        }
        // Re-throw validation errors
        throw error;
    }
}
