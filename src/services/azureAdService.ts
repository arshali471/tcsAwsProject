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
     * Get user's Azure AD group memberships
     * Returns list of group display names
     */
    static async getUserGroups(accessToken: string) {
        try {
            const response = await axios.get<{ value: any[] }>('https://graph.microsoft.com/v1.0/me/memberOf', {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            const groups = response.data.value || [];
            const groupNames = groups
                .filter((group: any) => group['@odata.type'] === '#microsoft.graph.group')
                .map((group: any) => group.displayName);

            console.log('[Azure AD] User groups:', groupNames);
            return groupNames;
        } catch (error: any) {
            console.error('[Azure AD] Failed to fetch user groups:', error.response?.data || error.message);
            return [];
        }
    }

    /**
     * Check if user is an admin based on Azure AD group membership
     * Returns true if user belongs to Iff_cloud_admins group
     */
    static isAdminUser(groups: string[]): boolean {
        const adminGroup = 'Iff_cloud_admins';
        const isAdmin = groups.some(group =>
            group.toLowerCase() === adminGroup.toLowerCase()
        );

        console.log(`[Azure AD] User is admin: ${isAdmin} (belongs to ${adminGroup}: ${isAdmin})`);
        return isAdmin;
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
