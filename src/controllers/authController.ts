import express from "express";
import { AzureAdService } from "../services/azureAdService";
import { UserService } from "../services/userService";
import { Utility } from "../util/util";
import { CONFIG } from "../config/environment";
import { UserSessionService } from "../services/userSessionService";

export class AuthController {
    /**
     * Handle Microsoft OAuth callback
     * POST /api/v1/auth/microsoft/callback
     * Body: { accessToken: string }
     */
    static async microsoftCallback(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            const { accessToken } = req.body;

            if (!accessToken) {
                return res.status(400).send("Access token is required");
            }

            // Validate token with Microsoft Graph
            const validation = await AzureAdService.validateAccessToken(accessToken);

            if (!validation.valid || !validation.profile) {
                return res.status(401).send(validation.error || "Invalid Microsoft token");
            }

            const { azureOid, email, displayName, jobTitle, department } = validation.profile;

            // Fetch user's Azure AD groups
            const userGroups = await AzureAdService.getUserGroups(accessToken);

            // Check if user belongs to admin group
            const isAdmin = AzureAdService.isAdminUser(userGroups);

            // Check if user exists by Azure OID
            let user = await UserService.getUserByAzureOid(azureOid);

            if (!user) {
                // Check if user exists by email (link accounts)
                const existingUser = await UserService.getUserByEmail(email);

                if (existingUser) {
                    // Link existing account to Azure AD and update admin status based on group
                    user = await UserService.updateUser(String(existingUser._id), {
                        ssoProvider: 'azure',
                        azureOid,
                        displayName,
                        department,
                        jobTitle,
                        admin: isAdmin,
                        addUser: isAdmin,
                        addAWSKey: isAdmin,
                        addDocument: isAdmin,
                        lastLogin: new Date()
                    });
                    console.log(`[Auth] Linked existing user ${email} to Azure AD (Admin: ${isAdmin})`);
                } else {
                    // Auto-provision new user with admin access based on AD group
                    const username = email.split('@')[0];

                    user = await UserService.createSSOUser({
                        email,
                        username,
                        displayName,
                        azureOid,
                        department,
                        jobTitle,
                        ssoProvider: 'azure',
                        admin: isAdmin,
                        addUser: isAdmin,
                        addAWSKey: isAdmin,
                        addDocument: isAdmin
                    });
                    console.log(`[Auth] Auto-provisioned new SSO user: ${email} (Admin: ${isAdmin})`);
                }
            } else {
                // Update last login and admin status (in case group membership changed)
                await UserService.updateUser(String(user._id), {
                    admin: isAdmin,
                    addUser: isAdmin,
                    addAWSKey: isAdmin,
                    addDocument: isAdmin,
                    lastLogin: new Date()
                });
                console.log(`[Auth] Updated user ${email} admin status: ${isAdmin}`);
            }

            if (!user) {
                return res.status(500).send("Failed to create or retrieve user");
            }

            if (!user.isActive) {
                return res.status(403).send("User account is disabled");
            }

            // Generate JWT token (same as traditional login)
            const token = Utility.generateJwtToken(String(user._id));

            // Create session record
            try {
                await UserSessionService.createSession(user, token, req);
            } catch (sessionError) {
                console.error('[Auth] Error creating session:', sessionError);
                // Continue with login even if session creation fails
            }

            res.send({
                token,
                username: user.username,
                email: user.email,
                admin: user.admin || false,
                addUser: user.addUser || false,
                addAWSKey: user.addAWSKey || false,
                addDocument: user.addDocument || false,
                displayName: user.displayName,
                ssoProvider: 'azure'
            });
        } catch (err) {
            console.error('[Auth] Microsoft callback error:', err);
            next(err);
        }
    }

    /**
     * Get Azure AD configuration for frontend
     * GET /api/v1/auth/azure/config
     */
    static async getAzureConfig(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            const { clientId, tenantId, redirectUri } = CONFIG.azure;

            if (!clientId || !tenantId) {
                return res.send({
                    enabled: false,
                    message: 'Azure AD SSO is not configured'
                });
            }

            res.send({
                enabled: true,
                clientId,
                tenantId,
                authority: `https://login.microsoftonline.com/${tenantId}`,
                redirectUri,
                scopes: ['User.Read']
            });
        } catch (err) {
            next(err);
        }
    }
}
