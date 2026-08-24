<script setup lang="ts">
/**
 * 知識卡：可折疊，依當前語系 lazy 載入內容（PRD F2-3）。
 * 傳入 entry id 即可；內容從何而來由 content 層決定，模組不需知道。
 */
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { loadKnowledge, type KnowledgeEntryContent, type KnowledgeLocale } from '@/content/knowledge'
import RichText from './RichText.vue'

const props = withDefaults(defineProps<{ entryId: string; defaultOpen?: boolean }>(), {
  defaultOpen: false,
})

const { t, locale } = useI18n()
const open = ref(props.defaultOpen)
const entry = ref<KnowledgeEntryContent | null>(null)
const missing = ref(false)

watch(
  [() => props.entryId, locale, open],
  async () => {
    if (!open.value) return
    const bundle = await loadKnowledge(locale.value as KnowledgeLocale)
    const found = bundle[props.entryId]
    entry.value = found ?? null
    missing.value = found === undefined
  },
  { immediate: true },
)
</script>

<template>
  <section class="flex flex-col gap-3">
    <button
      type="button"
      class="flex w-fit items-center gap-2 rounded px-2 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500 hover:bg-ink-800 hover:text-ink-100"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span>{{ t('knowledge.label') }}</span>
      <span aria-hidden="true">{{ open ? '−' : '+' }}</span>
    </button>

    <article v-if="open" class="flex flex-col gap-3 rounded-lg border border-ink-700 bg-ink-900 p-5">
      <template v-if="entry">
        <h3 class="text-base font-semibold text-ink-50">{{ entry.title }}</h3>
        <RichText :blocks="entry.blocks" />
      </template>
      <p v-else class="text-sm text-ink-500">
        {{ missing ? t('knowledge.missing') : t('knowledge.loading') }}
      </p>
    </article>
  </section>
</template>
