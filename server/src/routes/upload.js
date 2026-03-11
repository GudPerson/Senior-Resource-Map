import { Hono } from 'hono';
import { authenticateToken, authorize } from '../middleware/auth.js';

const router = new Hono();

function resolveCloudinaryConfig(runtimeEnv = {}) {
    const processEnv = typeof globalThis.process !== 'undefined' ? globalThis.process.env || {} : {};
    const runtime = runtimeEnv || {};

    const cleanValue = (value) => String(value || '')
        .trim()
        .replace(/^['"]|['"]$/g, '')
        .replace(/^CLOUDINARY_URL\s*=\s*/i, '');

    const readValue = (...keys) => {
        for (const source of [runtime, processEnv]) {
            for (const key of keys) {
                const value = cleanValue(source[key]);
                if (value) return value;
            }
        }
        return '';
    };

    const cloudinaryUrl = readValue('CLOUDINARY_URL');
    if (cloudinaryUrl) {
        try {
            const parsed = new URL(cloudinaryUrl);
            if (parsed.protocol !== 'cloudinary:') {
                throw new Error('CLOUDINARY_URL must use the cloudinary:// scheme.');
            }

            const apiKey = decodeURIComponent(parsed.username || '');
            const apiSecret = decodeURIComponent(parsed.password || '');
            const cloudName = parsed.hostname || parsed.pathname.replace(/^\/+/, '');

            if (!cloudName || !apiKey || !apiSecret) {
                throw new Error('CLOUDINARY_URL must include cloud name, API key, and API secret.');
            }

            return { cloudName, apiKey, apiSecret };
        } catch (err) {
            throw new Error(`Invalid CLOUDINARY_URL configuration. ${err.message}`);
        }
    }

    const cloudName = readValue('CLOUDINARY_CLOUD_NAME');
    const apiKey = readValue('CLOUDINARY_API_KEY');
    const apiSecret = readValue('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error('Cloudinary is not configured. Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET.');
    }

    return { cloudName, apiKey, apiSecret };
}

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

        const { cloudName, apiKey, apiSecret } = resolveCloudinaryConfig(c.env);

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
