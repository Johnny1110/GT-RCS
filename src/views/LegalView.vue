<script setup lang="ts">
/**
 * 法遵頁（隱私權／Cookie／關於）— PRD Phase 6 / F6-4.3。
 *
 * 三份文件共用一個 view：版型完全相同，差別只有內容 id。
 * 內容走 content/legal（與知識條目同一套 lazy 載入），不進首屏 bundle。
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import RichText from '@/components/ui/RichText.vue'
import { summarize } from '@/content/blocks'
import { loadLegal, type LegalDocContent, type LegalLocale } from '@/content/legal'
import { legalPath, type LegalDoc } from '@/config/routes'
import { useSeoOverride } from '@/composables/useSeo'
import { routeLocaleOf } from '@/router/pageMeta'
import type { PageMeta } from '@/core/seo'

const props = defineProps<{ doc: LegalDoc }>()

const { t, locale } = useI18n()
const route = useRoute()
const content = ref<LegalDocContent | null>(null)

/** meta description 的長度上限：超過這個長度 Google 也會自己截 */
const DESCRIPTION_LENGTH = 155

/** 換語系時會有兩個載入同時在飛；晚到的舊結果必須丟掉，否則畫面語言會跳回去 */
let request = 0
watch(
  [() => props.doc, locale],
  async () => {
    const id = ++request
    const bundle = await loadLegal(locale.value as LegalLocale)
    if (id === request) content.value = bundle[props.doc] ?? null
  },
  { immediate: true },
)

useSeoOverride((): PageMeta | null => {
  const entry = content.value
  if (!entry) return null
  return {
    title: entry.title,
    description: summarize(entry.blocks, DESCRIPTION_LENGTH),
    path: legalPath(props.doc),
    locale: routeLocaleOf(route.meta),
  }
})

const updatedLabel = computed(() =>
  content.value ? t('legal.updated', { date: content.value.updated }) : '',
)
</script>

<template>
  <article class="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 pt-10">
    <header class="flex flex-col gap-2">
      <h1 class="text-2xl font-semibold text-ink-50">
        {{ content?.title ?? t(`legal.${doc}.title`) }}
      </h1>
      <p v-if="updatedLabel" class="font-mono text-[11px] tabular-nums text-ink-400">
        {{ updatedLabel }}
      </p>
    </header>

    <RichText v-if="content" :blocks="content.blocks" />
    <p v-else class="text-sm text-ink-400">{{ t('knowledge.loading') }}</p>
  </article>
</template>
