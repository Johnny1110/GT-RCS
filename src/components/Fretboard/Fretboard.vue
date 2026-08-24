<script setup lang="ts">
/**
 * Fretboard — 22 格指板（純顯示組件）。
 *
 * 架構契約（見 docs/architecture.md §組件層）：
 * - 純 props in / events out；不 import stores、不做樂理計算。
 * - cells 一律來自 core/theory mapToFretboard() 的輸出。
 * - 顏色一律來自 core/colors colorForInterval()（以 rootPc 為錨）。
 *
 * 把位框（positions）：全指板和弦音有 40 幾點，不分組就看不出哪幾個音湊成一個指型。
 * 框由 core/theory chordPositions() 算出（本組件不做樂理），畫在音點下層；
 * 框外的音點降低透明度——它們仍是和弦音，只是不屬於任何一個好按的指型。
 * 框是**灰階**的：色彩只屬於音高，結構一律灰階（design-system §1.1）。
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { isInPosition, type FretCell, type FretboardPosition, type PitchClass } from '@/core/theory'
import { colorForInterval } from '@/core/colors'
import { POSITION_MARKS, fretboardLayout, positionRect, scrollLeftForFret } from './geometry'

export interface FretboardProps {
  cells: readonly FretCell[]
  /** 顏色錨點（度數顏色相對此音計算） */
  rootPc: PitchClass
  fretCount?: number
  stringCount?: number
  labelMode?: 'degree' | 'noteName'
  /** 把位框；省略或空陣列 = 不畫框（音階線維持原本的全指板呈現） */
  positions?: readonly FretboardPosition[]
  /** 只看某一個把位：框外音點淡出。null = 全部把位都亮 */
  focusedPositionId?: string | null
}

const props = withDefaults(defineProps<FretboardProps>(), {
  fretCount: 22,
  stringCount: 6,
  labelMode: 'degree',
  positions: () => [],
  focusedPositionId: null,
})

const emit = defineEmits<{
  /** 點擊音點（互動練習用；純轉發，不含邏輯） */
  (e: 'cellClick', cell: FretCell): void
  /** 聚焦的把位改變（支援 v-model:focused-position-id） */
  (e: 'update:focusedPositionId', id: string | null): void
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

const frames = computed(() =>
  props.positions.map((position) => ({
    position,
    key: position.id,
    rect: positionRect(layout.value, position.fromFret, position.toFret, props.stringCount),
    active: focused.value === null || focused.value.id === position.id,
    label: position.fromFret === 0 ? t('fretboard.openPosition') : String(position.rootFret),
    title: t('fretboard.positionAria', {
      fret: position.rootFret,
      string: position.rootString,
      from: position.fromFret,
      to: position.toFret,
    }),
  })),
)

function dotOpacity(fret: number): number {
  if (props.positions.length === 0) return 1
  if (focused.value) return isInPosition(focused.value, fret) ? 1 : UNFOCUSED_OPACITY
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

function jumpTo(fret: number): void {
  scroller.value?.scrollTo({ left: scrollLeftForFret(layout.value, fret), behavior: 'smooth' })
}

/** 再點一次已聚焦的把位＝取消聚焦；順便把它捲進可視範圍（22 格在窄螢幕看不完） */
function focusPosition(position: FretboardPosition): void {
  const next = props.focusedPositionId === position.id ? null : position.id
  emit('update:focusedPositionId', next)
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
        <!-- 指位記號在最底層，弦與音點壓在其上 -->
        <circle v-for="(dot, i) in layout.inlays" :key="`inlay-${i}`"
                :cx="dot.cx" :cy="dot.cy" r="4" fill="var(--color-ink-800)" />

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
              :fill="frame.active ? 'var(--color-ink-400)' : 'var(--color-ink-700)'">{{ frame.label }}</text>

        <text v-for="num in layout.fretNumbers" :key="`num-${num.fret}`"
              :x="num.x" :y="num.y" text-anchor="middle"
              font-family="var(--font-mono)" font-size="10"
              :fill="num.marker ? 'var(--color-ink-400)' : 'var(--color-ink-600)'">{{ num.fret }}</text>

        <g v-for="dot in dots" :key="dot.key" :opacity="dot.opacity"
           @click="$emit('cellClick', dot.cell)">
          <circle :cx="dot.cx" :cy="dot.cy" :r="layout.dotR" :fill="dot.fill" />
          <text :x="dot.cx" :y="dot.cy" dy="0.35em" text-anchor="middle"
                font-family="var(--font-mono)" :font-size="layout.labelSize" font-weight="700"
                :fill="dot.textFill">{{ dot.label }}</text>
        </g>
      </svg>
    </div>

    <!-- 有把位框時，把位本身就是最好的跳轉目標，不再另外列固定格號 -->
    <div v-if="positions.length" class="flex flex-wrap items-center gap-2 self-end">
      <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
        {{ t('fretboard.position') }}
      </span>
      <button type="button"
              class="rounded border px-2 py-0.5 font-mono text-xs"
              :class="focusedPositionId === null
                ? 'border-ink-50 bg-ink-50 font-bold text-ink-950'
                : 'border-ink-700 text-ink-400 hover:bg-ink-800 hover:text-ink-100'"
              :aria-pressed="focusedPositionId === null"
              @click="$emit('update:focusedPositionId', null)">
        {{ t('fretboard.allPositions') }}
      </button>
      <button v-for="frame in frames" :key="`btn-${frame.key}`" type="button"
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
      <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
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
