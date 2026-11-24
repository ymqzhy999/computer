import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5178,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8018',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.indexOf('node_modules/three') !== -1) return 'three'
          if (id.indexOf('node_modules/echarts') !== -1 || id.indexOf('node_modules/zrender') !== -1) return 'echarts'
          if (id.indexOf('jspdf') !== -1 || id.indexOf('html2canvas') !== -1 || id.indexOf('dompurify') !== -1) return 'pdf'
          return undefined
        },
      },
    },
  },
})
