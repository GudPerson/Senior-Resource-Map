import { Hono } from 'hono';
import { authenticateToken, authorizeResourceOperator } from '../middleware/auth.js';
import { assertPersonalPlacesUser } from '../controllers/personalPlacesController.js';

const router = new Hono();
const PERSONAL_CATEGORY_ICON_MAX_BYTES = 2 * 1024 * 1024;
const PERSONAL_CATEGORY_ICON_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
]);

function createUploadConfigurationError(message) {
    const error = new Error(message);
    error.code = 'UPLOAD_NOT_CONFIGURED';
    error.status = 503;
    return error;
}

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
                throw createUploadConfigurationError('CLOUDINARY_URL must use the cloudinary:// scheme.');
            }

            const apiKey = decodeURIComponent(parsed.username || '');
            const apiSecret = decodeURIComponent(parsed.password || '');
            const cloudName = parsed.hostname || parsed.pathname.replace(/^\/+/, '');

            if (!cloudName || !apiKey || !apiSecret) {
                throw createUploadConfigurationError('CLOUDINARY_URL must include cloud name, API key, and API secret.');
            }

            return { cloudName, apiKey, apiSecret };
        } catch (err) {
            if (err.code === 'UPLOAD_NOT_CONFIGURED') throw err;
            throw createUploadConfigurationError(`Invalid CLOUDINARY_URL configuration. ${err.message}`);
        }
    }

    const cloudName = readValue('CLOUDINARY_CLOUD_NAME');
    const apiKey = readValue('CLOUDINARY_API_KEY');
    const apiSecret = readValue('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
        throw createUploadConfigurationError('Cloudinary is not configured. Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET.');
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

async function uploadImage(c, file, folder) {
    const { cloudName, apiKey, apiSecret } = resolveCloudinaryConfig(c.env);
    const timestamp = Math.floor(Date.now() / 1000);
    const params = {
        timestamp: timestamp.toString(),
        folder,
    };
    const signature = await generateSignature(params, apiSecret);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);
    formData.append('folder', folder);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
    });
    const data = await response.json();
    if (!response.ok) {
        console.error('Cloudinary upload error:', data);
        const error = new Error(data.error?.message || 'Upload failed');
        error.status = 500;
        throw error;
    }
    return data;
}

router.post('/personal-place-category-icon', authenticateToken, async (c) => {
    try {
        const user = c.get('user');
        assertPersonalPlacesUser(user);
        const body = await c.req.parseBody();
        const file = body.file;
        if (!(file instanceof File)) {
            return c.json({ error: 'Choose an image to upload' }, 400);
        }
        if (!PERSONAL_CATEGORY_ICON_TYPES.has(file.type)) {
            return c.json({ error: 'Use a PNG, JPEG, or WebP image' }, 400);
        }
        if (file.size > PERSONAL_CATEGORY_ICON_MAX_BYTES) {
            return c.json({ error: 'Category icons must be 2 MB or smaller' }, 400);
        }

        const data = await uploadImage(
            c,
            file,
            `seniorcare-connect/personal-place-category-icons/${user.id}`
        );
        return c.json({ secure_url: data.secure_url });
    } catch (err) {
        console.error('Personal place category icon upload error:', err);
        if (err.code === 'UPLOAD_NOT_CONFIGURED') {
            return c.json({
                error: 'Custom icon upload is unavailable in this environment.',
                code: 'upload_not_configured',
            }, 503);
        }
        return c.json({ error: err.message || 'Failed to upload category icon' }, err.status || 500);
    }
});

router.post('/', authenticateToken, authorizeResourceOperator(), async (c) => {
    try {
        const body = await c.req.parseBody();
        const file = body['file'];

        if (!file) {
            return c.json({ error: 'No file uploaded' }, 400);
        }

        const data = await uploadImage(c, file, 'seniorcare-connect');
        return c.json({ secure_url: data.secure_url });
    } catch (err) {
        console.error('Upload route error:', err);
        return c.json({ error: err.message || 'Server error during upload' }, 500);
    }
});

export default router;
