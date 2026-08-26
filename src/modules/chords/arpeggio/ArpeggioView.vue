<script setup lang="ts">
/**
 * 七和弦琶音（和弦線第四個模組）：沿五度圈逆時針走完 12 調，
 * 把 maj7／7／m7／m7b5／dim7 的琶音練成手型。
 *
 * 與另外三個和弦模組的差別是**時間解析度**：那三個是「小節線換和弦」，
 * 這一個是「每一格換一個音」——琶音的重點在音符的順序，不在和弦的塊狀聲響。
 * 因此示範音走 useArpeggioDemo（一格一音），指板上的白圈標出「這一格該彈這個音」。
 * 哪一格彈哪個音是純函式（sequence.ts）算的，畫面不做樂理。
 *
 * 把位聚焦記的是**錨定弦**而不是把位 id：id 綁在根音的格號上，換調就失效，
 * 但「根音在第 6 弦的指型」是跨 12 調不變的東西——那正是這個練習要練的。
 * 某個根音沒有那條弦的把位時（框互不重疊，會被擠掉）自動回到全部把位。
 *
 * 兩種強制切換與其他和弦模組一致（useBarCursor 的位移，不動時鐘）：
 * 點五度圈外圈 → 跳到那個調；點時間軸的和弦 → 跳到那一小節。
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  chordPositions, findPosition, isInPosition, mapToFretboard, voiceChord,
  type FretPosition, type NoteName,
} from '@/core/theory'
import { colorForInterval } from '@/core/colors'
import CircleOfFifths from '@/components/CircleOfFifths/CircleOfFifths.vue'
import ChordTimeline, { type TimelineEntry } from '@/components/ChordTimeline/ChordTimeline.vue'
import ChordDemoControl from '@/components/ui/ChordDemoControl.vue'
import Fretboard from '@/components/Fretboard/Fretboard.vue'
import KnowledgeCard from '@/components/ui/KnowledgeCard.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import { useArpeggioDemo } from '@/composables/useArpeggioDemo'
import { useBarCursor } from '@/composables/useBarCursor'
import { useModuleSettings } from '@/composables/useModuleSettings'
import { usePracticeSession } from '@/composables/usePracticeSession'
import { usePracticeTransport } from '@/composables/usePracticeTransport'
import { usePresetNavigation } from '@/composables/usePresetNavigation'
import { useTransportTick } from '@/composables/useTransportTick'
import { useTransportStore } from '@/stores/transport'
import { buildCircleCycle, cycleBarAt, firstBarOfKey, nextChordAfter } from '../cycle'
import { PRACTICE_KEYS, isPracticeKey } from '../keys'
import { buildChordStrip } from '../timeline'
import { ARPEGGIO_DRILLS, drillChordCount, findArpeggioDrill } from './drills'
import {
  ARPEGGIO_DIRECTIONS, arpeggioOrder, fitsBar, isArpeggioDirection, orderedTones,
  slotOf, slotsPerBar, toneIndexAt, type ArpeggioDirection,
} from './sequence'
import { ARPEGGIO_DEFAULTS, REPEAT_OPTIONS, isRepeatCount, type ArpeggioSettings } from './settings'

const MODULE_ID = 'chords.arpeggio'
/** 時間軸至少排這麼多格：單一品質的課表一個調只有一個和弦，只畫一格看不到接下來換哪個調 */
const MIN_STRIP = 4

const { t } = useI18n()
const settings = useModuleSettings<ArpeggioSettings>(MODULE_ID, ARPEGGIO_DEFAULTS)

// 持久化資料不可信：課表可能已被移除、方向與遍數可能被竄改
if (!findArpeggioDrill(settings.drillId)) settings.drillId = ARPEGGIO_DEFAULTS.drillId
if (!isPracticeKey(settings.startKey)) settings.startKey = ARPEGGIO_DEFAULTS.startKey
if (!isArpeggioDirection(settings.direction)) settings.direction = ARPEGGIO_DEFAULTS.direction
if (!isRepeatCount(settings.repeats)) settings.repeats = ARPEGGIO_DEFAULTS.repeats

usePracticeTransport(settings)
usePracticeSession({
  moduleId: MODULE_ID,
  params: () => ({ drillId: settings.drillId, direction: settings.direction, repeats: settings.repeats }),
})
/** ←→ 換 preset（F5-4）：清單順序與畫面上的選單一致 */
usePresetNavigation({
  items: () => ARPEGGIO_DRILLS.map((item) => item.id),
  current: () => settings.drillId,
  select: (id) => { settings.drillId = id },
})

const transport = useTransportStore()
const { position, playing } = useTransportTick()

const drill = computed(() => findArpeggioDrill(settings.drillId) ?? ARPEGGIO_DRILLS[0]!)
/** 一個琶音一小節，所以「走一遍要幾小節」＝課表的和弦數 */
const chordCount = computed(() => Math.max(1, drillChordCount(drill.value)))
const cycle = computed(() =>
  buildCircleCycle(drill.value, {
    barsPerKey: chordCount.value * settings.repeats,
    startKey: settings.startKey,
  }),
)

/** 小節游標：未播放時停在第 1 小節，加上使用者按下的強制切換 */
const cursor = useBarCursor()
/** 換課表／遍數／起始調 = 換了一張小節表，上一張的跳轉不該留著 */
watch(() => [settings.drillId, settings.repeats, settings.startKey], () => cursor.reset())

const activeBar = cursor.bar
const current = computed(() => cycleBarAt(cycle.value, activeBar.value))
const currentChord = computed(() => current.value?.chords[0])
const nextChord = computed(() => nextChordAfter(cycle.value, activeBar.value))
const rootPc = computed(() => currentChord.value?.root.pc ?? 0)
const cells = computed(() => (currentChord.value ? mapToFretboard(currentChord.value.tones) : []))

/** 把位框：琶音就是靠指型記的，框出來才分得清把位（core 推導，畫面不算樂理） */
const positions = computed(() => (currentChord.value ? chordPositions(rootPc.value) : []))
/** 使用者選的是「根音在第幾弦的指型」；把位 id 每換一個和弦就變，錨定弦不變 */
const focusedString = ref<number | null>(null)
const focusedId = computed(
  () => positions.value.find((p) => p.anchorString === focusedString.value)?.id ?? null,
)
function onFocusPosition(id: string | null): void {
  focusedString.value = findPosition(positions.value, id)?.anchorString ?? null
}

/** 音序：索引序列，畫面與示範音共用同一份順序（各自排一次遲早會不一致） */
const order = computed(() => arpeggioOrder(currentChord.value?.tones.length ?? 0, settings.direction))
const sequence = computed(() =>
  currentChord.value ? orderedTones(currentChord.value.tones, order.value) : [],
)
const slots = computed(() => slotsPerBar(transport.timeSig.beats, transport.ticksPerBeat))
const aligned = computed(() => fitsBar(order.value.length, slots.value))

/**
 * 現在該彈第幾個音；未播放時沒有「現在」——不給假的高亮。
 * 播放中改細分時 core 排到下一個小節線才生效，而這裡讀到的 ticksPerBeat 立刻就變了：
 * 那個小節剩下的格子可能對到別的音，下一個小節線自動回正。不為這一個小節多開一條狀態。
 */
const step = computed<number | null>(() => {
  if (!playing.value || order.value.length === 0) return null
  return slotOf(position.beat, position.tick, transport.ticksPerBeat) % order.value.length
})
const currentNote = computed(() => (step.value === null ? undefined : sequence.value[step.value]))

/** 白圈＝這一格該彈的音；聚焦某個把位時只圈框內的（框外圈起來只是雜訊） */
const marks = computed<FretPosition[]>(() => {
  const note = currentNote.value
  if (!note) return []
  const frame = findPosition(positions.value, focusedId.value)
  return cells.value
    .filter((cell) => cell.note.pc === note.pc && (!frame || isInPosition(frame, cell.fret)))
    .map((cell) => ({ string: cell.string, fret: cell.fret }))
})

const sequenceDots = computed(() =>
  sequence.value.map((note, index) => {
    const color = colorForInterval(rootPc.value, note.pc)
    return {
      key: `${index}-${note.degree}`,
      note,
      hex: color.hex,
      textHex: color.textHex,
      active: index === step.value,
    }
  }),
)

/** 這一遍走到第幾個和弦（0-based），時間軸靠它把游標放回這一遍的開頭 */
const indexInPass = computed(() => ((current.value?.barInKey ?? 1) - 1) % chordCount.value)
const passNumber = computed(() => Math.floor(((current.value?.barInKey ?? 1) - 1) / chordCount.value) + 1)

/**
 * 時間軸＝這一遍的每個和弦（點任何一格就切換過去）。
 * 小字說的是「這一格與眾不同的地方」：多和弦課表換的是級數，
 * 單一品質課表換的是調——後者只寫 I7 十二次等於什麼都沒說。
 */
const timeline = computed<TimelineEntry[]>(() => {
  if (!current.value) return []
  const chordAt = (bar: number) => cycleBarAt(cycle.value, bar)
  return buildChordStrip({
    firstBar: activeBar.value - indexInPass.value,
    count: Math.max(chordCount.value, MIN_STRIP),
    activeBar: activeBar.value,
    symbolAt: (bar) => chordAt(bar)?.chords[0]?.symbol,
    captionAt: (bar) =>
      chordCount.value === 1
        ? chordAt(bar)?.key ?? ''
        : chordAt(bar)?.chords[0]?.token.raw ?? '',
    nowLabel: t('chords.now'),
    nextLabel: t('chords.next'),
  })
})

/** 點五度圈：跳到那個調在循環裡的第一小節（不重排循環，順序仍由起始調決定） */
function jumpToKey(key: NoteName): void {
  const bar = firstBarOfKey(cycle.value, key)
  if (bar !== undefined) cursor.jumpTo(bar)
}

/** 示範音：一格一個音。直接由 cycle 查小節，不經過視覺 position——發聲要提前排程 */
useArpeggioDemo((e) => {
  const chord = cycleBarAt(cycle.value, cursor.barFor(e.bar))?.chords[0]
  if (!chord) return undefined
  const midis = voiceChord(chord.tones)
  const index = toneIndexAt(
    arpeggioOrder(midis.length, settings.direction),
    slotOf(e.beat, e.tick, transport.ticksPerBeat),
  )
  return index === undefined ? undefined : midis[index]
})

const drillOptions = computed(() =>
  ARPEGGIO_DRILLS.map((item) => ({ value: item.id, label: t(item.titleKey) })),
)
const directionOptions = computed(() =>
  ARPEGGIO_DIRECTIONS.map((value) => ({ value, label: t(`arpeggio.${value}`) })),
)
const repeatOptions = REPEAT_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))
const keyOptions = PRACTICE_KEYS.map((key) => ({ value: key, label: key }))

const knowledgeId = computed(() => drill.value.knowledgeIds?.[0])
</script>

<template>
  <div class="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 p-6">
    <header class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h1 class="text-2xl font-semibold text-ink-50">{{ t('modules.chords.arpeggio.title') }}</h1>
      <p class="text-sm text-ink-400">{{ t('modules.chords.arpeggio.description') }}</p>
    </header>

    <div class="flex flex-wrap items-start gap-x-8 gap-y-4">
      <div class="flex flex-col gap-1.5">
        <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">{{ t('arpeggio.drill') }}</span>
        <SegmentedControl v-model="settings.drillId" :options="drillOptions" :aria-label="t('arpeggio.drill')" wrap />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">{{ t('arpeggio.direction') }}</span>
        <SegmentedControl
          :model-value="settings.direction"
          :options="directionOptions"
          :aria-label="t('arpeggio.direction')"
          @update:model-value="settings.direction = $event as ArpeggioDirection"
        />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">{{ t('arpeggio.repeats') }}</span>
        <SegmentedControl
          :model-value="String(settings.repeats)"
          :options="repeatOptions"
          :aria-label="t('arpeggio.repeats')"
          @update:model-value="settings.repeats = Number($event)"
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
          <span v-if="settings.repeats > 1">
            {{ t('arpeggio.pass', { pass: passNumber, total: settings.repeats }) }}
          </span>
          <span>{{ t('chords.chord') }}
            <b class="text-base text-ink-50">{{ currentChord?.symbol }}</b>
            <span class="text-ink-400"> {{ currentChord?.token.raw }}</span></span>
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

    <section class="flex flex-col gap-3">
      <p class="font-mono text-[11px] text-ink-400">
        <span class="uppercase tracking-[0.18em]">{{ t('arpeggio.sequence') }}</span>
        <span class="ml-2 text-sm text-ink-300">{{ currentChord?.symbol }}</span>
      </p>

      <ol class="flex flex-wrap items-start gap-3" :aria-label="t('arpeggio.sequence')">
        <li v-for="dot in sequenceDots" :key="dot.key" class="flex w-11 flex-col items-center gap-1">
          <span
            class="grid h-10 w-10 place-items-center rounded-full font-mono text-sm font-bold"
            :class="dot.active ? 'ring-2 ring-ink-50 ring-offset-2 ring-offset-ink-950' : ''"
            :style="{ backgroundColor: dot.hex, color: dot.textHex }"
          >{{ dot.note.name }}</span>
          <span class="font-mono text-[11px]" :class="dot.active ? 'text-ink-100' : 'text-ink-400'">
            {{ dot.note.degree }}
          </span>
        </li>
      </ol>

      <p v-if="!aligned" class="font-mono text-[11px] text-ink-400">
        {{ t('arpeggio.fitHint', { notes: order.length, slots }) }}
      </p>
      <p class="max-w-[65ch] text-xs leading-6 text-ink-400">{{ t('arpeggio.hint') }}</p>
    </section>

    <section class="flex flex-col gap-2">
      <p class="font-mono text-[11px] text-ink-400">
        <span class="uppercase tracking-[0.18em]">{{ t('chords.chordTones') }}</span>
        <span class="ml-2 text-sm text-ink-300">{{ currentChord?.symbol }}</span>
      </p>
      <Fretboard
        :cells="cells"
        :root-pc="rootPc"
        :positions="positions"
        :focused-position-id="focusedId"
        :marks="marks"
        label-mode="degree"
        @update:focused-position-id="onFocusPosition"
      />
      <p class="font-mono text-[11px] text-ink-400">{{ t('arpeggio.markHint') }}</p>
    </section>

    <KnowledgeCard v-if="knowledgeId" :entry-id="knowledgeId" />
  </div>
</template>
