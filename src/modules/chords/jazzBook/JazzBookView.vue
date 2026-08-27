<script setup lang="ts">
/**
 * The Jazz Book（Phase 8）：把和弦線從「四小節的進行」推進到**一首曲子的曲式**。
 *
 * 與其他和弦模組的三個結構差異：
 * 1. **曲式**——段落展開成小節表（core 的 expandForm），畫面另有一列段落圖負責鳥瞰；
 *    時間軸只畫**當前段落**，32 格全列出來在手機上點不到，而「點得到」是強制切換的前提。
 * 2. **comping**——和弦跟著 feel 的 comp 格子敲，不是一小節一下（useCompDemo）。
 *    click 與 comp 是兩張格子：Charleston 拿來當節拍器會讓人整個失去拍子。
 * 3. **換調**——曲譜只存級數，所以移調免費；`每 N 遍換一個調` 是標準曲練習的核心，
 *    「只會在 F 調彈這首」是最常見的死角。
 *
 * 使用者自己的曲譜與內建曲庫走完全相同的路徑：解析文字 → ChartForm → expandForm。
 * 這一點是刻意的——內建曲庫的原始碼格式就是使用者匯出時拿到的格式。
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ChartTextError, chordAtBeat, chordPositions, expandForm, mapToFretboard, parseChartText,
  sectionSpans, type FormBar, type NoteName,
} from '@/core/theory'
import { isSilentBar } from '@/core/audio'
import CircleOfFifths from '@/components/CircleOfFifths/CircleOfFifths.vue'
import ChordTimeline, { type TimelineEntry } from '@/components/ChordTimeline/ChordTimeline.vue'
import ChordDemoControl from '@/components/ui/ChordDemoControl.vue'
import Fretboard from '@/components/Fretboard/Fretboard.vue'
import KnowledgeCard from '@/components/ui/KnowledgeCard.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import { useBarCursor } from '@/composables/useBarCursor'
import { useCompDemo } from '@/composables/useCompDemo'
import { useModuleSettings } from '@/composables/useModuleSettings'
import { usePresetNavigation } from '@/composables/usePresetNavigation'
import { usePracticeSession } from '@/composables/usePracticeSession'
import { usePracticeTransport } from '@/composables/usePracticeTransport'
import { useTransportTick } from '@/composables/useTransportTick'
import { useTransportStore } from '@/stores/transport'
import { useUserChartsStore, type UserChart } from '@/stores/userCharts'
import { PRACTICE_KEYS, isPracticeKey, toPracticeKey } from '../keys'
import { loopIndex, buildChordStrip } from '../timeline'
import ChartEditor from './ChartEditor.vue'
import { CHART_GROUPS, findChart, type Chart } from './charts'
import { beatsToNextHit, cellIndexOf, isCompHit } from './comping'
import { FEELS, isFeelId, resolveFeel } from './feels'
import {
  COMP_MODES, JAZZ_BOOK_DEFAULTS, KEY_ROTATION_OPTIONS, isCompMode, isKeyRotation,
  resolveFeelId, silenceFromKey, silenceKey, SILENCE_OPTIONS, userChartId, userChartRef,
  type JazzBookSettings,
} from './settings'

const MODULE_ID = 'chords.jazz-book'

const { t } = useI18n()
const transport = useTransportStore()
const userCharts = useUserChartsStore()
const settings = useModuleSettings<JazzBookSettings>(MODULE_ID, JAZZ_BOOK_DEFAULTS)

if (!isPracticeKey(settings.key)) settings.key = JAZZ_BOOK_DEFAULTS.key
if (!isCompMode(settings.comp)) settings.comp = JAZZ_BOOK_DEFAULTS.comp
if (!isKeyRotation(settings.keyRotation)) settings.keyRotation = JAZZ_BOOK_DEFAULTS.keyRotation

/** 使用者曲譜 → Chart。解析失敗不丟例外，交給畫面報錯（那是編輯器的工作） */
function userToChart(item: UserChart): { chart: Chart | null; error: ChartTextError | null } {
  try {
    const draft = parseChartText(item.text)
    return {
      chart: {
        id: userChartRef(item.id),
        title: draft.title,
        descriptionKey: '',
        homeKey: draft.homeKey,
        feel: resolveFeel(draft.feel).id,
        harmonyLevel: 'seventh',
        origin: { kind: 'user' },
        form: draft.form,
        sections: draft.sections,
        ...(draft.bpm === null ? {} : { bpm: draft.bpm }),
      },
      error: null,
    }
  } catch (error) {
    return { chart: null, error: error instanceof ChartTextError ? error : null }
  }
}

const editingId = computed(() => userChartId(settings.chartId))
const editingItem = computed(() => userCharts.find(editingId.value))

const resolved = computed<{ chart: Chart | null; error: ChartTextError | null }>(() => {
  const item = editingItem.value
  if (item) return userToChart(item)
  const chart = findChart(settings.chartId)
  return { chart: chart ?? findChart(JAZZ_BOOK_DEFAULTS.chartId) ?? null, error: null }
})
const chart = computed(() => resolved.value.chart)

/**
 * 換曲 = 換一份 feel 建議；使用者調過的 feel 不該跨曲子留著。
 * 但**掛載時的第一次不算換曲**——那時要尊重上次存下來的設定，
 * 否則每次進來都忘記使用者調過什麼（loopSectionIndex 同理）。
 */
let chartInitialised = false
watch(() => chart.value?.id, () => {
  const value = chart.value
  if (!value) return
  if (!chartInitialised) {
    chartInitialised = true
    if (!isFeelId(settings.feelId)) settings.feelId = value.feel
    return
  }
  settings.feelId = value.feel
  settings.loopSectionIndex = -1
}, { immediate: true })

const feel = computed(() => resolveFeel(resolveFeelId(settings.feelId, chart.value?.feel ?? 'mediumSwing')))
const silence = computed(() => silenceFromKey(settings.silence))

usePracticeTransport(settings)
usePracticeSession({
  moduleId: MODULE_ID,
  params: () => ({ chartId: settings.chartId, key: settings.key, feelId: settings.feelId }),
})

/**
 * feel 的 click 格子掛進 Transport（它接管拍號與細分），swing 一併套用。
 *
 * 掛載時**不動 BPM**：那時 usePracticeTransport 剛把使用者上次存的速度推上去，
 * 蓋掉它等於每次進來都忘記使用者調過什麼。只有換曲或換 feel 才回到建議速度。
 */
function applyFeel(withBpm: boolean): void {
  transport.setPattern(feel.value.click)
  transport.setSwing(feel.value.swing)
  if (withBpm) transport.setBpm(chart.value?.bpm ?? feel.value.bpm.default)
}
onMounted(() => applyFeel(false))
watch(() => [chart.value?.id, feel.value.id].join('/'), (_value, previous) => {
  if (previous !== undefined) applyFeel(true)
})
watch(silence, (mode) => transport.setDemoSilence(mode), { immediate: true })
onUnmounted(() => {
  transport.setPattern(null)
  transport.setDemoSilence(null)
})

/** ←→ 換曲：清單順序與畫面上的選單一致 */
const groupCharts = computed<readonly Chart[]>(() => {
  if (activeGroup.value === 'user') {
    return userCharts.items.map((item) => userToChart(item).chart).filter((c): c is Chart => c !== null)
  }
  return CHART_GROUPS.find((g) => g.id === activeGroup.value)?.charts ?? []
})
usePresetNavigation({
  items: () => groupCharts.value.map((c) => c.id),
  current: () => settings.chartId,
  select: (id) => { settings.chartId = id },
})

// ── 曲式與小節表 ────────────────────────────────────────────────────
const spans = computed(() => (chart.value ? sectionSpans(chart.value) : []))
const chorusBars = computed(() => spans.value.reduce((sum, s) => sum + s.bars, 0))

/** 循環範圍：整首，或只有選中的那一段 */
const loopRange = computed(() => {
  const span = settings.loopSectionIndex >= 0 ? spans.value[settings.loopSectionIndex] : undefined
  return span ? { first: span.firstBar, count: span.bars } : { first: 1, count: chorusBars.value }
})

const cursor = useBarCursor()
// 換曲、換調、換循環範圍 = 換了一份小節表，上一份的跳轉不該留著
watch(() => [settings.chartId, settings.key, settings.loopSectionIndex].join('/'), () => cursor.reset())

/** 游標小節 → 曲譜小節（1-based，落在循環範圍內） */
function chartBarAt(bar: number): number {
  const { first, count } = loopRange.value
  return count <= 0 ? 1 : first + loopIndex(bar, count)
}

/** 第幾遍（0-based）——換調與遍數顯示都看它 */
function chorusAt(bar: number): number {
  return Math.floor((bar - 1) / Math.max(1, loopRange.value.count))
}

/**
 * 這一小節該用哪個調。
 * PRACTICE_KEYS 的順序就是五度下行，所以「往下一個調」＝索引 +1。
 */
function keyAt(bar: number): NoteName {
  if (settings.keyRotation <= 0) return settings.key
  const base = PRACTICE_KEYS.indexOf(settings.key)
  const step = Math.floor(chorusAt(bar) / settings.keyRotation)
  return PRACTICE_KEYS[(((base + step) % PRACTICE_KEYS.length) + PRACTICE_KEYS.length) % PRACTICE_KEYS.length]!
}

/**
 * 12 個調的小節表快取。換調練習每遍都是新的調，每次重算會在
 * 排程回呼裡展開整首 32 小節——那是在音訊執行緒的關鍵路徑上做樂理。
 */
const barsCache = computed(() => {
  void chart.value?.id
  void feel.value.timeSig.beats
  return new Map<string, FormBar[]>()
})
function barsFor(key: NoteName): FormBar[] {
  const value = chart.value
  if (!value) return []
  const cache = barsCache.value
  const cached = cache.get(key)
  if (cached) return cached
  const bars = expandForm(value, {
    key, harmonyLevel: value.harmonyLevel, beatsPerBar: feel.value.timeSig.beats,
  })
  cache.set(key, bars)
  return bars
}

const { position, playing } = useTransportTick()

const activeChartBar = computed(() => chartBarAt(cursor.bar.value))
const displayKey = computed(() => keyAt(cursor.bar.value))
const activeSpan = computed(() =>
  spans.value.find((s) => activeChartBar.value >= s.firstBar && activeChartBar.value < s.firstBar + s.bars),
)
const currentBar = computed<FormBar | undefined>(() => barsFor(displayKey.value)[activeChartBar.value - 1])
const currentChord = computed(() =>
  chordAtBeat(currentBar.value, playing.value ? position.beat : 1)?.chord,
)

const cells = computed(() => (currentChord.value ? mapToFretboard(currentChord.value.tones) : []))
const positions = computed(() => (currentChord.value ? chordPositions(currentChord.value.root.pc) : []))
const focusedPositionId = ref<string | null>(null)
watch(() => currentChord.value?.root.pc, () => { focusedPositionId.value = null })

/** 時間軸＝**當前段落**的每一小節（整首 32 格在手機上點不到，鳥瞰交給段落圖） */
const timeline = computed<TimelineEntry[]>(() => {
  const span = activeSpan.value
  if (!span || !chart.value) return []
  const bars = barsFor(displayKey.value)
  const first = cursor.bar.value - (activeChartBar.value - span.firstBar)
  return buildChordStrip({
    firstBar: first,
    count: span.bars,
    activeBar: cursor.bar.value,
    symbolAt: (bar) => bars[chartBarAt(bar) - 1]?.chords.map((c) => c.chord.symbol).join(' · '),
    captionAt: (bar) => `${t('metronome.bar')} ${chartBarAt(bar)}`,
    nowLabel: t('chords.now'),
    nextLabel: t('chords.next'),
  })
})

/**
 * comping 示範音。敲不敲、敲什麼、敲多久全部在這裡決定——
 * useCompDemo 只負責把和弦變成聲音（與 useNoteDemo 同一條分工）。
 */
useCompDemo((e) => {
  if (settings.comp === 'off') return undefined
  // 靜默小節連 comp 都不響：那一段就是要你自己撐住
  if (isSilentBar(e.bar, silence.value)) return undefined
  const grid = feel.value.comp
  const ticksPerBeat = feel.value.ticksPerBeat
  const index = cellIndexOf(e.beat, e.tick, ticksPerBeat)
  if (!isCompHit(grid, e.bar, index)) return undefined

  const cursorBar = cursor.barFor(e.bar)
  const bar = barsFor(keyAt(cursorBar))[chartBarAt(cursorBar) - 1]
  const hit = chordAtBeat(bar, e.beat + (e.tick - 1) / ticksPerBeat)
  if (!hit) return undefined
  const tones = settings.comp === 'bass' ? hit.chord.tones.slice(0, 1) : hit.chord.tones
  return {
    // comp 模式也進 key：由和弦切到只剩根音時要重新配置聲位
    key: `${hit.chord.symbol}/${settings.comp}`,
    tones,
    beats: beatsToNextHit(grid, e.bar, index, ticksPerBeat, feel.value.timeSig.beats),
  }
})

// ── 選單與互動 ──────────────────────────────────────────────────────
type GroupId = 'drill' | 'standard' | 'user'
const activeGroup = ref<GroupId>(
  userChartId(settings.chartId) !== null
    ? 'user'
    : (CHART_GROUPS.find((g) => g.charts.some((c) => c.id === settings.chartId))?.id ?? 'drill'),
)

const groupOptions = computed(() => [
  ...CHART_GROUPS.map((g) => ({ value: g.id, label: t(g.titleKey) })),
  { value: 'user', label: t('jazzBook.group.user') },
])
const chartOptions = computed(() =>
  activeGroup.value === 'user'
    ? userCharts.items.map((item) => ({ value: userChartRef(item.id), label: item.title }))
    : groupCharts.value.map((c) => ({ value: c.id, label: c.title })),
)
const keyOptions = PRACTICE_KEYS.map((key) => ({ value: key, label: key }))
const feelOptions = computed(() => FEELS.map((f) => ({ value: f.id, label: f.marking })))
const compOptions = computed(() => COMP_MODES.map((m) => ({ value: m, label: t(`jazzBook.comp.${m}`) })))
const silenceOptions = computed(() =>
  SILENCE_OPTIONS.map((m) => ({ value: silenceKey(m), label: m ? `${m.demoBars}/${m.silentBars}` : t('jazzBook.silence.off') })),
)
const rotationOptions = computed(() =>
  KEY_ROTATION_OPTIONS.map((n) => ({ value: String(n), label: n === 0 ? t('jazzBook.rotation.off') : String(n) })),
)

// 換分組：選到不屬於該分組的曲子時落到第一首
watch(activeGroup, () => {
  const options = chartOptions.value
  if (!options.some((o) => o.value === settings.chartId)) {
    settings.chartId = options[0]?.value ?? JAZZ_BOOK_DEFAULTS.chartId
  }
})

/** 段落圖：整首循環時點一格＝跳過去；只循環單段時點一格＝改成循環那一段 */
function selectSection(index: number): void {
  if (settings.loopSectionIndex >= 0) {
    settings.loopSectionIndex = index
    return
  }
  const span = spans.value[index]
  if (span) cursor.jumpBy(span.firstBar - activeChartBar.value)
}

function toggleLoop(): void {
  settings.loopSectionIndex = settings.loopSectionIndex >= 0
    ? -1
    : (activeSpan.value?.index ?? 0)
}

/** 圈上寫 F#、選單寫 Gb——同一個調，換算過再寫回設定 */
function selectKey(key: NoteName): void {
  settings.key = toPracticeKey(key)
}

function createChart(): void {
  selectUserChart(userCharts.create(t('jazzBook.newChartName')).id)
}

function selectUserChart(id: string): void {
  activeGroup.value = 'user'
  settings.chartId = userChartRef(id)
}

function saveChart(text: string): void {
  const item = editingItem.value
  if (item) userCharts.update(item.id, text)
}

function importChart(text: string): void {
  selectUserChart(userCharts.importText(text, t('jazzBook.newChartName')).id)
}

function removeChart(): void {
  const item = editingItem.value
  if (!item) return
  userCharts.remove(item.id)
  settings.chartId = JAZZ_BOOK_DEFAULTS.chartId
  activeGroup.value = 'drill'
}

const chorusLabel = computed(() => chorusAt(cursor.bar.value) + 1)
const knowledgeId = computed(() => chart.value?.knowledgeIds?.[0])
/**
 * 作者標示：公版與保護期內的曲目都要顯示作者與年份。
 * 前者是尊重，後者是「這一首之後要處理」的提醒——內測期間看得見，才不會忘記。
 */
const originLine = computed(() => {
  const value = chart.value?.origin
  if (!value || (value.kind !== 'public-domain' && value.kind !== 'in-copyright')) return null
  return {
    composer: value.composer,
    year: value.firstPublished,
    noteKey: value.kind === 'public-domain' ? 'jazzBook.publicDomain' : 'jazzBook.inCopyright',
  }
})
const bpmHint = computed(() => {
  const range = feel.value.bpm
  return transport.bpm < range.min || transport.bpm > range.max
    ? t('jazzBook.bpmHint', { marking: feel.value.marking, min: range.min, max: range.max })
    : ''
})
</script>

<template>
  <div class="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 p-6">
    <header class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h1 class="rcs-h1">{{ t('modules.chords.jazzBook.title') }}</h1>
      <p class="text-sm text-ink-400">{{ t('modules.chords.jazzBook.description') }}</p>
    </header>

    <div class="flex flex-wrap items-start gap-x-8 gap-y-4">
      <div class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('jazzBook.library') }}</span>
        <SegmentedControl v-model="activeGroup" :options="groupOptions" :aria-label="t('jazzBook.library')" wrap />
      </div>
      <div class="flex min-w-0 flex-col gap-1.5">
        <span class="rcs-micro">{{ t('jazzBook.tune') }}</span>
        <SegmentedControl
          v-if="chartOptions.length"
          v-model="settings.chartId"
          :options="chartOptions"
          :aria-label="t('jazzBook.tune')"
          wrap
        />
        <button v-else type="button" class="rcs-btn" @click="createChart">{{ t('jazzBook.newChart') }}</button>
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('chords.key') }}</span>
        <SegmentedControl v-model="settings.key" :options="keyOptions" :aria-label="t('chords.key')" wrap />
      </div>
    </div>

    <div class="flex flex-wrap items-start gap-x-8 gap-y-4">
      <div class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('jazzBook.feel') }}</span>
        <SegmentedControl v-model="settings.feelId" :options="feelOptions" :aria-label="t('jazzBook.feel')" wrap />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('jazzBook.comping') }}</span>
        <SegmentedControl v-model="settings.comp" :options="compOptions" :aria-label="t('jazzBook.comping')" />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('jazzBook.silence.label') }}</span>
        <SegmentedControl v-model="settings.silence" :options="silenceOptions" :aria-label="t('jazzBook.silence.label')" />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('jazzBook.rotation.label') }}</span>
        <SegmentedControl
          :model-value="String(settings.keyRotation)"
          :options="rotationOptions"
          :aria-label="t('jazzBook.rotation.label')"
          @update:model-value="settings.keyRotation = Number($event)"
        />
      </div>
      <ChordDemoControl />
    </div>

    <p v-if="bpmHint" class="rcs-micro text-ink-400">{{ bpmHint }}</p>

    <p v-if="resolved.error" class="rcs-panel text-sm text-ink-200">
      {{ t('jazzBook.parseError', { line: resolved.error.line, bar: resolved.error.barIndex + 1 }) }}
    </p>

    <template v-if="chart">
      <!-- 曲式圖：整首的鳥瞰。時間軸只畫當前段落，所以這一列是「現在在哪」的唯一來源 -->
      <section class="flex flex-col gap-2">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span class="rcs-micro">{{ t('jazzBook.form') }}</span>
          <span class="rcs-data text-sm text-ink-200">{{ chart.title }}</span>
          <span class="rcs-micro text-ink-500">
            {{ chorusBars }} {{ t('metronome.bar') }} · {{ t('jazzBook.chorus', { n: chorusLabel }) }}
          </span>
          <button type="button" class="rcs-btn ml-auto" :aria-pressed="settings.loopSectionIndex >= 0" @click="toggleLoop">
            {{ settings.loopSectionIndex >= 0 ? t('jazzBook.loopSection') : t('jazzBook.loopWhole') }}
          </button>
        </div>
        <ol class="flex flex-wrap gap-2">
          <li v-for="span in spans" :key="span.index">
            <button
              type="button"
              class="flex min-w-16 flex-col gap-0.5 rounded-md border px-3 py-1.5 text-left"
              :class="span.index === activeSpan?.index
                ? 'border-ink-50 bg-ink-50 text-ink-950'
                : 'border-ink-700 text-ink-300 hover:border-ink-500'"
              :aria-current="span.index === activeSpan?.index ? 'true' : undefined"
              @click="selectSection(span.index)"
            >
              <span class="rcs-data text-sm">{{ span.label }}</span>
              <span class="rcs-micro" :class="span.index === activeSpan?.index ? 'text-ink-600' : 'text-ink-500'">
                {{ span.bars }}
              </span>
            </button>
          </li>
        </ol>
      </section>

      <div class="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div class="flex flex-col gap-2">
          <CircleOfFifths
            :tonic="displayKey"
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

      <p v-if="chart.descriptionKey" class="max-w-[65ch] text-sm text-ink-400">{{ t(chart.descriptionKey) }}</p>
      <p v-if="originLine" class="rcs-micro text-ink-500">
        {{ originLine.composer }} · {{ originLine.year }} · {{ t(originLine.noteKey) }}
      </p>
    </template>

    <ChartEditor
      :item="editingItem"
      @create="createChart"
      @update="saveChart"
      @import="importChart"
      @remove="removeChart"
    />

    <KnowledgeCard v-if="knowledgeId" :entry-id="knowledgeId" />
  </div>
</template>
