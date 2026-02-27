import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import hardAssetsRoutes from './routes/hardAssets.js';
import softAssetsRoutes from './routes/softAssets.js';
import tagsRoutes from './routes/tags.js';
import uploadRoutes from './routes/upload.js';
import userRoutes from './routes/users.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/hard-assets', hardAssetsRoutes);
app.use('/api/soft-assets', softAssetsRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => {
    console.log(`🏥 SeniorCare Connect API running on http://localhost:${PORT}`);
});

export default app;
