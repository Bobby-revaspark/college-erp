import {defineConfig} from 'vite';
import {fileURLToPath,URL} from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},plugins:[react(),tailwindcss()],build:{rollupOptions:{output:{manualChunks:{charts:['recharts']}}}},server:{host:'0.0.0.0',proxy:{'/api':'http://localhost:3001'}}});
