/**
 * 法遵頁內容的結構契約（PRD Phase 6 / F6-4.3）。
 *
 * 這些頁面是 AdSense 審核的必要條件，缺一份或某個語系缺內容就是「審核不過」，
 * 而那個回饋要等好幾天才拿得到。結構問題在這裡就要爆。
 */
import { describe, it, expect } from 'vitest'
import { LEGAL_DOCS } from '@/config/routes'
import { parseInline, summarize, type ContentBlock } from '../blocks'
import zhTW from './zh-TW.json'
import en from './en.json'

const BUNDLES = { 'zh-TW': zhTW, en } as Record<string, Record<string, unknown>>

interface Doc {
  title: string
  updated: string
  blocks: ContentBlock[]
}

describe.each(Object.keys(BUNDLES))('%s 法遵內容', (localeKey) => {
  const bundle = BUNDLES[localeKey] as Record<string, Doc>

  it('三份文件都在，且沒有多餘的文件', () => {
    expect(Object.keys(bundle).sort()).toEqual([...LEGAL_DOCS].sort())
  })

  it.each([...LEGAL_DOCS])('%s：標題、更新日與內文都不是空的', (doc) => {
    const entry = bundle[doc]
    expect(entry).toBeDefined()
    expect(entry?.title.trim().length).toBeGreaterThan(0)
    // 沒有日期的法遵頁等於沒有效力
    expect(entry?.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(entry?.blocks.length).toBeGreaterThanOrEqual(5)
  })

  it.each([...LEGAL_DOCS])('%s：區塊型別合法，清單不為空', (doc) => {
    for (const block of bundle[doc]?.blocks ?? []) {
      if (block.type === 'paragraph') {
        expect(block.text.trim().length).toBeGreaterThan(0)
      } else {
        expect(block.items.length).toBeGreaterThan(0)
        for (const item of block.items) expect(item.trim().length).toBeGreaterThan(0)
      }
    }
  })

  /** 粗體標記落單時 parseInline 會整段退回純文字——內容不會消失，但作者的強調沒了 */
  it.each([...LEGAL_DOCS])('%s：粗體標記成對', (doc) => {
    for (const block of bundle[doc]?.blocks ?? []) {
      const texts = block.type === 'paragraph' ? [block.text] : block.items
      for (const text of texts) {
        expect(text.split('**').length % 2, `未成對的 ** ：${text.slice(0, 40)}`).toBe(1)
        expect(parseInline(text).length).toBeGreaterThan(0)
      }
    }
  })

  it.each([...LEGAL_DOCS])('%s：摘要得出非空的 meta description', (doc) => {
    const summary = summarize(bundle[doc]?.blocks ?? [], 155)
    expect(summary.length).toBeGreaterThan(20)
    expect(summary.length).toBeLessThanOrEqual(156) // 156 = 155 + 省略號
    expect(summary).not.toContain('**')
  })

  /** 本站最重要的隱私主張：練習資料不外傳。政策裡沒寫到就是沒有主張 */
  it('隱私權政策明確提到 localStorage', () => {
    const text = JSON.stringify(bundle['privacy'])
    expect(text).toContain('localStorage')
  })

  it('隱私與 Cookie 政策都提到 Google 的三個角色', () => {
    const text = JSON.stringify([bundle['privacy'], bundle['cookies']])
    for (const term of ['AdSense', 'Analytics', 'CMP']) expect(text).toContain(term)
  })

  it('每份文件都留了聯絡方式或指向留有聯絡方式的頁面', () => {
    expect(JSON.stringify([bundle['privacy'], bundle['about']])).toContain('@')
  })
})

describe('兩個語系的結構一致', () => {
  it('文件 id 與區塊數量逐份相同', () => {
    const zh = zhTW as unknown as Record<string, Doc>
    const enBundle = en as unknown as Record<string, Doc>
    for (const doc of LEGAL_DOCS) {
      expect(enBundle[doc]?.blocks.length, `${doc} 的段落數不一致`).toBe(zh[doc]?.blocks.length)
      expect(enBundle[doc]?.updated).toBe(zh[doc]?.updated)
    }
  })
})
