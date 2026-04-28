import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { defineConfig, loadEnv } from 'vite';
/// <reference types="vitest" />

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'version-json',
        closeBundle() {
          const hash = (() => {
            try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'unknown'; }
          })();
          const version = { version: '1.1.0', buildTime: new Date().toISOString(), commit: hash };
          const json = JSON.stringify(version, null, 2);
          [path.resolve(__dirname, 'dist'), __dirname].forEach(dir => {
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, 'version.json'), json);
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-icons': ['lucide-react'],
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: [],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  };
});
