import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        host: true,
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8787',
                changeOrigin: true
            },
            '/__carearound-town-maps': {
                target: 'https://maps.carearound.sg',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/__carearound-town-maps/, '')
            },
            '/__carearound-town-map-downloads': {
                target: 'http://127.0.0.1:4176',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/__carearound-town-map-downloads/, '')
            }
        }
    }
});
