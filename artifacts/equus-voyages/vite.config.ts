import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

function resolvePort(command: 'build' | 'serve') {
  const rawPort = process.env.PORT;

  if (!rawPort) {
    if (command === 'build') return 5173;

    throw new Error(
      'PORT environment variable is required but was not provided.',
    );
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  return port;
}

function resolveBasePath(command: 'build' | 'serve') {
  const basePath = process.env.BASE_PATH;

  if (!basePath) {
    if (command === 'build') return '/';

    throw new Error(
      'BASE_PATH environment variable is required but was not provided.',
    );
  }

  return basePath;
}

export default defineConfig(async ({ command }) => ({
  base: resolveBasePath(command),
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('/@supabase/')) return 'supabase';
          if (id.includes('/react-router')) return 'router';
          if (id.includes('/react-i18next/') || id.includes('/i18next')) {
            return 'i18n';
          }
          if (id.includes('/lucide-react/')) return 'icons';
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/')
          ) {
            return 'react';
          }

          return undefined;
        },
      },
    },
  },
  server: {
    port: resolvePort(command),
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port: resolvePort(command),
    host: '0.0.0.0',
    allowedHosts: true,
  },
}));
