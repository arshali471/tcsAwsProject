import express from "express";
import { UserSessionService } from "../services/userSessionService";

/**
 * Middleware to update session last activity time
 * This should be applied after authentication middleware
 */
export const sessionActivityMiddleware = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    try {
        // Only update if user is authenticated
        if (req.user) {
            const token = req.headers.authorization?.replace('Bearer ', '');

            if (token) {
                // Update session activity asynchronously (don't await to avoid blocking requests)
                UserSessionService.updateActivity(token).catch((error) => {
                    console.error('[SessionActivity] Error updating activity:', error);
                });
            }
        }

        next();
    } catch (error) {
        // Don't block request if session update fails
        console.error('[SessionActivity] Middleware error:', error);
        next();
    }
};
