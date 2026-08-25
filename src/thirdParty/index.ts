/**
 * 第三方整合層 — 全站唯一會碰 window 上第三方全域物件的地方。
 *
 * 呼叫順序是規格不是習慣：同意預設值 → CMP → 分析。
 * 先有 Consent Mode 的 denied 預設，之後載入的任何 Google tag 才不會搶跑。
 */
import './types'
import { installConsentDefaults } from './consentMode'
import { initCmp } from './cmp'
import { initAnalytics } from './analytics'

export function initThirdParty(): void {
  installConsentDefaults()
  initCmp()
  initAnalytics()
}

export * from './consentMode'
export * from './analytics'
export * from './adsense'
export * from './cmp'
export { loadScript, resetLoadedScripts } from './loader'
