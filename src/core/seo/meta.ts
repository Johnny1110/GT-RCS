/**
 * SEO 中繼資料 — 純函式（PRD Phase 6 / F6-5.2）。
 *
 * 架構契約：
 * - 本層**不碰 DOM、不讀 config**。站台設定由呼叫端以 SiteConfig 注入，
 *   因為同一份邏輯要同時服務三個呼叫端：執行期的 useSeo（寫 document.head）、
 *   建置期的 prerender（寫死進 HTML）、以及 sitemap 產生器。三者共用才不會漂移。
 * - 一頁的正規網址由「語系中性路徑 + 語系前綴」推導，不允許各處自己拼字串：
 *   canonical、hreflang、sitemap、OG 只要有一個算法不同，Google 就會判成重複內容。
 */

export interface SiteConfig {
  /** 無尾斜線的絕對來源，如 https://rcs.guitar */
  origin: string
  name: string
  defaultLocale: string
  locales: readonly string[]
  /** 語系 → 路徑前綴；預設語系為空字串 */
  localePrefix: Readonly<Record<string, string>>
}

export interface PageMeta {
  title: string
  description: string
  /** 語系中性路徑，以 / 起頭、無尾斜線（首頁為 '/'） */
  path: string
  locale: string
  /** true = 不進索引（預覽頻道、練習工具頁） */
  noindex?: boolean
}

export interface MetaTag {
  name?: string
  property?: string
  content: string
}

export interface LinkTag {
  rel: string
  href: string
  hreflang?: string
}

/** '/knowledge' + en → '/en/knowledge'；首頁 + en → '/en' */
export function localizedPath(config: SiteConfig, path: string, locale: string): string {
  const prefix = config.localePrefix[locale] ?? ''
  if (path === '/') return prefix === '' ? '/' : prefix
  return `${prefix}${path}`
}

export function absoluteUrl(config: SiteConfig, path: string): string {
  return `${config.origin}${path === '/' ? '/' : path}`
}

export function canonicalUrl(config: SiteConfig, meta: PageMeta): string {
  return absoluteUrl(config, localizedPath(config, meta.path, meta.locale))
}

/**
 * hreflang 組：每個語系一條 + x-default 指向預設語系。
 * x-default 是給「語言不在清單裡」的訪客看的，少了它 Google 會自己猜。
 */
export function alternateLinks(config: SiteConfig, path: string): LinkTag[] {
  const links: LinkTag[] = config.locales.map((locale) => ({
    rel: 'alternate',
    hreflang: locale,
    href: absoluteUrl(config, localizedPath(config, path, locale)),
  }))
  links.push({
    rel: 'alternate',
    hreflang: 'x-default',
    href: absoluteUrl(config, localizedPath(config, path, config.defaultLocale)),
  })
  return links
}

/**
 * 完整的 <title> 文字。
 * 標題**本身已經含站名**時就不再接一次——首頁的 app.title 是
 * 「RCS — Rhythm & Chord & Scales」，接上去會變成「… — RCS — RCS」。
 */
export function documentTitle(config: SiteConfig, meta: PageMeta): string {
  return meta.title.includes(config.name) ? meta.title : `${meta.title} — ${config.name}`
}

export function metaTags(config: SiteConfig, meta: PageMeta): MetaTag[] {
  const title = documentTitle(config, meta)
  const url = canonicalUrl(config, meta)
  const tags: MetaTag[] = [
    { name: 'description', content: meta.description },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: config.name },
    { property: 'og:title', content: title },
    { property: 'og:description', content: meta.description },
    { property: 'og:url', content: url },
    { property: 'og:locale', content: meta.locale.replace('-', '_') },
    { name: 'twitter:card', content: 'summary' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: meta.description },
  ]
  // 只在需要時輸出 robots：預設就是可索引，多寫一行反而是雜訊
  if (meta.noindex) tags.unshift({ name: 'robots', content: 'noindex, follow' })
  return tags
}

/** canonical + 全部 hreflang；noindex 的頁面不發 hreflang（它不參與語系群組） */
export function linkTags(config: SiteConfig, meta: PageMeta): LinkTag[] {
  const canonical: LinkTag = { rel: 'canonical', href: canonicalUrl(config, meta) }
  return meta.noindex ? [canonical] : [canonical, ...alternateLinks(config, meta.path)]
}
