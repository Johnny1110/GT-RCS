/**
 * Google 認證 CMP（Privacy & messaging / Funding Choices）— PRD Phase 6 / F6-4.1。
 *
 * 為什麼獨立於廣告 script 載入：AdSense tag 會順帶帶出 CMP，但我們的廣告是白名單版位，
 * 練習頁根本不載 AdSense。若讓 CMP 跟著廣告走，從練習頁進站的 EEA 訪客就永遠不會被詢問，
 * 而分析仍在跑——那是漏洞。所以 CMP 全站載入，廣告依然只在白名單版位出現。
 */
import { ADSENSE_CLIENT, IS_PRODUCTION_SITE } from '@/config/env'
import { loadScript } from './loader'

/** `ca-pub-123…` → `pub-123…`（CMP 端點吃的是沒有 ca- 前綴的形式） */
export function cmpPublisherId(client: string): string {
  return client.replace(/^ca-/, '')
}

export function cmpScriptUrl(client: string): string {
  return `https://fundingchoicesmessages.google.com/i/${encodeURIComponent(cmpPublisherId(client))}?ers=1`
}

/**
 * Google 規定的存在訊號：建一個名為 googlefcPresent 的隱藏 iframe。
 * 少了它，CMP 判斷不出訊息是否真的被顯示過。body 還沒好就下一個 tick 再試。
 */
function signalPresence(): void {
  const frames = window.frames as unknown as Record<string, unknown>
  if (frames['googlefcPresent']) return
  if (!document.body) {
    setTimeout(signalPresence, 0)
    return
  }
  const iframe = document.createElement('iframe')
  iframe.name = 'googlefcPresent'
  iframe.style.display = 'none'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = 'none'
  iframe.style.position = 'absolute'
  iframe.style.left = '-1000px'
  iframe.style.top = '-1000px'
  document.body.appendChild(iframe)
}

export function initCmp(): void {
  if (!IS_PRODUCTION_SITE || ADSENSE_CLIENT === '') return
  signalPresence()
  void loadScript(cmpScriptUrl(ADSENSE_CLIENT))
}
