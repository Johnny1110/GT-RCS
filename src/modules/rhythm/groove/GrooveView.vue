<script setup lang="ts">
/**
 * 律動風格跟練（PRD F4-4）：節奏是主角，和弦只給一個 vamp 提示。
 *
 * 自訂 pattern 的語意：編輯 preset 等於在 overrides 存一份自己的版本，
 * 「回復預設」就是刪掉那一筆。preset 本身永遠不變，換裝置也還原得回來。
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import RhythmSheet from '@/components/RhythmSheet/RhythmSheet.vue'
import KnowledgeCard from '@/components/ui/KnowledgeCard.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import { COUNT_STYLES } from '@/components/RhythmSheet/counting'
import { useModuleSettings } from '@/composables/useModuleSettings'
import { usePresetNavigation } from '@/composables/usePresetNavigation'
import { usePracticeSession } from '@/composables/usePracticeSession'
import { usePracticeTransport } from '@/composables/usePracticeTransport'
import { useTransportTick } from '@/composables/useTransportTick'
import {
  SWING_MAX, SWING_MIN, SWING_SHUFFLE, SWING_STRAIGHT,
  nextCellRole, normalizeBars, type CellRole, type RhythmPattern,
} from '@/core/audio'
import { useTransportStore } from '@/stores/transport'
import { GROOVE_STYLES, findStyle } from '../presets'
import {
  chordHintSymbol, resolveCountStyle, resolvePatternId, resolveStyleId,
  useActiveCell, usePatternPlayback,
} from '../shared'
import { GROOVE_DEFAULTS, type GrooveSettings } from './settings'

const MODULE_ID = 'rhythm.groove'
const SWING_PRESETS = [
  { key: 'straight', value: SWING_STRAIGHT },
  { key: 'light', value: 58 },
  { key: 'shuffle', value: SWING_SHUFFLE },
] as const

const { t } = useI18n()
const settings = useModuleSettings<GrooveSettings>(MODULE_ID, GROOVE_DEFAULTS)
settings.styleId = resolveStyleId(settings.styleId, GROOVE_DEFAULTS.styleId)
settings.countStyle = resolveCountStyle(settings.countStyle, GROOVE_DEFAULTS.countStyle)
if (!settings.overrides || typeof settings.overrides !== 'object') settings.overrides = {}

const transport = useTransportStore()
const editing = ref(false)
const style = computed(() => findStyle(settings.styleId) ?? GROOVE_STYLES[0]!)
/** ←→ 換 preset（F5-4）：清單順序與畫面上的選單一致 */
usePresetNavigation({
  items: () => style.value.patterns.map((p) => p.id),
  current: () => settings.patternId,
  select: (id) => { settings.patternId = id },
})


// 換風格：pattern 落到新風格的第一個；swing 回到該風格的預設
// （shuffle 的 pattern 用 50% 直拍播出來根本不是同一個節奏，這不是偏好問題）
watch(style, (value, previous) => {
  settings.patternId = resolvePatternId(value.patterns, settings.patternId)
  if (previous && previous.id !== value.id) transport.setSwing(value.defaultSwing)
}, { immediate: true })

const preset = computed(
  () => style.value.patterns.find((p) => p.id === settings.patternId) ?? style.value.patterns[0]!,
)

const override = computed(() => settings.overrides[preset.value.id])
const customized = computed(() => override.value !== undefined)

/** 實際播放與顯示的 pattern：有自訂就用自訂的格子，其餘沿用 preset */
const pattern = computed<RhythmPattern>(() => {
  const base = preset.value
  const cells = override.value
  if (!cells) return base
  return {
    ...base,
    bars: normalizeBars(cells, base.timeSig, base.ticksPerBeat, base.bars.length),
  }
})

usePatternPlayback(pattern)
usePracticeTransport(settings)
usePracticeSession({
  moduleId: MODULE_ID,
  params: () => ({ styleId: settings.styleId, patternId: settings.patternId, swing: settings.swing }),
})

const { position, playing } = useTransportTick()
const activeCell = useActiveCell(() => pattern.value.ticksPerBeat)

// swing 由 store 持有（core 會夾範圍），模組設定只負責記住它
watch(() => transport.swing, (value) => { settings.swing = value })
transport.setSwing(settings.swing)

/** 三連音細分本身就是 shuffle 的目的地，再套 swing 沒有意義 */
const swingApplies = computed(() => pattern.value.ticksPerBeat % 2 === 0)

function onCycle(barIndex: number, cellIndex: number): void {
  const base = pattern.value
  const bars = normalizeBars(
    override.value ?? base.bars.map((b) => [...b]),
    base.timeSig, base.ticksPerBeat, base.bars.length,
  )
  const bar = bars[barIndex]
  if (!bar) return
  bar[cellIndex] = nextCellRole(bar[cellIndex] ?? 'rest')
  settings.overrides[base.id] = bars as CellRole[][]
}

function resetPattern(): void {
  delete settings.overrides[preset.value.id]
}

const styleOptions = computed(() => GROOVE_STYLES.map((s) => ({ value: s.id, label: t(s.titleKey) })))
const patternOptions = computed(() =>
  style.value.patterns.map((p) => ({ value: p.id, label: t(p.titleKey) })),
)
const countOptions = computed(() =>
  COUNT_STYLES.map((s) => ({ value: s, label: t(`rhythm.countStyle.${s}`) })),
)
const chordSymbol = computed(() => chordHintSymbol(style.value.chordHint))
</script>

<template>
  <div class="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-6 p-6">
    <header class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h1 class="rcs-h1">{{ t('modules.rhythm.groove.title') }}</h1>
      <p class="text-sm text-ink-400">{{ t('modules.rhythm.groove.description') }}</p>
    </header>

    <div class="flex flex-wrap items-start gap-x-8 gap-y-4">
      <div class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('rhythm.style') }}</span>
        <SegmentedControl v-model="settings.styleId" :options="styleOptions" :aria-label="t('rhythm.style')" wrap />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('rhythm.pattern') }}</span>
        <SegmentedControl v-model="settings.patternId" :options="patternOptions" :aria-label="t('rhythm.pattern')" wrap />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('rhythm.chordHint') }}</span>
        <p class="font-mono text-lg font-bold leading-[26px] text-ink-50">{{ chordSymbol }}</p>
      </div>
    </div>

    <p class="max-w-[65ch] text-sm text-ink-400">{{ t(style.descriptionKey) }}</p>

    <section class="flex min-w-0 flex-col gap-4 rcs-panel p-5">
      <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p class="rcs-micro">
          {{ t(pattern.titleKey) }}
          <span v-if="customized" class="ml-2 text-ink-300">· {{ t('rhythm.customized') }}</span>
        </p>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded border px-3 py-1 font-mono text-xs transition-colors motion-reduce:transition-none"
            :class="editing
              ? 'border-ink-50 bg-ink-50 font-bold text-ink-950'
              : 'border-ink-700 bg-ink-800 text-ink-300 hover:text-ink-50'"
            :aria-pressed="editing"
            @click="editing = !editing"
          >
            {{ t('rhythm.edit') }}
          </button>
          <button
            v-if="customized"
            type="button"
            class="rcs-btn px-3 py-1 font-mono text-xs"
            @click="resetPattern"
          >
            {{ t('rhythm.reset') }}
          </button>
        </div>
      </div>

      <RhythmSheet
        :bars="pattern.bars"
        :time-sig="pattern.timeSig"
        :ticks-per-beat="pattern.ticksPerBeat"
        :count-style="settings.countStyle"
        :active-bar="position.bar"
        :active-cell="activeCell"
        :playing="playing"
        :editable="editing"
        @cycle="onCycle"
      />

      <p v-if="editing" class="max-w-[65ch] text-sm text-ink-400">{{ t('rhythm.editHint') }}</p>
    </section>

    <div class="flex flex-wrap items-start gap-x-8 gap-y-4">
      <div v-if="swingApplies" class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('rhythm.swing') }}</span>
        <!-- flex-wrap 是必要的：英文的 swing preset 標籤（Full shuffle）比中文寬，
             375px 手機上不換行就會把整頁撐出橫捲 -->
        <div class="flex flex-wrap items-center gap-3">
          <span class="w-10 rcs-data text-sm text-ink-50">{{ Math.round(transport.swing) }}%</span>
          <input
            class="rcs-range w-32"
            type="range"
            :min="SWING_MIN"
            :max="SWING_MAX"
            :value="Math.round(transport.swing)"
            :aria-label="t('rhythm.swing')"
            @input="transport.setSwing(Number(($event.target as HTMLInputElement).value))"
          >
          <div class="flex gap-1">
            <button
              v-for="item in SWING_PRESETS"
              :key="item.key"
              type="button"
              class="rcs-btn px-2 py-1 font-mono text-[11px]"
              @click="transport.setSwing(item.value)"
            >
              {{ t(`rhythm.swingPreset.${item.key}`) }}
            </button>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('rhythm.counting') }}</span>
        <SegmentedControl v-model="settings.countStyle" :options="countOptions" :aria-label="t('rhythm.counting')" />
      </div>
    </div>

    <p class="max-w-[65ch] text-sm text-ink-400">{{ t('rhythm.grooveHint') }}</p>

    <KnowledgeCard v-for="id in style.knowledgeIds ?? []" :key="id" :entry-id="id" />
  </div>
</template>
