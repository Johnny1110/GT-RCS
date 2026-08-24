/**
 * 樂理知識內容 — 結構化格式（PRD F2-3）。
 *
 * 為什麼不用 Markdown：解析器約 12KB gz（首屏預算 200KB），且自由格式會與
 * design-system 的排版規範打架。結構化區塊零依賴、型別安全，並讓
 * 「兩個語系的 entry id 必須一致」成為可測的規則（knowledge.spec.ts）。
 *
 * 內文支援 **粗體** 行內標記，其餘一律純文字（樂理符號如 b3、m7b5 不做特殊處理）。
 */
export type ContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }

export interface KnowledgeEntryContent {
  title: string
  blocks: ContentBlock[]
}

export type KnowledgeBundle = Record<string, KnowledgeEntryContent>

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
