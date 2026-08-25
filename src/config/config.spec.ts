/**
 * 設定層的漂移守門測試（PRD Phase 6）。
 *
 * 這一組測試存在的理由只有一個：Phase 6 有三份清單彼此必須一致，
 * 而不一致的症狀全都只在 production 才看得到——
 * sitemap 指向不存在的路由、CSP 擋掉自己要載的 script、廣告出現在跟練頁。
 * 三者都不會讓本機 build 失敗，所以只能靠測試守。
 */
import { describe, it, expect } from 'vitest'
import { APP_ROUTES, LEGAL_DOCS, isLegalDoc, knowledgeEntryPath, legalPath, prerenderPaths, sitemapPaths } from './routes'
import { AD_PLACEMENTS, PLACEMENT_HEIGHT, PLACEMENT_ROUTES, adsenseScriptUrl, parseSlots } from './ads'
import { allDomains, domainsFor, isAllowedScriptUrl, THIRD_PARTY_GROUPS } from './thirdParty'
import { DEFAULT_LOCALE, LOCALE_PREFIX, SITE_LOCALES, isSiteLocale, siteConfig } from './site'
import { CONSENT_REQUIRED_REGIONS } from './consentRegions'
import { listModules } from '@/modules/registry'
import '@/modules'

describe('APP_ROUTES 與模組註冊表', () => {
  /** 手寫清單與註冊表漂移的症狀是「新模組悄悄從 sitemap 消失」，不會有人發現 */
  it('每個註冊的模組都在 APP_ROUTES 裡', () => {
    for (const m of listModules()) {
      expect(APP_ROUTES, `模組 ${m.id} 的路由不在 config/routes.ts`).toContain(m.route)
    }
  })

  it('APP_ROUTES 裡沒有已不存在的路由', () => {
    const known = new Set(['/', '/stats', ...listModules().map((m) => m.route)])
    for (const route of APP_ROUTES) {
      expect(known, `${route} 不對應任何模組或工具頁`).toContain(route)
    }
  })

  it('沒有重複', () => {
    expect(new Set(APP_ROUTES).size).toBe(APP_ROUTES.length)
  })
})

describe('廣告版位白名單', () => {
  const moduleRoutes = listModules().map((m) => m.route)

  /** DoD：所有跟練播放畫面零廣告。實作方式是那些頁面根本沒有廣告容器 */
  it('沒有任何練習模組路由出現在廣告白名單裡', () => {
    const adRoutes = Object.values(PLACEMENT_ROUTES).flat()
    for (const route of moduleRoutes) {
      expect(adRoutes, `${route} 是練習模組，不得有廣告版位`).not.toContain(route)
    }
  })

  it('每個版位都有路由與保留高度（少一個就會是沒保留高度的版位 → CLS）', () => {
    for (const placement of AD_PLACEMENTS) {
      expect(PLACEMENT_ROUTES[placement].length).toBeGreaterThan(0)
      expect(PLACEMENT_HEIGHT[placement].mobile).toBeGreaterThan(0)
      expect(PLACEMENT_HEIGHT[placement].desktop).toBeGreaterThan(0)
    }
  })

  it('廣告 script 網址帶 client 參數且在白名單網域內', () => {
    const url = adsenseScriptUrl('ca-pub-1234567890123456')
    expect(url).toContain('client=ca-pub-1234567890123456')
    expect(isAllowedScriptUrl(url)).toBe(true)
  })
})

describe('parseSlots', () => {
  it('解析 `版位:slotId` 逗號清單', () => {
    expect(parseSlots('home:111,stats:222')).toEqual({ home: '111', stats: '222' })
  })

  it('忽略空白與格式不對的片段，而不是丟例外', () => {
    // 建置期環境變數打錯字不該讓整個站掛掉——最壞的結果是那個版位不出現
    expect(parseSlots(' home : 111 , 壞掉的, :222, unknown:333 ,')).toEqual({ home: '111' })
  })

  it('空字串 → 沒有任何版位', () => {
    expect(parseSlots('')).toEqual({})
  })
})

describe('第三方網域白名單', () => {
  it('每個群組在四個 CSP 指令下都有定義（缺一個等於 CSP 少一段）', () => {
    for (const group of THIRD_PARTY_GROUPS) {
      for (const directive of ['script', 'connect', 'frame', 'img'] as const) {
        expect(Array.isArray(domainsFor(group, directive))).toBe(true)
      }
    }
  })

  it('allDomains 去重且排序（生成的 CSP 才會穩定可比對）', () => {
    const list = allDomains('script')
    expect(new Set(list).size).toBe(list.length)
    expect([...list].sort()).toEqual([...list])
  })

  it('實際會載入的三個 script 網址都在白名單內', () => {
    expect(isAllowedScriptUrl('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=x')).toBe(true)
    expect(isAllowedScriptUrl('https://fundingchoicesmessages.google.com/i/pub-1?ers=1')).toBe(true)
    expect(isAllowedScriptUrl('https://www.googletagmanager.com/gtag/js?id=G-1')).toBe(true)
  })

  it('白名單外一律擋掉', () => {
    expect(isAllowedScriptUrl('https://evil.example.com/x.js')).toBe(false)
  })

  /** 前綴比對必須連斜線一起比，否則 googlesyndication.com.evil.com 會被放行 */
  it('不會被「白名單網域當前綴」的網址騙過', () => {
    expect(isAllowedScriptUrl('https://pagead2.googlesyndication.com.evil.com/x.js')).toBe(false)
  })
})

describe('站台設定', () => {
  it('預設語系沒有前綴，其餘語系有', () => {
    expect(LOCALE_PREFIX[DEFAULT_LOCALE]).toBe('')
    for (const locale of SITE_LOCALES) {
      if (locale === DEFAULT_LOCALE) continue
      expect(LOCALE_PREFIX[locale]).toMatch(/^\/\w+$/)
    }
  })

  it('siteConfig 去掉 origin 的尾斜線（否則所有絕對網址都會多一條斜線）', () => {
    expect(siteConfig('https://rcs.guitar/').origin).toBe('https://rcs.guitar')
  })

  it('isSiteLocale 只認得清單裡的語系', () => {
    expect(isSiteLocale('en')).toBe(true)
    expect(isSiteLocale('ja')).toBe(false)
  })
})

describe('內容路徑', () => {
  it('legalPath / knowledgeEntryPath 以 / 起頭且無尾斜線', () => {
    for (const doc of LEGAL_DOCS) expect(legalPath(doc)).toBe(`/${doc}`)
    expect(knowledgeEntryPath('scale-ionian')).toBe('/knowledge/scale-ionian')
  })

  it('isLegalDoc 只認得三份文件', () => {
    expect(isLegalDoc('privacy')).toBe(true)
    expect(isLegalDoc('terms')).toBe(false)
  })

  it('預渲染清單含首頁、知識索引、全部條目與法遵頁', () => {
    const paths = prerenderPaths(['scale-ionian', 'rhythm-backbeat'])
    expect(paths).toContain('/')
    expect(paths).toContain('/knowledge')
    expect(paths).toContain('/knowledge/scale-ionian')
    for (const doc of LEGAL_DOCS) expect(paths).toContain(legalPath(doc))
  })

  it('sitemap 清單沒有重複路徑（重複會被 Google 當成設定錯誤）', () => {
    const paths = sitemapPaths(['scale-ionian']).map((e) => e.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('sitemap 的權重：內容頁高於工具頁高於法遵頁', () => {
    const table = new Map(sitemapPaths(['scale-ionian']).map((e) => [e.path, e.priority]))
    expect(table.get('/knowledge/scale-ionian')).toBeGreaterThan(table.get('/stats') ?? 0)
    expect(table.get('/stats')).toBeGreaterThan(table.get('/privacy') ?? 0)
  })
})

describe('同意徵求地區', () => {
  it('涵蓋 EU 27 + EEA + UK + CH，且無重複', () => {
    expect(CONSENT_REQUIRED_REGIONS).toHaveLength(32)
    expect(new Set(CONSENT_REQUIRED_REGIONS).size).toBe(32)
    for (const code of ['DE', 'FR', 'IE', 'NO', 'GB', 'CH']) {
      expect(CONSENT_REQUIRED_REGIONS).toContain(code)
    }
  })

  it('全部是 ISO 3166-1 alpha-2 大寫兩碼', () => {
    for (const code of CONSENT_REQUIRED_REGIONS) expect(code).toMatch(/^[A-Z]{2}$/)
  })
})
