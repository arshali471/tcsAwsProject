export function normalizePort(val: number | string): number | string | boolean {
    const port: number = (typeof val === 'string') ? parseInt(val, 10) : val;

    if (isNaN(port)) {
        return val;
    }
    if (port >= 0) {
        return port;
    }

    return false;
}

export function onError(error: NodeJS.ErrnoException, port: number | string | boolean): void {
    if (error.syscall !== 'listen') {
        throw error;
    }

    const bind: string = (typeof port === 'string') ? 'Pipe ' + port : 'Port ' + port;

    switch (error.code) {
        case 'EACCES':
            console.log(`${bind} requires elevated privileges`);
            process.exit(1);
        case 'EADDRINUSE':
            console.log(`${bind} is already in use`);
            process.exit(1);
        default:
            throw error;
    }
}