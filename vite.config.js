import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* base './' keeps asset paths relative so the built site can be hosted from any folder */
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173 }
});
