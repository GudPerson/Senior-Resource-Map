import { Hono } from 'hono';
import { authenticateToken, authorize } from '../middleware/auth.js';
import { env } from 'hono/adapter';

const router = new Hono();

const generateSignature = async (params, apiSecret) => {
    const keys = Object.keys(params).sort();
    let signatureStr = '';
    keys.forEach(k => {
        signatureStr += `${k}=${params[k]}&`;
    });
    signatureStr = signatureStr.slice(0, -1) + apiSecret;

    const encoder = new TextEncoder();
    const data = encoder.encode(signatureStr);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

router.post('/', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), async (c) => {
    try {
        const body = await c.req.parseBody();
        const file = body['file'];

        if (!file) {
            return c.json({ error: 'No file uploaded' }, 400);
        }

        const envVars = env(c);
        const cloudName = envVars.CLOUDINARY_CLOUD_NAME;
        const apiKey = envVars.CLOUDINARY_API_KEY;
        const apiSecret = envVars.CLOUDINARY_API_SECRET;

        // Use direct REST call as cloudinary Node SDK relies on fs
        const timestamp = Math.floor(Date.now() / 1000);
        const params = {
            timestamp: timestamp.toString(),
            folder: 'seniorcare-connect' // Fixed to match original
        };

        const signature = await generateSignature(params, apiSecret);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('api_key', apiKey);
        formData.append('timestamp', timestamp);
        formData.append('signature', signature);
        formData.append('folder', 'seniorcare-connect');

        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Cloudinary upload error:', data);
            return c.json({ error: data.error?.message || 'Upload failed' }, 500);
        }

        return c.json({ secure_url: data.secure_url });
    } catch (err) {
        console.error('Upload route error:', err);
        return c.json({ error: err.message || 'Server error during upload' }, 500);
    }
});

export default router;
