/**
 * 預渲染的 HTML 產生（PRD Phase 6 / F6-5.1）。
 *
 * 這一層的錯誤特別難發現：輸出是靜態檔，本機看的是 SPA 版本，
 * 壞掉的 HTML 只有爬蟲和 view-source 才看得到。所以跳脫規則逐條鎖定。
 */
import { describe, it, expect } from 'vitest'
import { escapeHtml, interpolate, lookup, renderArticle, renderBlocks, renderInline, summarize } from './renderContent'
import type { ContentBlock } from '../src/content/blocks'

describe('escapeHtml', () => {
  it('跳脫五個會破壞標記的字元', () => {
    expect(escapeHtml('<a href="x">A & B</a>')).toBe('&lt;a href=&quot;x&quot;&gt;A &amp; B&lt;/a&gt;')
  })

  it('& 先跳脫，不會產生 &amp;lt; 這種雙重跳脫', () => {
    expect(escapeHtml('a < b & c')).toBe('a &lt; b &amp; c')
  })

  it('樂理符號原樣保留（b3、m7b5、#11 都不是特殊字元）', () => {
    expect(escapeHtml('m7b5 與 #11')).toBe('m7b5 與 #11')
  })
})

describe('renderInline', () => {
  it('**粗體** 變成 strong，其餘跳脫', () => {
    expect(renderInline('注意 **avoid note** 這件事')).toBe(
      '注意 <strong class="font-semibold text-ink-50">avoid note</strong> 這件事',
    )
  })

  it('粗體內容也會跳脫（內容裡的角括號不能變成標籤）', () => {
    expect(renderInline('**<script>**')).toContain('&lt;script&gt;')
    expect(renderInline('**<script>**')).not.toContain('<script>')
  })

  it('標記落單時整段當純文字，內容不會被吃掉', () => {
    expect(renderInline('a ** b')).toBe('a ** b')
  })
})

describe('renderBlocks', () => {
  const blocks: ContentBlock[] = [
    { type: 'paragraph', text: '第一段' },
    { type: 'list', items: ['項目一', '項目二'] },
  ]

  it('段落與清單各自成標籤', () => {
    const html = renderBlocks(blocks)
    expect(html).toContain('<p class="rcs-body text-ink-300">第一段</p>')
    expect(html.match(/<li /g)).toHaveLength(2)
  })

  /** 與 RichText.vue 同一組 class：不一致就會在 Vue 掛載那一瞬間看到版型跳動 */
  it('容器 class 與 RichText.vue 相同', () => {
    expect(renderBlocks([])).toBe('<div class="flex max-w-[65ch] flex-col gap-3"></div>')
  })
})

describe('renderArticle', () => {
  it('標題進 h1（爬蟲靠它判斷這頁在講什麼）', () => {
    expect(renderArticle('Ionian', [])).toContain('<h1 class="rcs-h1">Ionian</h1>')
  })

  it('標題也會跳脫', () => {
    expect(renderArticle('A & B', [])).toContain('A &amp; B')
  })

  it('沒有附註時不留空標籤', () => {
    expect(renderArticle('X', [])).not.toContain('<p class="font-mono')
    expect(renderArticle('X', [], '更新：2026-08-25')).toContain('更新：2026-08-25')
  })
})

describe('summarize', () => {
  it('取第一段並脫掉粗體標記', () => {
    expect(summarize([{ type: 'paragraph', text: '**重點**在這' }], 100)).toBe('重點在這')
  })

  it('略過開頭的清單，找到第一個段落', () => {
    const blocks: ContentBlock[] = [{ type: 'list', items: ['x'] }, { type: 'paragraph', text: '正文' }]
    expect(summarize(blocks, 100)).toBe('正文')
  })

  it('超長時在詞界截斷並加省略號', () => {
    const text = 'The most stable scale of them all and here is a great deal more text to push it over'
    const out = summarize([{ type: 'paragraph', text }], 40)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(41)
    expect(out).not.toMatch(/\s…$/)
  })

  it('沒有段落時回空字串，而不是 undefined', () => {
    expect(summarize([], 100)).toBe('')
    expect(summarize([{ type: 'list', items: ['x'] }], 100)).toBe('')
  })
})

describe('lookup / interpolate', () => {
  const messages = { app: { title: 'RCS' }, knowledgeIndex: { count: '共 {count} 篇' } }

  it('走得進巢狀 key', () => {
    expect(lookup(messages, 'app.title')).toBe('RCS')
  })

  /** 與 vue-i18n 同樣的失敗方式：把 key 印出來，畫面上一眼看得出哪裡漏了 */
  it('查不到就回 key 本身', () => {
    expect(lookup(messages, 'app.nope')).toBe('app.nope')
    expect(lookup(messages, 'app.title.deeper')).toBe('app.title.deeper')
  })

  it('代入具名參數', () => {
    expect(interpolate(lookup(messages, 'knowledgeIndex.count'), { count: 33 })).toBe('共 33 篇')
  })

  it('缺參數時保留原樣，不會印出 undefined', () => {
    expect(interpolate('共 {count} 篇', {})).toBe('共 {count} 篇')
  })
})
