import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Номер сборки: он зашит в код и лежит в version.json рядом с index.html.
// По нему приложение понимает, что вышла новая версия (см. src/lib/updater.ts).
const BUILD_ID = Date.now().toString(36);

export default defineConfig({
  base: './', // Относительные пути для работы на GitHub Pages
  plugins: [
    react(),
    {
      name: 'version-file',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) });
      },
    },
  ],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: true,
  },
});
