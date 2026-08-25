<script setup lang="ts">
/**
 * 固定調分級練習（PRD F3-4）：單一調內，由入門三和弦一路到 fusion／neo-soul。
 * 與 12 調循環的差別是「留在同一個調把和弦練熟」，因此進行以 AB 循環反覆。
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { chordPositions, mapToFretboard, realizeProgression } from '@/core/theory'
import CircleOfFifths from '@/components/CircleOfFifths/CircleOfFifths.vue'
import ChordTimeline, { type TimelineEntry } from '@/components/ChordTimeline/ChordTimeline.vue'
import ChordDemoControl from '@/components/ui/ChordDemoControl.vue'
import Fretboard from '@/components/Fretboard/Fretboard.vue'
import KnowledgeCard from '@/components/ui/KnowledgeCard.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import { useChordDemo } from '@/composables/useChordDemo'
import { useModuleSettings } from '@/composables/useModuleSettings'
import { usePracticeSession } from '@/composables/usePracticeSession'
import { usePracticeTransport } from '@/composables/usePracticeTransport'
import { useTransportTick } from '@/composables/useTransportTick'
import { DESCENDING_FIFTHS } from '@/components/CircleOfFifths/geometry'
import { PRACTICE_LEVELS, findLevel } from '../presets'
import { KEY_PRACTICE_DEFAULTS, type KeyPracticeSettings } from '../settings'

const MODULE_ID = 'chords.key-practice'
const TIMELINE_WINDOW = 4

const { t } = useI18n()
const settings = useModuleSettings<KeyPracticeSettings>(MODULE_ID, KEY_PRACTICE_DEFAULTS)

if (!DESCENDING_FIFTHS.includes(settings.key)) settings.key = KEY_PRACTICE_DEFAULTS.key
if (!findLevel(settings.levelId)) settings.levelId = KEY_PRACTICE_DEFAULTS.levelId

const level = computed(() => findLevel(settings.levelId) ?? PRACTICE_LEVELS[0]!)
const preset = computed(
  () => level.value.progressions.find((p) => p.id === settings.presetId) ?? level.value.progressions[0]!,
)

// 換級別時，原本選的進行不屬於新級別 → 自動落到該級別的第一個
watch(level, (value) => {
  if (!value.progressions.some((p) => p.id === settings.presetId)) {
    settings.presetId = value.progressions[0]?.id ?? KEY_PRACTICE_DEFAULTS.presetId
  }
}, { immediate: true })

usePracticeTransport(settings)
usePracticeSession({
  moduleId: MODULE_ID,
  params: () => ({ key: settings.key, levelId: settings.levelId, presetId: settings.presetId }),
})

const { position, playing } = useTransportTick()

const bars = computed(() =>
  realizeProgression(preset.value, { key: settings.key, harmonyLevel: preset.value.harmonyLevel }),
)

const activeIndex = computed(() =>
  bars.value.length === 0 ? 0 : ((playing.value ? position.bar : 1) - 1) % bars.value.length,
)
const currentChord = computed(() => bars.value[activeIndex.value]?.chords[0])
const cells = computed(() => (currentChord.value ? mapToFretboard(currentChord.value.tones) : []))

/**
 * 把位框：全指板和弦音看不出指型，框出來才分得清把位（core 推導，畫面不算樂理）。
 * 換和弦時取消聚焦——把位 id 綁在根音上，留著上一個和弦的選擇只會指到不存在的框。
 */
const positions = computed(() =>
  currentChord.value ? chordPositions(currentChord.value.root.pc) : [],
)
const focusedPositionId = ref<string | null>(null)
watch(() => currentChord.value?.root.pc, () => { focusedPositionId.value = null })


/** 示範音：直接由 bars 查小節，不經過視覺 position——發聲要提前排程 */
useChordDemo((bar) =>
  bars.value.length === 0 ? undefined : bars.value[(bar - 1) % bars.value.length]?.chords[0],
)

const timeline = computed<TimelineEntry[]>(() => {
  if (bars.value.length === 0) return []
  const entries: TimelineEntry[] = []
  for (let offset = 0; offset < Math.min(TIMELINE_WINDOW, bars.value.length); offset++) {
    const bar = bars.value[(activeIndex.value + offset) % bars.value.length]
    const chord = bar?.chords[0]
    if (!bar || !chord) continue
    entries.push({
      key: `${bar.bar}-${offset}`,
      symbol: bar.chords.map((c) => c.symbol).join(' · '),
      caption: offset === 0 ? t('chords.now') : offset === 1 ? t('chords.next') : `${t('metronome.bar')} ${bar.bar}`,
      state: offset === 0 ? 'current' : offset === 1 ? 'next' : 'future',
    })
  }
  return entries
})

const keyOptions = DESCENDING_FIFTHS.map((key) => ({ value: key, label: key }))
const levelOptions = computed(() =>
  PRACTICE_LEVELS.map((item) => ({ value: item.id, label: t(item.titleKey) })),
)
const progressionOptions = computed(() =>
  level.value.progressions.map((item) => ({ value: item.id, label: t(item.titleKey) })),
)
const knowledgeId = computed(() => preset.value.knowledgeIds?.[0] ?? level.value.knowledgeIds?.[0])
</script>

<template>
  <div class="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 p-6">
    <header class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h1 class="text-2xl font-semibold text-ink-50">{{ t('modules.chords.keyPractice.title') }}</h1>
      <p class="text-sm text-ink-400">{{ t('modules.chords.keyPractice.description') }}</p>
    </header>

    <div class="flex flex-wrap items-start gap-x-8 gap-y-4">
      <div class="flex flex-col gap-1.5">
        <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">{{ t('chords.key') }}</span>
        <SegmentedControl v-model="settings.key" :options="keyOptions" :aria-label="t('chords.key')" wrap />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">{{ t('chords.level') }}</span>
        <SegmentedControl v-model="settings.levelId" :options="levelOptions" :aria-label="t('chords.level')" wrap />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">{{ t('chords.progression') }}</span>
        <SegmentedControl v-model="settings.presetId" :options="progressionOptions" :aria-label="t('chords.progression')" wrap />
      </div>
      <ChordDemoControl />
    </div>

    <p class="max-w-[65ch] text-sm text-ink-400">{{ t(level.descriptionKey) }}</p>

    <div class="grid gap-6 lg:grid-cols-[320px_1fr]">
      <CircleOfFifths :tonic="settings.key" :current-chord-pc="currentChord?.root.pc" />

      <div class="flex min-w-0 flex-col gap-4">
        <ChordTimeline :entries="timeline" />
      </div>
    </div>

    <section class="flex flex-col gap-2">
      <p class="font-mono text-[11px] text-ink-500">
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
