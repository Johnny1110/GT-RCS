<script setup lang="ts">
/**
 * 404（PRD Phase 6 / F6-1.1）。
 *
 * 靜態主機把所有未知路徑 rewrite 到 index.html，所以 404 只能由前端負責。
 * 這一頁必須 noindex（路由 meta 已標），否則 Google 會把每一個打錯的網址
 * 都當成一頁真實內容收進索引——那叫 soft 404，會拖累整站評價。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { KNOWLEDGE_BASE_PATH } from '@/config/routes'
import { pathForLocale, routeLocaleOf } from '@/router/pageMeta'

const { t } = useI18n()
const route = useRoute()

const homePath = computed(() => pathForLocale('/', routeLocaleOf(route.meta)))
const knowledgePath = computed(() => pathForLocale(KNOWLEDGE_BASE_PATH, routeLocaleOf(route.meta)))
</script>

<template>
  <section class="mx-auto flex w-full max-w-xl flex-col gap-4 p-6 pt-16">
    <p class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">404</p>
    <h1 class="text-xl font-semibold text-ink-50">{{ t('notFound.title') }}</h1>
    <p class="text-sm leading-7 text-ink-300">{{ t('notFound.body') }}</p>
    <div class="flex flex-wrap gap-2">
      <RouterLink
        :to="homePath"
        class="rounded border border-ink-700 bg-ink-800 px-3 py-1.5 text-sm text-ink-100 hover:bg-ink-700"
      >
        {{ t('error.home') }}
      </RouterLink>
      <RouterLink
        :to="knowledgePath"
        class="rounded border border-ink-700 px-3 py-1.5 text-sm text-ink-400 hover:bg-ink-800 hover:text-ink-100"
      >
        {{ t('knowledgeIndex.title') }}
      </RouterLink>
    </div>
  </section>
</template>
