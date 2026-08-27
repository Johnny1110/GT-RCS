<script setup lang="ts">
/**
 * 樂理知識索引 `/knowledge`（PRD Phase 6 / F6-5.1）。
 *
 * 這一頁的存在理由有兩個，缺一不可：
 * - 給讀者一份能瀏覽的目錄（練習頁裡的知識卡是折疊的，不利於「先讀再練」）
 * - 給爬蟲一個能一次走完全部內容頁的入口。33 條雙語條目沒有索引頁就等於孤島，
 *   AdSense 審核與 Search Console 都看不見它們。
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import AdSlot from '@/components/ads/AdSlot.vue'
import { loadKnowledge, type KnowledgeBundle, type KnowledgeLocale } from '@/content/knowledge'
import { entrySlug } from '@/content/knowledge/slug'
import { summarize } from '@/content/blocks'
import { knowledgeEntryPath } from '@/config/routes'
import { pathForLocale, routeLocaleOf } from '@/router/pageMeta'

/** 條目 id 的前綴 → 分組顯示順序。不在清單裡的前綴排在最後 */
const GROUP_ORDER = ['scale', 'chord', 'progression', 'rhythm'] as const

const { t, locale } = useI18n()
const route = useRoute()
const bundle = ref<KnowledgeBundle | null>(null)

const SUMMARY_LENGTH = 90

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

interface IndexItem {
  id: string
  title: string
  summary: string
  path: string
}

const groups = computed<{ key: string; items: IndexItem[] }[]>(() => {
  const entries = bundle.value
  if (!entries) return []
  const byGroup = new Map<string, IndexItem[]>()
  for (const [id, entry] of Object.entries(entries)) {
    const group = id.split('.')[0] ?? 'other'
    const list = byGroup.get(group) ?? []
    list.push({
      id,
      title: entry.title,
      summary: summarize(entry.blocks, SUMMARY_LENGTH),
      path: pathForLocale(knowledgeEntryPath(entrySlug(id)), routeLocaleOf(route.meta)),
    })
    byGroup.set(group, list)
  }
  const order = (key: string): number => {
    const i = (GROUP_ORDER as readonly string[]).indexOf(key)
    return i < 0 ? GROUP_ORDER.length : i
  }
  return [...byGroup.entries()]
    .map(([key, items]) => ({ key, items }))
    .sort((a, b) => order(a.key) - order(b.key))
})

const total = computed(() => groups.value.reduce((sum, g) => sum + g.items.length, 0))
</script>

<template>
  <div class="mx-auto flex w-full max-w-4xl flex-col gap-10 p-6 pt-10">
    <header class="flex flex-col gap-3">
      <h1 class="rcs-h1">{{ t('knowledgeIndex.title') }}</h1>
      <p class="max-w-2xl text-sm leading-7 text-ink-300">{{ t('knowledgeIndex.description') }}</p>
      <p class="font-mono text-[11px] tabular-nums text-ink-400">
        {{ t('knowledgeIndex.count', { count: total }) }}
      </p>
    </header>

    <section v-for="group in groups" :key="group.key" class="flex flex-col gap-3">
      <h2 class="rcs-micro">
        {{ t(`knowledgeIndex.group.${group.key}`) }}
      </h2>
      <ul class="grid gap-3 sm:grid-cols-2">
        <li v-for="item in group.items" :key="item.id">
          <RouterLink
            :to="item.path"
            class="flex h-full flex-col gap-1 rcs-panel p-4 transition-colors hover:border-ink-500 hover:bg-ink-800 motion-reduce:transition-none"
          >
            <span class="font-medium text-ink-50">{{ item.title }}</span>
            <span class="text-sm leading-6 text-ink-400">{{ item.summary }}</span>
          </RouterLink>
        </li>
      </ul>
    </section>

    <AdSlot placement="knowledge" />
  </div>
</template>
