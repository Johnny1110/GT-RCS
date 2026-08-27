<script setup lang="ts">
/**
 * 使用者曲譜編輯器（Phase 8 / F8-8）。
 *
 * 與 ProgressionEditor 同一種做法：**逐次輸入即時驗證**，錯誤指得出是哪一行、哪一小節。
 * core 丟出的 ChartTextError 訊息是給開發者看的英文，畫面不轉發它——
 * 只取 line 與 barIndex，配自己的 i18n 說明。
 *
 * 這一層是本模組的法律設計落點：使用者手上那本書裡的曲子由他自己輸入，
 * 資料只存在他的瀏覽器（stores/userCharts.ts），不上傳、我方無伺服器可存放。
 * 匯出是純文字，格式與內建曲庫的原始碼相同——他的譜要帶得走。
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChartTextError, formatChartText, parseChartText, sectionSpans } from '@/core/theory'
import type { UserChart } from '@/stores/userCharts'

const props = defineProps<{ item: UserChart | undefined }>()
const emit = defineEmits<{
  (e: 'create'): void
  (e: 'update', text: string): void
  (e: 'import', text: string): void
  (e: 'remove'): void
}>()

const { t } = useI18n()
const open = ref(false)
const draft = ref('')
const importText = ref('')

watch(() => props.item?.id, () => { draft.value = props.item?.text ?? '' }, { immediate: true })
watch(() => props.item?.text, (text) => { if (text !== undefined && !dirty.value) draft.value = text })

const dirty = computed(() => props.item !== undefined && draft.value !== props.item.text)

/** 每打一個字重新解析：小節數與段落結構是使用者最需要的即時回饋 */
const parsed = computed(() => {
  if (draft.value.trim() === '') return { ok: false as const, error: null }
  try {
    const chartDraft = parseChartText(draft.value)
    const spans = sectionSpans(chartDraft)
    return {
      ok: true as const,
      title: chartDraft.title,
      bars: spans.reduce((sum, s) => sum + s.bars, 0),
      spans,
    }
  } catch (error) {
    return { ok: false as const, error: error instanceof ChartTextError ? error : null }
  }
})

const errorText = computed(() => {
  if (parsed.value.ok) return ''
  const error = parsed.value.error
  if (!error) return t('jazzBook.editor.unknownError')
  return error.barIndex >= 0
    ? t('jazzBook.parseError', { line: error.line, bar: error.barIndex + 1 })
    : t('jazzBook.editor.headerError', { line: error.line })
})

function save(): void {
  if (parsed.value.ok) emit('update', draft.value)
}

function copyExport(): void {
  if (!parsed.value.ok) return
  const chartDraft = parseChartText(draft.value)
  // 匯出走 formatChartText 而不是直接複製輸入框：格式正規化過，貼回來一定解析得了
  void navigator.clipboard?.writeText(formatChartText(chartDraft))
}

function runImport(): void {
  if (importText.value.trim() === '') return
  emit('import', importText.value)
  importText.value = ''
}
</script>

<template>
  <section class="rcs-panel flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-3">
      <button type="button" class="rcs-btn" :aria-expanded="open" @click="open = !open">
        {{ t('jazzBook.editor.title') }}
      </button>
      <p class="rcs-micro text-ink-500">{{ t('jazzBook.editor.privacy') }}</p>
    </div>

    <template v-if="open">
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="rcs-btn" @click="emit('create')">{{ t('jazzBook.newChart') }}</button>
        <button v-if="item" type="button" class="rcs-btn" :disabled="!parsed.ok || !dirty" @click="save">
          {{ t('jazzBook.editor.save') }}
        </button>
        <button v-if="item" type="button" class="rcs-btn" :disabled="!parsed.ok" @click="copyExport">
          {{ t('jazzBook.editor.copy') }}
        </button>
        <button v-if="item" type="button" class="rcs-btn ml-auto" @click="emit('remove')">
          {{ t('jazzBook.editor.remove') }}
        </button>
      </div>

      <template v-if="item">
        <label class="flex flex-col gap-1.5">
          <span class="rcs-micro">{{ t('jazzBook.editor.text') }}</span>
          <textarea
            v-model="draft"
            class="rcs-input min-h-48 w-full font-mono text-xs leading-relaxed"
            spellcheck="false"
            :aria-invalid="parsed.ok ? undefined : 'true'"
            :aria-label="t('jazzBook.editor.text')"
          />
        </label>

        <p v-if="parsed.ok" class="rcs-micro text-ink-400">
          {{ parsed.title }} · {{ parsed.bars }} {{ t('metronome.bar') }} ·
          {{ parsed.spans.map((s) => `${s.label}(${s.bars})`).join(' ') }}
        </p>
        <p v-else class="rcs-micro text-ink-200">{{ errorText }}</p>
      </template>

      <details class="flex flex-col gap-2">
        <summary class="rcs-micro cursor-pointer text-ink-400">{{ t('jazzBook.editor.syntax') }}</summary>
        <pre class="mt-2 overflow-x-auto rounded bg-ink-950 p-3 font-mono text-[11px] leading-relaxed text-ink-300">{{ t('jazzBook.editor.syntaxBody') }}</pre>
      </details>

      <label class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('jazzBook.editor.import') }}</span>
        <textarea
          v-model="importText"
          class="rcs-input min-h-24 w-full font-mono text-xs"
          spellcheck="false"
          :placeholder="t('jazzBook.editor.importHint')"
          :aria-label="t('jazzBook.editor.import')"
        />
        <button type="button" class="rcs-btn self-start" :disabled="importText.trim() === ''" @click="runImport">
          {{ t('jazzBook.editor.importAction') }}
        </button>
      </label>
    </template>
  </section>
</template>
