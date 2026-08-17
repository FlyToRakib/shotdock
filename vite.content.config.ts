import { defineConfig } from 'vite';

/**
 * The content script is injected on demand with chrome.scripting.executeScript,
 * which requires a classic (non-module) script. Built as a single self-contained
 * IIFE into dist/content.js, appended to the main build output.
 */
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'chrome116',
    sourcemap: false,
    lib: {
      entry: 'src/content/content.ts',
      formats: ['iife'],
      name: 'ShotDockContent',
      fileName: () => 'content.js',
    },
  },
});
