<script setup lang="ts">
/**
 * Fretboard — 22 格指板（純顯示組件）。
 *
 * 架構契約（見 docs/architecture.md §組件層）：
 * - 純 props in / events out；不 import stores、不做樂理計算。
 * - cells 一律來自 core/theory mapToFretboard() 的輸出。
 * - 顏色一律來自 core/colors colorForInterval()（以 rootPc 為錨）。
 *
 * 把位框（positions）：全指板音點有 40～90 個，不分組就看不出哪幾個音湊成一個指型。
 * 框由 core/theory 的 chordPositions() / scalePositions() 算出（本組件不做樂理），
 * 畫在音點下層；框是**灰階**的：色彩只屬於音高，結構一律灰階（design-system §1.1）。
 *
 * 兩種模式，差別在把位系統本身重不重疊：
 * - tile（和弦）：把位互不重疊 → 全部框一起畫，標籤是根音格號，框外音點淡出。
 * - focus（音階）：把位天生重疊 → 一次只畫聚焦的那一個框，標籤是錨定音的度數；
 *   沒選把位時完全不畫框，維持原本的全指板呈現。
 *
 * 互動（回想測驗，PRD F7-4）：`selectable` 時在**每一格**（含沒有音點的格）鋪一層透明命中區，
 * 點下去只 emit 座標——這一格上有沒有音、答對沒答對，一律由模組層判斷。
 * `marks` 畫空心圈，用來標出「要辨認的是這一格」。
 *
 * `requireFocus`：有些練習（音階模進）**必須**有一個指型才成立——沒有指型就沒有路徑，
 * 也就沒有順序。這時「全部」不是一個合法狀態，於是它從選單消失，再點一次也不取消聚焦。
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  isInPosition,
  type FretCell, type FretPosition, type FretboardPosition, type PitchClass,
} from '@/core/theory'
import { colorForInterval } from '@/core/colors'
import { POSITION_MARKS, fretboardLayout, positionRect, scrollLeftForFret } from './geometry'

export interface FretboardProps {
  cells: readonly FretCell[]
  /** 顏色錨點（度數顏色相對此音計算） */
  rootPc: PitchClass
  fretCount?: number
  stringCount?: number
  labelMode?: 'degree' | 'noteName'
  /** 把位框；省略或空陣列 = 不畫框 */
  positions?: readonly FretboardPosition[]
  /** 只看某一個把位：框外音點淡出。null = 全部把位都亮 */
  focusedPositionId?: string | null
  /** 把位彼此重疊時用 'focus'（音階）；互不重疊時用 'tile'（和弦） */
  positionMode?: 'tile' | 'focus'
  /** 互動練習：整塊指板可點（含沒有音點的格），emit fretClick */
  selectable?: boolean
  /** 空心圈標記（回想測驗的題目「就是這一格」）；不帶音名也不帶顏色 */
  marks?: readonly FretPosition[]
  /** 一定要選著一個把位（模進：沒有指型就沒有順序）：不提供「全部」，再點一次也不取消 */
  requireFocus?: boolean
}

const props = withDefaults(defineProps<FretboardProps>(), {
  fretCount: 22,
  stringCount: 6,
  labelMode: 'degree',
  positions: () => [],
  focusedPositionId: null,
  positionMode: 'tile',
  selectable: false,
  marks: () => [],
  requireFocus: false,
})

const emit = defineEmits<{
  /** 點擊音點（互動練習用；純轉發，不含邏輯） */
  (e: 'cellClick', cell: FretCell): void
  /** 聚焦的把位改變（支援 v-model:focused-position-id） */
  (e: 'update:focusedPositionId', id: string | null): void
  /** 點擊任何一格（selectable 時才有）；純座標，不含樂理 */
  (e: 'fretClick', position: FretPosition): void
}>()

/** 框外音點的透明度：看得見（它確實是和弦音）但退到背景 */
const OUTSIDE_OPACITY = 0.26
/** 聚焦某把位時，其餘一切的透明度 */
const UNFOCUSED_OPACITY = 0.12

const { t } = useI18n()
const scroller = ref<HTMLElement | null>(null)
const layout = computed(() =>
  fretboardLayout(props.fretCount, props.stringCount, props.positions.length > 0),
)

const focused = computed(() =>
  props.positions.find((p) => p.id === props.focusedPositionId) ?? null,
)

/** 全部把位（選單用）。音階把位標度數——'1' 的框就是根音起的指型，比序號多說一件事 */
const entries = computed(() =>
  props.positions.map((position) => ({
    position,
    key: position.id,
    rect: positionRect(layout.value, position.fromFret, position.toFret, props.stringCount),
    active: focused.value === null || focused.value.id === position.id,
    label: props.positionMode === 'focus'
      ? position.anchorDegree
      : position.fromFret === 0
        ? t('fretboard.openPosition')
        : String(position.anchorFret),
    title: props.positionMode === 'focus'
      ? t('fretboard.scalePositionAria', {
          degree: position.anchorDegree,
          from: position.fromFret,
          to: position.toFret,
        })
      : t('fretboard.positionAria', {
          fret: position.anchorFret,
          string: position.anchorString,
          from: position.fromFret,
          to: position.toFret,
        }),
  })),
)

/** 實際畫出來的框。focus 模式的把位互相重疊，全畫會糊成一團，因此只畫聚焦的那一個 */
const frames = computed(() =>
  props.positionMode === 'focus'
    ? entries.value.filter((entry) => entry.key === focused.value?.id)
    : entries.value,
)

function dotOpacity(fret: number): number {
  if (props.positions.length === 0) return 1
  if (focused.value) return isInPosition(focused.value, fret) ? 1 : UNFOCUSED_OPACITY
  // focus 模式沒選把位＝維持原本的全指板呈現（框是輔助，不是濾鏡）
  if (props.positionMode === 'focus') return 1
  return props.positions.some((p) => isInPosition(p, fret)) ? 1 : OUTSIDE_OPACITY
}

const dots = computed(() =>
  props.cells.map((cell) => {
    const color = colorForInterval(props.rootPc, cell.note.pc)
    return {
      cell,
      key: `${cell.string}-${cell.fret}`,
      cx: layout.value.cellX(cell.fret),
      cy: layout.value.cellY(cell.string),
      fill: color.hex,
      textFill: color.textHex,
      label: props.labelMode === 'degree' ? cell.note.degree : cell.note.name,
      opacity: dotOpacity(cell.fret),
    }
  }),
)

/** 命中半徑略大於音點：手機上 22 格已經很窄，命中區再等於音點就按不到 */
const HIT_R = 1.4

/** 每一格一個透明圓；只有 selectable 時才產生（平時是 0 個節點） */
const hits = computed(() => {
  if (!props.selectable) return []
  const cells: { key: string; cx: number; cy: number; position: FretPosition }[] = []
  for (let string = 1; string <= props.stringCount; string++) {
    for (let fret = 0; fret <= props.fretCount; fret++) {
      cells.push({
        key: `hit-${string}-${fret}`,
        cx: layout.value.cellX(fret),
        cy: layout.value.cellY(string),
        position: { string, fret },
      })
    }
  }
  return cells
})

const markDots = computed(() =>
  props.marks.map((mark) => ({
    key: `mark-${mark.string}-${mark.fret}`,
    cx: layout.value.cellX(mark.fret),
    cy: layout.value.cellY(mark.string),
    position: mark,
  })),
)

function jumpTo(fret: number): void {
  scroller.value?.scrollTo({ left: scrollLeftForFret(layout.value, fret), behavior: 'smooth' })
}

/** 再點一次已聚焦的把位＝取消聚焦；順便把它捲進可視範圍（22 格在窄螢幕看不完） */
function focusPosition(position: FretboardPosition): void {
  const toggledOff = props.focusedPositionId === position.id
  emit('update:focusedPositionId', toggledOff && !props.requireFocus ? null : position.id)
  jumpTo(position.fromFret)
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-2">
    <div ref="scroller" class="min-w-0 overflow-x-auto rounded-lg border border-ink-700 bg-ink-900 py-2">
      <svg
        :viewBox="`0 0 ${layout.width} ${layout.height}`"
        :style="{ minWidth: `${layout.width}px` }"
        class="block w-full"
        role="img"
        :aria-label="t('fretboard.aria', { count: cells.length })"
      >
        <!-- 指位記號在最底層，弦與音點壓在其上。
             亮金色是設計系統裡唯一不屬於音高的顏色（design-system.md §5 的明列例外）：
             它是琴本身的鑲嵌，不是資料；灰階版在面板上只有 1.86:1，等於要瞇著眼睛數第 12 格 -->
        <circle v-for="(dot, i) in layout.inlays" :key="`inlay-${i}`"
                :cx="dot.cx" :cy="dot.cy" :r="layout.inlayR" fill="var(--color-inlay)" />

        <line v-for="fret in layout.fretLines" :key="`fret-${fret.fret}`"
              :x1="fret.x" :x2="fret.x"
              :y1="layout.cellY(1)" :y2="layout.cellY(stringCount)"
              :stroke="fret.nut ? 'var(--color-ink-500)' : 'var(--color-ink-700)'"
              :stroke-width="fret.width" />

        <line v-for="line in layout.strings" :key="`string-${line.string}`"
              :x1="layout.cellX(0) - layout.dotR" :x2="layout.fretLines[fretCount]?.x ?? 0"
              :y1="line.y" :y2="line.y"
              stroke="var(--color-ink-600)" :stroke-width="line.width" />

        <!-- 把位框畫在音點下層：框是結構，音點才是主角 -->
        <rect v-for="frame in frames" :key="`pos-${frame.key}`"
              :x="frame.rect.x" :y="frame.rect.y"
              :width="frame.rect.width" :height="frame.rect.height"
              rx="8" fill="transparent"
              :stroke="frame.active ? 'var(--color-ink-500)' : 'var(--color-ink-800)'"
              :stroke-width="focusedPositionId && frame.active ? 2 : 1.5"
              class="cursor-pointer"
              @click="focusPosition(frame.position)">
          <title>{{ frame.title }}</title>
        </rect>
        <text v-for="frame in frames" :key="`pos-label-${frame.key}`"
              :x="frame.rect.labelX" :y="frame.rect.labelY"
              font-family="var(--font-mono)" font-size="10" font-weight="700"
              letter-spacing="0.08em" class="pointer-events-none"
              :fill="frame.active ? 'var(--color-ink-100)' : 'var(--color-ink-400)'">{{ frame.label }}</text>

        <text v-for="num in layout.fretNumbers" :key="`num-${num.fret}`"
              :x="num.x" :y="num.y" text-anchor="middle"
              font-family="var(--font-mono)" font-size="10"
              :fill="num.marker ? 'var(--color-ink-100)' : 'var(--color-ink-400)'">{{ num.fret }}</text>

        <g v-for="dot in dots" :key="dot.key" :opacity="dot.opacity"
           @click="$emit('cellClick', dot.cell)">
          <circle :cx="dot.cx" :cy="dot.cy" :r="layout.dotR" :fill="dot.fill" />
          <text :x="dot.cx" :y="dot.cy" dy="0.35em" text-anchor="middle"
                font-family="var(--font-mono)" :font-size="layout.labelSize" font-weight="700"
                :fill="dot.textFill">{{ dot.label }}</text>
        </g>

        <!-- 題目標記：空心圈，不帶標記也不帶顏色（顏色只屬於已知的音） -->
        <circle v-for="mark in markDots" :key="mark.key"
                :cx="mark.cx" :cy="mark.cy" :r="layout.dotR + 2"
                fill="none" stroke="var(--color-ink-50)" stroke-width="2"
                class="pointer-events-none"
                :data-mark-string="mark.position.string" :data-mark-fret="mark.position.fret" />

        <!-- 命中層畫在最上層，否則音點與把位框會先吃掉點擊。
             座標寫成 data 屬性：這些圓形沒有標記也沒有顏色，不標出來連除錯都看不出誰是誰 -->
        <circle v-for="hit in hits" :key="hit.key"
                :cx="hit.cx" :cy="hit.cy" :r="layout.dotR * HIT_R"
                fill="transparent" class="cursor-pointer"
                :data-hit-string="hit.position.string" :data-hit-fret="hit.position.fret"
                @click="$emit('fretClick', hit.position)" />
      </svg>
    </div>

    <!-- 有把位框時，把位本身就是最好的跳轉目標，不再另外列固定格號 -->
    <div v-if="positions.length" class="flex flex-wrap items-center gap-2 self-end">
      <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">
        {{ t('fretboard.position') }}
      </span>
      <button v-if="!requireFocus" type="button"
              class="rounded border px-2 py-0.5 font-mono text-xs"
              :class="focusedPositionId === null
                ? 'border-ink-50 bg-ink-50 font-bold text-ink-950'
                : 'border-ink-700 text-ink-400 hover:bg-ink-800 hover:text-ink-100'"
              :aria-pressed="focusedPositionId === null"
              @click="$emit('update:focusedPositionId', null)">
        {{ t('fretboard.allPositions') }}
      </button>
      <button v-for="frame in entries" :key="`btn-${frame.key}`" type="button"
              class="rounded border px-2 py-0.5 font-mono text-xs"
              :class="focusedPositionId === frame.key
                ? 'border-ink-50 bg-ink-50 font-bold text-ink-950'
                : 'border-ink-700 text-ink-400 hover:bg-ink-800 hover:text-ink-100'"
              :aria-pressed="focusedPositionId === frame.key"
              :title="frame.title"
              @click="focusPosition(frame.position)">
        {{ frame.label }}
      </button>
    </div>

    <div v-else class="flex items-center gap-2 self-end">
      <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">
        {{ t('fretboard.jumpTo') }}
      </span>
      <button v-for="fret in POSITION_MARKS" :key="fret" type="button"
              class="rounded border border-ink-700 px-2 py-0.5 font-mono text-xs text-ink-400 hover:bg-ink-800 hover:text-ink-100"
              @click="jumpTo(fret)">
        {{ fret === 0 ? t('fretboard.openPosition') : fret }}
      </button>
    </div>
  </div>
</template>
