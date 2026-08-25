<script setup lang="ts">
/**
 * 首頁：產品介紹 + 三大類導覽（導覽由模組註冊表生成，新增模組自動出現）。
 *
 * 介紹文案不是行銷裝飾（PRD F6-5.1）：AdSense 審核與搜尋引擎需要一個
 * 「不執行 JS 也讀得懂這站在幹嘛」的落地頁，所以這段文字會被預渲染進靜態 HTML。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import AdSlot from '@/components/ads/AdSlot.vue'
import { KNOWLEDGE_BASE_PATH } from '@/config/routes'
import { modulesByCategory } from '@/modules/registry'
import { pathForLocale, routeLocaleOf } from '@/router/pageMeta'
import type { PracticeCategory } from '@/modules/types'

const { t } = useI18n()
const route = useRoute()
const categories: PracticeCategory[] = ['rhythm', 'chords', 'scales']

/** 首頁的介紹重點，逐條對應三大類 */
const HIGHLIGHTS: PracticeCategory[] = ['rhythm', 'chords', 'scales']

const locale = computed(() => routeLocaleOf(route.meta))
function localized(path: string): string {
  return pathForLocale(path, locale.value)
}
</script>

<template>
  <div class="mx-auto flex max-w-4xl flex-col gap-12 p-6 pt-12">
    <header class="flex flex-col gap-3">
      <h1 class="font-mono text-3xl font-bold tracking-[0.04em] text-ink-50">RCS</h1>
      <p class="max-w-xl text-ink-300">{{ t('app.tagline') }}</p>
    </header>

    <section class="flex max-w-2xl flex-col gap-4">
      <p class="text-sm leading-7 text-ink-300">{{ t('home.intro.what') }}</p>
      <p class="text-sm leading-7 text-ink-300">{{ t('home.intro.why') }}</p>
      <ul class="flex flex-col gap-2">
        <li
          v-for="key in HIGHLIGHTS"
          :key="key"
          class="border-l border-ink-700 pl-3 text-sm leading-7 text-ink-300"
        >
          <strong class="font-semibold text-ink-50">{{ t(`category.${key}`) }}</strong>
          — {{ t(`home.highlight.${key}`) }}
        </li>
      </ul>
      <p class="text-sm leading-7 text-ink-300">{{ t('home.intro.privacy') }}</p>
    </section>

    <section v-for="category in categories" :key="category" class="flex flex-col gap-3">
      <div class="flex items-baseline gap-3">
        <h2 class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">
          {{ t(`category.${category}`) }}
        </h2>
        <span class="font-mono text-[11px] tabular-nums text-ink-400">
          {{ modulesByCategory(category).length }}
        </span>
      </div>

      <p v-if="modulesByCategory(category).length === 0" class="text-sm text-ink-400">
        {{ t('app.comingSoon') }}
      </p>

      <div v-else class="grid gap-3 sm:grid-cols-2">
        <RouterLink
          v-for="m in modulesByCategory(category)"
          :key="m.id"
          :to="localized(m.route)"
          class="flex flex-col gap-1 rounded-lg border border-ink-700 bg-ink-900 p-4 transition-colors hover:border-ink-500 hover:bg-ink-800 motion-reduce:transition-none"
        >
          <span class="font-medium text-ink-50">{{ t(m.titleKey) }}</span>
          <span class="text-sm text-ink-400">{{ t(m.descriptionKey) }}</span>
        </RouterLink>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">
        {{ t('knowledgeIndex.title') }}
      </h2>
      <RouterLink
        :to="localized(KNOWLEDGE_BASE_PATH)"
        class="flex flex-col gap-1 rounded-lg border border-ink-700 bg-ink-900 p-4 transition-colors hover:border-ink-500 hover:bg-ink-800 motion-reduce:transition-none"
      >
        <span class="font-medium text-ink-50">{{ t('knowledgeIndex.cta') }}</span>
        <span class="text-sm text-ink-400">{{ t('knowledgeIndex.description') }}</span>
      </RouterLink>
    </section>

    <AdSlot placement="home" />
  </div>
</template>
