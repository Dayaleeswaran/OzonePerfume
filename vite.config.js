import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* base '/' — the site uses real paths (/product/x), so assets must resolve from the root */
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: { port: 5173 }
});
