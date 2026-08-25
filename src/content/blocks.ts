/**
 * 結構化內文區塊 — 知識條目與法遵頁共用的內容格式。
 *
 * 為什麼不用 Markdown：解析器約 12KB gz（首屏預算 200KB），且自由格式會與
 * design-system 的排版規範打架。結構化區塊零依賴、型別安全，並讓
 * 「兩個語系的 entry id 必須一致」成為可測的規則。
 *
 * 內文支援 **粗體** 行內標記，其餘一律純文字（樂理符號如 b3、m7b5 不做特殊處理）。
 */
export type ContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }

export interface InlineSpan {
  text: string
  strong: boolean
}

/** 解析 **粗體**；標記不成對時整段視為純文字（寧可不上粗體，也不要吃掉內容） */
export function parseInline(text: string): InlineSpan[] {
  const parts = text.split('**')
  if (parts.length % 2 === 0) return [{ text, strong: false }]
  return parts
    .map((part, i) => ({ text: part, strong: i % 2 === 1 }))
    .filter((span) => span.text !== '')
}

/**
 * 取內容摘要給 meta description 用（PRD Phase 6 / F6-5.2）。
 * 取第一段文字、脫掉粗體標記、超長就在**詞界**截斷——
 * 從中間切斷一個字的描述在搜尋結果裡看起來像壞掉的頁面。
 */
export function summarize(blocks: readonly ContentBlock[], maxLength: number): string {
  const first = blocks.find((b) => b.type === 'paragraph')
  const text = (first?.type === 'paragraph' ? first.text : '').replace(/\*\*/g, '').trim()
  if (text.length <= maxLength) return text
  const cut = text.slice(0, maxLength)
  // CJK 沒有空白詞界，找不到就直接切——那是正常結果，不是退化路徑
  const lastSpace = cut.lastIndexOf(' ')
  const body = lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${body.trimEnd()}…`
}
