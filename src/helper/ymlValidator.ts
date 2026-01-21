import * as yaml from 'js-yaml';

/**
 * Validates if the uploaded YML file contains 'kind: Config'
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
