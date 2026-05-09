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
          const pkgVersion = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')).version;
          const version = { version: pkgVersion, buildTime: new Date().toISOString(), commit: hash };
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
      dedupe: ['react', 'react-dom'],
    },
    server: {
      host: '127.0.0.1',
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/');
            if (normalizedId.includes('node_modules')) {
              if (
                normalizedId.includes('/node_modules/react/') ||
                normalizedId.includes('/node_modules/react-dom/') ||
                normalizedId.includes('/node_modules/scheduler/')
              ) {
                return 'vendor-react';
              }
              if (normalizedId.includes('/node_modules/react-router') || normalizedId.includes('/node_modules/react-router-dom')) {
                return 'vendor-router';
              }
              if (normalizedId.includes('/node_modules/@tanstack/react-query')) {
                return 'vendor-query';
              }
              if (normalizedId.includes('lucide-react')) {
                return 'vendor-icons';
              }
            }
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
