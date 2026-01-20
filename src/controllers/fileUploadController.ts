import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { Client } from "ssh2";

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, "../../uploads/terminal-uploads");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Preserve original filename with timestamp to avoid conflicts
        const timestamp = Date.now();
        const originalName = file.originalname;
        cb(null, `${timestamp}-${originalName}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB limit - increased for large files
    }
});

export class FileUploadController {
    /**
     * Upload file and transfer to remote server via SCP
     * POST /api/v1/terminal/upload
     * Body: multipart/form-data with file, ip, username, sshKey, remotePath
     */
    static uploadMiddleware = upload.single('file');

    static async uploadToServer(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            if (!req.file) {
                return res.status(400).send({ success: false, message: "No file uploaded" });
            }

            const { ip, username, sshKey, remotePath } = req.body;

            if (!ip || !username || !sshKey || !remotePath) {
                // Clean up uploaded file
                fs.unlinkSync(req.file.path);
                return res.status(400).send({
                    success: false,
                    message: "Missing required fields: ip, username, sshKey, remotePath"
                });
            }

            const localFilePath = req.file.path;
            const remoteFilePath = remotePath.endsWith('/')
                ? `${remotePath}${req.file.originalname}`
                : remotePath;

            console.log(`[FileUpload] Starting upload of ${req.file.originalname} to ${ip}:${remoteFilePath}`);
            console.log(`[FileUpload] Local file path: ${localFilePath}`);
            console.log(`[FileUpload] File size: ${req.file.size} bytes`);
            console.log(`[FileUpload] SSH Key length: ${sshKey.length} chars`);
            console.log(`[FileUpload] SSH Key preview: ${sshKey.substring(0, 100)}...`);

            // Check if sshKey is a file path or actual key content
            let sshKeyContent = sshKey;

            // If it looks like a file path (starts with / or ./ or contains .pem), try to read it
            if (sshKey.startsWith('/') || sshKey.startsWith('./') || sshKey.endsWith('.pem') || sshKey.includes('ssh-key/')) {
                console.log(`[FileUpload] SSH key appears to be a file path, attempting to read: ${sshKey}`);
                try {
                    if (fs.existsSync(sshKey)) {
                        sshKeyContent = fs.readFileSync(sshKey, 'utf-8');
                        console.log(`[FileUpload] Successfully read SSH key from file, length: ${sshKeyContent.length} chars`);
                    } else {
                        console.error(`[FileUpload] SSH key file not found: ${sshKey}`);
                        fs.unlinkSync(localFilePath);
                        return res.status(400).send({
                            success: false,
                            message: "SSH key file not found: " + sshKey
                        });
                    }
                } catch (readError: any) {
                    console.error(`[FileUpload] Error reading SSH key file:`, readError);
                    fs.unlinkSync(localFilePath);
                    return res.status(400).send({
                        success: false,
                        message: "Failed to read SSH key file: " + readError.message
                    });
                }
            } else if (!sshKey.includes('BEGIN') || !sshKey.includes('PRIVATE KEY')) {
                console.error(`[FileUpload] SSH key doesn't appear to be valid PEM format`);
                fs.unlinkSync(localFilePath);
                return res.status(400).send({
                    success: false,
                    message: "SSH key must be in PEM format (BEGIN...PRIVATE KEY)"
                });
            }

            // Validate remote path exists before upload
            console.log(`[FileUpload] Validating remote path: ${remotePath}`);
            const pathValidation = await FileUploadController.validateRemotePath(
                remotePath,
                ip,
                username,
                sshKeyContent
            );

            if (!pathValidation.success) {
                console.error(`[FileUpload] Remote path validation failed: ${pathValidation.error}`);
                fs.unlinkSync(localFilePath);
                return res.status(400).send({
                    success: false,
                    message: pathValidation.error || "Remote path does not exist or is not accessible"
                });
            }

            console.log(`[FileUpload] Remote path validated successfully`);

            // Transfer file via SCP
            const result = await FileUploadController.scpUpload(
                localFilePath,
                remoteFilePath,
                ip,
                username,
                sshKeyContent  // Use the actual key content, not the path
            );

            console.log(`[FileUpload] SCP result:`, result);

            // Clean up local file after upload
            if (fs.existsSync(localFilePath)) {
                fs.unlinkSync(localFilePath);
                console.log(`[FileUpload] Cleaned up local file: ${localFilePath}`);
            }

            if (result.success) {
                console.log(`[FileUpload] Successfully uploaded to ${ip}:${remoteFilePath}`);
                res.send({
                    success: true,
                    message: "File uploaded successfully",
                    data: {
                        originalName: req.file.originalname,
                        size: req.file.size,
                        remotePath: remoteFilePath,
                        server: ip
                    }
                });
            } else {
                console.error(`[FileUpload] Upload failed: ${result.error}`);
                res.status(500).send({
                    success: false,
                    message: "File upload failed",
                    error: result.error
                });
            }
        } catch (err: any) {
            console.error('[FileUpload] Error:', err);
            // Clean up file if it exists
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            next(err);
        }
    }

    /**
     * Validate that remote path exists and is accessible
     */
    private static validateRemotePath(
        remotePath: string,
        host: string,
        username: string,
        privateKey: string
    ): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            const conn = new Client();
            let isResolved = false;

            // Timeout after 30 seconds for path validation
            const timeout = setTimeout(() => {
                if (!isResolved) {
                    isResolved = true;
                    console.error('[PathValidation] Validation timeout');
                    conn.end();
                    resolve({ success: false, error: 'Connection timeout while validating path' });
                }
            }, 30000);

            conn.on('ready', () => {
                console.log('[PathValidation] SSH connection established');

                // Determine the directory to check
                // If path ends with /, it's a directory
                // Otherwise, check if parent directory exists
                const dirToCheck = remotePath.endsWith('/')
                    ? remotePath.slice(0, -1)  // Remove trailing slash
                    : remotePath.substring(0, remotePath.lastIndexOf('/')) || '/';

                console.log(`[PathValidation] Checking if directory exists: ${dirToCheck}`);

                // Execute combined command to check existence and write permission
                const command = `test -d "${dirToCheck}" && test -w "${dirToCheck}" && echo "VALID" || (test -d "${dirToCheck}" && echo "NO_WRITE" || echo "NOT_EXISTS")`;

                conn.exec(command, (err, stream) => {
                    if (err) {
                        clearTimeout(timeout);
                        if (!isResolved) {
                            isResolved = true;
                            console.error('[PathValidation] Exec error:', err);
                            conn.end();
                            resolve({ success: false, error: err.message });
                        }
                        return;
                    }

                    let output = '';

                    stream.on('data', (data: Buffer) => {
                        output += data.toString();
                    });

                    stream.on('close', (code: number) => {
                        clearTimeout(timeout);
                        if (!isResolved) {
                            isResolved = true;
                            conn.end();

                            const trimmedOutput = output.trim();
                            console.log(`[PathValidation] Command output: "${trimmedOutput}", exit code: ${code}`);

                            if (trimmedOutput === 'VALID') {
                                resolve({ success: true });
                            } else if (trimmedOutput === 'NO_WRITE') {
                                resolve({
                                    success: false,
                                    error: `Directory '${dirToCheck}' exists but you don't have write permission`
                                });
                            } else {
                                resolve({
                                    success: false,
                                    error: `Directory '${dirToCheck}' does not exist. Please create it first or specify a valid path.`
                                });
                            }
                        }
                    });

                    stream.stderr.on('data', (data: Buffer) => {
                        console.error('[PathValidation] stderr:', data.toString());
                    });
                });
            });

            conn.on('error', (err) => {
                clearTimeout(timeout);
                if (!isResolved) {
                    isResolved = true;
                    console.error('[PathValidation] Connection error:', err);
                    resolve({ success: false, error: `Cannot connect to server: ${err.message}` });
                }
            });

            console.log(`[PathValidation] Connecting to ${username}@${host}`);

            try {
                conn.connect({
                    host,
                    username,
                    privateKey,
                    port: 22,
                    readyTimeout: 30000
                });
            } catch (err: any) {
                clearTimeout(timeout);
                if (!isResolved) {
                    isResolved = true;
                    console.error('[PathValidation] Connection setup error:', err);
                    resolve({ success: false, error: err.message || 'Failed to establish SSH connection' });
                }
            }
        });
    }

    /**
     * Upload file via SCP using ssh2
     */
    private static scpUpload(
        localPath: string,
        remotePath: string,
        host: string,
        username: string,
        privateKey: string
    ): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            const conn = new Client();
            let isResolved = false;

            // Timeout after 10 minutes (600 seconds) to allow large file uploads
            const timeout = setTimeout(() => {
                if (!isResolved) {
                    isResolved = true;
                    console.error('[SCP] Connection timeout after 10 minutes');
                    conn.end();
                    resolve({ success: false, error: 'Connection timeout after 10 minutes. Check server connectivity and SSH key.' });
                }
            }, 600000);

            conn.on('ready', () => {
                console.log('[SCP] SSH connection established');

                // Read local file
                const fileContent = fs.readFileSync(localPath);
                console.log(`[SCP] Read local file, size: ${fileContent.length} bytes`);

                // Use SFTP to upload file
                conn.sftp((err, sftp) => {
                    if (err) {
                        clearTimeout(timeout);
                        if (!isResolved) {
                            isResolved = true;
                            console.error('[SCP] SFTP error:', err);
                            conn.end();
                            return resolve({ success: false, error: err.message });
                        }
                        return;
                    }

                    console.log(`[SCP] SFTP session created, writing to: ${remotePath}`);

                    // Create write stream
                    const writeStream = sftp.createWriteStream(remotePath);

                    writeStream.on('close', () => {
                        clearTimeout(timeout);
                        if (!isResolved) {
                            isResolved = true;
                            console.log('[SCP] File uploaded successfully');
                            conn.end();
                            resolve({ success: true });
                        }
                    });

                    writeStream.on('error', (error: any) => {
                        clearTimeout(timeout);
                        if (!isResolved) {
                            isResolved = true;
                            console.error('[SCP] Write error:', error);
                            conn.end();
                            resolve({ success: false, error: error.message });
                        }
                    });

                    writeStream.on('finish', () => {
                        console.log('[SCP] Write stream finished');
                    });

                    // Write file content
                    console.log(`[SCP] Starting write of ${fileContent.length} bytes`);
                    writeStream.write(fileContent);
                    writeStream.end();
                    console.log('[SCP] Write stream ended');
                });
            });

            conn.on('error', (err) => {
                clearTimeout(timeout);
                if (!isResolved) {
                    isResolved = true;
                    console.error('[SCP] Connection error:', err);
                    console.error('[SCP] Error details:', JSON.stringify(err, null, 2));
                    resolve({ success: false, error: err.message || 'SSH connection failed' });
                }
            });

            console.log(`[SCP] Connecting to ${username}@${host}`);
            console.log(`[SCP] Private key starts with: ${privateKey.substring(0, 50)}...`);

            // Validate SSH key format
            if (!privateKey || privateKey.trim().length === 0) {
                clearTimeout(timeout);
                console.error('[SCP] SSH key is empty or undefined');
                return resolve({ success: false, error: 'SSH key is empty' });
            }

            // Check if key is in correct format
            const keyHeader = privateKey.trim().split('\n')[0];
            console.log(`[SCP] Key header: ${keyHeader}`);

            if (!keyHeader.includes('BEGIN') || !keyHeader.includes('PRIVATE KEY')) {
                clearTimeout(timeout);
                console.error('[SCP] Invalid SSH key format - missing BEGIN PRIVATE KEY header');
                return resolve({ success: false, error: 'Invalid SSH key format. Key must start with -----BEGIN ... PRIVATE KEY-----' });
            }

            try {
                const connectConfig: any = {
                    host,
                    username,
                    privateKey,
                    port: 22,
                    readyTimeout: 60000, // 60 seconds to establish connection
                    keepaliveInterval: 30000, // Send keepalive every 30 seconds
                    keepaliveCountMax: 20, // Allow 20 missed keepalives (10 minutes total)
                    debug: (info: string) => {
                        console.log('[SCP Debug]', info);
                    }
                };

                console.log('[SCP] Attempting connection with config:', {
                    host: connectConfig.host,
                    username: connectConfig.username,
                    port: connectConfig.port,
                    readyTimeout: connectConfig.readyTimeout,
                    keyLength: privateKey.length
                });

                conn.connect(connectConfig);
            } catch (err: any) {
                clearTimeout(timeout);
                if (!isResolved) {
                    isResolved = true;
                    console.error('[SCP] Connection setup error:', err);
                    resolve({ success: false, error: err.message || 'Failed to establish SSH connection' });
                }
            }
        });
    }

    /**
     * List files in uploads directory
     * GET /api/v1/terminal/uploads
     */
    static async listUploads(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            const uploadDir = path.join(__dirname, "../../uploads/terminal-uploads");

            if (!fs.existsSync(uploadDir)) {
                return res.send({ success: true, files: [] });
            }

            const files = fs.readdirSync(uploadDir).map(filename => {
                const filePath = path.join(uploadDir, filename);
                const stats = fs.statSync(filePath);

                return {
                    name: filename,
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime
                };
            });

            res.send({
                success: true,
                count: files.length,
                files
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Download file from remote server
     * POST /api/v1/terminal/download
     * Body: { ip, username, sshKey, remotePath, localPath }
     */
    static async downloadFromServer(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            const { ip, username, sshKey, remotePath, localFilename } = req.body;

            if (!ip || !username || !sshKey || !remotePath) {
                return res.status(400).send({
                    success: false,
                    message: "Missing required fields: ip, username, sshKey, remotePath"
                });
            }

            const downloadDir = path.join(__dirname, "../../uploads/terminal-downloads");
            if (!fs.existsSync(downloadDir)) {
                fs.mkdirSync(downloadDir, { recursive: true });
            }

            const filename = localFilename || path.basename(remotePath);
            const localPath = path.join(downloadDir, `${Date.now()}-${filename}`);

            console.log(`[FileDownload] Downloading ${remotePath} from ${ip}`);

            const result = await FileUploadController.scpDownload(
                remotePath,
                localPath,
                ip,
                username,
                sshKey
            );

            if (result.success) {
                // Send file to client
                res.download(localPath, filename, (err) => {
                    // Clean up file after download
                    if (fs.existsSync(localPath)) {
                        fs.unlinkSync(localPath);
                    }

                    if (err) {
                        console.error('[FileDownload] Send error:', err);
                    }
                });
            } else {
                res.status(500).send({
                    success: false,
                    message: "File download failed",
                    error: result.error
                });
            }
        } catch (err) {
            next(err);
        }
    }

    /**
     * List files in remote directory
     * POST /api/v1/terminal/list-files
     * Body: { ip, username, sshKey, path }
     */
    static async listRemoteFiles(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            const { ip, username, sshKey, path: remotePath } = req.body;

            if (!ip || !username || !sshKey || !remotePath) {
                return res.status(400).send({
                    success: false,
                    message: "Missing required fields: ip, username, sshKey, path"
                });
            }

            // Read SSH key if it's a file path
            let sshKeyContent = sshKey;
            if (sshKey.startsWith('/') || sshKey.startsWith('./') || sshKey.endsWith('.pem') || sshKey.includes('ssh-key/')) {
                try {
                    if (fs.existsSync(sshKey)) {
                        sshKeyContent = fs.readFileSync(sshKey, 'utf-8');
                    }
                } catch (readError: any) {
                    return res.status(400).send({
                        success: false,
                        message: "Failed to read SSH key file: " + readError.message
                    });
                }
            }

            console.log(`[ListFiles] Listing files in ${remotePath} on ${ip}`);

            const result = await FileUploadController.executeListCommand(
                remotePath,
                ip,
                username,
                sshKeyContent
            );

            if (result.success && result.files) {
                res.send({
                    success: true,
                    path: remotePath,
                    files: result.files
                });
            } else {
                res.status(500).send({
                    success: false,
                    message: "Failed to list files",
                    error: result.error
                });
            }
        } catch (err: any) {
            console.error('[ListFiles] Error:', err);
            next(err);
        }
    }

    /**
     * Execute ls command on remote server and parse output
     */
    private static executeListCommand(
        remotePath: string,
        host: string,
        username: string,
        privateKey: string
    ): Promise<{ success: boolean; files?: any[]; error?: string }> {
        return new Promise((resolve) => {
            const conn = new Client();
            let isResolved = false;

            const timeout = setTimeout(() => {
                if (!isResolved) {
                    isResolved = true;
                    conn.end();
                    resolve({ success: false, error: 'Connection timeout' });
                }
            }, 30000);

            conn.on('ready', () => {
                // Use ls -lAh --time-style=long-iso for consistent parsing
                const command = `ls -lAh --time-style=long-iso "${remotePath}" 2>&1 || echo "ERROR_LISTING"`;

                conn.exec(command, (err, stream) => {
                    if (err) {
                        clearTimeout(timeout);
                        if (!isResolved) {
                            isResolved = true;
                            conn.end();
                            resolve({ success: false, error: err.message });
                        }
                        return;
                    }

                    let output = '';

                    stream.on('data', (data: Buffer) => {
                        output += data.toString();
                    });

                    stream.on('close', () => {
                        clearTimeout(timeout);
                        if (!isResolved) {
                            isResolved = true;
                            conn.end();

                            if (output.includes('ERROR_LISTING') || output.includes('cannot access') || output.includes('No such file')) {
                                resolve({ success: false, error: 'Path does not exist or permission denied' });
                                return;
                            }

                            // Parse ls output
                            const files = FileUploadController.parseListOutput(output);
                            resolve({ success: true, files });
                        }
                    });

                    stream.stderr.on('data', (data: Buffer) => {
                        console.error('[ListFiles] stderr:', data.toString());
                    });
                });
            });

            conn.on('error', (err) => {
                clearTimeout(timeout);
                if (!isResolved) {
                    isResolved = true;
                    resolve({ success: false, error: err.message });
                }
            });

            try {
                conn.connect({
                    host,
                    username,
                    privateKey,
                    port: 22,
                    readyTimeout: 30000
                });
            } catch (err: any) {
                clearTimeout(timeout);
                if (!isResolved) {
                    isResolved = true;
                    resolve({ success: false, error: err.message });
                }
            }
        });
    }

    /**
     * Parse ls -lAh output into structured file objects
     */
    private static parseListOutput(output: string): any[] {
        const lines = output.split('\n').filter(line => line.trim().length > 0);
        const files: any[] = [];

        for (const line of lines) {
            // Skip total line
            if (line.startsWith('total')) continue;

            // Parse ls -lAh --time-style=long-iso format:
            // drwxr-xr-x 2 user group  4.0K 2024-01-20 10:30 dirname
            // -rw-r--r-- 1 user group  1.2M 2024-01-20 10:30 filename.txt
            const match = line.match(/^([dlbcsp-])([-rwxsStT]{9})\s+(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+(.+)$/);

            if (match) {
                const [, type, permissions, , owner, group, size, date, time, name] = match;

                // Skip . and ..
                if (name === '.' || name === '..') continue;

                files.push({
                    name,
                    type: type === 'd' ? 'directory' : type === 'l' ? 'symlink' : 'file',
                    permissions: type + permissions,
                    owner,
                    group,
                    size,
                    modified: `${date} ${time}`,
                    isDirectory: type === 'd',
                    isSymlink: type === 'l'
                });
            }
        }

        return files;
    }

    /**
     * Download file via SCP using ssh2
     */
    private static scpDownload(
        remotePath: string,
        localPath: string,
        host: string,
        username: string,
        privateKey: string
    ): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            const conn = new Client();

            conn.on('ready', () => {
                console.log('[SCP] SSH connection established for download');

                conn.sftp((err, sftp) => {
                    if (err) {
                        console.error('[SCP] SFTP error:', err);
                        conn.end();
                        return resolve({ success: false, error: err.message });
                    }

                    const readStream = sftp.createReadStream(remotePath);
                    const writeStream = fs.createWriteStream(localPath);

                    readStream.on('error', (error: any) => {
                        console.error('[SCP] Read error:', error);
                        conn.end();
                        resolve({ success: false, error: error.message });
                    });

                    writeStream.on('error', (error: any) => {
                        console.error('[SCP] Write error:', error);
                        conn.end();
                        resolve({ success: false, error: error.message });
                    });

                    writeStream.on('close', () => {
                        console.log('[SCP] File downloaded successfully');
                        conn.end();
                        resolve({ success: true });
                    });

                    readStream.pipe(writeStream);
                });
            });

            conn.on('error', (err) => {
                console.error('[SCP] Connection error:', err);
                resolve({ success: false, error: err.message });
            });

            conn.connect({
                host,
                username,
                privateKey
            });
        });
    }
}
