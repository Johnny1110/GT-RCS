<script setup lang="ts">
/**
 * 指板回想（PRD Phase 7）：把答案藏起來再問。
 *
 * 其他模組都是「顯示 + 節拍」——畫面先給答案，使用者練的是辨認。
 * 這一個把資訊流向反過來：指板一開始全空，你點對才亮。
 *
 * 兩個正交設定 = 四種練法（PRD F7-1）：
 * - 方向 find：給名字，你點出全指板所有位置
 * - 方向 name：給一格，你說出它的名字
 * - 語言 note／degree：絕對音名，或相對某個調的度數
 *
 * 換題有兩種：不限時（答完按下一題）與限時（**由 transport 的小節數**驅動，
 * 不用 setInterval 也不用牆上時鐘——architecture.md §8 反模式 2）。
 * 出題與比對是純函式，在 quiz.ts；這裡只負責接線與呈現。
 */
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseNoteName, type FretPosition } from '@/core/theory'
import Fretboard from '@/components/Fretboard/Fretboard.vue'
import BeatLamps from '@/components/ui/BeatLamps.vue'
import KnowledgeCard from '@/components/ui/KnowledgeCard.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import { useModuleSettings } from '@/composables/useModuleSettings'
import { usePracticeSession } from '@/composables/usePracticeSession'
import { usePracticeTransport } from '@/composables/usePracticeTransport'
import { usePresetNavigation } from '@/composables/usePresetNavigation'
import { useTransportTick } from '@/composables/useTransportTick'
import { useTransportStore } from '@/stores/transport'
import { KEYS, SCALE_TYPES, isKey, isScaleType } from '../shared'
import {
  accuracy, buildQuestion, cellAt, chromaticBoard, emptyScore, hasPosition,
  recallItems, refillBag,
  type RecallItem, type RecallQuestion,
} from './quiz'
import { BARS_PER_QUESTION_OPTIONS, RECALL_DEFAULTS, type RecallSettings } from './settings'

const MODULE_ID = 'scales.recall'

const { t } = useI18n()
const settings = useModuleSettings<RecallSettings>(MODULE_ID, RECALL_DEFAULTS)

// 持久化資料不可信：可能被竄改，也可能因公式表演進而過期
if (!isKey(settings.root)) settings.root = RECALL_DEFAULTS.root
if (!isScaleType(settings.scale)) settings.scale = RECALL_DEFAULTS.scale
if (settings.direction !== 'find' && settings.direction !== 'name') {
  settings.direction = RECALL_DEFAULTS.direction
}
if (settings.language !== 'note' && settings.language !== 'degree') {
  settings.language = RECALL_DEFAULTS.language
}
if (!BARS_PER_QUESTION_OPTIONS.includes(settings.barsPerQuestion as never)) {
  settings.barsPerQuestion = RECALL_DEFAULTS.barsPerQuestion
}

usePracticeTransport(settings)
usePracticeSession({
  moduleId: MODULE_ID,
  params: () => ({
    direction: settings.direction,
    language: settings.language,
    root: settings.root,
    scale: settings.scale,
  }),
})
/**
 * ←→ 換音階（F5-4）：清單順序與畫面上的選單一致。
 * 音名語言沒有音階選單，就交回空清單——鍵盤層看到少於兩項會放行，
 * 不會出現「按了方向鍵，畫面上看不到的設定被改掉」。
 */
usePresetNavigation({
  items: () => (settings.language === 'degree' ? SCALE_TYPES : []),
  current: () => settings.scale,
  select: (id) => { settings.scale = id as typeof settings.scale },
})

const transport = useTransportStore()
const { position, playing } = useTransportTick()

const items = computed(() => recallItems(settings.language, settings.root, settings.scale))
/** 誤點回饋的來源：每一格都要說得出「你點的是什麼」 */
const board = computed(() => chromaticBoard(settings.root))

const bag = ref<RecallItem[]>([])
const question = ref<RecallQuestion | null>(null)
/** 已答對的位置；name 方向答對後也放進來，讓白圈填上正確答案 */
const found = ref<FretPosition[]>([])
const completed = ref(false)
const feedback = ref('')
const score = reactive(emptyScore())

const total = computed(() => question.value?.item.cells.length ?? 0)

function draw(): void {
  if (bag.value.length === 0) {
    bag.value = refillBag(items.value, Math.random, question.value?.item.label ?? null)
  }
  const item = bag.value.shift()
  question.value = item ? buildQuestion(item, settings.direction, Math.random) : null
  found.value = []
  completed.value = false
  score.questions += 1
}

/** 換題：沒答完的算漏掉——換題時沒找到的不能當作沒發生 */
function advance(): void {
  const current = question.value
  if (current && !completed.value) {
    if (settings.direction === 'find') {
      const remaining = current.item.cells.length - found.value.length
      score.missed += remaining
      feedback.value = t('recall.summary', {
        target: current.item.label,
        found: found.value.length,
        total: current.item.cells.length,
      })
    } else {
      score.missed += 1
      feedback.value = t('recall.summaryName', { target: current.item.label })
    }
  } else {
    feedback.value = ''
  }
  draw()
}

function restart(): void {
  bag.value = []
  question.value = null
  feedback.value = ''
  Object.assign(score, emptyScore())
  draw()
}

// 換方向／語言／調／音階＝換了一整副牌，分數與題目都要重來
watch(
  () => [settings.direction, settings.language, settings.root, settings.scale],
  restart,
  { immediate: true },
)

/**
 * 限時模式的換題來源：transport 的小節數。
 * 停止播放時回 -1，因此起播（-1 → 0）與停止都不會誤觸換題。
 */
const questionIndex = computed(() =>
  settings.barsPerQuestion > 0 && playing.value
    ? Math.floor((position.bar - 1) / settings.barsPerQuestion)
    : -1,
)
watch(questionIndex, (next, prev) => {
  if (next >= 0 && prev !== undefined && prev >= 0 && next !== prev) advance()
})

const timed = computed(() => settings.barsPerQuestion > 0)

function missText(position: FretPosition): string {
  const cell = cellAt(board.value, position)
  if (!cell) return ''
  if (settings.language === 'note') return t('recall.missNote', { name: cell.note.name })
  const inScale = items.value.find((item) => item.pc === cell.note.pc)
  return inScale
    ? t('recall.missDegree', { degree: inScale.label })
    : t('recall.missOutside', {
        name: cell.note.name,
        root: settings.root,
        scale: t(`scale.${settings.scale}`),
      })
}

/** 找位置：點對就亮，點錯說出你點的是什麼（組件只轉發座標，判斷在這裡） */
function onFretClick(clicked: FretPosition): void {
  const current = question.value
  if (!current || settings.direction !== 'find' || completed.value) return
  if (hasPosition(found.value, clicked)) return

  if (hasPosition(current.item.cells, clicked)) {
    found.value = [...found.value, clicked]
    score.hits += 1
    feedback.value = ''
    if (found.value.length === current.item.cells.length) {
      completed.value = true
      feedback.value = t('recall.allFound', { target: current.item.label })
    }
  } else {
    score.misses += 1
    feedback.value = missText(clicked)
  }
}

/** 說名字：答對就把白圈填成正確答案，答錯留在原地再想 */
function onAnswer(item: RecallItem): void {
  const current = question.value
  if (!current || settings.direction !== 'name' || completed.value) return

  if (item.pc === current.item.pc) {
    score.hits += 1
    completed.value = true
    if (current.prompt) found.value = [current.prompt]
    feedback.value = t('recall.correct', { name: current.item.label })
  } else {
    score.misses += 1
    feedback.value = t('recall.missPick', { picked: item.label })
  }
}

/** 只畫已經答對的格——沒答對的那些正是題目 */
const visibleCells = computed(() =>
  question.value?.item.cells.filter((cell) => hasPosition(found.value, cell)) ?? [],
)

/**
 * 顏色錨點：度數語言以調為錨（答對的音點顯示真實度數色），
 * 音名語言以該題目標音為錨（找到的都是白色主音點，標記顯示音名）。
 */
const rootPc = computed(() =>
  settings.language === 'degree' || question.value === null
    ? parseNoteName(settings.root).pc
    : question.value.item.pc,
)

const marks = computed(() => (question.value?.prompt ? [question.value.prompt] : []))

const promptText = computed(() => {
  const current = question.value
  if (!current) return ''
  const scale = t(`scale.${settings.scale}`)
  if (settings.direction === 'find') {
    return settings.language === 'note'
      ? t('recall.findNote', { target: current.item.label })
      : t('recall.findDegree', { target: current.item.label, root: settings.root, scale })
  }
  return settings.language === 'note'
    ? t('recall.nameNote')
    : t('recall.nameDegree', { root: settings.root, scale })
})

const directionOptions = computed(() => [
  { value: 'find', label: t('recall.dirFind') },
  { value: 'name', label: t('recall.dirName') },
])
const languageOptions = computed(() => [
  { value: 'note', label: t('recall.langNote') },
  { value: 'degree', label: t('recall.langDegree') },
])
const keyOptions = computed(() => KEYS.map((key) => ({ value: key, label: key })))
const scaleOptions = computed(() =>
  SCALE_TYPES.map((scale) => ({ value: scale, label: t(`scale.${scale}`) })),
)
const barsOptions = computed(() =>
  BARS_PER_QUESTION_OPTIONS.map((n) => ({
    value: String(n),
    label: n === 0 ? t('recall.untimed') : String(n),
  })),
)
</script>

<template>
  <div class="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 p-6">
    <header class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h1 class="rcs-h1">{{ t('modules.scales.recall.title') }}</h1>
      <p class="text-sm text-ink-400">{{ t('modules.scales.recall.description') }}</p>
    </header>

    <div class="flex flex-wrap items-start gap-x-8 gap-y-4">
      <div class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('recall.direction') }}</span>
        <SegmentedControl
          :model-value="settings.direction"
          :options="directionOptions"
          :aria-label="t('recall.direction')"
          @update:model-value="settings.direction = $event as RecallSettings['direction']"
        />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('recall.language') }}</span>
        <SegmentedControl
          :model-value="settings.language"
          :options="languageOptions"
          :aria-label="t('recall.language')"
          @update:model-value="settings.language = $event as RecallSettings['language']"
        />
      </div>
      <template v-if="settings.language === 'degree'">
        <div class="flex flex-col gap-1.5">
          <span class="rcs-micro">{{ t('explorer.key') }}</span>
          <SegmentedControl v-model="settings.root" :options="keyOptions" :aria-label="t('explorer.key')" wrap />
        </div>
        <div class="flex flex-col gap-1.5">
          <span class="rcs-micro">{{ t('explorer.scale') }}</span>
          <SegmentedControl v-model="settings.scale" :options="scaleOptions" :aria-label="t('explorer.scale')" wrap />
        </div>
      </template>
      <div class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('recall.barsPerQuestion') }}</span>
        <SegmentedControl
          :model-value="String(settings.barsPerQuestion)"
          :options="barsOptions"
          :aria-label="t('recall.barsPerQuestion')"
          @update:model-value="settings.barsPerQuestion = Number($event)"
        />
      </div>
    </div>

    <!-- 題目：畫面上唯一的重點，所以它是這一頁字最大的東西 -->
    <section class="flex flex-col gap-4 rcs-panel p-5">
      <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
        <p class="text-xl font-semibold text-ink-50">{{ promptText }}</p>
        <p v-if="settings.direction === 'find'" class="font-mono text-sm tabular-nums text-ink-300">
          <span class="text-base font-bold text-ink-50">{{ found.length }}</span>
          <span class="text-ink-400"> / {{ total }}</span>
        </p>
      </div>

      <!-- 說名字：選項就是出題池，全鍵盤可達 -->
      <div v-if="settings.direction === 'name'" class="flex flex-wrap gap-2">
        <button
          v-for="item in items"
          :key="item.label"
          type="button"
          class="min-w-[3.5rem] rounded border px-3 py-1.5 font-mono text-sm transition-colors motion-reduce:transition-none"
          :class="completed && item.pc === question?.item.pc
            ? 'border-ink-50 bg-ink-50 font-bold text-ink-950'
            : 'border-ink-700 bg-ink-800 text-ink-100 hover:bg-ink-700 disabled:opacity-40'"
          :disabled="completed"
          @click="onAnswer(item)"
        >
          {{ item.label }}
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
        <p class="min-h-[1.5rem] text-sm text-ink-300">{{ feedback }}</p>

        <button
          v-if="!timed"
          type="button"
          class="ml-auto rounded border px-4 py-1.5 font-mono text-sm"
          :class="completed
            ? 'border-ink-50 bg-ink-50 font-bold text-ink-950'
            : 'border-ink-700 bg-ink-800 text-ink-300 hover:bg-ink-700 hover:text-ink-100'"
          @click="advance"
        >
          {{ t('recall.next') }}
        </button>

        <div v-else class="ml-auto flex items-center gap-3">
          <span class="rcs-micro">{{ t('transport.beat') }}</span>
          <BeatLamps
            :beats="transport.timeSig.beats"
            :current="position.beat"
            :active="playing"
            :size="12"
            :gap="8"
          />
        </div>
      </div>

      <p v-if="timed && !playing" class="font-mono text-[11px] text-ink-400">{{ t('recall.timedHint') }}</p>
      <p v-else-if="!timed" class="font-mono text-[11px] text-ink-500">{{ t('recall.untimedHint') }}</p>
    </section>

    <Fretboard
      :cells="visibleCells"
      :root-pc="rootPc"
      :marks="marks"
      :label-mode="settings.language === 'degree' ? 'degree' : 'noteName'"
      selectable
      @fret-click="onFretClick"
    />

    <section class="flex flex-wrap items-baseline gap-x-8 gap-y-2 font-mono text-xs text-ink-400">
      <span class="rcs-micro">{{ t('recall.stats') }}</span>
      <span>{{ t('recall.questions') }} <b class="text-base tabular-nums text-ink-50">{{ score.questions }}</b></span>
      <span>{{ t('recall.hits') }} <b class="text-base tabular-nums text-ink-50">{{ score.hits }}</b></span>
      <span>{{ t('recall.misses') }} <b class="text-base tabular-nums text-ink-100">{{ score.misses }}</b></span>
      <span>{{ t('recall.missed') }} <b class="text-base tabular-nums text-ink-100">{{ score.missed }}</b></span>
      <span>{{ t('recall.accuracy') }} <b class="text-base tabular-nums text-ink-50">{{ accuracy(score) }}%</b></span>
      <button
        type="button"
        class="rounded border border-ink-700 px-2 py-0.5 text-xs text-ink-400 hover:bg-ink-800 hover:text-ink-100"
        @click="restart"
      >
        {{ t('recall.restart') }}
      </button>
    </section>

    <p class="max-w-[65ch] text-xs text-ink-400">{{ t('recall.keyboardNote') }}</p>

    <KnowledgeCard entry-id="scale.practice-tips" />
  </div>
</template>
