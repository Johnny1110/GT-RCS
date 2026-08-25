/**
 * GA4（PRD Phase 6 / F6-6.3）——受 Consent Mode 管控。
 *
 * 不自動送 page_view：SPA 換頁不會重新載入，Google 的自動 page_view 只會記到第一頁。
 * 改由 router.afterEach 明確送出，路徑才會對。
 */
import { GA_MEASUREMENT_ID, IS_PRODUCTION_SITE } from '@/config/env'
import { loadScript } from './loader'

export function analyticsEnabled(): boolean {
  return IS_PRODUCTION_SITE && GA_MEASUREMENT_ID !== ''
}

export function initAnalytics(): void {
  if (!analyticsEnabled()) return
  void loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`)
  window.gtag?.('js', new Date())
  window.gtag?.('config', GA_MEASUREMENT_ID, { send_page_view: false })
}

export function trackPageView(path: string, title: string): void {
  if (!analyticsEnabled()) return
  window.gtag?.('event', 'page_view', { page_path: path, page_title: title })
}
