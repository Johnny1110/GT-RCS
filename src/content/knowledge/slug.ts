/**
 * 知識條目 id ↔ 網址 slug（PRD Phase 6 / F6-5.1）。
 *
 * 為什麼不直接把 id 當 slug：`scale.majorPentatonic` 出現在網址裡對搜尋引擎與人都不友善。
 * 為什麼反向查詢要吃 id 清單而不是純字串反解：kebab 化會把 `practice-tips` 與
 * `majorPentatonic` 壓成同一種形狀，硬要反解就會猜錯。查表不會猜。
 *
 * 本檔零 import：vite.config.ts 在建置期要用它產生 sitemap 與預渲染頁面。
 */

/** camelCase → kebab-case，並全部轉小寫；數字原樣保留 */
function kebab(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

/** 'scale.majorPentatonic' → 'scale-major-pentatonic' */
export function entrySlug(id: string): string {
  const dot = id.indexOf('.')
  if (dot < 0) return kebab(id)
  return `${kebab(id.slice(0, dot))}-${kebab(id.slice(dot + 1))}`
}

/** 反向查表；找不到回 undefined（路由自行決定要不要 404） */
export function slugToEntryId(slug: string, ids: readonly string[]): string | undefined {
  return ids.find((id) => entrySlug(id) === slug)
}
