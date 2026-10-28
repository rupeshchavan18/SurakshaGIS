import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function serveDocsPlugin(): Plugin {
  return {
    name: 'serve-docs-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/docs/')) {
          const cleanUrl = decodeURIComponent(req.url.split('?')[0]);
          const filePath = resolve(__dirname, '.' + cleanUrl);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Access-Control-Allow-Origin', '*');
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/docs/')) {
          const cleanUrl = decodeURIComponent(req.url.split('?')[0]);
          const filePath = resolve(__dirname, '.' + cleanUrl);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Access-Control-Allow-Origin', '*');
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        }
        next();
      });
    },
    closeBundle() {
      // Preserve docs/ in source, and copy to dist/docs for production builds
      const src = resolve(__dirname, 'docs/flood_risk_dataset_india.csv');
      const distDir = resolve(__dirname, 'dist/docs');
      if (fs.existsSync(src)) {
        if (!fs.existsSync(distDir)) {
          fs.mkdirSync(distDir, { recursive: true });
        }
        fs.copyFileSync(src, resolve(distDir, 'flood_risk_dataset_india.csv'));
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), serveDocsPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
