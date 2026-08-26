<script setup lang="ts">
/**
 * 自訂進行編輯器（PRD F5-3.1–2）。
 *
 * 驗證是**逐 token、即時**的：每打一個字就重新 parse，把解析得出的和弦排成一列，
 * 出錯時直接指出第幾個 token 壞掉。core 丟出的 ProgressionSyntaxError 訊息是給開發者看的
 * 英文，畫面不轉發它——只取 tokenIndex，配上自己的 i18n 說明與範例。
 *
 * 五度圈點一下就把那個調對應的級數接到記法後面（PRD 的第二種輸入方式）：
 * 級數由 chromaticDegree + degreeToNumeral 推導，畫面不 hardcode 羅馬數字。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ProgressionSyntaxError, chromaticDegree, degreeToNumeral, parseNoteName, parseProgression,
  realizeChord, type NoteName,
} from '@/core/theory'
import CircleOfFifths from '@/components/CircleOfFifths/CircleOfFifths.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import {
  BARS_PER_CHORD_OPTIONS, HARMONY_LEVELS, type CustomProgression,
} from '@/stores/customProgressions'
import { PRACTICE_KEYS } from '../keys'

const BARS_PER_KEY_OPTIONS = [4, 8, 16] as const

const props = defineProps<{
  item: CustomProgression
  /** 跟練中正在響的和弦根音——同一個五度圈既是輸入介面也是跟練 highlight */
  currentChordPc?: number | undefined
}>()
const emit = defineEmits<{ (e: 'patch', patch: Partial<CustomProgression>): void }>()

const { t } = useI18n()

/** 解析結果：成功給和弦列，失敗給壞掉的位置。每次輸入都重算 */
const parsed = computed(() => {
  const rawTokens = props.item.tokens.trim().split(/\s+/).filter(Boolean)
  try {
    const tokens = parseProgression(props.item.tokens, props.item.harmonyLevel)
    return {
      ok: true as const,
      chords: tokens.map((token) => ({
        raw: token.raw,
        symbol: realizeChord(token, { key: props.item.key, harmonyLevel: props.item.harmonyLevel }).symbol,
      })),
    }
  } catch (error) {
    const index = error instanceof ProgressionSyntaxError ? error.tokenIndex : 0
    return { ok: false as const, index, raw: rawTokens[index] ?? '', rawTokens }
  }
})

const keyOptions = PRACTICE_KEYS.map((key) => ({ value: key, label: key }))
const barsOptions = BARS_PER_CHORD_OPTIONS.map((n) => ({ value: String(n), label: n === 0.5 ? '½' : String(n) }))
const barsPerKeyOptions = BARS_PER_KEY_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))
const harmonyOptions = computed(() =>
  HARMONY_LEVELS.map((level) => ({ value: level, label: t(`custom.harmony.${level}`) })),
)

/** 五度圈點擊：把那個調相對主調的級數接到記法尾巴 */
function appendKey(key: NoteName): void {
  const tonicPc = parseNoteName(props.item.key).pc
  const numeral = degreeToNumeral(chromaticDegree(parseNoteName(key).pc - tonicPc))
  const tokens = props.item.tokens.trim()
  emit('patch', { tokens: tokens === '' ? numeral : `${tokens} ${numeral}` })
}

function removeLast(): void {
  const tokens = props.item.tokens.trim().split(/\s+/).filter(Boolean)
  tokens.pop()
  emit('patch', { tokens: tokens.join(' ') })
}
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-[300px_1fr]">
    <div class="flex flex-col gap-2">
      <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">{{ t('custom.clickToAdd') }}</span>
      <CircleOfFifths
        :tonic="item.key"
        :current-chord-pc="currentChordPc"
        mode="chord"
        @select-key="appendKey"
      />
    </div>

    <div class="flex min-w-0 flex-col gap-5">
      <label class="flex flex-col gap-1.5">
        <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">{{ t('custom.name') }}</span>
        <input
          class="rcs-input w-full max-w-sm"
          type="text"
          :value="item.name"
          :placeholder="t('custom.namePlaceholder')"
          @input="emit('patch', { name: ($event.target as HTMLInputElement).value })"
        >
      </label>

      <div class="flex flex-col gap-1.5">
        <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">{{ t('custom.tokens') }}</span>
        <div class="flex flex-wrap items-center gap-2">
          <input
            class="rcs-input w-full max-w-lg font-mono"
            type="text"
            spellcheck="false"
            autocapitalize="off"
            :value="item.tokens"
            :placeholder="t('custom.tokensPlaceholder')"
            :aria-invalid="!parsed.ok"
            @input="emit('patch', { tokens: ($event.target as HTMLInputElement).value })"
          >
          <button
            type="button"
            class="rounded border border-ink-700 px-2 py-1 font-mono text-xs text-ink-400 hover:bg-ink-800 hover:text-ink-100"
            @click="removeLast"
          >
            {{ t('custom.removeLast') }}
          </button>
        </div>

        <!-- 解析結果：成功排成和弦列，失敗指出第幾個 token 壞掉 -->
        <div v-if="parsed.ok" class="flex flex-wrap items-center gap-1.5">
          <span
            v-for="(chord, i) in parsed.chords"
            :key="`${chord.raw}-${i}`"
            class="rounded bg-ink-800 px-2 py-0.5 font-mono text-xs text-ink-100"
          >
            {{ chord.symbol }}<span class="ml-1.5 text-ink-400">{{ chord.raw }}</span>
          </span>
        </div>
        <div v-else class="flex flex-col gap-1">
          <div class="flex flex-wrap items-center gap-1.5">
            <span
              v-for="(raw, i) in parsed.rawTokens"
              :key="`${raw}-${i}`"
              class="rounded px-2 py-0.5 font-mono text-xs"
              :class="i === parsed.index ? 'bg-ink-50 font-bold text-ink-950' : 'bg-ink-800 text-ink-400'"
            >{{ raw }}</span>
          </div>
          <p class="text-xs text-ink-300">
            {{ parsed.raw === ''
              ? t('custom.errorEmpty')
              : t('custom.errorToken', { index: parsed.index + 1, token: parsed.raw }) }}
          </p>
          <p class="font-mono text-[11px] text-ink-400">{{ t('custom.syntaxHint') }}</p>
        </div>
      </div>

      <div class="flex flex-wrap items-start gap-x-8 gap-y-4">
        <div class="flex flex-col gap-1.5">
          <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">{{ t('custom.barsPerChord') }}</span>
          <SegmentedControl
            :model-value="String(item.barsPerChord)"
            :options="barsOptions"
            :aria-label="t('custom.barsPerChord')"
            @update:model-value="emit('patch', { barsPerChord: Number($event) })"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">{{ t('custom.harmonyLevel') }}</span>
          <SegmentedControl
            :model-value="item.harmonyLevel"
            :options="harmonyOptions"
            :aria-label="t('custom.harmonyLevel')"
            @update:model-value="emit('patch', { harmonyLevel: $event as CustomProgression['harmonyLevel'] })"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">{{ t('chords.key') }}</span>
          <SegmentedControl
            :model-value="item.key"
            :options="keyOptions"
            :aria-label="t('chords.key')"
            wrap
            @update:model-value="emit('patch', { key: $event as NoteName })"
          />
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
        <label class="flex items-center gap-2 text-sm text-ink-300">
          <input
            type="checkbox"
            class="rcs-check"
            :checked="item.cycleKeys"
            @change="emit('patch', { cycleKeys: ($event.target as HTMLInputElement).checked })"
          >
          {{ t('custom.cycleKeys') }}
        </label>
        <div v-if="item.cycleKeys" class="flex items-center gap-2">
          <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">{{ t('chords.barsPerKey') }}</span>
          <SegmentedControl
            :model-value="String(item.barsPerKey)"
            :options="barsPerKeyOptions"
            :aria-label="t('chords.barsPerKey')"
            @update:model-value="emit('patch', { barsPerKey: Number($event) })"
          />
        </div>
      </div>
    </div>
  </div>
</template>
