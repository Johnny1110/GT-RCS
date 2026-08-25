import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { prerenderPlugin } from './build/prerender'

export default defineConfig(({ mode }) => {
  // 建置期環境變數（PRD Phase 6）：預渲染要知道正式網域與部署環境才寫得出 canonical 與 robots
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    plugins: [
      vue(),
      tailwindcss(),
      prerenderPlugin({
        origin: env['VITE_SITE_ORIGIN'] ?? '',
        deployEnv: env['VITE_DEPLOY_ENV'] ?? 'local',
        adsenseClient: env['VITE_ADSENSE_CLIENT'] ?? '',
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      include: ['src/**/*.spec.ts', 'build/**/*.spec.ts', 'deploy/**/*.spec.ts'],
      // core/** 為純 TS 不需 DOM；組件測試以 // @vitest-environment happy-dom 個別指定
      environment: 'node',
    },
  }
})
