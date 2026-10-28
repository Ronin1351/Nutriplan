import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default mergeConfig(
  viteConfig,
  defineConfig({
    root: projectRoot,
    test: {
      environment: 'jsdom',
      setupFiles: [path.resolve(projectRoot, 'src/test/setup.ts')],
      include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.ts'],
    },
  }),
);
