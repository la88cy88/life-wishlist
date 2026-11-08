import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 项目站点部署在 /life-wishlist/ 子路径下。
// 如果以后更换仓库名，只需修改这里的 base，其余代码使用相对路径。
export const PAGES_BASE = '/life-wishlist/';

export default defineConfig({
  base: PAGES_BASE,
  plugins: [react()],
  build: {
    target: 'es2018',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
});
