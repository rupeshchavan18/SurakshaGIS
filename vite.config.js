import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import fs from 'node:fs';
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
function serveDocsPlugin() {
    return {
        name: 'serve-docs-plugin',
        configureServer: function (server) {
            server.middlewares.use(function (req, res, next) {
                if (req.url && req.url.startsWith('/docs/')) {
                    var cleanUrl = decodeURIComponent(req.url.split('?')[0]);
                    var filePath = resolve(__dirname, '.' + cleanUrl);
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
        configurePreviewServer: function (server) {
            server.middlewares.use(function (req, res, next) {
                if (req.url && req.url.startsWith('/docs/')) {
                    var cleanUrl = decodeURIComponent(req.url.split('?')[0]);
                    var filePath = resolve(__dirname, '.' + cleanUrl);
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
        closeBundle: function () {
            // Preserve docs/ in source, and copy to dist/docs for production builds
            var src = resolve(__dirname, 'docs/flood_risk_dataset_india.csv');
            var distDir = resolve(__dirname, 'dist/docs');
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
