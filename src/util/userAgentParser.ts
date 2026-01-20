export class UserAgentParser {
    /**
     * Parse user agent string to extract device, browser, and OS information
     */
    static parse(userAgent: string) {
        const ua = userAgent.toLowerCase();

        return {
            deviceType: this.getDeviceType(ua),
            browser: this.getBrowser(ua),
            os: this.getOS(ua)
        };
    }

    private static getDeviceType(ua: string): string {
        if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
            return 'tablet';
        }
        if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
            return 'mobile';
        }
        return 'desktop';
    }

    private static getBrowser(ua: string): string {
        if (ua.includes('edg/') || ua.includes('edge/')) {
            return 'Microsoft Edge';
        }
        if (ua.includes('opr/') || ua.includes('opera')) {
            return 'Opera';
        }
        if (ua.includes('chrome') && !ua.includes('edg')) {
            return 'Google Chrome';
        }
        if (ua.includes('safari') && !ua.includes('chrome')) {
            return 'Safari';
        }
        if (ua.includes('firefox')) {
            return 'Mozilla Firefox';
        }
        if (ua.includes('trident') || ua.includes('msie')) {
            return 'Internet Explorer';
        }
        return 'Unknown';
    }

    private static getOS(ua: string): string {
        if (ua.includes('windows nt 10.0')) {
            return 'Windows 10';
        }
        if (ua.includes('windows nt 6.3')) {
            return 'Windows 8.1';
        }
        if (ua.includes('windows nt 6.2')) {
            return 'Windows 8';
        }
        if (ua.includes('windows nt 6.1')) {
            return 'Windows 7';
        }
        if (ua.includes('windows')) {
            return 'Windows';
        }
        if (ua.includes('mac os x')) {
            const version = ua.match(/mac os x (\d+[._]\d+)/);
            return version ? `macOS ${version[1].replace('_', '.')}` : 'macOS';
        }
        if (ua.includes('android')) {
            const version = ua.match(/android (\d+(\.\d+)?)/);
            return version ? `Android ${version[1]}` : 'Android';
        }
        if (ua.includes('iphone') || ua.includes('ipad')) {
            const version = ua.match(/os (\d+_\d+)/);
            return version ? `iOS ${version[1].replace('_', '.')}` : 'iOS';
        }
        if (ua.includes('linux')) {
            return 'Linux';
        }
        return 'Unknown';
    }

    /**
     * Get IP address from request
     */
    static getClientIP(req: any): string {
        // Try various headers in order of reliability
        return (
            req.headers['x-forwarded-for']?.split(',')[0] ||
            req.headers['x-real-ip'] ||
            req.headers['cf-connecting-ip'] || // Cloudflare
            req.connection?.remoteAddress ||
            req.socket?.remoteAddress ||
            req.ip ||
            'unknown'
        );
    }
}
