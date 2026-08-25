import { describe, it, expect } from 'vitest'
import { entrySlug, slugToEntryId } from './slug'
import zhTW from './zh-TW.json'
import en from './en.json'

const IDS = Object.keys(zhTW)

describe('entrySlug', () => {
  it('把群組與名稱以單一連字號接起來，並 kebab 化 camelCase', () => {
    expect(entrySlug('scale.ionian')).toBe('scale-ionian')
    expect(entrySlug('scale.majorPentatonic')).toBe('scale-major-pentatonic')
    expect(entrySlug('rhythm.sixEight')).toBe('rhythm-six-eight')
  })

  it('名稱本身含連字號時原樣保留', () => {
    expect(entrySlug('scale.practice-tips')).toBe('scale-practice-tips')
  })

  it('數字不被拆開', () => {
    expect(entrySlug('progression.4536251')).toBe('progression-4536251')
    expect(entrySlug('rhythm.subdivisionGrid')).toBe('rhythm-subdivision-grid')
  })
})

describe('全部知識條目的 slug', () => {
  /** 兩條條目撞到同一個 slug，其中一頁就會被另一頁的預渲染覆蓋掉——而且沒有錯誤訊息 */
  it('互不重複', () => {
    const slugs = IDS.map(entrySlug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('只含小寫英數與連字號（網址安全，不需要 encode）', () => {
    for (const id of IDS) expect(entrySlug(id)).toMatch(/^[a-z0-9-]+$/)
  })

  it('查得回原本的 id', () => {
    for (const id of IDS) expect(slugToEntryId(entrySlug(id), IDS)).toBe(id)
  })

  it('查不到就回 undefined，不是猜一個', () => {
    expect(slugToEntryId('scale-does-not-exist', IDS)).toBeUndefined()
  })

  /** 兩個語系的 slug 必須一致，hreflang 才配得成對 */
  it('中英兩個語系產生同一組 slug', () => {
    expect(Object.keys(en).map(entrySlug).sort()).toEqual(IDS.map(entrySlug).sort())
  })
})
