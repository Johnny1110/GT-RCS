<script setup lang="ts">
/**
 * 五度圈經典進行跟練（PRD F3-3）：沿五度圈逆時針走完 12 調。
 * 五度圈 highlight、和弦時間軸、指板組成音三者都由同一個小節游標驅動。
 *
 * 兩種強制切換（useBarCursor 的位移，不動時鐘）：
 * 點五度圈外圈 → 跳到那個調的第一小節；點時間軸的和弦 → 跳到那一小節。
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { chordPositions, mapToFretboard, type NoteName } from '@/core/theory'
import CircleOfFifths from '@/components/CircleOfFifths/CircleOfFifths.vue'
import ChordTimeline, { type TimelineEntry } from '@/components/ChordTimeline/ChordTimeline.vue'
import ChordDemoControl from '@/components/ui/ChordDemoControl.vue'
import Fretboard from '@/components/Fretboard/Fretboard.vue'
import KnowledgeCard from '@/components/ui/KnowledgeCard.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import { useBarCursor } from '@/composables/useBarCursor'
import { useChordDemo } from '@/composables/useChordDemo'
import { useModuleSettings } from '@/composables/useModuleSettings'
import { usePresetNavigation } from '@/composables/usePresetNavigation'
import { usePracticeSession } from '@/composables/usePracticeSession'
import { usePracticeTransport } from '@/composables/usePracticeTransport'
import { buildCircleCycle, cycleBarAt, firstBarOfKey, nextChordAfter } from '../cycle'
import { PRACTICE_KEYS, isPracticeKey } from '../keys'
import { CIRCLE_PROGRESSIONS, findCircleProgression } from '../presets'
import { buildChordStrip } from '../timeline'
import { BARS_PER_KEY_OPTIONS, CIRCLE_DEFAULTS, type CircleProgressionSettings } from '../settings'

const MODULE_ID = 'chords.circle-progressions'

const { t } = useI18n()
const settings = useModuleSettings<CircleProgressionSettings>(MODULE_ID, CIRCLE_DEFAULTS)

// 持久化資料不可信：preset 可能已被移除、barsPerKey 可能被竄改
if (!findCircleProgression(settings.presetId)) settings.presetId = CIRCLE_DEFAULTS.presetId
if (!BARS_PER_KEY_OPTIONS.includes(settings.barsPerKey as never)) settings.barsPerKey = CIRCLE_DEFAULTS.barsPerKey
if (!isPracticeKey(settings.startKey)) settings.startKey = CIRCLE_DEFAULTS.startKey

usePracticeTransport(settings)
usePracticeSession({
  moduleId: MODULE_ID,
  params: () => ({ presetId: settings.presetId, barsPerKey: settings.barsPerKey }),
})

/** ←→ 換 preset（F5-4）：清單順序與畫面上的選單一致 */
usePresetNavigation({
  items: () => CIRCLE_PROGRESSIONS.map((p) => p.id),
  current: () => settings.presetId,
  select: (id) => { settings.presetId = id },
})


const preset = computed(() => findCircleProgression(settings.presetId) ?? CIRCLE_PROGRESSIONS[0]!)
const cycle = computed(() =>
  buildCircleCycle(preset.value, { barsPerKey: settings.barsPerKey, startKey: settings.startKey }),
)

/** 小節游標：未播放時停在第 1 小節，加上使用者按下的強制切換 */
const cursor = useBarCursor()
/** 換 preset／每調小節／起始調 = 換了一張小節表，上一張的跳轉不該留著 */
watch(() => [settings.presetId, settings.barsPerKey, settings.startKey], () => cursor.reset())

const activeBar = cursor.bar
const current = computed(() => cycleBarAt(cycle.value, activeBar.value))
const currentChord = computed(() => current.value?.chords[0])
const nextChord = computed(() => nextChordAfter(cycle.value, activeBar.value))

const cells = computed(() =>
  currentChord.value ? mapToFretboard(currentChord.value.tones) : [],
)

/**
 * 把位框：全指板和弦音看不出指型，框出來才分得清把位（core 推導，畫面不算樂理）。
 * 換和弦時取消聚焦——把位 id 綁在根音上，留著上一個和弦的選擇只會指到不存在的框。
 */
const positions = computed(() =>
  currentChord.value ? chordPositions(currentChord.value.root.pc) : [],
)
const focusedPositionId = ref<string | null>(null)
watch(() => currentChord.value?.root.pc, () => { focusedPositionId.value = null })


/** 時間軸＝當前這個調的整段小節（點任何一格就切換過去） */
const timeline = computed<TimelineEntry[]>(() => {
  const now = current.value
  if (!now) return []
  return buildChordStrip({
    firstBar: activeBar.value - (now.barInKey - 1),
    count: settings.barsPerKey,
    activeBar: activeBar.value,
    symbolAt: (bar) => cycleBarAt(cycle.value, bar)?.chords[0]?.symbol,
    captionAt: (bar) => `${t('metronome.bar')} ${cycleBarAt(cycle.value, bar)?.barInKey ?? ''}`,
    nowLabel: t('chords.now'),
    nextLabel: t('chords.next'),
  })
})

/** 點五度圈：跳到那個調在循環裡的第一小節（不重排循環，順序仍由起始調決定） */
function jumpToKey(key: NoteName): void {
  const bar = firstBarOfKey(cycle.value, key)
  if (bar !== undefined) cursor.jumpTo(bar)
}

const presetOptions = computed(() =>
  CIRCLE_PROGRESSIONS.map((item) => ({ value: item.id, label: t(item.titleKey) })),
)
const barsOptions = BARS_PER_KEY_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))
const keyOptions = PRACTICE_KEYS.map((key) => ({ value: key, label: key }))

/** 示範音：直接由 cycle 查小節，不經過視覺 position——發聲要提前排程 */
useChordDemo((bar) => cycleBarAt(cycle.value, cursor.barFor(bar))?.chords[0])

const knowledgeId = computed(() => preset.value.knowledgeIds?.[0])
</script>

<template>
  <div class="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 p-6">
    <header class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h1 class="text-2xl font-semibold text-ink-50">{{ t('modules.chords.circle.title') }}</h1>
      <p class="text-sm text-ink-400">{{ t('modules.chords.circle.description') }}</p>
    </header>

    <div class="flex flex-wrap items-start gap-x-8 gap-y-4">
      <div class="flex flex-col gap-1.5">
        <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">{{ t('chords.progression') }}</span>
        <SegmentedControl v-model="settings.presetId" :options="presetOptions" :aria-label="t('chords.progression')" wrap />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">{{ t('chords.barsPerKey') }}</span>
        <SegmentedControl
          :model-value="String(settings.barsPerKey)"
          :options="barsOptions"
          :aria-label="t('chords.barsPerKey')"
          @update:model-value="settings.barsPerKey = Number($event)"
        />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">{{ t('chords.startKey') }}</span>
        <SegmentedControl v-model="settings.startKey" :options="keyOptions" :aria-label="t('chords.startKey')" wrap />
      </div>
      <ChordDemoControl />
    </div>

    <div class="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div v-if="current" class="flex flex-col gap-2">
        <CircleOfFifths
          :tonic="current.key"
          :current-chord-pc="currentChord?.root.pc"
          mode="key"
          @select-key="jumpToKey"
        />
        <p class="font-mono text-[11px] text-ink-500">{{ t('chords.jumpKeyHint') }}</p>
      </div>

      <div class="flex min-w-0 flex-col gap-4">
        <div class="flex flex-wrap items-baseline gap-x-6 gap-y-2 font-mono text-xs text-ink-400">
          <span>{{ t('chords.key') }} <b class="text-base text-ink-50">{{ current?.key }}</b>
            <span class="text-ink-400"> {{ (current?.keyIndex ?? 0) + 1 }}/12</span></span>
          <span>{{ t('metronome.bar') }}
            <b class="text-base tabular-nums text-ink-50">{{ current?.barInKey ?? 1 }}</b>
            <span class="text-ink-400">/{{ settings.barsPerKey }}</span></span>
          <span v-if="nextChord">{{ t('chords.next') }} <b class="text-ink-100">{{ nextChord.symbol }}</b></span>
        </div>

        <ChordTimeline
          :entries="timeline"
          selectable
          :label="t('chords.jumpChordHint')"
          @select="cursor.jumpBy"
        />
        <p class="font-mono text-[11px] text-ink-500">{{ t('chords.jumpChordHint') }}</p>
      </div>
    </div>

    <section class="flex flex-col gap-2">
      <p class="font-mono text-[11px] text-ink-400">
        <span class="uppercase tracking-[0.18em]">{{ t('chords.chordTones') }}</span>
        <span class="ml-2 text-sm text-ink-300">{{ currentChord?.symbol }}</span>
      </p>
      <Fretboard
        v-model:focused-position-id="focusedPositionId"
        :cells="cells"
        :root-pc="currentChord?.root.pc ?? 0"
        :positions="positions"
        label-mode="degree"
      />
    </section>

    <KnowledgeCard v-if="knowledgeId" :entry-id="knowledgeId" />
  </div>
</template>
