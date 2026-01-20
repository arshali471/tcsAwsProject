import express from 'express';
import { ApiLogsDao } from '../lib/dao/apiLogs.dao';

export function apiLoggingMiddleware() {
    return async function (req: express.Request, res: express.Response, next: express.NextFunction) {
        const startTime = Date.now();

        // Skip logging for health check and certain routes
        const skipRoutes = ['/healthCheck', '/api/v1/api-logs'];
        const fullPath = req.originalUrl || req.url;
        if (skipRoutes.some(route => fullPath.startsWith(route))) {
            return next();
        }

        // Store original functions
        const originalSend = res.send;
        const originalJson = res.json;

        let responseData: any = null;

        // Override res.json
        res.json = function (data: any): express.Response {
            responseData = data;
            return originalJson.call(this, data);
        };

        // Override res.send
        res.send = function (data: any): express.Response {
            if (!responseData) {
                responseData = data;
            }
            return originalSend.call(this, data);
        };

        // Listen for response finish event
        res.on('finish', async () => {
            const responseTime = Date.now() - startTime;

            // Log API request asynchronously (don't wait for it)
            setImmediate(async () => {
                try {
                    const logData: any = {
                        method: req.method,
                        endpoint: fullPath.split('?')[0], // Remove query params
                        statusCode: res.statusCode,
                        responseTime,
                        ipAddress: req.ip || req.socket.remoteAddress || req.headers['x-forwarded-for'],
                        userAgent: req.get('user-agent'),
                    };

                    // Add user information if available
                    if (req.user) {
                        logData.userId = (req.user as any)._id;
                        logData.username = (req.user as any).username;
                    }

                    // Optionally log request body for POST/PUT/PATCH (be careful with sensitive data)
                    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
                        // Filter out sensitive fields
                        const filteredBody = filterSensitiveData(req.body);
                        if (Object.keys(filteredBody).length > 0) {
                            logData.requestBody = filteredBody;
                        }
                    }

                    // Log error messages for failed requests
                    if (res.statusCode >= 400 && responseData) {
                        try {
                            const parsedData = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
                            logData.errorMessage = parsedData.message || parsedData.error || 'Unknown error';
                        } catch (e) {
                            logData.errorMessage = String(responseData).substring(0, 500);
                        }
                    }

                    await ApiLogsDao.createLog(logData);
                } catch (error) {
                    console.error('Error logging API request:', error);
                }
            });
        });

        next();
    };
}

// Helper function to filter sensitive data
function filterSensitiveData(obj: any): any {
    if (!obj || typeof obj !== 'object') {
        return {};
    }

    const sensitiveFields = [
        'password',
        'token',
        'secret',
        'apiKey',
        'accessKey',
        'secretKey',
        'creditCard',
        'ssn',
        'authorization'
    ];

    const filtered: any = {};

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const lowerKey = key.toLowerCase();

            // Skip sensitive fields
            if (sensitiveFields.some(field => lowerKey.includes(field))) {
                filtered[key] = '[REDACTED]';
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                // Recursively filter nested objects
                filtered[key] = filterSensitiveData(obj[key]);
            } else {
                filtered[key] = obj[key];
            }
        }
    }

    return filtered;
}
