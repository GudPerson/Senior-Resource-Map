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
const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174'];
app.use(cors({
    origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) cb(null, true);
        else cb(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/hard-assets', hardAssetsRoutes);
app.use('/api/soft-assets', softAssetsRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/sub-categories', subCategoriesRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/favorites', favoritesRoutes);
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => {
    console.log(`🏥 SeniorCare Connect API running on http://localhost:${PORT}`);
});

export default app;
