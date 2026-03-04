import express from 'express';
import multer from 'multer';
import cloudinary from '../lib/cloudinary.js';
import { authenticateToken, authorize } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'seniorcare-connect' },
            (error, result) => {
                if (error) {
                    console.error('Cloudinary upload error:', error);
                    return res.status(500).json({ error: error.message || 'Upload failed' });
                }
                res.json({ secure_url: result.secure_url });
            }
        );

        uploadStream.end(req.file.buffer);
    } catch (err) {
        console.error('Upload route error:', err);
        res.status(500).json({ error: err.message || 'Server error during upload' });
    }
});

export default router;
