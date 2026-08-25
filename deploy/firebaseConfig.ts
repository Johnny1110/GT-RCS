/**
 * firebase.json 的產生器（PRD Phase 6 / F6-1.1、F6-1.3）。
 *
 * 為什麼是產生的而不是手寫：CSP 的第三方網域必須與執行期實際載入的清單一致，
 * 兩份手動維護的清單一定會漂移，而漂移的症狀是「production 廣告不見了」——
 * 本機與預覽都看不出來（本機不載廣告）。所以兩邊都讀 config/third-party.json，
 * 並由 deploy/firebase.spec.ts 鎖定 firebase.json 與產生器輸出逐字相同。
 *
 * 改法：改 third-party.json → `npm run gen:firebase` → commit。
 */
import { allDomains } from '../src/config/thirdParty'

/**
 * 關於 script-src 的 'unsafe-inline'：
 * AdSense 與 CMP 會注入行內 script，且靜態主機發不出 per-request nonce，
 * 所以這個洞是**必要**的，不是疏忽。CSP 在此的價值變成「限制可載入的第三方網域」，
 * 而不是「阻擋行內腳本」——把它寫清楚，比假裝有一個更嚴格的 CSP 誠實。
 *
 * 沒有放 'unsafe-eval'：部分廣告素材可能需要它。真的遇到素材壞掉再加，
 * 不預先開這個洞（見 docs/ops/runbook.md 的疑難排解）。
 */
function contentSecurityPolicy(): string {
  const script = allDomains('script').join(' ')
  const connect = allDomains('connect').join(' ')
  const frame = allDomains('frame').join(' ')
  const img = allDomains('img').join(' ')

  return [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline' ${script}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${img}`,
    `font-src 'self' data:`,
    `connect-src 'self' ${connect}`,
    `frame-src 'self' ${frame}`,
    `media-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'self'`,
    `upgrade-insecure-requests`,
  ].join('; ')
}

/** hash 過檔名的資產可以永久快取；HTML 一律不快取，否則發版後使用者還在舊殼裡 */
const IMMUTABLE = 'public, max-age=31536000, immutable'
const NO_CACHE = 'no-cache'

export function buildFirebaseConfig(): unknown {
  return {
    hosting: {
      public: 'dist',
      ignore: ['firebase.json', '**/.*', '**/node_modules/**'],
      // 網址不帶 .html、不帶尾斜線——與 core/seo 產生的 canonical 完全一致
      cleanUrls: true,
      trailingSlash: false,
      // SPA fallback：預渲染出來的靜態檔會先被命中，命不中才落到這條
      rewrites: [{ source: '**', destination: '/index.html' }],
      headers: [
        {
          source: '/assets/**',
          headers: [{ key: 'Cache-Control', value: IMMUTABLE }],
        },
        {
          source: '**/*.@(html|json|xml|txt)',
          headers: [{ key: 'Cache-Control', value: NO_CACHE }],
        },
        {
          source: '**',
          headers: [
            { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            // 這個站不需要這些能力；關掉可以讓廣告 iframe 也拿不到
            { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=(), payment=()' },
          ],
        },
      ],
    },
  }
}

/** 序列化格式固定：測試逐字比對，格式一變就會誤報 */
export function serializeFirebaseConfig(): string {
  return `${JSON.stringify(buildFirebaseConfig(), null, 2)}\n`
}
