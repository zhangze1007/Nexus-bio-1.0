import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 强制设置基础路径为当前目录，防止白屏
  base: './',
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      // 这里的设置确保能找到 src 里的文件
      '@': '/src',
    },
  },
});
