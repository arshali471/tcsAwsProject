import axios from 'axios';
import { CONFIG } from '../config/environment';

export class AzureAdService {
    /**
     * Validate Microsoft access token by calling Microsoft Graph
     * Returns user profile if valid
     */
    static async validateAccessToken(accessToken: string) {
        try {
            const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            const userData: any = response.data;

            return {
                valid: true,
                profile: {
                    azureOid: userData.id,
                    email: userData.mail || userData.userPrincipalName,
                    displayName: userData.displayName,
                    jobTitle: userData.jobTitle,
                    department: userData.department,
                },
            };
        } catch (error: any) {
            console.error('[Azure AD] Token validation failed:', error.response?.data || error.message);
            return {
                valid: false,
                profile: null,
                error: error.response?.data?.error?.message || 'Invalid token',
            };
        }
    }

    /**
     * Validate configuration on startup
     */
    static validateConfig() {
        const { clientId, tenantId, clientSecret } = CONFIG.azure;

        if (!clientId || !tenantId) {
            console.warn('[Azure AD] SSO not configured. Set AZURE_CLIENT_ID and AZURE_TENANT_ID environment variables.');
            return false;
        }

        if (!clientSecret || clientSecret === 'your-azure-client-secret-here') {
            console.warn('[Azure AD] Client secret not configured. SSO will work but with limited functionality.');
        }

        console.log('[Azure AD] SSO configured successfully');
        return true;
    }
}
