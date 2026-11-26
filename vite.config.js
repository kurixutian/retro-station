import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  server: {
    proxy: {
      '/api/launchbox': {
        target: 'https://gamesdb.launchbox-app.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/launchbox/, ''),
      },
    },
  },
});
