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

                // Get file size for logging
                const stats = fs.statSync(localPath);
                console.log(`[SCP] Local file size: ${Math.round(stats.size / (1024 * 1024))} MB`);

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

                    // Use streaming for large files
                    const readStream = fs.createReadStream(localPath);
                    const writeStream = sftp.createWriteStream(remotePath);

                    let bytesTransferred = 0;
                    readStream.on('data', (chunk: Buffer) => {
                        bytesTransferred += chunk.length;
                        if (bytesTransferred % (50 * 1024 * 1024) === 0) {
                            console.log(`[SCP] Uploaded ${Math.round(bytesTransferred / (1024 * 1024))} MB`);
                        }
                    });

                    writeStream.on('close', () => {
                        clearTimeout(timeout);
                        if (!isResolved) {
                            isResolved = true;
                            console.log(`[SCP] File uploaded successfully (${Math.round(bytesTransferred / (1024 * 1024))} MB)`);
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

                    readStream.on('error', (error: any) => {
                        clearTimeout(timeout);
                        if (!isResolved) {
                            isResolved = true;
                            console.error('[SCP] Read error:', error);
                            conn.end();
                            resolve({ success: false, error: error.message });
                        }
                    });

                    writeStream.on('finish', () => {
                        console.log('[SCP] Write stream finished');
                    });

                    // Pipe read stream to write stream
                    console.log(`[SCP] Starting streaming upload`);
                    readStream.pipe(writeStream);
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
                    readyTimeout: 120000, // 2 minutes to establish connection
                    keepaliveInterval: 10000, // Send keepalive every 10 seconds
                    keepaliveCountMax: 120 // Allow up to 20 minutes of inactivity (120 * 10s)
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

                            // Parse ls output with base path for full file paths
                            const files = FileUploadController.parseListOutput(output, remotePath);
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
    private static parseListOutput(output: string, basePath: string = ''): any[] {
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

                // Construct full path
                const fullPath = basePath.endsWith('/')
                    ? `${basePath}${name}`
                    : `${basePath}/${name}`;

                files.push({
                    name,
                    path: fullPath, // Add full path for file selection
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
            let resolved = false;

            const cleanup = (success: boolean, error?: string) => {
                if (!resolved) {
                    resolved = true;
                    conn.end();
                    resolve({ success, error });
                }
            };

            conn.on('ready', () => {
                console.log('[SCP] SSH connection established for download');

                conn.sftp((err, sftp) => {
                    if (err) {
                        console.error('[SCP] SFTP error:', err);
                        return cleanup(false, err.message);
                    }

                    const readStream = sftp.createReadStream(remotePath);
                    const writeStream = fs.createWriteStream(localPath);

                    let bytesTransferred = 0;
                    readStream.on('data', (chunk: Buffer) => {
                        bytesTransferred += chunk.length;
                        if (bytesTransferred % (50 * 1024 * 1024) === 0) {
                            console.log(`[SCP] Downloaded ${Math.round(bytesTransferred / (1024 * 1024))} MB`);
                        }
                    });

                    readStream.on('error', (error: any) => {
                        console.error('[SCP] Read error:', error);
                        cleanup(false, error.message);
                    });

                    writeStream.on('error', (error: any) => {
                        console.error('[SCP] Write error:', error);
                        cleanup(false, error.message);
                    });

                    writeStream.on('close', () => {
                        console.log(`[SCP] File downloaded successfully (${Math.round(bytesTransferred / (1024 * 1024))} MB)`);
                        cleanup(true);
                    });

                    readStream.pipe(writeStream);
                });
            });

            conn.on('error', (err) => {
                console.error('[SCP] Connection error:', err);
                cleanup(false, err.message);
            });

            conn.on('timeout', () => {
                console.error('[SCP] Connection timeout');
                cleanup(false, 'Connection timeout');
            });

            conn.connect({
                host,
                username,
                privateKey,
                port: 22,
                readyTimeout: 120000,
                keepaliveInterval: 10000,
                keepaliveCountMax: 120
            });
        });
    }

    /**
     * Download a directory from remote server by creating tar.gz archive
     */
    private static scpDownloadDirectory(
        remotePath: string,
        localArchivePath: string,
        host: string,
        username: string,
        privateKey: string
    ): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            const conn = new Client();
            const dirName = path.basename(remotePath);
            const parentDir = path.dirname(remotePath);
            let resolved = false;

            const cleanup = (success: boolean, error?: string) => {
                if (!resolved) {
                    resolved = true;
                    conn.end();
                    resolve({ success, error });
                }
            };

            conn.on('ready', () => {
                console.log('[SCP] SSH connection established for directory download');

                // Create tar.gz archive on remote server and download it
                const tarCommand = `cd ${parentDir} && tar -czf /tmp/${dirName}.tar.gz ${dirName}`;

                conn.exec(tarCommand, (err, stream) => {
                    if (err) {
                        console.error('[SCP] Error creating archive:', err);
                        return cleanup(false, err.message);
                    }

                    stream.on('close', (code: number) => {
                        if (code !== 0) {
                            console.error('[SCP] Archive creation failed with code:', code);
                            return cleanup(false, `tar command failed with code ${code}`);
                        }

                        console.log('[SCP] Archive created, downloading...');

                        // Download the archive
                        conn.sftp((sftpErr, sftp) => {
                            if (sftpErr) {
                                console.error('[SCP] SFTP error:', sftpErr);
                                return cleanup(false, sftpErr.message);
                            }

                            const remoteArchive = `/tmp/${dirName}.tar.gz`;
                            const readStream = sftp.createReadStream(remoteArchive);
                            const writeStream = fs.createWriteStream(localArchivePath);

                            let bytesTransferred = 0;
                            readStream.on('data', (chunk: Buffer) => {
                                bytesTransferred += chunk.length;
                                // Log progress for large files
                                if (bytesTransferred % (10 * 1024 * 1024) === 0) {
                                    console.log(`[SCP] Downloaded ${Math.round(bytesTransferred / (1024 * 1024))} MB`);
                                }
                            });

                            readStream.on('error', (error: any) => {
                                console.error('[SCP] Read error:', error);
                                cleanup(false, error.message);
                            });

                            writeStream.on('error', (error: any) => {
                                console.error('[SCP] Write error:', error);
                                cleanup(false, error.message);
                            });

                            writeStream.on('close', () => {
                                console.log(`[SCP] Archive downloaded (${Math.round(bytesTransferred / (1024 * 1024))} MB), cleaning up remote temp file`);

                                // Clean up remote temp archive
                                conn.exec(`rm -f ${remoteArchive}`, (cleanupErr) => {
                                    if (cleanupErr) {
                                        console.warn('[SCP] Failed to cleanup remote archive:', cleanupErr);
                                    }
                                    cleanup(true);
                                });
                            });

                            readStream.pipe(writeStream);
                        });
                    });

                    stream.on('data', (data: Buffer) => {
                        console.log('[SCP] tar output:', data.toString());
                    });

                    stream.stderr.on('data', (data: Buffer) => {
                        console.error('[SCP] tar error:', data.toString());
                    });
                });
            });

            conn.on('error', (err) => {
                console.error('[SCP] Connection error:', err);
                cleanup(false, err.message);
            });

            conn.on('timeout', () => {
                console.error('[SCP] Connection timeout');
                cleanup(false, 'Connection timeout');
            });

            conn.connect({
                host,
                username,
                privateKey,
                port: 22,
                readyTimeout: 120000, // 2 minutes for initial connection
                keepaliveInterval: 10000, // Send keepalive every 10 seconds
                keepaliveCountMax: 120 // Allow up to 20 minutes of inactivity (120 * 10s)
            });
        });
    }

    /**
     * Upload a directory to remote server by uploading tar.gz archive and extracting it
     */
    private static scpUploadDirectory(
        localArchivePath: string,
        remoteTargetPath: string,
        dirName: string,
        host: string,
        username: string,
        privateKey: string
    ): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            const conn = new Client();
            const remoteArchive = `/tmp/${path.basename(localArchivePath)}`;
            let resolved = false;

            const cleanup = (success: boolean, error?: string) => {
                if (!resolved) {
                    resolved = true;
                    conn.end();
                    resolve({ success, error });
                }
            };

            conn.on('ready', () => {
                console.log('[SCP] SSH connection established for directory upload');

                conn.sftp((err, sftp) => {
                    if (err) {
                        console.error('[SCP] SFTP error:', err);
                        return cleanup(false, err.message);
                    }

                    console.log('[SCP] Uploading archive to:', remoteArchive);

                    const readStream = fs.createReadStream(localArchivePath);
                    const writeStream = sftp.createWriteStream(remoteArchive);

                    let bytesTransferred = 0;
                    readStream.on('data', (chunk: Buffer) => {
                        bytesTransferred += chunk.length;
                        // Log progress for large files
                        if (bytesTransferred % (10 * 1024 * 1024) === 0) {
                            console.log(`[SCP] Uploaded ${Math.round(bytesTransferred / (1024 * 1024))} MB`);
                        }
                    });

                    readStream.on('error', (error: any) => {
                        console.error('[SCP] Read error:', error);
                        cleanup(false, error.message);
                    });

                    writeStream.on('error', (error: any) => {
                        console.error('[SCP] Write error:', error);
                        cleanup(false, error.message);
                    });

                    writeStream.on('close', () => {
                        console.log(`[SCP] Archive uploaded (${Math.round(bytesTransferred / (1024 * 1024))} MB), extracting to: ${remoteTargetPath}`);

                        // Extract archive on remote server
                        const extractCommand = `cd ${remoteTargetPath} && tar -xzf ${remoteArchive} && rm -f ${remoteArchive}`;

                        conn.exec(extractCommand, (execErr, stream) => {
                            if (execErr) {
                                console.error('[SCP] Error extracting archive:', execErr);
                                return cleanup(false, execErr.message);
                            }

                            stream.on('close', (code: number) => {
                                if (code !== 0) {
                                    console.error('[SCP] Extraction failed with code:', code);
                                    return cleanup(false, `tar extraction failed with code ${code}`);
                                }

                                console.log('[SCP] Directory extracted successfully');
                                cleanup(true);
                            });

                            stream.on('data', (data: Buffer) => {
                                console.log('[SCP] extraction output:', data.toString());
                            });

                            stream.stderr.on('data', (data: Buffer) => {
                                console.error('[SCP] extraction error:', data.toString());
                            });
                        });
                    });

                    readStream.pipe(writeStream);
                });
            });

            conn.on('error', (err) => {
                console.error('[SCP] Connection error:', err);
                cleanup(false, err.message);
            });

            conn.on('timeout', () => {
                console.error('[SCP] Connection timeout');
                cleanup(false, 'Connection timeout');
            });

            conn.connect({
                host,
                username,
                privateKey,
                port: 22,
                readyTimeout: 120000, // 2 minutes for initial connection
                keepaliveInterval: 10000, // Send keepalive every 10 seconds
                keepaliveCountMax: 120 // Allow up to 20 minutes of inactivity (120 * 10s)
            });
        });
    }

    /**
     * Transfer file between two servers using SCP
     * POST /api/v1/terminal/transfer-file
     * Body: { sourceIp, sourceUsername, sourceSshKey, sourcePath, targetIp, targetUsername, targetSshKey, targetPath }
     */
    static async transferFileBetweenServers(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            const {
                sourceIp,
                sourceUsername,
                sourceSshKey,
                sourcePath,
                targetIp,
                targetUsername,
                targetSshKey,
                targetPath,
                isDirectory = false
            } = req.body;

            console.log('[Transfer] Server-to-server file transfer request:', {
                source: `${sourceUsername}@${sourceIp}:${sourcePath}`,
                target: `${targetUsername}@${targetIp}:${targetPath}`,
                isDirectory,
                useSourceKeyForTarget: !targetSshKey || targetSshKey === ''
            });

            if (!sourceIp || !sourceUsername || !sourceSshKey || !sourcePath ||
                !targetIp || !targetUsername || !targetPath) {
                return res.status(400).send({
                    success: false,
                    message: "Missing required parameters"
                });
            }

            // If target SSH key is not provided, use source SSH key
            const finalTargetSshKey = targetSshKey && targetSshKey.trim() !== '' ? targetSshKey : sourceSshKey;
            console.log('[Transfer] Using source key for target:', finalTargetSshKey === sourceSshKey);

            const tempDir = path.join(__dirname, "../../uploads/temp-transfers");
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const fileName = path.basename(sourcePath);
            let tempFilePath: string;
            let downloadResult: { success: boolean; error?: string };
            let uploadResult: { success: boolean; error?: string };

            if (isDirectory) {
                // For directories: create tar.gz archive, transfer, and extract
                const archiveName = `${fileName}.tar.gz`;
                tempFilePath = path.join(tempDir, `${Date.now()}-${archiveName}`);

                console.log('[Transfer] Step 1: Creating tar.gz archive of directory on source server');

                // Create archive on source server and download it
                downloadResult = await FileUploadController.scpDownloadDirectory(
                    sourcePath,
                    tempFilePath,
                    sourceIp,
                    sourceUsername,
                    sourceSshKey
                );

                if (!downloadResult.success) {
                    return res.status(500).send({
                        success: false,
                        message: `Failed to download directory from source server: ${downloadResult.error}`
                    });
                }

                console.log('[Transfer] Step 2: Uploading and extracting archive on target server');

                // Upload archive to target server and extract it
                uploadResult = await FileUploadController.scpUploadDirectory(
                    tempFilePath,
                    targetPath,
                    fileName,
                    targetIp,
                    targetUsername,
                    finalTargetSshKey
                );

            } else {
                // For files: direct transfer
                tempFilePath = path.join(tempDir, `${Date.now()}-${fileName}`);

                console.log('[Transfer] Step 1: Downloading file from source server to temp location:', tempFilePath);

                downloadResult = await FileUploadController.scpDownload(
                    sourcePath,
                    tempFilePath,
                    sourceIp,
                    sourceUsername,
                    sourceSshKey
                );

                if (!downloadResult.success) {
                    return res.status(500).send({
                        success: false,
                        message: `Failed to download from source server: ${downloadResult.error}`
                    });
                }

                console.log('[Transfer] Step 2: Uploading file to target server');

                uploadResult = await FileUploadController.scpUpload(
                    tempFilePath,
                    path.join(targetPath, fileName),
                    targetIp,
                    targetUsername,
                    finalTargetSshKey
                );
            }

            // Step 3: Clean up temporary file/archive
            try {
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                    console.log('[Transfer] Cleaned up temporary file');
                }
            } catch (cleanupError) {
                console.error('[Transfer] Failed to clean up temp file:', cleanupError);
            }

            if (!uploadResult.success) {
                return res.status(500).send({
                    success: false,
                    message: `Failed to upload to target server: ${uploadResult.error}`
                });
            }

            console.log(`[Transfer] ${isDirectory ? 'Directory' : 'File'} transfer completed successfully`);

            return res.status(200).send({
                success: true,
                message: `${isDirectory ? 'Directory' : 'File'} transferred successfully from ${sourceIp} to ${targetIp}`,
                fileName: fileName,
                sourcePath,
                targetPath: path.join(targetPath, fileName),
                isDirectory
            });

        } catch (error: any) {
            console.error('[Transfer] Error during file transfer:', error);
            return res.status(500).send({
                success: false,
                message: error.message || "File transfer failed"
            });
        }
    }

    /**
     * Delete file or folder on remote server
     * POST /api/v1/terminal/delete-file
     * Body: { ip, username, sshKey, path }
     */
    static async deleteFile(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            const { ip, username, sshKey, path: filePath } = req.body;

            if (!ip || !username || !sshKey || !filePath) {
                return res.status(400).send({
                    success: false,
                    message: "Missing required fields: ip, username, sshKey, path"
                });
            }

            console.log(`[DeleteFile] Deleting file/folder: ${filePath} on ${ip}`);

            const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
                const conn = new Client();

                conn.on('ready', () => {
                    console.log('[DeleteFile] SSH connection established');

                    // Use rm -rf to delete files and directories
                    const command = `rm -rf ${filePath}`;

                    conn.exec(command, (err, stream) => {
                        if (err) {
                            console.error('[DeleteFile] Exec error:', err);
                            conn.end();
                            return resolve({ success: false, error: err.message });
                        }

                        let errorOutput = '';

                        stream.on('close', (code: number) => {
                            console.log(`[DeleteFile] Command exited with code: ${code}`);
                            conn.end();

                            if (code === 0) {
                                resolve({ success: true });
                            } else {
                                resolve({
                                    success: false,
                                    error: errorOutput || `Command failed with exit code ${code}`
                                });
                            }
                        });

                        stream.on('data', (data: Buffer) => {
                            console.log('[DeleteFile] STDOUT:', data.toString());
                        });

                        stream.stderr.on('data', (data: Buffer) => {
                            errorOutput += data.toString();
                            console.error('[DeleteFile] STDERR:', data.toString());
                        });
                    });
                });

                conn.on('error', (err) => {
                    console.error('[DeleteFile] SSH connection error:', err);
                    resolve({ success: false, error: err.message });
                });

                conn.connect({
                    host: ip,
                    port: 22,
                    username: username,
                    privateKey: sshKey,
                    readyTimeout: 30000
                });
            });

            if (!result.success) {
                return res.status(500).send({
                    success: false,
                    message: `Failed to delete: ${result.error}`
                });
            }

            console.log('[DeleteFile] File/folder deleted successfully');

            return res.status(200).send({
                success: true,
                message: "File/folder deleted successfully",
                path: filePath
            });

        } catch (error: any) {
            console.error('[DeleteFile] Error during file deletion:', error);
            return res.status(500).send({
                success: false,
                message: error.message || "File deletion failed"
            });
        }
    }

    /**
     * Create folder on remote server
     * POST /api/v1/terminal/create-folder
     * Body: { ip, username, sshKey, path }
     */
    static async createFolder(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            const { ip, username, sshKey, path: folderPath } = req.body;

            if (!ip || !username || !sshKey || !folderPath) {
                return res.status(400).send({
                    success: false,
                    message: "Missing required fields: ip, username, sshKey, path"
                });
            }

            console.log(`[CreateFolder] Creating folder: ${folderPath} on ${ip}`);

            const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
                const conn = new Client();

                conn.on('ready', () => {
                    console.log('[CreateFolder] SSH connection established');

                    // Use mkdir -p to create folder and parent directories if needed
                    const command = `mkdir -p ${folderPath}`;

                    conn.exec(command, (err, stream) => {
                        if (err) {
                            console.error('[CreateFolder] Exec error:', err);
                            conn.end();
                            return resolve({ success: false, error: err.message });
                        }

                        let errorOutput = '';

                        stream.on('close', (code: number) => {
                            console.log(`[CreateFolder] Command exited with code: ${code}`);
                            conn.end();

                            if (code === 0) {
                                resolve({ success: true });
                            } else {
                                resolve({
                                    success: false,
                                    error: errorOutput || `Command failed with exit code ${code}`
                                });
                            }
                        });

                        stream.on('data', (data: Buffer) => {
                            console.log('[CreateFolder] STDOUT:', data.toString());
                        });

                        stream.stderr.on('data', (data: Buffer) => {
                            errorOutput += data.toString();
                            console.error('[CreateFolder] STDERR:', data.toString());
                        });
                    });
                });

                conn.on('error', (err) => {
                    console.error('[CreateFolder] SSH connection error:', err);
                    resolve({ success: false, error: err.message });
                });

                conn.connect({
                    host: ip,
                    port: 22,
                    username: username,
                    privateKey: sshKey,
                    readyTimeout: 30000
                });
            });

            if (!result.success) {
                return res.status(500).send({
                    success: false,
                    message: `Failed to create folder: ${result.error}`
                });
            }

            console.log('[CreateFolder] Folder created successfully');

            return res.status(200).send({
                success: true,
                message: "Folder created successfully",
                path: folderPath
            });

        } catch (error: any) {
            console.error('[CreateFolder] Error during folder creation:', error);
            return res.status(500).send({
                success: false,
                message: error.message || "Folder creation failed"
            });
        }
    }
}
