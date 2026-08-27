<script setup lang="ts">
/**
 * 單篇樂理知識頁 `/knowledge/:slug`（PRD Phase 6 / F6-5.1）。
 *
 * 這是全站唯一「內容本身就是答案」的頁面，也是 AdSense 審核與 SEO 的主要資產：
 * 建置期會預渲染成靜態 HTML（vite.config.ts 的 prerender 外掛），
 * 不執行 JS 的爬蟲也讀得到全文。
 *
 * 同組其他條目的連結不是裝飾：孤立頁面爬不深，內部連結是讓 33 篇彼此連通的方式。
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import AdSlot from '@/components/ads/AdSlot.vue'
import RichText from '@/components/ui/RichText.vue'
import { loadKnowledge, type KnowledgeBundle, type KnowledgeLocale } from '@/content/knowledge'
import { entrySlug, slugToEntryId } from '@/content/knowledge/slug'
import { summarize } from '@/content/blocks'
import { KNOWLEDGE_BASE_PATH, knowledgeEntryPath } from '@/config/routes'
import { useSeoOverride } from '@/composables/useSeo'
import { pathForLocale, routeLocaleOf } from '@/router/pageMeta'
import type { PageMeta } from '@/core/seo'

const { t, locale } = useI18n()
const route = useRoute()
const bundle = ref<KnowledgeBundle | null>(null)

const DESCRIPTION_LENGTH = 155
/** 同組推薦連結數：夠爬蟲走下去，又不會把頁尾變成連結牆 */
const RELATED_LIMIT = 6

const slug = computed(() => String(route.params.slug ?? ''))
const routeLocale = computed(() => routeLocaleOf(route.meta))

/** 換語系時會有兩個載入同時在飛；晚到的舊結果必須丟掉，否則畫面語言會跳回去 */
let request = 0
watch(
  locale,
  async () => {
    const id = ++request
    const loaded = await loadKnowledge(locale.value as KnowledgeLocale)
    if (id === request) bundle.value = loaded
  },
  { immediate: true },
)

const entryId = computed(() =>
  bundle.value ? slugToEntryId(slug.value, Object.keys(bundle.value)) : undefined,
)
const entry = computed(() => {
  const id = entryId.value
  return id && bundle.value ? (bundle.value[id] ?? null) : null
})
/** 載完了卻找不到 = 網址錯了；還沒載完不算 */
const notFound = computed(() => bundle.value !== null && entryId.value === undefined)

const indexPath = computed(() => pathForLocale(KNOWLEDGE_BASE_PATH, routeLocale.value))

const related = computed(() => {
  const id = entryId.value
  const entries = bundle.value
  if (!id || !entries) return []
  const group = id.split('.')[0]
  return Object.entries(entries)
    .filter(([other]) => other !== id && other.split('.')[0] === group)
    .slice(0, RELATED_LIMIT)
    .map(([otherId, content]) => ({
      id: otherId,
      title: content.title,
      path: pathForLocale(knowledgeEntryPath(entrySlug(otherId)), routeLocale.value),
    }))
})

useSeoOverride((): PageMeta | null => {
  const content = entry.value
  if (!content) return null
  return {
    title: content.title,
    description: summarize(content.blocks, DESCRIPTION_LENGTH),
    path: knowledgeEntryPath(slug.value),
    locale: routeLocale.value,
  }
})
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6 pt-10">
    <nav class="rcs-micro">
      <RouterLink :to="indexPath" class="text-ink-400 hover:text-ink-100">
        ← {{ t('knowledgeIndex.title') }}
      </RouterLink>
    </nav>

    <article v-if="entry" class="flex flex-col gap-5">
      <h1 class="rcs-h1">{{ entry.title }}</h1>
      <RichText :blocks="entry.blocks" />
    </article>

    <p v-else-if="notFound" class="text-sm text-ink-400">{{ t('knowledge.missing') }}</p>
    <p v-else class="text-sm text-ink-400">{{ t('knowledge.loading') }}</p>

    <section v-if="related.length > 0" class="flex flex-col gap-3 border-t border-ink-800 pt-6">
      <h2 class="rcs-micro">
        {{ t('knowledgeIndex.related') }}
      </h2>
      <ul class="flex flex-wrap gap-2">
        <li v-for="item in related" :key="item.id">
          <RouterLink
            :to="item.path"
            class="inline-flex rounded border border-ink-700 px-3 py-1.5 text-sm text-ink-300 hover:border-ink-500 hover:text-ink-50"
          >
            {{ item.title }}
          </RouterLink>
        </li>
      </ul>
    </section>

    <AdSlot placement="knowledge" />
  </div>
</template>
