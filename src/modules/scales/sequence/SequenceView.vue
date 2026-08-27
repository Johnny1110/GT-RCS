<script setup lang="ts">
/**
 * 音階模進（音階線第四個模組）：一弦三音與五聲盒型，把指型跑成即興素材。
 *
 * 與另外三個音階模組的差別是**時間解析度與方向**：
 * 總覽與跟練給的是「這個音階在指板上的全部音」，回想把答案藏起來考辨認；
 * 這一個給的是**順序**——一格一個音跟著 click 走，白圈說「就是這一格」。
 * 因此示範音走 useNoteDemo（與七和弦琶音同一個接線），指板上畫的就是那條路徑。
 *
 * 三層分工，每一層都不越界：
 * - core/theory `scaleShapePath()`：這個把位的指型「實際要彈的每一個音」（樂理）。
 * - modules `patterns.ts`：那條路徑要怎麼重排成模進（練習設計）。
 * - 本檔：接線與呈現，不做樂理也不排序列。
 *
 * 兩件容易寫錯的事：
 * - 指型記的是**度數**不是把位 id（id 綁在格號上，換調就失效）——與七和弦琶音記錨定弦同一種考量。
 * - 格號是**絕對**的：模進的序列比一個小節長得多，每小節重算會讓它永遠停在第一組。
 */
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  SCALE_FORMULAS, findPosition, fretMidi, scaleNotesPerString, scalePositions, scaleShapePath, spell,
  type FretPosition,
} from '@/core/theory'
import { colorForInterval } from '@/core/colors'
import BeatLamps from '@/components/ui/BeatLamps.vue'
import ChordDemoControl from '@/components/ui/ChordDemoControl.vue'
import Fretboard from '@/components/Fretboard/Fretboard.vue'
import KnowledgeCard from '@/components/ui/KnowledgeCard.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import { useModuleSettings } from '@/composables/useModuleSettings'
import { useNoteDemo } from '@/composables/useNoteDemo'
import { usePracticeSession } from '@/composables/usePracticeSession'
import { usePracticeTransport } from '@/composables/usePracticeTransport'
import { usePresetNavigation } from '@/composables/usePresetNavigation'
import { useTransportTick } from '@/composables/useTransportTick'
import { useTransportStore } from '@/stores/transport'
import { KEYS, SCALE_TYPES, isKey, isScaleType } from '../shared'
import {
  SEQUENCE_DIRECTIONS, SEQUENCE_PATTERNS, absoluteSlot, alignmentBars, findSequencePattern,
  groupCount, groupIndices, groupOf, isSequenceDirection, orderedCells, sequenceIndices,
  slotsPerBar, stepAt, type SequenceDirection,
} from './patterns'
import { SCALE_SEQUENCE_DEFAULTS, type ScaleSequenceSettings } from './settings'

const MODULE_ID = 'scales.sequence'

const { t } = useI18n()
const settings = useModuleSettings<ScaleSequenceSettings>(MODULE_ID, SCALE_SEQUENCE_DEFAULTS)

// 持久化資料不可信：可能被竄改，也可能因公式表或模進清單演進而過期
if (!isKey(settings.root)) settings.root = SCALE_SEQUENCE_DEFAULTS.root
if (!isScaleType(settings.scale)) settings.scale = SCALE_SEQUENCE_DEFAULTS.scale
if (!findSequencePattern(settings.patternId)) settings.patternId = SCALE_SEQUENCE_DEFAULTS.patternId
if (!isSequenceDirection(settings.direction)) settings.direction = SCALE_SEQUENCE_DEFAULTS.direction

usePracticeTransport(settings)
usePracticeSession({
  moduleId: MODULE_ID,
  params: () => ({
    root: settings.root,
    scale: settings.scale,
    shapeDegree: settings.shapeDegree,
    patternId: settings.patternId,
    direction: settings.direction,
  }),
})
/** ←→ 換模進型（F5-4）：這個模組的「preset」是模進，清單順序與畫面上的選單一致 */
usePresetNavigation({
  items: () => SEQUENCE_PATTERNS.map((item) => item.id),
  current: () => settings.patternId,
  select: (id) => { settings.patternId = id },
})

const transport = useTransportStore()
const { position, playing } = useTransportTick()

const notes = computed(() => spell(settings.root, SCALE_FORMULAS[settings.scale]))
const rootPc = computed(() => notes.value[0]?.pc ?? 0)
const perString = computed(() => scaleNotesPerString(settings.scale))

/** 把位框由 core 推導；指型以錨定音的**度數**記憶，換調照樣指向同一個指型 */
const positions = computed(() => scalePositions(settings.root, settings.scale))
const shape = computed(
  () => positions.value.find((p) => p.anchorDegree === settings.shapeDegree) ?? positions.value[0],
)
const focusedId = computed(() => shape.value?.id ?? null)

function onFocusPosition(id: string | null): void {
  const picked = findPosition(positions.value, id)
  if (picked) settings.shapeDegree = picked.anchorDegree
}

/**
 * 換調或換音階時把記著的度數校正回實際選中的指型：
 * 五聲沒有 `2` 的指型，留著一個指不到任何東西的度數，日誌與下次載入都會怪怪的。
 */
watch(() => [settings.root, settings.scale], () => {
  const resolved = shape.value
  if (resolved && resolved.anchorDegree !== settings.shapeDegree) {
    settings.shapeDegree = resolved.anchorDegree
  }
})

/** 指型路徑＝指板上畫的音點，也是模進的原料（每弦 N 音，由低音弦走到高音弦） */
const path = computed(() =>
  shape.value ? scaleShapePath(settings.root, settings.scale, shape.value) : [],
)

const pattern = computed(() => findSequencePattern(settings.patternId) ?? SEQUENCE_PATTERNS[0]!)
/** 索引序列：畫面與示範音共用同一份順序 */
const sequence = computed(() => sequenceIndices(path.value.length, pattern.value, settings.direction))
const slots = computed(() => slotsPerBar(transport.timeSig.beats, transport.ticksPerBeat))
const cycleBars = computed(() => alignmentBars(sequence.value.length, slots.value))

/**
 * 現在走到序列的第幾個音；未播放時沒有「現在」——不給假的高亮，畫面停在第一組。
 * 播放中改細分時 core 排到下一個小節線才生效，這裡讀到的值卻立刻就變：
 * 那個小節剩下的格子可能對到別的音，下一個小節線自動回正。不為這一個小節多開一條狀態。
 */
const step = computed<number | null>(() => {
  if (!playing.value) return null
  const slot = absoluteSlot(position, transport.timeSig.beats, transport.ticksPerBeat)
  return stepAt(sequence.value.length, slot) ?? null
})

const group = computed(() => groupOf(step.value ?? 0, pattern.value.size))
const groupTotal = computed(() => groupCount(sequence.value.length, pattern.value.size))
const stepInGroup = computed(() =>
  step.value === null ? -1 : step.value - group.value * pattern.value.size,
)

/** 現在這一組的音（整條序列有四十幾個音，全部畫出來沒人看得完） */
const groupDots = computed(() =>
  orderedCells(path.value, groupIndices(sequence.value, group.value, pattern.value.size)).map(
    (cell, index) => {
      const color = colorForInterval(rootPc.value, cell.note.pc)
      return {
        key: `${index}-${cell.string}-${cell.fret}`,
        cell,
        hex: color.hex,
        textHex: color.textHex,
        active: index === stepInGroup.value,
      }
    },
  ),
)

/**
 * 音階裡沒被這個指型走到的音（藍調的 b5，或指板末端被截斷的音）。
 * 由路徑推導而不是寫死「藍調例外」：骨架表之後長大了，這行提示自動跟著對。
 */
const skipped = computed(() => {
  const inPath = new Set(path.value.map((cell) => cell.note.pc))
  return notes.value.filter((note) => !inPath.has(note.pc)).map((note) => note.degree)
})

/** 白圈＝這一格該彈的音。路徑給的是確切格位，所以只圈一格（不是同音高的每一格） */
const marks = computed<FretPosition[]>(() => {
  const pathIndex = step.value === null ? undefined : sequence.value[step.value]
  const cell = pathIndex === undefined ? undefined : path.value[pathIndex]
  return cell ? [{ string: cell.string, fret: cell.fret }] : []
})

/** 示範音：一格一個音，音高就是指板上那一格的實際音高（不是移到中音域的聲位） */
useNoteDemo((e) => {
  const slot = absoluteSlot(e, transport.timeSig.beats, transport.ticksPerBeat)
  const at = stepAt(sequence.value.length, slot)
  const pathIndex = at === undefined ? undefined : sequence.value[at]
  const cell = pathIndex === undefined ? undefined : path.value[pathIndex]
  return cell ? fretMidi(cell) : undefined
})

const keyOptions = computed(() => KEYS.map((key) => ({ value: key, label: key })))
const scaleOptions = computed(() =>
  SCALE_TYPES.map((scale) => ({ value: scale, label: t(`scale.${scale}`) })),
)
const patternOptions = computed(() =>
  SEQUENCE_PATTERNS.map((item) => ({ value: item.id, label: t(item.titleKey) })),
)
const directionOptions = computed(() =>
  SEQUENCE_DIRECTIONS.map((value) => ({ value, label: t(`sequence.${value}`) })),
)
</script>

<template>
  <div class="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 p-6">
    <header class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h1 class="text-2xl font-semibold text-ink-50">{{ t('modules.scales.sequence.title') }}</h1>
      <p class="text-sm text-ink-400">{{ t('modules.scales.sequence.description') }}</p>
    </header>

    <div class="flex flex-wrap items-start gap-x-8 gap-y-4">
      <div class="flex flex-col gap-1.5">
        <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">{{ t('explorer.key') }}</span>
        <SegmentedControl v-model="settings.root" :options="keyOptions" :aria-label="t('explorer.key')" wrap />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">{{ t('explorer.scale') }}</span>
        <SegmentedControl v-model="settings.scale" :options="scaleOptions" :aria-label="t('explorer.scale')" wrap />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">{{ t('sequence.pattern') }}</span>
        <SegmentedControl
          v-model="settings.patternId"
          :options="patternOptions"
          :aria-label="t('sequence.pattern')"
          wrap
        />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">{{ t('sequence.direction') }}</span>
        <SegmentedControl
          :model-value="settings.direction"
          :options="directionOptions"
          :aria-label="t('sequence.direction')"
          @update:model-value="settings.direction = $event as SequenceDirection"
        />
      </div>
      <ChordDemoControl />
    </div>

    <div class="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-lg border border-ink-700 bg-ink-900 px-5 py-3">
      <div class="flex flex-col gap-1">
        <span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-400">{{ t('metronome.bar') }}</span>
        <span class="font-mono text-2xl font-bold tabular-nums text-ink-50">
          {{ playing ? position.bar : '—' }}
        </span>
      </div>
      <div class="flex flex-col gap-1">
        <span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-400">{{ t('transport.beat') }}</span>
        <BeatLamps
          :beats="transport.timeSig.beats"
          :current="position.beat"
          :active="playing"
          :size="16"
          :gap="10"
        />
      </div>
      <div class="flex flex-col gap-1">
        <span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-400">{{ t('sequence.shape') }}</span>
        <span class="font-mono text-xs text-ink-100">
          {{ t('sequence.shapeInfo', { notes: perString, degree: shape?.anchorDegree ?? '—' }) }}
        </span>
      </div>
      <div class="flex flex-col gap-1">
        <span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-400">{{ t('sequence.group') }}</span>
        <span class="font-mono text-xs tabular-nums text-ink-100">
          {{ t('sequence.groupOf', { index: group + 1, total: groupTotal }) }}
        </span>
      </div>
    </div>

    <section class="flex flex-col gap-3">
      <p class="font-mono text-[11px] text-ink-400">
        <span class="uppercase tracking-[0.18em]">{{ t('sequence.strip') }}</span>
        <span class="ml-2 text-sm text-ink-300">{{ t(pattern.titleKey) }}</span>
      </p>

      <ol v-if="groupDots.length" class="flex flex-wrap items-start gap-3" :aria-label="t('sequence.strip')">
        <li v-for="dot in groupDots" :key="dot.key" class="flex w-11 flex-col items-center gap-1">
          <span
            class="grid h-10 w-10 place-items-center rounded-full font-mono text-sm font-bold"
            :class="dot.active ? 'ring-2 ring-ink-50 ring-offset-2 ring-offset-ink-950' : ''"
            :style="{ backgroundColor: dot.hex, color: dot.textHex }"
          >{{ dot.cell.note.name }}</span>
          <span class="font-mono text-[11px]" :class="dot.active ? 'text-ink-100' : 'text-ink-400'">
            {{ dot.cell.note.degree }}
          </span>
        </li>
      </ol>
      <p v-else class="font-mono text-[11px] text-ink-400">{{ t('sequence.emptyShape') }}</p>

      <p v-if="sequence.length" class="font-mono text-[11px] text-ink-400">
        {{ cycleBars === 1
          ? t('sequence.aligned', { notes: sequence.length, slots })
          : t('sequence.cycle', { notes: sequence.length, slots, bars: cycleBars }) }}
      </p>
      <p class="max-w-[65ch] text-xs leading-6 text-ink-400">{{ t('sequence.hint') }}</p>
    </section>

    <section class="flex flex-col gap-2">
      <Fretboard
        :cells="path"
        :root-pc="rootPc"
        :positions="positions"
        :focused-position-id="focusedId"
        :marks="marks"
        position-mode="focus"
        label-mode="degree"
        require-focus
        @update:focused-position-id="onFocusPosition"
      />
      <p class="font-mono text-[11px] text-ink-400">{{ t('sequence.markHint', { notes: perString }) }}</p>
      <p v-if="skipped.length" class="font-mono text-[11px] text-ink-400">
        {{ t('sequence.passingHint', { degrees: skipped.join('、') }) }}
      </p>
      <p class="max-w-[65ch] text-xs leading-6 text-ink-400">{{ t('sequence.intervalHint') }}</p>
    </section>

    <KnowledgeCard entry-id="scale.sequences" />
  </div>
</template>
