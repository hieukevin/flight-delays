import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls during dev to the Express server
      '/health': 'http://localhost:8080',
      '/airports': 'http://localhost:8080',
      '/predict': 'http://localhost:8080'
    }
  }
});
