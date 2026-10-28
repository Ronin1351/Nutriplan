import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createRecipeImportHandler } from './api/recipe-import.js';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

function localRecipeImportApi(): Plugin {
  const handler = createRecipeImportHandler();
  return {
    name: 'local-recipe-import-api',
    configureServer(server) {
      server.middlewares.use('/api/recipe-import', (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', async () => {
          const response = {
            statusCode: 200,
            status(code: number) { response.statusCode = code; return response; },
            setHeader(name: string, value: string) { res.setHeader(name, value); },
            json(value: unknown) { res.statusCode = response.statusCode; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); return response; },
            send(value: string) { res.statusCode = response.statusCode; res.end(value); return response; },
          };
          try {
            await handler({ method: req.method, body: JSON.parse(body || '{}') }, response);
          } catch {
            if (!res.writableEnded) { res.statusCode = 500; res.end(JSON.stringify({ error: 'server-error', message: 'Recipe import failed.' })); }
          }
        });
      });
    },
  };
}

export default defineConfig({
  root: path.resolve(projectRoot, 'react-app'),
  publicDir: path.resolve(projectRoot, 'public'),
  plugins: [localRecipeImportApi(), react()],
  resolve: {
    alias: {
      '@': path.resolve(projectRoot, 'src'),
    },
  },
  server: {
    fs: {
      allow: [projectRoot],
    },
  },
  build: {
    outDir: path.resolve(projectRoot, 'dist'),
    emptyOutDir: true,
  },
  worker: {
    format: 'es',
  },
});
