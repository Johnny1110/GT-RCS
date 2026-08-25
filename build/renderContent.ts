/**
 * 結構化內容 → 靜態 HTML（PRD Phase 6 / F6-5.1）。
 *
 * 純函式，不碰檔案系統，好讓 renderContent.spec.ts 逐條驗證跳脫與版型。
 * 這一層產出的 class 必須與 RichText.vue 相同：Vue 掛載會用自己的 DOM 取代這裡的內容，
 * 兩邊不一致就會在掛載那一瞬間看到版型跳動。
 *
 * **粗體解析與摘要都直接用 src/content/blocks.ts 的實作**，不在這裡重寫一份——
 * 建置期的靜態 HTML 與執行期的畫面必須逐字相同，兩套實作遲早會分岔。
 */
import { parseInline, summarize, type ContentBlock } from '../src/content/blocks'

export { summarize }

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderInline(text: string): string {
  return parseInline(text)
    .map((span) =>
      span.strong
        ? `<strong class="font-semibold text-ink-50">${escapeHtml(span.text)}</strong>`
        : escapeHtml(span.text),
    )
    .join('')
}

/** 與 RichText.vue 同一組 class */
export function renderBlocks(blocks: readonly ContentBlock[]): string {
  const out: string[] = []
  for (const block of blocks) {
    if (block.type === 'paragraph') {
      out.push(`<p class="text-sm leading-7 text-ink-300">${renderInline(block.text)}</p>`)
    } else {
      const items = block.items
        .map(
          (item) =>
            `<li class="border-l border-ink-700 pl-3 text-sm leading-7 text-ink-300">${renderInline(item)}</li>`,
        )
        .join('')
      out.push(`<ul class="flex flex-col gap-2">${items}</ul>`)
    }
  }
  return `<div class="flex max-w-[65ch] flex-col gap-3">${out.join('')}</div>`
}

export function renderArticle(title: string, blocks: readonly ContentBlock[], note?: string): string {
  const heading = `<h1 class="text-2xl font-semibold text-ink-50">${escapeHtml(title)}</h1>`
  const meta = note ? `<p class="font-mono text-[11px] text-ink-400">${escapeHtml(note)}</p>` : ''
  return `<div class="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 pt-10"><header class="flex flex-col gap-2">${heading}${meta}</header>${renderBlocks(blocks)}</div>`
}

export type Messages = Record<string, unknown>

/** i18n 訊息查表：查不到就回 key 本身，與 vue-i18n 的行為一致（畫面上看得出來哪裡漏了） */
export function lookup(messages: Messages, key: string): string {
  let node: unknown = messages
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return key
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' ? node : key
}

export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_m, name: string) => String(values[name] ?? `{${name}}`))
}
