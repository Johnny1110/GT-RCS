/**
 * 廣告版位設定（PRD Phase 6 / F6-3）。
 *
 * 產品原則寫成程式碼：**練習體驗絕不被廣告打斷**。
 * - 版位是**白名單**，不是黑名單：沒列在 PLACEMENT_ROUTES 的路由，連容器都不會存在。
 * - 不使用 Auto ads（那會讓 Google 自行決定插在哪裡，等於放棄這個白名單）。
 * - `ads.spec.ts` 鎖定白名單不含任何跟練路由；想在練習頁放廣告，得先改測試——
 *   那一刻就會有人問「為什麼」。
 *
 * 缺 VITE_ADSENSE_CLIENT 或缺該版位的 slot id 時一律當作「這個版位不存在」，
 * 所以本機與預覽頻道自然是零廣告站。
 */
import { ADSENSE_CLIENT, ADSENSE_SLOTS_RAW, IS_PRODUCTION_SITE } from './env'

export const AD_PLACEMENTS = ['home', 'knowledge', 'stats'] as const
export type AdPlacement = (typeof AD_PLACEMENTS)[number]

/**
 * 版位 → 允許出現的路由 path。三個都是「讀」的頁面：看介紹、讀樂理、看統計。
 *
 * **沒有任何練習模組路由在這裡**，這是 DoD「所有跟練播放畫面零廣告」的實作方式：
 * 不是播放時把廣告藏起來，而是那些頁面根本不存在廣告容器。
 *
 * 與 PRD F6-3.1 的差異（刻意）：PRD 允許 Scale Explorer 側欄，但 Explorer 在 RCS 是
 * 掛著 TransportBar 的模組頁，同一份 PRD 又禁止「TransportBar 附近」。若照字面放上去，
 * 只剩兩條路：播放中隱藏（廣告已投放才隱藏 = AdSense 政策風險），或播放中照顯示
 * （違反產品承諾）。兩條都不能走，所以改放在知識頁——那才是真正的內容頁。
 */
export const PLACEMENT_ROUTES: Readonly<Record<AdPlacement, readonly string[]>> = {
  home: ['/'],
  knowledge: ['/knowledge', '/knowledge/:slug'],
  stats: ['/stats'],
}

/** 保留高度（px）：載入前後同高，CLS = 0。行動與桌機各一組 */
export const PLACEMENT_HEIGHT: Readonly<Record<AdPlacement, { mobile: number; desktop: number }>> = {
  home: { mobile: 280, desktop: 280 },
  knowledge: { mobile: 280, desktop: 280 },
  stats: { mobile: 250, desktop: 250 },
}

/** `home:1234567890,stats:0987654321` → { home: '1234567890', … }；格式不對的片段直接忽略 */
export function parseSlots(raw: string): Partial<Record<AdPlacement, string>> {
  const out: Partial<Record<AdPlacement, string>> = {}
  for (const chunk of raw.split(',')) {
    const [name, id] = chunk.split(':').map((s) => s.trim())
    if (!name || !id) continue
    if (!(AD_PLACEMENTS as readonly string[]).includes(name)) continue
    out[name as AdPlacement] = id
  }
  return out
}

const SLOTS = parseSlots(ADSENSE_SLOTS_RAW)

/** 全站是否可能出現廣告：正式站 + 有發布商 ID */
export const ADS_ENABLED: boolean = IS_PRODUCTION_SITE && ADSENSE_CLIENT !== ''

export interface AdUnit {
  client: string
  slot: string
}

export function adUnitFor(placement: AdPlacement): AdUnit | null {
  if (!ADS_ENABLED) return null
  const slot = SLOTS[placement]
  return slot ? { client: ADSENSE_CLIENT, slot } : null
}

/** AdSense 載入器網址（帶 client，讓 Google 早一步知道是誰的版位） */
export function adsenseScriptUrl(client: string): string {
  return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`
}
