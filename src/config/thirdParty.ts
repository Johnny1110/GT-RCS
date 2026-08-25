/**
 * 第三方網域白名單的型別化入口（PRD Phase 6 / F6-1.3、F6-3.2）。
 *
 * 契約：
 * - 清單本體在 `third-party.json`，是唯一真相。執行期注入 script 的 `src/thirdParty/**`
 *   與生成 CSP 標頭的 `scripts/gen-firebase-json.mjs` 都讀它。
 * - 這一層純資料，不碰 DOM。「要不要載入」是 `src/thirdParty/**` 的事。
 * - 新增第三方服務 = 在 JSON 加一組 + 這裡加一個 group key；`deploy/firebase.spec.ts`
 *   會因為 firebase.json 沒同步而失敗——這就是防止 CSP 與實際載入清單漂移的機制。
 */
import raw from './third-party.json'

export type ThirdPartyGroup = 'adsense' | 'cmp' | 'analytics'
export type CspDirective = 'script' | 'connect' | 'frame' | 'img'

interface GroupEntry {
  why: string
  script: string[]
  connect: string[]
  frame: string[]
  img: string[]
}

const GROUPS: readonly ThirdPartyGroup[] = ['adsense', 'cmp', 'analytics']

const table = raw as unknown as Record<ThirdPartyGroup, GroupEntry>

/** 某群組在某 CSP 指令下需要的網域 */
export function domainsFor(group: ThirdPartyGroup, directive: CspDirective): readonly string[] {
  return table[group][directive]
}

/** 全部群組在某 CSP 指令下的網域聯集（排序去重，讓生成結果穩定可比對） */
export function allDomains(directive: CspDirective): readonly string[] {
  const set = new Set<string>()
  for (const group of GROUPS) for (const d of table[group][directive]) set.add(d)
  return [...set].sort()
}

/** script 的來源網域必須在白名單內才准注入——擋掉「順手加一個網域」繞過 CSP 的路 */
export function isAllowedScriptUrl(url: string): boolean {
  return allDomains('script').some((origin) => url.startsWith(`${origin}/`))
}

export { GROUPS as THIRD_PARTY_GROUPS }
