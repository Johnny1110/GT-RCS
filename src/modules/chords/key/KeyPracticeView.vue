<script setup lang="ts">
/**
 * 固定調分級練習（PRD F3-4）：單一調內，由入門三和弦一路到 fusion／neo-soul。
 * 與 12 調循環的差別是「留在同一個調把和弦練熟」，因此進行以 AB 循環反覆。
 *
 * 兩種強制切換：點五度圈外圈 → 換調（寫回設定，會持久化）；
 * 點時間軸的和弦 → 用 useBarCursor 的位移跳到那一小節（不動時鐘）。
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { chordPositions, mapToFretboard, realizeProgression, type NoteName } from '@/core/theory'
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
import { PRACTICE_KEYS, isPracticeKey, toPracticeKey } from '../keys'
import { PRACTICE_LEVELS, findLevel } from '../presets'
import { buildChordStrip, loopIndex } from '../timeline'
import { KEY_PRACTICE_DEFAULTS, type KeyPracticeSettings } from '../settings'

const MODULE_ID = 'chords.key-practice'

const { t } = useI18n()
const settings = useModuleSettings<KeyPracticeSettings>(MODULE_ID, KEY_PRACTICE_DEFAULTS)

if (!isPracticeKey(settings.key)) settings.key = KEY_PRACTICE_DEFAULTS.key
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

/** ←→ 換 preset（F5-4）：清單順序與畫面上的選單一致 */
usePresetNavigation({
  items: () => level.value.progressions.map((p) => p.id),
  current: () => settings.presetId,
  select: (id) => { settings.presetId = id },
})


const bars = computed(() =>
  realizeProgression(preset.value, { key: settings.key, harmonyLevel: preset.value.harmonyLevel }),
)

/** 小節游標：未播放時停在第 1 小節，加上使用者按下的強制切換 */
const cursor = useBarCursor()
/** 換調或換進行 = 換了一份小節表，上一份的跳轉不該留著 */
watch(() => [settings.key, settings.presetId], () => cursor.reset())

const activeIndex = computed(() => loopIndex(cursor.bar.value, bars.value.length))
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
useChordDemo((bar) => {
  const list = bars.value
  return list.length === 0 ? undefined : list[loopIndex(cursor.barFor(bar), list.length)]?.chords[0]
})

/** 時間軸＝整個進行（點任何一格就切換過去） */
const timeline = computed<TimelineEntry[]>(() => {
  const list = bars.value
  if (list.length === 0) return []
  const barAt = (bar: number) => list[loopIndex(bar, list.length)]
  return buildChordStrip({
    firstBar: cursor.bar.value - activeIndex.value,
    count: list.length,
    activeBar: cursor.bar.value,
    symbolAt: (bar) => barAt(bar)?.chords.map((c) => c.symbol).join(' · '),
    captionAt: (bar) => `${t('metronome.bar')} ${barAt(bar)?.bar ?? ''}`,
    nowLabel: t('chords.now'),
    nextLabel: t('chords.next'),
  })
})

const keyOptions = PRACTICE_KEYS.map((key) => ({ value: key, label: key }))
const levelOptions = computed(() =>
  PRACTICE_LEVELS.map((item) => ({ value: item.id, label: t(item.titleKey) })),
)
const progressionOptions = computed(() =>
  level.value.progressions.map((item) => ({ value: item.id, label: t(item.titleKey) })),
)
const knowledgeId = computed(() => preset.value.knowledgeIds?.[0] ?? level.value.knowledgeIds?.[0])

/** 圈上寫 F#、這裡的選單寫 Gb——同一個調，換算過再寫回設定 */
function selectKey(key: NoteName): void {
  settings.key = toPracticeKey(key)
}
</script>

<template>
  <div class="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 p-6">
    <header class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h1 class="rcs-h1">{{ t('modules.chords.keyPractice.title') }}</h1>
      <p class="text-sm text-ink-400">{{ t('modules.chords.keyPractice.description') }}</p>
    </header>

    <div class="flex flex-wrap items-start gap-x-8 gap-y-4">
      <div class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('chords.key') }}</span>
        <SegmentedControl v-model="settings.key" :options="keyOptions" :aria-label="t('chords.key')" wrap />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('chords.level') }}</span>
        <SegmentedControl v-model="settings.levelId" :options="levelOptions" :aria-label="t('chords.level')" wrap />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('chords.progression') }}</span>
        <SegmentedControl v-model="settings.presetId" :options="progressionOptions" :aria-label="t('chords.progression')" wrap />
      </div>
      <ChordDemoControl />
    </div>

    <p class="max-w-[65ch] text-sm text-ink-400">{{ t(level.descriptionKey) }}</p>

    <div class="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div class="flex flex-col gap-2">
        <CircleOfFifths
          :tonic="settings.key"
          :current-chord-pc="currentChord?.root.pc"
          mode="key"
          @select-key="selectKey"
        />
        <p class="font-mono text-[11px] text-ink-500">{{ t('chords.switchKeyHint') }}</p>
      </div>

      <div class="flex min-w-0 flex-col gap-4">
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
        <span class="rcs-micro">{{ t('chords.chordTones') }}</span>
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
