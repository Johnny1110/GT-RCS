<script setup lang="ts">
/**
 * Fretboard — 22 格指板（純顯示組件）。
 *
 * 架構契約（見 docs/architecture.md §組件層）：
 * - 純 props in / events out；不 import stores、不做樂理計算。
 * - cells 一律來自 core/theory mapToFretboard() 的輸出。
 * - 顏色一律來自 core/colors colorForInterval()（以 rootPc 為錨）。
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FretCell, PitchClass } from '@/core/theory'
import { colorForInterval } from '@/core/colors'
import { POSITION_MARKS, fretboardLayout, scrollLeftForFret } from './geometry'

export interface FretboardProps {
  cells: readonly FretCell[]
  /** 顏色錨點（度數顏色相對此音計算） */
  rootPc: PitchClass
  fretCount?: number
  stringCount?: number
  labelMode?: 'degree' | 'noteName'
}

const props = withDefaults(defineProps<FretboardProps>(), {
  fretCount: 22,
  stringCount: 6,
  labelMode: 'degree',
})

defineEmits<{
  /** 點擊音點（互動練習用；純轉發，不含邏輯） */
  (e: 'cellClick', cell: FretCell): void
}>()

const { t } = useI18n()
const scroller = ref<HTMLElement | null>(null)
const layout = computed(() => fretboardLayout(props.fretCount, props.stringCount))

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
    }
  }),
)

function jumpTo(fret: number): void {
  scroller.value?.scrollTo({ left: scrollLeftForFret(layout.value, fret), behavior: 'smooth' })
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

        <text v-for="num in layout.fretNumbers" :key="`num-${num.fret}`"
              :x="num.x" :y="num.y" text-anchor="middle"
              font-family="var(--font-mono)" font-size="10"
              :fill="num.marker ? 'var(--color-ink-400)' : 'var(--color-ink-600)'">{{ num.fret }}</text>

        <g v-for="dot in dots" :key="dot.key" @click="$emit('cellClick', dot.cell)">
          <circle :cx="dot.cx" :cy="dot.cy" :r="layout.dotR" :fill="dot.fill" />
          <text :x="dot.cx" :y="dot.cy" dy="0.35em" text-anchor="middle"
                font-family="var(--font-mono)" :font-size="layout.labelSize" font-weight="700"
                :fill="dot.textFill">{{ dot.label }}</text>
        </g>
      </svg>
    </div>

    <div class="flex items-center gap-2 self-end">
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
