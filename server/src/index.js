import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import hardAssetsRoutes from './routes/hardAssets.js';
import softAssetsRoutes from './routes/softAssets.js';
import tagsRoutes from './routes/tags.js';
import subCategoriesRoutes from './routes/subCategories.js';
import uploadRoutes from './routes/upload.js';
import userRoutes from './routes/users.js';
import favoritesRoutes from './routes/favorites.js';
import adminRoutes from './routes/admin.js';

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.CLIENT_URL
].filter(Boolean);

app.use(cors({
    origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) cb(null, true);
        else cb(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Mount all API routes under /api
app.use('/api/auth', authRoutes);
app.use('/api/hard-assets', hardAssetsRoutes);
app.use('/api/soft-assets', softAssetsRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/sub-categories', subCategoriesRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/admin', adminRoutes);
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Netlify function path can forward with or without the /api prefix.
// Alias plain routes to keep API resolution consistent.
app.use('/auth', authRoutes);
app.use('/hard-assets', hardAssetsRoutes);
app.use('/soft-assets', softAssetsRoutes);
app.use('/tags', tagsRoutes);
app.use('/sub-categories', subCategoriesRoutes);
app.use('/upload', uploadRoutes);
app.use('/users', userRoutes);
app.use('/favorites', favoritesRoutes);
app.use('/admin', adminRoutes);
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Also mount under /.netlify/functions/api for serverless
app.use('/.netlify/functions/api/auth', authRoutes);
app.use('/.netlify/functions/api/hard-assets', hardAssetsRoutes);
app.use('/.netlify/functions/api/soft-assets', softAssetsRoutes);
app.use('/.netlify/functions/api/tags', tagsRoutes);
app.use('/.netlify/functions/api/sub-categories', subCategoriesRoutes);
app.use('/.netlify/functions/api/upload', uploadRoutes);
app.use('/.netlify/functions/api/users', userRoutes);
app.use('/.netlify/functions/api/favorites', favoritesRoutes);
app.use('/.netlify/functions/api/admin', adminRoutes);
app.get('/.netlify/functions/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Only start listening when running directly (not as a serverless function)
if (process.env.NETLIFY !== 'true') {
    app.listen(PORT, () => {
        console.log(`🏥 SeniorCare Connect API running on http://localhost:${PORT}`);
    });
}

export default app;
