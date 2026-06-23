import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const apiTarget =
  process.env.VITE_API_PROXY_TARGET ||
  process.env.VITE_PUBLIC_API_BASE_URL ||
  'http://127.0.0.1:7842';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    proxy: {
      '/health': apiTarget,
      '/api': apiTarget,
      '/clodia': apiTarget,
      '/topics': apiTarget
    }
  }
});
