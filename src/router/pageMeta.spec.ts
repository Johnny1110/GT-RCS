import { describe, it, expect } from 'vitest'
import { defaultPageMeta, neutralPath, pathForLocale, routeLocaleOf } from './pageMeta'

describe('neutralPath', () => {
  it('脫掉語系前綴', () => {
    expect(neutralPath('/en/knowledge/scale-ionian')).toBe('/knowledge/scale-ionian')
  })

  it('/en 就是英文首頁', () => {
    expect(neutralPath('/en')).toBe('/')
  })

  it('不帶前綴的路徑原樣返回', () => {
    expect(neutralPath('/stats')).toBe('/stats')
  })

  it('尾斜線一律去掉（canonical 不能有兩種寫法）', () => {
    expect(neutralPath('/knowledge/')).toBe('/knowledge')
    expect(neutralPath('/en/knowledge/')).toBe('/knowledge')
    expect(neutralPath('/')).toBe('/')
  })

  /** 有條目叫 english-something 時，不能因為開頭像 /en 就被誤切 */
  it('只脫完整的路徑片段，不做字首比對', () => {
    expect(neutralPath('/enigma')).toBe('/enigma')
  })
})

describe('pathForLocale', () => {
  it('中英互轉', () => {
    expect(pathForLocale('/knowledge', 'en')).toBe('/en/knowledge')
    expect(pathForLocale('/en/knowledge', 'zh-TW')).toBe('/knowledge')
  })

  it('首頁互轉', () => {
    expect(pathForLocale('/', 'en')).toBe('/en')
    expect(pathForLocale('/en', 'zh-TW')).toBe('/')
  })

  it('轉回同一個語系是原地不動（切換鈕才知道要不要導頁）', () => {
    expect(pathForLocale('/en/stats', 'en')).toBe('/en/stats')
    expect(pathForLocale('/stats', 'zh-TW')).toBe('/stats')
  })

  it('來回兩次回到原點', () => {
    const start = '/knowledge/rhythm-backbeat'
    expect(pathForLocale(pathForLocale(start, 'en'), 'zh-TW')).toBe(start)
  })
})

describe('routeLocaleOf', () => {
  it('沒有標記就是預設語系', () => {
    expect(routeLocaleOf({})).toBe('zh-TW')
  })

  it('認得 meta.locale', () => {
    expect(routeLocaleOf({ locale: 'en' })).toBe('en')
  })

  it('不認識的值退回預設語系，而不是照單全收', () => {
    expect(routeLocaleOf({ locale: 'ja' })).toBe('zh-TW')
    expect(routeLocaleOf({ locale: 42 })).toBe('zh-TW')
  })
})

describe('defaultPageMeta', () => {
  const t = (key: string): string => `translated:${key}`

  it('用路由上的 i18n key 產生標題與描述', () => {
    const meta = defaultPageMeta('/stats', { titleKey: 'stats.title', descriptionKey: 'stats.description' }, t)
    expect(meta.title).toBe('translated:stats.title')
    expect(meta.description).toBe('translated:stats.description')
    expect(meta.path).toBe('/stats')
  })

  it('路徑一律是語系中性的（canonical 由 locale 另外決定）', () => {
    const meta = defaultPageMeta('/en/stats', { titleKey: 'stats.title', locale: 'en' }, t)
    expect(meta.path).toBe('/stats')
    expect(meta.locale).toBe('en')
  })

  it('沒給 key 時退回站名與標語，不會出現 undefined', () => {
    const meta = defaultPageMeta('/whatever', {}, t)
    expect(meta.title).toBe('translated:app.title')
    expect(meta.description).toBe('translated:app.tagline')
  })

  /** 404 若沒有 noindex，Google 會把每個打錯的網址都收進索引（soft 404） */
  it('noindex 標記會傳遞下去', () => {
    expect(defaultPageMeta('/nope', { noindex: true }, t).noindex).toBe(true)
    expect(defaultPageMeta('/stats', {}, t).noindex).toBeUndefined()
  })
})
