/**
 * sitemap.xml / robots.txt — 純函式（PRD Phase 6 / F6-5.2）。
 *
 * 契約：本層不讀時鐘（lastmod 由呼叫端注入，建置期才有意義）、不碰檔案系統，
 * 只把 SitemapEntry[] 變成字串。寫檔是 vite 外掛的事。
 */
import { absoluteUrl, localizedPath, type SiteConfig } from './meta'

export interface SitemapEntry {
  /** 語系中性路徑；每個語系會各產生一筆 <url> */
  path: string
  /** 0–1，相對權重 */
  priority?: number
  changefreq?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  /** ISO 日期字串（YYYY-MM-DD） */
  lastmod?: string
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 每個語系一筆 <url>，並在每筆內附上全語系的 xhtml:link——
 * Google 要求 hreflang 群組互相指認，只在 HTML 裡放 link 標籤而 sitemap 不放，
 * 會讓還沒被渲染的頁面漏掉語系關聯。
 */
export function buildSitemap(
  config: SiteConfig,
  entries: readonly SitemapEntry[],
): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ]
  for (const entry of entries) {
    for (const locale of config.locales) {
      lines.push('  <url>')
      lines.push(`    <loc>${escapeXml(absoluteUrl(config, localizedPath(config, entry.path, locale)))}</loc>`)
      for (const alt of config.locales) {
        const href = escapeXml(absoluteUrl(config, localizedPath(config, entry.path, alt)))
        lines.push(`    <xhtml:link rel="alternate" hreflang="${alt}" href="${href}"/>`)
      }
      if (entry.lastmod) lines.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`)
      if (entry.changefreq) lines.push(`    <changefreq>${entry.changefreq}</changefreq>`)
      if (entry.priority !== undefined) lines.push(`    <priority>${entry.priority.toFixed(1)}</priority>`)
      lines.push('  </url>')
    }
  }
  lines.push('</urlset>')
  return `${lines.join('\n')}\n`
}

/**
 * 預覽頻道一律 Disallow：/ ——預覽網址被索引會跟 production 互相稀釋權重，
 * 而且審核中的站被 Google 看到兩份一樣的內容不是好事。
 */
export function buildRobots(config: SiteConfig, options: { allowIndex: boolean }): string {
  if (!options.allowIndex) {
    return ['User-agent: *', 'Disallow: /', ''].join('\n')
  }
  return [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${config.origin}/sitemap.xml`,
    '',
  ].join('\n')
}
