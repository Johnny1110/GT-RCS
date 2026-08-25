/**
 * 把 PageMeta 寫進 document.head（PRD Phase 6 / F6-5.2）。
 *
 * 架構契約：
 * - 標籤內容一律由 `core/seo` 的純函式算出，本層只負責「寫進 DOM」。
 *   同一份純函式也被建置期的預渲染用到，執行期與靜態 HTML 才不會各說各話。
 * - **全站只有一個套用點**（App.vue 的 useSeoApplier）。頁面要改標題就登記 override，
 *   不是各自寫 head——兩處都在寫 head 的結果是誰後跑誰贏，換頁時序一亂就殘留舊標籤。
 * - 本層管理的標籤都帶 `data-rcs-seo`，每次套用先清空再重寫。
 * - **非正式站一律 noindex**：預覽頻道與本機 dev 不該進索引（F6-2.1）。
 */
import { onUnmounted, shallowRef, watchEffect } from 'vue'
import { linkTags, metaTags, documentTitle, type PageMeta } from '@/core/seo'
import { SITE, IS_PRODUCTION_SITE } from '@/config/env'

/**
 * 本層寫進 head 的標籤都帶這個標記，每次套用先清空再重寫。
 * **建置期的預渲染也用同一個標記**（build/prerender.ts 的 SEO_MARKER），
 * 這樣 Vue 掛載後會連靜態 HTML 留下的那組一起清掉——否則同一頁會有兩個 canonical。
 */
const MARKER = 'data-rcs-seo'

/** 由當前頁面登記的覆寫值；null = 用路由的預設 meta */
const override = shallowRef<PageMeta | null>(null)

function clearManagedTags(): void {
  for (const el of document.head.querySelectorAll(`[${MARKER}]`)) el.remove()
}

export function applyPageMeta(meta: PageMeta): void {
  const effective: PageMeta = IS_PRODUCTION_SITE ? meta : { ...meta, noindex: true }

  clearManagedTags()
  document.title = documentTitle(SITE, effective)
  // 刻意不碰 documentElement.lang：那是「畫面現在用什麼語言」，由 App.vue 的
  // 設定 watcher 擁有。這裡的 locale 是「這個網址屬於哪個語系」，兩者語意不同

  for (const tag of metaTags(SITE, effective)) {
    const el = document.createElement('meta')
    if (tag.name) el.setAttribute('name', tag.name)
    if (tag.property) el.setAttribute('property', tag.property)
    el.setAttribute('content', tag.content)
    el.setAttribute(MARKER, '')
    document.head.appendChild(el)
  }

  for (const link of linkTags(SITE, effective)) {
    const el = document.createElement('link')
    el.setAttribute('rel', link.rel)
    el.setAttribute('href', link.href)
    if (link.hreflang) el.setAttribute('hreflang', link.hreflang)
    el.setAttribute(MARKER, '')
    document.head.appendChild(el)
  }
}

/**
 * 內容頁登記自己的 meta（標題／描述來自非同步載入的內容，所以吃 getter）。
 * 卸載時撤銷登記，下一頁自動回到路由預設值。
 */
export function useSeoOverride(getMeta: () => PageMeta | null): void {
  watchEffect(() => {
    override.value = getMeta()
  })
  onUnmounted(() => {
    override.value = null
  })
}

/** 全站唯一的套用點，由 App.vue 呼叫 */
export function useSeoApplier(getFallback: () => PageMeta): void {
  watchEffect(() => applyPageMeta(override.value ?? getFallback()))
}
