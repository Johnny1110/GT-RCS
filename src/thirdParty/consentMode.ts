/**
 * Google Consent Mode v2（PRD Phase 6 / F6-4.1、F6-4.2）。
 *
 * 執行時機：**必須在任何 Google script 載入前**呼叫 installConsentDefaults()。
 * gtag 只是 dataLayer.push 的包裝，先把預設值排進佇列，之後載入的 tag 一讀就生效；
 * 順序反了就會有一次未經同意的請求發出去——那正是 GDPR 罰的東西。
 *
 * 預設值策略（照 Google 文件的兩段式寫法：先地區、後全域）：
 * - EEA/UK/CH：全部 denied，並 wait_for_update 讓 tag 等 CMP 的答案。
 * - 其餘地區：granted。那些地區不會跳同意視窗，若也設 denied，分析等於永久關閉。
 */
import { CONSENT_REQUIRED_REGIONS } from '@/config/consentRegions'

/** CMP 回覆前，tag 最多等這麼久（毫秒）。Google 建議 500 */
const WAIT_FOR_UPDATE_MS = 500

const CONSENT_KEYS = [
  'ad_storage',
  'ad_user_data',
  'ad_personalization',
  'analytics_storage',
] as const

function consentState(value: 'granted' | 'denied'): Record<string, string> {
  return Object.fromEntries(CONSENT_KEYS.map((key) => [key, value]))
}

let installed = false

export function installConsentDefaults(): void {
  if (installed) return
  installed = true

  window.dataLayer = window.dataLayer ?? []
  const dataLayer = window.dataLayer
  // 推進去的必須是 arguments 物件而不是陣列：gtag.js 讀的是 arguments 的形狀，
  // 換成陣列它會認不得。這是 Google 的既定介面，不是我們能選的寫法。
  function gtag(): void {
    // eslint-disable-next-line prefer-rest-params
    dataLayer.push(arguments)
  }
  const push: (...args: unknown[]) => void = window.gtag ?? gtag
  window.gtag = push

  push('consent', 'default', {
    ...consentState('denied'),
    region: CONSENT_REQUIRED_REGIONS,
    wait_for_update: WAIT_FOR_UPDATE_MS,
  })
  push('consent', 'default', consentState('granted'))
}

/** 測試用 */
export function resetConsentDefaults(): void {
  installed = false
}

/** CMP 是否已載入且提供「重新選擇」入口（非 EEA 訪客不會有） */
export function canRevokeConsent(): boolean {
  return typeof window.googlefc?.showRevocationMessage === 'function'
}

/** 讓使用者重新開啟同意視窗；沒有 CMP 時什麼都不做（頁尾按鈕會自己隱藏） */
export function showConsentRevocation(): void {
  window.googlefc?.showRevocationMessage?.()
}
