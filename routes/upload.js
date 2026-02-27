import express from 'express';
import multer from 'multer';
import cloudinary from '../lib/cloudinary.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'seniorcare-connect' },
        (error, result) => {
            if (error) {
                console.error('Cloudinary upload error:', error);
                return res.status(500).json({ error: 'Upload failed' });
            }
            res.json({ secure_url: result.secure_url });
        }
    );

    uploadStream.end(req.file.buffer);
});

export default router;
