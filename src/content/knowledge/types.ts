/**
 * 樂理知識內容 — 結構化格式（PRD F2-3）。
 * 內文區塊型別已提升到 `content/blocks.ts`（法遵頁共用），此處只保留知識條目的外殼。
 */
import type { ContentBlock } from '../blocks'

export interface KnowledgeEntryContent {
  title: string
  blocks: ContentBlock[]
}

export type KnowledgeBundle = Record<string, KnowledgeEntryContent>

export type { ContentBlock, InlineSpan } from '../blocks'
export { parseInline } from '../blocks'
