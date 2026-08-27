<script setup lang="ts">
/**
 * 自訂進行（PRD F5-3）：使用者自己打的進行，跟練體驗與內建 preset 完全相同。
 *
 * 為什麼是獨立模組而不是塞進既有兩個和弦模組的 preset 清單：
 * 自訂進行多了一整套編輯與管理（新增／改名／複製／刪除），而練習模組的規則是
 * 「一個練習 = 一個資料夾 = 一份 manifest」。塞進去會讓那兩個模組同時是練習器又是編輯器。
 *
 * 跟練的部分刻意與 KeyPractice／CircleProgressions 走同一條路：
 * 展開成 core 的 ProgressionPreset → realizeProgression（單一調）或 buildCircleCycle（12 調），
 * 之後 timeline／五度圈／指板／示範音全部由同一個小節數驅動。
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  chordPositions, mapToFretboard, parseProgression, realizeProgression,
  type NoteName, type RealizedChord,
} from '@/core/theory'
import CircleOfFifths from '@/components/CircleOfFifths/CircleOfFifths.vue'
import ChordTimeline, { type TimelineEntry } from '@/components/ChordTimeline/ChordTimeline.vue'
import ChordDemoControl from '@/components/ui/ChordDemoControl.vue'
import Fretboard from '@/components/Fretboard/Fretboard.vue'
import { useBarCursor } from '@/composables/useBarCursor'
import { useChordDemo } from '@/composables/useChordDemo'
import { useModuleSettings } from '@/composables/useModuleSettings'
import { usePresetNavigation } from '@/composables/usePresetNavigation'
import { usePracticeSession } from '@/composables/usePracticeSession'
import { usePracticeTransport } from '@/composables/usePracticeTransport'
import { useTransportStore } from '@/stores/transport'
import { toPreset, useCustomProgressionsStore, type CustomProgression } from '@/stores/customProgressions'
import { buildCircleCycle, cycleBarAt, firstBarOfKey } from '../cycle'
import { buildChordStrip, loopIndex } from '../timeline'
import ProgressionEditor from './ProgressionEditor.vue'
import { CUSTOM_DEFAULTS, type CustomProgressionSettings } from './settings'

const MODULE_ID = 'chords.custom'

const { t } = useI18n()
const settings = useModuleSettings<CustomProgressionSettings>(MODULE_ID, CUSTOM_DEFAULTS)
const store = useCustomProgressionsStore()
const transport = useTransportStore()

usePracticeTransport(settings)
usePracticeSession({
  moduleId: MODULE_ID,
  params: () => ({ progressionId: settings.selectedId }),
})

/** ←→ 換 preset（F5-4）：清單順序與畫面上的選單一致 */
usePresetNavigation({
  items: () => store.items.map((i) => i.id),
  current: () => settings.selectedId,
  select: (id) => { settings.selectedId = id },
})


/** 選中的進行；持久化的 id 可能已被刪除 → 落到第一個 */
const selected = computed<CustomProgression | undefined>(
  () => store.find(settings.selectedId) ?? store.items[0],
)
watch(selected, (item) => { if (item && item.id !== settings.selectedId) settings.selectedId = item.id },
  { immediate: true })

/** 記法能不能解析——不能就整頁的跟練都停用，不要拿壞資料去排程 */
const tokenCount = computed(() => {
  if (!selected.value) return 0
  try {
    return parseProgression(selected.value.tokens, selected.value.harmonyLevel).length
  } catch {
    return 0
  }
})
const playable = computed(() => tokenCount.value > 0)

const preset = computed(() =>
  selected.value ? toPreset(selected.value, tokenCount.value) : null,
)

/** 12 調循環時走 cycle 表，否則就是單一調的小節表反覆 */
const cycle = computed(() =>
  preset.value && selected.value?.cycleKeys && playable.value
    ? buildCircleCycle(preset.value, {
        barsPerKey: selected.value.barsPerKey,
        startKey: selected.value.key,
      })
    : null,
)
const singleKeyBars = computed(() =>
  preset.value && selected.value && !selected.value.cycleKeys && playable.value
    ? realizeProgression(preset.value, {
        key: selected.value.key,
        harmonyLevel: selected.value.harmonyLevel,
      })
    : [],
)

function chordAtBar(bar: number): RealizedChord | undefined {
  if (cycle.value) return cycleBarAt(cycle.value, bar)?.chords[0]
  const bars = singleKeyBars.value
  return bars.length === 0 ? undefined : bars[loopIndex(bar, bars.length)]?.chords[0]
}

function keyAtBar(bar: number): NoteName | undefined {
  return cycle.value ? cycleBarAt(cycle.value, bar)?.key : selected.value?.key
}

/** 小節游標：未播放時停在第 1 小節，加上使用者按下的強制切換 */
const cursor = useBarCursor()
/** 換進行或改記法 = 換了一份小節表，上一份的跳轉不該留著 */
watch(() => [settings.selectedId, selected.value?.tokens, selected.value?.key], () => cursor.reset())

const activeBar = cursor.bar
const currentChord = computed(() => chordAtBar(activeBar.value))
const currentKey = computed(() => keyAtBar(activeBar.value))

const cells = computed(() => (currentChord.value ? mapToFretboard(currentChord.value.tones) : []))
const positions = computed(() =>
  currentChord.value ? chordPositions(currentChord.value.root.pc) : [],
)
const focusedPositionId = ref<string | null>(null)
watch(() => currentChord.value?.root.pc, () => { focusedPositionId.value = null })

useChordDemo((bar) => chordAtBar(cursor.barFor(bar)))

/**
 * 時間軸＝一整段進行（點任何一格就切換過去）。
 * 12 調循環時「一段」是當前這個調的小節，單一調時就是整個進行反覆的那一輪。
 */
const timeline = computed<TimelineEntry[]>(() => {
  if (!playable.value) return []
  const bar = activeBar.value
  const cycleTable = cycle.value
  const segment = cycleTable
    ? { first: bar - ((cycleBarAt(cycleTable, bar)?.barInKey ?? 1) - 1), count: selected.value?.barsPerKey ?? 0 }
    : { first: bar - loopIndex(bar, singleKeyBars.value.length), count: singleKeyBars.value.length }
  return buildChordStrip({
    firstBar: segment.first,
    count: segment.count,
    activeBar: bar,
    symbolAt: (at) => chordAtBar(at)?.symbol,
    captionAt: (at) => `${t('metronome.bar')} ${cycleTable
      ? (cycleBarAt(cycleTable, at)?.barInKey ?? '')
      : loopIndex(at, singleKeyBars.value.length) + 1}`,
    nowLabel: t('chords.now'),
    nextLabel: t('chords.next'),
  })
})

/** 點五度圈：跳到那個調在 12 調循環裡的第一小節 */
function jumpToKey(key: NoteName): void {
  const target = cycle.value ? firstBarOfKey(cycle.value, key) : undefined
  if (target !== undefined) cursor.jumpTo(target)
}

/**
 * BPM 跟著進行走：每個進行記住自己的速度。
 * 換進行 → 推它的 BPM 進 transport；在 TransportBar 上改 → 寫回這個進行。
 */
watch(selected, (item) => {
  if (item) transport.setBpm(item.defaultBpm)
}, { immediate: true })
watch(() => transport.bpm, (bpm) => {
  if (selected.value && bpm !== selected.value.defaultBpm) {
    store.update(selected.value.id, { defaultBpm: bpm })
  }
})

function patch(changes: Partial<CustomProgression>): void {
  if (selected.value) store.update(selected.value.id, changes)
}

function addNew(): void {
  settings.selectedId = store.create(t('custom.newName', { n: store.items.length + 1 })).id
}

function duplicateCurrent(): void {
  if (!selected.value) return
  const copy = store.duplicate(selected.value.id, t('custom.copySuffix'))
  if (copy) settings.selectedId = copy.id
}

const confirmingDelete = ref(false)
function deleteCurrent(): void {
  if (selected.value) store.remove(selected.value.id)
  confirmingDelete.value = false
}
watch(selected, () => { confirmingDelete.value = false })
</script>

<template>
  <div class="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 p-6">
    <header class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h1 class="rcs-h1">{{ t('modules.chords.custom.title') }}</h1>
      <p class="text-sm text-ink-400">{{ t('modules.chords.custom.description') }}</p>
    </header>

    <!-- 進行清單 + 管理 -->
    <div class="flex flex-wrap items-center gap-2">
      <button
        v-for="item in store.items"
        :key="item.id"
        type="button"
        class="max-w-[14rem] truncate rounded border px-3 py-1 text-sm"
        :class="item.id === selected?.id
          ? 'border-ink-50 bg-ink-50 font-semibold text-ink-950'
          : 'border-ink-700 text-ink-300 hover:bg-ink-800 hover:text-ink-100'"
        :aria-pressed="item.id === selected?.id"
        @click="settings.selectedId = item.id"
      >
        {{ item.name }}
      </button>

      <button
        type="button"
        class="rcs-btn px-3 py-1 text-sm"
        @click="addNew"
      >
        {{ t('custom.new') }}
      </button>

      <template v-if="selected">
        <span class="mx-1 h-4 w-px bg-ink-800" />
        <button
          type="button"
          class="rounded border border-ink-700 px-3 py-1 font-mono text-xs text-ink-400 hover:bg-ink-800 hover:text-ink-100"
          @click="duplicateCurrent"
        >
          {{ t('custom.duplicate') }}
        </button>
        <button
          v-if="!confirmingDelete"
          type="button"
          class="rounded border border-ink-700 px-3 py-1 font-mono text-xs text-ink-400 hover:bg-ink-800 hover:text-ink-100"
          @click="confirmingDelete = true"
        >
          {{ t('custom.delete') }}
        </button>
        <template v-else>
          <span class="text-xs text-ink-300">{{ t('custom.deleteConfirm', { name: selected.name }) }}</span>
          <button
            type="button"
            class="rcs-btn-primary px-3 py-1 font-mono text-xs"
            @click="deleteCurrent"
          >
            {{ t('stats.clearYes') }}
          </button>
          <button
            type="button"
            class="rounded border border-ink-700 px-3 py-1 font-mono text-xs text-ink-400 hover:bg-ink-800"
            @click="confirmingDelete = false"
          >
            {{ t('stats.cancel') }}
          </button>
        </template>
      </template>
    </div>

    <p v-if="!selected" class="rcs-panel p-6 text-sm text-ink-400">
      {{ t('custom.empty') }}
    </p>

    <template v-else>
      <section class="rcs-panel p-5">
        <ProgressionEditor
          :item="selected"
          :current-chord-pc="currentChord?.root.pc"
          @patch="patch"
        />
      </section>

      <ChordDemoControl />

      <p v-if="!playable" class="text-sm text-ink-300">{{ t('custom.notPlayable') }}</p>

      <template v-else>
        <!-- 單一調時上面編輯器的五度圈已經在 highlight 當前和弦，不再重複畫一個 -->
        <div class="grid gap-6" :class="selected.cycleKeys ? 'lg:grid-cols-[320px_1fr]' : ''">
          <div v-if="selected.cycleKeys" class="flex flex-col gap-2">
            <CircleOfFifths
              :tonic="currentKey"
              :current-chord-pc="currentChord?.root.pc"
              mode="key"
              @select-key="jumpToKey"
            />
            <p class="font-mono text-[11px] text-ink-500">{{ t('chords.jumpKeyHint') }}</p>
          </div>

          <div class="flex min-w-0 flex-col gap-4">
            <div class="flex flex-wrap items-baseline gap-x-6 gap-y-2 font-mono text-xs text-ink-400">
              <span>{{ t('chords.key') }} <b class="text-base text-ink-50">{{ currentKey }}</b></span>
              <span>{{ t('metronome.bar') }}
                <b class="text-base tabular-nums text-ink-50">{{ activeBar }}</b></span>
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
      </template>
    </template>

    <p class="max-w-[65ch] text-xs text-ink-400">{{ t('custom.backupHint') }}</p>
  </div>
</template>
