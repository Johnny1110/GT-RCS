/**
 * 建置期預渲染 + sitemap / robots / ads.txt（PRD Phase 6 / F6-5.1、F6-5.2、F6-3.3）。
 *
 * 為什麼自己寫而不是引 vite-ssg：本站的內容頁全是**結構化資料**（content/**.json），
 * 把它變成 HTML 只需要一個純函式，不需要在 Node 裡跑一次 Vue。省下的是一整條 SSR
 * 相依鏈與它的維護成本，而首屏 bundle 是本專案的硬指標。
 *
 * 產出的 HTML 會被 Vue 掛載時取代——這是刻意的：
 * 它服務的是**不執行 JS 的讀者**（AdSense 審核、Bing、社群卡片預覽、第一輪爬取）。
 * 執行 JS 的瀏覽器看到的是完整 SPA，兩者內容一致，不是 cloaking。
 *
 * 契約：中繼標籤一律由 `src/core/seo` 的純函式產生，與執行期的 useSeo 同一份邏輯。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Plugin } from 'vite'
import { linkTags, metaTags, documentTitle, buildSitemap, buildRobots, type PageMeta, type SiteConfig } from '../src/core/seo'
import { siteConfig, DEFAULT_ORIGIN, SITE_LOCALES, LOCALE_PREFIX, type SiteLocale } from '../src/config/site'
import { KNOWLEDGE_BASE_PATH, LEGAL_DOCS, knowledgeEntryPath, legalPath, sitemapPaths } from '../src/config/routes'
import { entrySlug } from '../src/content/knowledge/slug'
import {
  escapeHtml, interpolate, lookup, renderArticle, renderBlocks, summarize, type Messages,
} from './renderContent'
import type { ContentBlock } from '../src/content/blocks'

interface EntryContent {
  title: string
  blocks: ContentBlock[]
}

interface LegalContent extends EntryContent {
  updated: string
}

export interface PrerenderOptions {
  origin: string
  /** 'production' | 'preview' | 'local'；只有 production 允許索引 */
  deployEnv: string
  /** ca-pub-…；有值才寫 ads.txt */
  adsenseClient: string
}

/** 與 composables/useSeo.ts 的 MARKER 相同：執行期靠它清掉預渲染留下的標籤 */
const SEO_MARKER = 'data-rcs-seo'

/** meta description 長度上限，與 LegalView / KnowledgeEntryView 用的同一個值 */
const DESCRIPTION_LENGTH = 155
const SUMMARY_LENGTH = 90

/** 條目頁最多列這麼多同類連結；與 KnowledgeEntryView 的 RELATED_LIMIT 相同 */
const RELATED_LIMIT = 6

function localizedHref(path: string, locale: SiteLocale): string {
  const prefix = LOCALE_PREFIX[locale]
  return path === '/' ? (prefix === '' ? '/' : prefix) : `${prefix}${path}`
}

/**
 * 每一頁都帶的頁尾導覽。
 * 不只是為了好看：不執行 JS 的爬蟲若在條目頁落地卻沒有任何連結可走，那一頁就是孤島。
 * 有了它，從站上任何一頁都走得到知識索引與三份法遵頁。
 */
function renderFooter(messages: Messages, locale: SiteLocale): string {
  const links = [
    { path: KNOWLEDGE_BASE_PATH, label: lookup(messages, 'knowledgeIndex.title') },
    ...LEGAL_DOCS.map((doc) => ({ path: legalPath(doc), label: lookup(messages, `legal.${doc}.title`) })),
  ]
    .map(
      (link) =>
        `<a href="${localizedHref(link.path, locale)}" class="text-xs text-ink-400">${escapeHtml(link.label)}</a>`,
    )
    .join('')
  return `<footer class="mt-auto border-t border-ink-800 px-6 py-6"><nav class="mx-auto flex max-w-4xl flex-wrap items-center gap-x-5 gap-y-2">${links}<span class="ml-auto font-mono text-[11px] text-ink-400">${escapeHtml(
    lookup(messages, 'legal.footerNote'),
  )}</span></nav></footer>`
}

/** 條目頁：麵包屑 + 內文 + 同類連結，與 KnowledgeEntryView 的結構一致 */
function renderKnowledgeEntry(
  messages: Messages,
  knowledge: Record<string, EntryContent>,
  id: string,
  locale: SiteLocale,
): string {
  const entry = knowledge[id]
  if (!entry) throw new Error(`Missing knowledge entry "${id}" in ${locale}`)
  const group = id.split('.')[0]
  const related = Object.entries(knowledge)
    .filter(([other]) => other !== id && other.split('.')[0] === group)
    .slice(0, RELATED_LIMIT)
    .map(
      ([otherId, content]) =>
        `<li><a href="${localizedHref(knowledgeEntryPath(entrySlug(otherId)), locale)}" class="inline-flex rounded border border-ink-700 px-3 py-1.5 text-sm text-ink-300">${escapeHtml(
          content.title,
        )}</a></li>`,
    )
    .join('')
  const back = `<nav class="rcs-micro"><a href="${localizedHref(
    KNOWLEDGE_BASE_PATH,
    locale,
  )}" class="text-ink-400">← ${escapeHtml(lookup(messages, 'knowledgeIndex.title'))}</a></nav>`
  const relatedBlock =
    related === ''
      ? ''
      : `<section class="flex flex-col gap-3 border-t border-ink-800 pt-6"><h2 class="rcs-micro">${escapeHtml(
          lookup(messages, 'knowledgeIndex.related'),
        )}</h2><ul class="flex flex-wrap gap-2">${related}</ul></section>`
  return `<div class="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6 pt-10">${back}<article class="flex flex-col gap-5"><h1 class="rcs-h1">${escapeHtml(
    entry.title,
  )}</h1>${renderBlocks(entry.blocks)}</article>${relatedBlock}</div>`
}

/**
 * 首頁的靜態骨架。**必須與 `src/views/HomeView.vue` 的 masthead 與介紹段落一致**：
 * 這段 HTML 是爬蟲與 Vue 掛載前的第一次繪製看到的東西，兩邊不一致就會閃版。
 *
 * 「繼續練習」那一塊不在這裡：它讀 localStorage，建置期沒有那份資料，
 * 而且對爬蟲來說也不是內容。它掛載後才出現，出現在介紹段落之前。
 */
function renderHome(messages: Messages): string {
  const parts = [
    `<header class="flex flex-col gap-3"><div class="flex flex-col gap-1.5">` +
      `<h1 class="rcs-display font-mono tracking-[0.12em]">RCS</h1>` +
      `<p class="rcs-micro">${escapeHtml(lookup(messages, 'app.wordmark'))}</p></div>` +
      `<p class="rcs-body max-w-xl text-ink-300">${escapeHtml(lookup(messages, 'app.tagline'))}</p></header>`,
    `<p class="rcs-body text-ink-300">${escapeHtml(lookup(messages, 'home.intro.what'))}</p>`,
    `<p class="rcs-body text-ink-300">${escapeHtml(lookup(messages, 'home.intro.why'))}</p>`,
  ]
  const items = (['rhythm', 'chords', 'scales'] as const)
    .map(
      (key) =>
        `<li class="rcs-body border-l border-ink-700 pl-3 text-ink-300"><strong class="font-semibold text-ink-50">${escapeHtml(
          lookup(messages, `category.${key}`),
        )}</strong> — ${escapeHtml(lookup(messages, `home.highlight.${key}`))}</li>`,
    )
    .join('')
  parts.push(`<ul class="flex flex-col gap-2">${items}</ul>`)
  parts.push(`<p class="rcs-body text-ink-300">${escapeHtml(lookup(messages, 'home.intro.privacy'))}</p>`)
  return `<div class="mx-auto flex w-full max-w-4xl flex-col gap-12 p-6 pt-12">${parts.join('')}</div>`
}

function renderKnowledgeIndex(
  messages: Messages,
  knowledge: Record<string, EntryContent>,
  locale: SiteLocale,
): string {
  const prefix = LOCALE_PREFIX[locale]
  const links = Object.entries(knowledge)
    .map(([id, entry]) => {
      const href = `${prefix}${knowledgeEntryPath(entrySlug(id))}`
      return `<li><a href="${href}" class="flex flex-col gap-1 rcs-panel p-4"><span class="font-medium text-ink-50">${escapeHtml(
        entry.title,
      )}</span><span class="rcs-small text-ink-400">${escapeHtml(
        summarize(entry.blocks, SUMMARY_LENGTH),
      )}</span></a></li>`
    })
    .join('')
  const count = interpolate(lookup(messages, 'knowledgeIndex.count'), {
    count: Object.keys(knowledge).length,
  })
  return `<div class="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 pt-10"><header class="flex flex-col gap-3"><h1 class="rcs-h1">${escapeHtml(
    lookup(messages, 'knowledgeIndex.title'),
  )}</h1><p class="rcs-body max-w-2xl text-ink-300">${escapeHtml(
    lookup(messages, 'knowledgeIndex.description'),
  )}</p><p class="font-mono text-[11px] text-ink-400">${escapeHtml(count)}</p></header><ul class="grid gap-3 sm:grid-cols-2">${links}</ul></div>`
}

/**
 * 預渲染的 head 標籤。
 *
 * 每個標籤都帶 `data-rcs-seo`——與執行期 useSeo 用的是同一個標記，
 * 所以 Vue 掛載後第一件事就是把它們清掉再寫自己的。少了這個標記，
 * 靜態 HTML 的 canonical 會與執行期的並存，同一頁出現兩個 canonical
 * （SPA fallback 的頁面更慘：留下的是首頁的 canonical）。
 */
function headFor(config: SiteConfig, meta: PageMeta): string {
  const lines = [`  <title>${escapeHtml(documentTitle(config, meta))}</title>`]
  for (const tag of metaTags(config, meta)) {
    const attr = tag.name ? `name="${escapeHtml(tag.name)}"` : `property="${escapeHtml(tag.property ?? '')}"`
    lines.push(`  <meta ${attr} content="${escapeHtml(tag.content)}" ${SEO_MARKER} />`)
  }
  for (const link of linkTags(config, meta)) {
    const hreflang = link.hreflang ? ` hreflang="${escapeHtml(link.hreflang)}"` : ''
    lines.push(`  <link rel="${escapeHtml(link.rel)}"${hreflang} href="${escapeHtml(link.href)}" ${SEO_MARKER} />`)
  }
  return lines.join('\n')
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

export function prerenderPlugin(options: PrerenderOptions): Plugin {
  const config = siteConfig(options.origin || DEFAULT_ORIGIN)
  const allowIndex = options.deployEnv === 'production'

  return {
    name: 'rcs-prerender',
    apply: 'build',
    // writeBundle 之後 dist/index.html 已經帶著 hash 過的 asset 連結，拿它當模板才是對的
    closeBundle() {
      const outDir = 'dist'
      const template = readFileSync(join(outDir, 'index.html'), 'utf8')

      const write = (path: string, contents: string): void => {
        const full = join(outDir, path)
        mkdirSync(dirname(full), { recursive: true })
        writeFileSync(full, contents, 'utf8')
      }

      const emitPage = (locale: SiteLocale, meta: PageMeta, body: string, footer: string): void => {
        const prefix = LOCALE_PREFIX[locale]
        const file =
          meta.path === '/' ? `${prefix}/index.html` : `${prefix}${meta.path}/index.html`
        const html = template
          .replace(/<html lang="[^"]*"/, `<html lang="${locale}"`)
          .replace(/\s*<title>[\s\S]*?<\/title>/, '')
          .replace('</head>', `${headFor(config, meta)}\n</head>`)
          .replace(
            '<div id="app"></div>',
            `<div id="app"><div class="flex min-h-screen flex-col bg-ink-950 text-ink-100">${body}${footer}</div></div>`,
          )
        write(file.replace(/^\//, ''), html)
      }

      let pages = 0
      let slugs: string[] = []

      for (const locale of SITE_LOCALES) {
        const messages = readJson<Messages>(`src/locales/${locale}.json`)
        const knowledge = readJson<Record<string, EntryContent>>(
          `src/content/knowledge/${locale}.json`,
        )
        const legal = readJson<Record<string, LegalContent>>(`src/content/legal/${locale}.json`)
        slugs = Object.keys(knowledge).map(entrySlug)
        const footer = renderFooter(messages, locale)

        emitPage(
          locale,
          {
            title: lookup(messages, 'app.title'),
            description: lookup(messages, 'app.tagline'),
            path: '/',
            locale,
            ...(allowIndex ? {} : { noindex: true }),
          },
          renderHome(messages),
          footer,
        )
        pages += 1

        emitPage(
          locale,
          {
            title: lookup(messages, 'knowledgeIndex.title'),
            description: lookup(messages, 'knowledgeIndex.description'),
            path: KNOWLEDGE_BASE_PATH,
            locale,
            ...(allowIndex ? {} : { noindex: true }),
          },
          renderKnowledgeIndex(messages, knowledge, locale),
          footer,
        )
        pages += 1

        for (const [id, entry] of Object.entries(knowledge)) {
          emitPage(
            locale,
            {
              title: entry.title,
              description: summarize(entry.blocks, DESCRIPTION_LENGTH),
              path: knowledgeEntryPath(entrySlug(id)),
              locale,
              ...(allowIndex ? {} : { noindex: true }),
            },
            renderKnowledgeEntry(messages, knowledge, id, locale),
            footer,
          )
          pages += 1
        }

        for (const doc of LEGAL_DOCS) {
          const entry = legal[doc]
          if (!entry) throw new Error(`Missing legal document "${doc}" in ${locale}`)
          emitPage(
            locale,
            {
              title: entry.title,
              description: summarize(entry.blocks, DESCRIPTION_LENGTH),
              path: legalPath(doc),
              locale,
              ...(allowIndex ? {} : { noindex: true }),
            },
            renderArticle(
              entry.title,
              entry.blocks,
              interpolate(lookup(messages, 'legal.updated'), { date: entry.updated }),
            ),
            footer,
          )
          pages += 1
        }
      }

      write('sitemap.xml', buildSitemap(config, sitemapPaths(slugs)))
      write('robots.txt', buildRobots(config, { allowIndex }))
      if (options.adsenseClient) {
        // AdSense 規定的授權賣家宣告；發布商 ID 去掉 ca- 前綴
        write(
          'ads.txt',
          `google.com, ${options.adsenseClient.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`,
        )
      }

      this.info?.(
        `prerendered ${pages} pages · sitemap ${sitemapPaths(slugs).length * SITE_LOCALES.length} urls · index=${allowIndex}`,
      )
    },
  }
}
