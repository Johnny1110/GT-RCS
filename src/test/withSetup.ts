/**
 * 在真實組件的 setup() 中執行 composable，讓 onMounted/onUnmounted 正常運作。
 * 回傳 unmount 以驗證「離開頁面」的行為。
 */
import { createApp, type App } from 'vue'

export interface SetupResult<T> {
  result: T
  app: App
  unmount: () => void
}

export function withSetup<T>(composable: () => T): SetupResult<T> {
  let result!: T
  const app = createApp({
    setup() {
      result = composable()
      return () => null
    },
  })
  app.mount(document.createElement('div'))
  return { result, app, unmount: () => app.unmount() }
}
