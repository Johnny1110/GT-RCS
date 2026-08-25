/**
 * 站台常數與 SiteConfig 組裝（PRD Phase 6 / F6-5）。
 *
 * 契約：**本檔不得讀 import.meta.env**。vite.config.ts 在 Node 情境下 import 它來
 * 生成 sitemap／prerender，那裡沒有 import.meta.env；環境變數一律走 config/env.ts。
 */
import type { SiteConfig } from '@/core/seo'

export type SiteLocale = 'zh-TW' | 'en'

/** 預設語系：不帶語系前綴的路徑就是它 */
export const DEFAULT_LOCALE: SiteLocale = 'zh-TW'
export const SITE_LOCALES: readonly SiteLocale[] = ['zh-TW', 'en']

/** 非預設語系的路徑前綴，如 /en/knowledge/scale-ionian */
export const LOCALE_PREFIX: Readonly<Record<SiteLocale, string>> = {
  'zh-TW': '',
  en: '/en',
}

export const SITE_NAME = 'RCS'

/** 未注入 VITE_SITE_ORIGIN 時的退路（正式網域） */
export const DEFAULT_ORIGIN = 'https://rcs.guitar'

export function siteConfig(origin: string): SiteConfig {
  return {
    origin: origin.replace(/\/$/, ''),
    name: SITE_NAME,
    defaultLocale: DEFAULT_LOCALE,
    locales: SITE_LOCALES,
    localePrefix: LOCALE_PREFIX,
  }
}

export function isSiteLocale(value: string): value is SiteLocale {
  return (SITE_LOCALES as readonly string[]).includes(value)
}
