import { defineConfig } from 'vite';

// GitHub Pages のサブパス配信用。ローカル dev では '/' になる。
// 試遊版は 1 階層深いところに置くので、BASE_PATH で差し替える（/enbu/preview/）。
export default defineConfig(({ command }) => ({
  base: command === 'build' ? (process.env.BASE_PATH || '/enbu/') : '/',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5173 },
}));
