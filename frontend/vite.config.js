import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Отключаем ESLint во время сборки
      eslint: {
        lintOnStart: false,
        lintOnSave: false,
      }
    })
  ],
  server: {
    proxy: {
      // Проксирование всех API запросов к backend
      '/auth': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/students': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/exams': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/groups': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/teachers': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/exam-types': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/telegram': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    }
  },
  build: {
    // Увеличиваем лимит предупреждений для сборки
    chunkSizeWarningLimit: 1000,
    // Минификация использует esbuild (встроен в Vite, не требует дополнительных зависимостей)
    minify: 'esbuild',
    // Обработка ошибок
    rollupOptions: {
      onwarn(warning, warn) {
        // Игнорируем некоторые предупреждения
        if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return
        if (warning.code === 'CIRCULAR_DEPENDENCY') return
        warn(warning)
      }
    }
  },
  // Отключение ESLint во время сборки
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  }
})
