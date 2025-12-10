import multer from 'multer';
import { CONFIG } from '../config/environment';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, `${CONFIG.uploadsFolderPath}`)
    },
    filename: (req, file, cb) => {
        cb(null, new Date().getTime() + file.originalname);
    }
});

export const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 1024 * 2
    },
});

// Memory storage for S3 uploads (documentation, etc.)
const memoryStorage = multer.memoryStorage();

export const uploadToMemory = multer({
    storage: memoryStorage,
    limits: {
        fileSize: 1024 * 1024 * 100 // 100MB limit for documentation files
    },
});
