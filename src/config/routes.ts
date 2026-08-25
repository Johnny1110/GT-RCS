/**
 * 靜態路由目錄 — sitemap 與預渲染的唯一清單（PRD Phase 6 / F6-5）。
 *
 * 為什麼要手寫一份而不是從 modules/registry 讀：registry 的 manifest 會連帶
 * import 到 Vue 與帶 `@/` 別名的模組，而 vite.config.ts 在 Node 情境下 import 不了那些。
 * 代價是可能漂移，所以 `src/config/routes.spec.ts` 鎖定本清單與註冊表完全一致——
 * 新增模組卻忘了更新這裡，測試會失敗而不是靜靜地從 sitemap 消失。
 *
 * 本檔零 import（型別除外），vite.config.ts 直接讀。
 */

/** 練習模組與工具頁；有內容但要靠 JS 渲染，所以不預渲染、權重較低 */
export const APP_ROUTES: readonly string[] = [
  '/',
  '/stats',
  '/rhythm/metronome',
  '/rhythm/subdivision',
  '/rhythm/groove',
  '/chords/circle-progressions',
  '/chords/key-practice',
  '/chords/custom',
  '/scales/explorer',
  '/scales/practice',
]

export const LEGAL_DOCS = ['privacy', 'cookies', 'about'] as const
export type LegalDoc = (typeof LEGAL_DOCS)[number]

export const KNOWLEDGE_BASE_PATH = '/knowledge'

export function legalPath(doc: LegalDoc): string {
  return `/${doc}`
}

export function knowledgeEntryPath(slug: string): string {
  return `${KNOWLEDGE_BASE_PATH}/${slug}`
}

export function isLegalDoc(value: string): value is LegalDoc {
  return (LEGAL_DOCS as readonly string[]).includes(value)
}

/**
 * 會被寫成靜態 HTML 的路徑（語系中性）。
 * 挑選標準：**內容本身就是答案**的頁面——AdSense 審核與搜尋引擎要看的是這些，
 * 而不是需要點擊播放才有意義的練習工具。
 */
export function prerenderPaths(knowledgeSlugs: readonly string[]): string[] {
  return [
    '/',
    KNOWLEDGE_BASE_PATH,
    ...knowledgeSlugs.map(knowledgeEntryPath),
    ...LEGAL_DOCS.map(legalPath),
  ]
}

/** sitemap 全清單：內容頁在前（權重高），工具頁在後 */
export function sitemapPaths(knowledgeSlugs: readonly string[]): { path: string; priority: number }[] {
  return [
    { path: '/', priority: 1 },
    { path: KNOWLEDGE_BASE_PATH, priority: 0.9 },
    ...knowledgeSlugs.map((slug) => ({ path: knowledgeEntryPath(slug), priority: 0.8 })),
    ...APP_ROUTES.filter((p) => p !== '/').map((path) => ({ path, priority: 0.6 })),
    ...LEGAL_DOCS.map((doc) => ({ path: legalPath(doc), priority: 0.3 })),
  ]
}
