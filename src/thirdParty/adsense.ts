/**
 * AdSense script 與版位推送（PRD Phase 6 / F6-3.2）。
 *
 * script 只在**真的有版位掛載時**才載入：練習頁不含版位，也就完全不會有廣告 script
 * 拖慢首屏（F6-3.4 要求練習頁 Lighthouse perf ≥ 90）。
 */
import { adsenseScriptUrl } from '@/config/ads'
import { loadScript } from './loader'

export function ensureAdsenseLoaded(client: string): Promise<void> {
  return loadScript(adsenseScriptUrl(client), {
    crossOrigin: 'anonymous',
    attrs: { 'data-ad-client': client },
  })
}

/** 告訴 AdSense「這裡有一個新版位」。ins 元素必須已經在 DOM 裡 */
export function pushAdUnit(): void {
  window.adsbygoogle = window.adsbygoogle ?? []
  window.adsbygoogle.push({})
}
