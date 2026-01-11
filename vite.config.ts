import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

function copyManifest() {
  return {
    name: 'copy-manifest',
    writeBundle() {
      const manifestSrc = join(__dirname, 'public/manifest.json');
      const manifestDest = join(__dirname, 'dist/manifest.json');
      mkdirSync(join(__dirname, 'dist'), { recursive: true });
      copyFileSync(manifestSrc, manifestDest);
    },
  };
}

export default defineConfig({
  plugins: [react(), copyManifest()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        options: resolve(__dirname, 'options.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Keep entry file names consistent
          if (chunkInfo.name === 'popup' || chunkInfo.name === 'options' || chunkInfo.name === 'background') {
            return '[name].js';
          }
          return '[name].js';
        },
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        // Manual chunks to prevent shared chunks between entries
        manualChunks: (id) => {
          // Don't create shared chunks for our entry points
          if (id.includes('node_modules')) {
            // Vendor chunks are OK to share
            return 'vendor';
          }
          // Return undefined to let each entry have its own chunks
          return undefined;
        },
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
});
