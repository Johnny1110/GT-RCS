<script setup lang="ts">
/**
 * 首頁：產品介紹 + 三大類導覽（導覽由模組註冊表生成，新增模組自動出現）。
 *
 * 介紹文案不是行銷裝飾（PRD F6-5.1）：AdSense 審核與搜尋引擎需要一個
 * 「不執行 JS 也讀得懂這站在幹嘛」的落地頁，所以這段文字會被預渲染進靜態 HTML。
 * **改動這一段的 DOM 就要同步改 `build/prerender.ts` 的 renderHome()**，
 * 否則首次繪製會先閃一個舊版面再被 Vue 換掉。
 *
 * 版面上的兩個決定：
 *
 * **1. 「繼續練習」是這一頁唯一的反白按鈕**（design-system.md §5：每畫面最多一顆）。
 * 打開 app 的人十次有九次是要接著昨天練的東西，讓他先重新讀一次三大類導覽
 * 再自己找回去，是把導覽的方便當成使用者的義務。沒有紀錄時整塊不存在——
 * 第一次來的人不需要一顆「繼續」按鈕告訴他自己什麼都還沒做。
 *
 * **2. 三大類用 R / C / S 當版面索引。**產品名就是這三個字的縮寫，
 * 把字母放大當每一區的起始標記，等於讓版面自己解釋名字；而且它完全是灰階排印，
 * 不必動用任何顏色——顏色在這套系統裡只屬於音高。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import AdSlot from '@/components/ads/AdSlot.vue'
import { KNOWLEDGE_BASE_PATH } from '@/config/routes'
import { addDays, localDayKey } from '@/core/stats'
import { getModule, modulesByCategory } from '@/modules/registry'
import { pathForLocale, routeLocaleOf } from '@/router/pageMeta'
import { usePracticeLogStore } from '@/stores/practiceLog'
import type { PracticeCategory } from '@/modules/types'

const { t } = useI18n()
const route = useRoute()
const practiceLog = usePracticeLogStore()
const categories: PracticeCategory[] = ['rhythm', 'chords', 'scales']

/** 首頁的介紹重點，逐條對應三大類 */
const HIGHLIGHTS: PracticeCategory[] = ['rhythm', 'chords', 'scales']

const locale = computed(() => routeLocaleOf(route.meta))
function localized(path: string): string {
  return pathForLocale(path, locale.value)
}

/**
 * 最近一次練習。取最後一筆而不是排序後取最大：日誌是 append-only，
 * 最後一筆就是最新的一筆。
 *
 * 模組查不到就當作沒有紀錄——舊版本練過、現在已下架的模組不該連出一個死連結。
 */
const lastSession = computed(() => {
  for (let i = practiceLog.entries.length - 1; i >= 0; i -= 1) {
    const entry = practiceLog.entries[i]
    if (!entry) continue
    const module = getModule(entry.moduleId)
    if (module) return { entry, module }
  }
  return null
})

/**
 * 相對日期。用 core/stats 的 localDayKey 而不是自己算時間差：
 * 統計頁的「今天」是以本地日界線分組的，兩處對「昨天」的定義必須一致，
 * 否則首頁說昨天、統計圖畫在前天。
 */
const lastSessionWhen = computed(() => {
  const session = lastSession.value
  if (!session) return ''
  const now = new Date()
  const day = localDayKey(new Date(session.entry.date))
  if (day === localDayKey(now)) return t('home.resume.today')
  if (day === localDayKey(addDays(now, -1))) return t('home.resume.yesterday')

  for (let n = 2; n <= 30; n += 1) {
    if (day === localDayKey(addDays(now, -n))) return t('home.resume.daysAgo', { n })
  }
  return t('home.resume.longAgo')
})
</script>

<template>
  <div class="mx-auto flex w-full max-w-4xl flex-col gap-12 p-6 pt-12">
    <header class="flex flex-col gap-3">
      <div class="flex flex-col gap-1.5">
        <h1 class="rcs-display font-mono tracking-[0.12em]">RCS</h1>
        <p class="rcs-micro">{{ t('app.wordmark') }}</p>
      </div>
      <p class="rcs-body max-w-xl text-ink-300">{{ t('app.tagline') }}</p>
    </header>

    <!-- 繼續練習：全頁唯一的反白按鈕，沒有紀錄時整塊不存在 -->
    <RouterLink
      v-if="lastSession"
      :to="localized(lastSession.module.route)"
      class="rcs-btn-primary group flex items-center gap-4 rounded-lg px-5 py-4"
    >
      <span class="flex min-w-0 flex-col gap-0.5">
        <span class="rcs-micro text-ink-600">{{ t('home.resume.title') }}</span>
        <span class="truncate text-base font-semibold">{{ t(lastSession.module.titleKey) }}</span>
      </span>
      <span class="ml-auto flex shrink-0 items-baseline gap-1.5">
        <span class="rcs-data text-lg">{{ lastSession.entry.bpm }}</span>
        <span class="rcs-micro text-ink-600">{{ t('transport.bpm') }}</span>
      </span>
      <span class="rcs-micro shrink-0 text-ink-600">{{ lastSessionWhen }}</span>
      <span
        class="shrink-0 font-mono text-sm transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
        aria-hidden="true"
      >→</span>
    </RouterLink>

    <section class="flex max-w-2xl flex-col gap-4">
      <p class="rcs-body text-ink-300">{{ t('home.intro.what') }}</p>
      <p class="rcs-body text-ink-300">{{ t('home.intro.why') }}</p>
      <ul class="flex flex-col gap-2">
        <li
          v-for="key in HIGHLIGHTS"
          :key="key"
          class="rcs-body border-l border-ink-700 pl-3 text-ink-300"
        >
          <strong class="font-semibold text-ink-50">{{ t(`category.${key}`) }}</strong>
          — {{ t(`home.highlight.${key}`) }}
        </li>
      </ul>
      <p class="rcs-body text-ink-300">{{ t('home.intro.privacy') }}</p>
    </section>

    <section v-for="category in categories" :key="category" class="flex flex-col gap-4">
      <!-- R / C / S 版面索引：產品名的縮寫就是三大類的字首，讓版面自己解釋名字 -->
      <div class="flex items-center gap-3">
        <span class="rcs-data w-7 shrink-0 text-3xl leading-none text-ink-700" aria-hidden="true">
          {{ category.charAt(0).toUpperCase() }}
        </span>
        <h2 class="rcs-micro">{{ t(`category.${category}`) }}</h2>
        <span class="rcs-micro tabular-nums">{{ modulesByCategory(category).length }}</span>
        <span class="h-px min-w-4 flex-1 bg-ink-800" aria-hidden="true" />
      </div>

      <p v-if="modulesByCategory(category).length === 0" class="rcs-small pl-10 text-ink-400">
        {{ t('app.comingSoon') }}
      </p>

      <div v-else class="grid gap-3 pl-10 sm:grid-cols-2">
        <RouterLink
          v-for="m in modulesByCategory(category)"
          :key="m.id"
          :to="localized(m.route)"
          class="group flex flex-col gap-1 rcs-panel p-4 transition-colors hover:border-ink-500 hover:bg-ink-800 motion-reduce:transition-none"
        >
          <span class="flex items-center gap-2">
            <span class="font-medium text-ink-50">{{ t(m.titleKey) }}</span>
            <span
              class="ml-auto font-mono text-sm text-ink-600 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
              aria-hidden="true"
            >→</span>
          </span>
          <span class="rcs-small text-ink-400">{{ t(m.descriptionKey) }}</span>
        </RouterLink>
      </div>
    </section>

    <section class="flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <span class="w-7 shrink-0" aria-hidden="true" />
        <h2 class="rcs-micro">{{ t('knowledgeIndex.title') }}</h2>
        <span class="h-px min-w-4 flex-1 bg-ink-800" aria-hidden="true" />
      </div>
      <RouterLink
        :to="localized(KNOWLEDGE_BASE_PATH)"
        class="group ml-10 flex flex-col gap-1 rcs-panel p-4 transition-colors hover:border-ink-500 hover:bg-ink-800 motion-reduce:transition-none"
      >
        <span class="flex items-center gap-2">
          <span class="font-medium text-ink-50">{{ t('knowledgeIndex.cta') }}</span>
          <span
            class="ml-auto font-mono text-sm text-ink-600 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
            aria-hidden="true"
          >→</span>
        </span>
        <span class="rcs-small text-ink-400">{{ t('knowledgeIndex.description') }}</span>
      </RouterLink>
    </section>

    <AdSlot placement="home" />
  </div>
</template>
