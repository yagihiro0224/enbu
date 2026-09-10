import { defineConfig } from 'vite';

// GitHub Pages のサブパス配信用。ローカル dev では '/' になる。
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/enbu/' : '/',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5173 },
}));
