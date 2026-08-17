import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Main extension bundle: the HTML surfaces (popup, options, preview, offscreen)
 * and the MV3 service worker. The content script is built separately as an IIFE —
 * see vite.content.config.ts — because injected scripts cannot be ES modules.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome116',
    sourcemap: false,
    rollupOptions: {
      input: {
        popup: 'popup.html',
        options: 'options.html',
        preview: 'preview.html',
        offscreen: 'offscreen.html',
        'service-worker': 'src/background/service-worker.ts',
      },
      output: {
        // The manifest references the worker by a fixed path, so it must not be hashed.
        entryFileNames: (chunk) =>
          chunk.name === 'service-worker' ? 'service-worker.js' : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
