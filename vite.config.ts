import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Фронт ходит только в свой бэкенд (server/): и за данными admin-api, и за
 * курсом, и за листами. Ключ и пароль от базы живут там — в браузер и в бандл
 * ничего из этого не попадает, поэтому здесь нет ни одного секрета.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backend = `http://localhost:${env.PORT || 5274}`

  return {
    plugins: [react()],
    server: {
      port: 5273,
      proxy: {
        // Regex, а не префикс: строка '/api' матчила бы и страницу /api-logs,
        // уводя её в бэкенд вместо роутера. Слеш в конце обязателен.
        '^/admin-api/': { target: backend, changeOrigin: true },
        '^/api/': { target: backend, changeOrigin: true },
      },
    },
  }
})
