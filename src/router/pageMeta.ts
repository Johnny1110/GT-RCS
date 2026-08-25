/**
 * 路由 → PageMeta 的預設推導（PRD Phase 6 / F6-5.2）。
 *
 * 純字串運算，不碰 DOM：路徑的語系前綴怎麼脫、怎麼裝，只在這裡定義一次。
 * canonical、hreflang、語言切換鈕、sitemap 都靠它，任何一處自己拼字串就會產生
 * 對不起來的網址組。
 */
import { DEFAULT_LOCALE, LOCALE_PREFIX, SITE_LOCALES, isSiteLocale, type SiteLocale } from '@/config/site'
import type { PageMeta } from '@/core/seo'

/** 這條路由屬於哪個語系（由網址前綴決定，不看使用者設定） */
export function routeLocaleOf(meta: Readonly<Record<string, unknown>>): SiteLocale {
  const value = meta['locale']
  return typeof value === 'string' && isSiteLocale(value) ? value : DEFAULT_LOCALE
}

/** '/en/knowledge/x' → '/knowledge/x'；'/en' → '/'；尾斜線一律去掉 */
export function neutralPath(path: string): string {
  const trimmed = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
  for (const locale of SITE_LOCALES) {
    const prefix = LOCALE_PREFIX[locale]
    if (prefix === '') continue
    if (trimmed === prefix) return '/'
    if (trimmed.startsWith(`${prefix}/`)) return trimmed.slice(prefix.length)
  }
  return trimmed
}

/**
 * 純從路徑判斷語系前綴；沒有前綴回 null（= 由使用者的設定決定）。
 *
 * main.ts 在建立 i18n **之前**用它決定初始語系。晚一步做的代價不只是閃一下：
 * 內容頁會先用舊語系載一次、再用新語系載一次，兩個非同步結果誰後到誰贏。
 */
export function localeFromPath(path: string): SiteLocale | null {
  for (const locale of SITE_LOCALES) {
    const prefix = LOCALE_PREFIX[locale]
    if (prefix === '') continue
    if (path === prefix || path.startsWith(`${prefix}/`)) return locale
  }
  return null
}

/** 同一頁的另一個語系網址 */
export function pathForLocale(path: string, locale: SiteLocale): string {
  const neutral = neutralPath(path)
  const prefix = LOCALE_PREFIX[locale]
  if (neutral === '/') return prefix === '' ? '/' : prefix
  return `${prefix}${neutral}`
}

export interface RouteMetaLike {
  titleKey?: unknown
  descriptionKey?: unknown
  noindex?: unknown
  locale?: unknown
}

/**
 * 路由層級的預設 meta。內容頁會用 useSeoOverride 換掉標題與描述，
 * 但在內容載入完成前先有一組正確的網址與語系，總比 head 一片空白好。
 */
export function defaultPageMeta(
  path: string,
  meta: Readonly<RouteMetaLike>,
  t: (key: string) => string,
): PageMeta {
  const locale = routeLocaleOf(meta as Readonly<Record<string, unknown>>)
  const titleKey = typeof meta.titleKey === 'string' ? meta.titleKey : 'app.title'
  const descriptionKey = typeof meta.descriptionKey === 'string' ? meta.descriptionKey : 'app.tagline'
  const page: PageMeta = {
    title: t(titleKey),
    description: t(descriptionKey),
    path: neutralPath(path),
    locale,
  }
  return meta.noindex === true ? { ...page, noindex: true } : page
}
