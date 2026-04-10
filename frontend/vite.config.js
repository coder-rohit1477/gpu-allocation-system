import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const serverPort = Number.parseInt(env.VITE_PORT ?? '5173', 10) || 5173;
  const proxyTarget = env.VITE_API_PROXY_TARGET?.trim() || 'http://localhost:5001';

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: serverPort,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            auth: ['jwt-decode'],
            http: ['axios'],
            ui: ['sonner'],
          },
        },
      },
    },
  };
});
