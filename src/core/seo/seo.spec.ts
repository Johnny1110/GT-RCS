import { describe, it, expect } from 'vitest'
import {
  absoluteUrl, alternateLinks, buildRobots, buildSitemap, canonicalUrl,
  documentTitle, linkTags, localizedPath, metaTags, type PageMeta, type SiteConfig,
} from './index'

const CONFIG: SiteConfig = {
  origin: 'https://rcs.guitar',
  name: 'RCS',
  defaultLocale: 'zh-TW',
  locales: ['zh-TW', 'en'],
  localePrefix: { 'zh-TW': '', en: '/en' },
}

function page(overrides: Partial<PageMeta> = {}): PageMeta {
  return { title: 'Ionian', description: '最穩定的音階', path: '/knowledge/scale-ionian', locale: 'zh-TW', ...overrides }
}

describe('localizedPath', () => {
  it('預設語系不加前綴', () => {
    expect(localizedPath(CONFIG, '/knowledge', 'zh-TW')).toBe('/knowledge')
  })

  it('非預設語系加前綴', () => {
    expect(localizedPath(CONFIG, '/knowledge', 'en')).toBe('/en/knowledge')
  })

  /** 首頁是唯一會產生 '//' 的路徑，特別處理 */
  it('首頁的英文版是 /en 而不是 /en/', () => {
    expect(localizedPath(CONFIG, '/', 'en')).toBe('/en')
    expect(localizedPath(CONFIG, '/', 'zh-TW')).toBe('/')
  })

  it('不認識的語系當作沒有前綴，不會產生 undefined 字串', () => {
    expect(localizedPath(CONFIG, '/knowledge', 'ja')).toBe('/knowledge')
  })
})

describe('canonical 與 hreflang', () => {
  it('canonical 與網址本身一致（英文頁指向英文網址）', () => {
    expect(canonicalUrl(CONFIG, page({ locale: 'en' }))).toBe('https://rcs.guitar/en/knowledge/scale-ionian')
  })

  it('hreflang 每個語系一條，外加 x-default 指向預設語系', () => {
    const links = alternateLinks(CONFIG, '/knowledge')
    expect(links.map((l) => l.hreflang)).toEqual(['zh-TW', 'en', 'x-default'])
    expect(links.find((l) => l.hreflang === 'x-default')?.href).toBe('https://rcs.guitar/knowledge')
  })

  /** 語系群組必須互相指認，否則 Google 只會認得其中一半 */
  it('同一組的兩個語系網址互為 alternate', () => {
    const zh = alternateLinks(CONFIG, '/knowledge').map((l) => l.href)
    const en = alternateLinks(CONFIG, '/knowledge').map((l) => l.href)
    expect(zh).toEqual(en)
  })

  it('noindex 的頁面不發 hreflang（它不屬於任何語系群組）', () => {
    const links = linkTags(CONFIG, page({ noindex: true }))
    expect(links).toHaveLength(1)
    expect(links[0]?.rel).toBe('canonical')
  })

  it('absoluteUrl 不產生重複斜線', () => {
    expect(absoluteUrl(CONFIG, '/')).toBe('https://rcs.guitar/')
    expect(absoluteUrl(CONFIG, '/stats')).toBe('https://rcs.guitar/stats')
  })
})

describe('documentTitle', () => {
  it('一般頁面接上站名', () => {
    expect(documentTitle(CONFIG, page())).toBe('Ionian — RCS')
  })

  it('標題本身就是站名時不重複', () => {
    expect(documentTitle(CONFIG, page({ title: 'RCS' }))).toBe('RCS')
  })

  /** 首頁的 app.title 是「RCS — Rhythm & Chord & Scales」，接上去會變成 … — RCS — RCS */
  it('標題已經含站名時不再接一次', () => {
    expect(documentTitle(CONFIG, page({ title: 'RCS — Rhythm & Chord & Scales' })))
      .toBe('RCS — Rhythm & Chord & Scales')
    expect(documentTitle(CONFIG, page({ title: '關於 RCS' }))).toBe('關於 RCS')
  })
})

describe('metaTags', () => {
  it('og:locale 用底線格式（zh-TW → zh_TW）', () => {
    const og = metaTags(CONFIG, page()).find((t) => t.property === 'og:locale')
    expect(og?.content).toBe('zh_TW')
  })

  it('og:url 與 canonical 相同', () => {
    const meta = page({ locale: 'en' })
    const og = metaTags(CONFIG, meta).find((t) => t.property === 'og:url')
    expect(og?.content).toBe(canonicalUrl(CONFIG, meta))
  })

  it('預設不輸出 robots 標籤，noindex 時才有', () => {
    expect(metaTags(CONFIG, page()).some((t) => t.name === 'robots')).toBe(false)
    expect(metaTags(CONFIG, page({ noindex: true }))[0]).toEqual({ name: 'robots', content: 'noindex, follow' })
  })

  it('描述同時出現在 description、og:description 與 twitter:description', () => {
    const tags = metaTags(CONFIG, page())
    const descriptions = tags.filter((t) => t.content === '最穩定的音階')
    expect(descriptions).toHaveLength(3)
  })
})

describe('buildSitemap', () => {
  const xml = buildSitemap(CONFIG, [{ path: '/', priority: 1 }, { path: '/knowledge', priority: 0.9 }])

  it('每個路徑逐語系各一筆 <url>', () => {
    expect(xml.match(/<url>/g)).toHaveLength(4)
  })

  it('每一筆都帶完整的語系互指', () => {
    expect(xml).toContain('<loc>https://rcs.guitar/en/knowledge</loc>')
    expect(xml).toContain('<xhtml:link rel="alternate" hreflang="zh-TW" href="https://rcs.guitar/knowledge"/>')
  })

  it('沒給 lastmod/changefreq 就不輸出空標籤', () => {
    expect(xml).not.toContain('<lastmod>')
    expect(xml).not.toContain('<changefreq>')
  })

  it('& 會被轉義（否則整份 XML 解析失敗）', () => {
    const escaped = buildSitemap(CONFIG, [{ path: '/a&b' }])
    expect(escaped).toContain('/a&amp;b')
    expect(escaped).not.toMatch(/a&b/)
  })

  it('priority 固定一位小數', () => {
    expect(xml).toContain('<priority>1.0</priority>')
    expect(xml).toContain('<priority>0.9</priority>')
  })
})

describe('buildRobots', () => {
  it('正式站開放索引並指向 sitemap', () => {
    const txt = buildRobots(CONFIG, { allowIndex: true })
    expect(txt).toContain('Allow: /')
    expect(txt).toContain('Sitemap: https://rcs.guitar/sitemap.xml')
  })

  /** 預覽頻道被索引 = 跟 production 互相稀釋，還讓審核中的站出現兩份一樣的內容 */
  it('非正式站全站 Disallow，且不宣告 sitemap', () => {
    const txt = buildRobots(CONFIG, { allowIndex: false })
    expect(txt).toContain('Disallow: /')
    expect(txt).not.toContain('Sitemap:')
  })
})
