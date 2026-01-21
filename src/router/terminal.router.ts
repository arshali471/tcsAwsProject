import { Router, Request, Response, NextFunction } from 'express';
import { FileUploadController } from '../controllers/fileUploadController';
import { authMiddleware } from '../middleware/AuthMiddleware';

export default class TerminalRouter {
    public router: Router;

    constructor() {
        this.router = Router();
        this.routes();
    }

    public routes(): void {
        // All terminal endpoints require authentication
        this.router.post(
            "/upload",
            authMiddleware(),
            (req: Request, res: Response, next: NextFunction) => {
                console.log('[Terminal Router] Upload request received');
                console.log('[Terminal Router] Content-Type:', req.headers['content-type']);
                next();
            },
            FileUploadController.uploadMiddleware,
            (err: any, req: Request, res: Response, next: NextFunction) => {
                console.error('[Terminal Router] Multer error:', err);
                res.status(400).send({ success: false, message: err.message });
            },
            FileUploadController.uploadToServer
        );

        this.router.post(
            "/download",
            authMiddleware(),
            FileUploadController.downloadFromServer
        );

        this.router.get(
            "/uploads",
            authMiddleware(),
            FileUploadController.listUploads
        );

        this.router.post(
            "/list-files",
            authMiddleware(),
            FileUploadController.listRemoteFiles
        );

        this.router.post(
            "/transfer-file",
            authMiddleware(),
            FileUploadController.transferFileBetweenServers
        );

        this.router.post(
            "/delete-file",
            authMiddleware(),
            FileUploadController.deleteFile
        );

        this.router.post(
            "/create-folder",
            authMiddleware(),
            FileUploadController.createFolder
        );
    }
}
