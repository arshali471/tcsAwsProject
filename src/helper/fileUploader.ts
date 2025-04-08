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
