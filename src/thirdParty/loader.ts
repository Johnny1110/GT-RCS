/**
 * 第三方 script 注入的唯一入口（PRD Phase 6 / F6-3.2）。
 *
 * 三條規則，全部可測：
 * 1. **網域必須在白名單內**（config/third-party.json）。不在就拒絕載入並在 console 出聲——
 *    因為 production 的 CSP 也會擋，與其上線才發現，不如在 dev 就爆。
 * 2. **同一個 URL 只載一次**：路由來回切換不該重複注入。
 * 3. **一律 async**：廣告與分析都不准擋住 App 可互動（F6-3.2）。
 */
import { isAllowedScriptUrl } from '@/config/thirdParty'

const loaded = new Map<string, Promise<void>>()

export interface ScriptOptions {
  /** 額外的 data-* 屬性，如 AdSense 的 data-ad-client */
  attrs?: Readonly<Record<string, string>>
  crossOrigin?: 'anonymous'
}

export function loadScript(url: string, options: ScriptOptions = {}): Promise<void> {
  const existing = loaded.get(url)
  if (existing) return existing

  if (!isAllowedScriptUrl(url)) {
    const error = new Error(`Blocked third-party script (not in allowlist): ${url}`)
    console.error(error.message)
    const rejected = Promise.reject(error)
    // 呼叫端多半是 `void loadScript(...)`；先標記為已處理，避免 unhandled rejection
    rejected.catch(() => {})
    return rejected
  }

  const promise = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script')
    el.src = url
    el.async = true
    if (options.crossOrigin) el.crossOrigin = options.crossOrigin
    for (const [key, value] of Object.entries(options.attrs ?? {})) el.setAttribute(key, value)
    el.addEventListener('load', () => resolve())
    // 被廣告攔截器擋掉走的就是這條：不是錯誤，是常態，呼叫端負責優雅收合
    el.addEventListener('error', () => reject(new Error(`Failed to load ${url}`)))
    document.head.appendChild(el)
  })

  loaded.set(url, promise)
  // 失敗的 URL 不重試：攔截器不會因為再試一次就放行
  promise.catch(() => {})
  return promise
}

/** 測試用：清掉「載過了」的記憶 */
export function resetLoadedScripts(): void {
  loaded.clear()
}
