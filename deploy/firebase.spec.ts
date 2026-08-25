/**
 * firebase.json 的漂移守門測試（PRD Phase 6 / §5 風險：CSP 與第三方清單衝突）。
 *
 * 症狀說明為什麼值得一個測試：有人在 third-party.json 加了網域讓執行期載得到，
 * 但忘了重新產生 firebase.json，於是 production 的 CSP 擋掉那個 script——
 * 本機（不載第三方）與預覽（同樣不載）都看不出來，只有正式站的廣告會消失。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { serializeFirebaseConfig } from './firebaseConfig'
import { allDomains } from '../src/config/thirdParty'

const committed = readFileSync('firebase.json', 'utf8')

interface HostingHeader {
  source: string
  headers: { key: string; value: string }[]
}

interface FirebaseJson {
  hosting: {
    public: string
    cleanUrls: boolean
    trailingSlash: boolean
    rewrites: { source: string; destination: string }[]
    headers: HostingHeader[]
  }
}

const parsed = JSON.parse(committed) as FirebaseJson

function headerValue(key: string): string {
  for (const group of parsed.hosting.headers) {
    const found = group.headers.find((h) => h.key === key)
    if (found) return found.value
  }
  throw new Error(`header ${key} not found`)
}

describe('firebase.json 與產生器同步', () => {
  it('逐字相同（不同就跑 npm run gen:firebase 並 commit）', () => {
    expect(committed).toBe(serializeFirebaseConfig())
  })
})

describe('CSP 與第三方白名單一致', () => {
  const csp = headerValue('Content-Security-Policy')

  const directives = new Map(
    csp.split('; ').map((part) => {
      const [name, ...values] = part.split(' ')
      return [name ?? '', values]
    }),
  )

  it.each([
    ['script-src', 'script'],
    ['connect-src', 'connect'],
    ['frame-src', 'frame'],
    ['img-src', 'img'],
  ] as const)('%s 涵蓋白名單裡的每一個網域', (directive, kind) => {
    const values = directives.get(directive) ?? []
    for (const domain of allDomains(kind)) {
      expect(values, `${directive} 少了 ${domain}`).toContain(domain)
    }
  })

  it('CSP 裡沒有白名單以外的第三方網域（避免偷偷放行）', () => {
    const known = new Set([
      ...allDomains('script'), ...allDomains('connect'),
      ...allDomains('frame'), ...allDomains('img'),
    ])
    for (const domain of csp.match(/https:\/\/[^\s;]+/g) ?? []) {
      expect(known, `${domain} 不在 third-party.json 裡`).toContain(domain)
    }
  })

  it('關鍵防護沒有被順手放寬', () => {
    expect(directives.get('object-src')).toEqual(["'none'"])
    expect(directives.get('base-uri')).toEqual(["'self'"])
    expect(directives.get('form-action')).toEqual(["'self'"])
    // 'unsafe-eval' 是刻意不開的；廣告素材真的需要時再加，並在 runbook 記一筆
    expect(csp).not.toContain("'unsafe-eval'")
  })

  it('style-src 允許行內樣式但不允許第三方樣式表', () => {
    expect(directives.get('style-src')).toEqual(["'self'", "'unsafe-inline'"])
  })
})

describe('Hosting 設定', () => {
  it('SPA fallback 指向 index.html', () => {
    expect(parsed.hosting.rewrites).toEqual([{ source: '**', destination: '/index.html' }])
  })

  it('網址規則與 core/seo 產生的 canonical 一致：無 .html、無尾斜線', () => {
    expect(parsed.hosting.cleanUrls).toBe(true)
    expect(parsed.hosting.trailingSlash).toBe(false)
  })

  it('hash 過的資產永久快取，HTML 不快取（否則發版後使用者還在舊殼裡）', () => {
    const assets = parsed.hosting.headers.find((h) => h.source === '/assets/**')
    expect(assets?.headers[0]?.value).toContain('immutable')
    const html = parsed.hosting.headers.find((h) => h.source.includes('html'))
    expect(html?.headers[0]?.value).toBe('no-cache')
  })

  it('基本安全標頭都在（F6-1.3）', () => {
    expect(headerValue('X-Content-Type-Options')).toBe('nosniff')
    expect(headerValue('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(headerValue('Permissions-Policy')).toContain('camera=()')
  })

  it('部署的是 dist', () => {
    expect(parsed.hosting.public).toBe('dist')
  })
})
