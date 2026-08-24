<script setup lang="ts">
/**
 * RhythmSheet — 節奏譜（PRD F4-2、design-system §5）。
 *
 * 架構契約：**presentational**。不 import store、不算樂理、不自走時鐘。
 * 游標位置由上層以 activeBar / activeCell 傳入（來源是 useTransportTick，
 * 也就是 TickBus 已到時的 tick），所以視覺永遠不會超前聲音。
 *
 * 視覺完全灰階——節奏沒有音高，12 色系統不該出現在這裡（design-system §1.1）。
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { cellsPerBar, type CellRole, type TicksPerBeat, type TimeSignature } from '@/core/audio'
import { countToken, type CountStyle } from './counting'

const props = withDefaults(
  defineProps<{
    bars: readonly (readonly CellRole[])[]
    timeSig: TimeSignature
    ticksPerBeat: TicksPerBeat
    countStyle?: CountStyle
    /** 1-based 小節數（自 play 起算）；由本組件對 bars.length 取模找出循環中的位置 */
    activeBar?: number
    /** 0-based 小節內格號 */
    activeCell?: number
    playing?: boolean
    editable?: boolean
  }>(),
  { countStyle: 'numeric', activeBar: 0, activeCell: -1, playing: false, editable: false },
)

const emit = defineEmits<{ (e: 'cycle', barIndex: number, cellIndex: number): void }>()

const { t } = useI18n()
const scroller = ref<HTMLElement | null>(null)

const total = computed(() => cellsPerBar(props.timeSig, props.ticksPerBeat))

/** 每列一小節；每小節再依拍分組，拍與拍之間留大 gap（視覺分組＝拍） */
interface Cell {
  index: number
  beat: number
  tick: number
  role: CellRole
  label: string
  beatHead: boolean
}

const rows = computed(() =>
  props.bars.map((cells, barIndex) => ({
    barIndex,
    beats: Array.from({ length: props.timeSig.beats }, (_, beatIndex) => ({
      beat: beatIndex + 1,
      cells: Array.from({ length: props.ticksPerBeat }, (_, tickIndex): Cell => {
        const index = beatIndex * props.ticksPerBeat + tickIndex
        const token = countToken(tickIndex + 1, props.ticksPerBeat)
        return {
          index,
          beat: beatIndex + 1,
          tick: tickIndex + 1,
          role: cells[index] ?? 'rest',
          label: token === 'beat' && props.countStyle === 'numeric'
            ? String(beatIndex + 1)
            : t(`rhythm.count.${props.countStyle}.${token}`),
          beatHead: tickIndex === 0,
        }
      }),
    })),
  })),
)

/** 播放中才有游標；activeBar 是絕對小節數，對 pattern 長度取模才是譜上的位置 */
const cursorBar = computed(() => {
  if (!props.playing || props.activeBar < 1 || props.bars.length === 0) return -1
  return (props.activeBar - 1) % props.bars.length
})

function isCursor(barIndex: number, cellIndex: number): boolean {
  return barIndex === cursorBar.value && cellIndex === props.activeCell
}

/** 16 分在窄螢幕會超出可視範圍：游標跟捲，但只捲這個容器，不動整頁 */
watch([cursorBar, () => props.activeCell], () => {
  const box = scroller.value
  if (!box || cursorBar.value < 0) return
  const cell = box.querySelector<HTMLElement>('[data-cursor="true"]')
  if (!cell) return
  const left = cell.offsetLeft
  const right = left + cell.offsetWidth
  if (left < box.scrollLeft) box.scrollLeft = left - 16
  else if (right > box.scrollLeft + box.clientWidth) box.scrollLeft = right - box.clientWidth + 16
})

/**
 * design-system §5：完全灰階。休止用比面板更暗的 ink-950 —— 譜面板本身是 ink-900，
 * 休止格若也用 ink-900 會整個消失，讀起來像「這裡沒有格子」而不是「這一格不出聲」。
 */
const ROLE_CLASS: Readonly<Record<CellRole, string>> = {
  accent: 'bg-ink-50',
  normal: 'bg-ink-500',
  ghost: 'border-[1.5px] border-dashed border-ink-500',
  rest: 'bg-ink-950',
}

function onCell(barIndex: number, cellIndex: number): void {
  if (props.editable) emit('cycle', barIndex, cellIndex)
}
</script>

<template>
  <div
    ref="scroller"
    class="min-w-0 overflow-x-auto"
    role="group"
    :aria-label="t('rhythm.sheetAria', { bars: bars.length, cells: total })"
  >
    <!--
      格寬用 CSS 變數而非 flex 伸縮：巢狀 flex 的 min-content 推導在「格子有下限、
      容器又要貼齊內容」這組條件下不可靠（實測會出現拍組比自己的格子還窄 → 格子重疊）。
      斷點決定格寬、scroller 負責溢出，行為才可預測。
      38px 為 design-system 規格值，窄螢幕降到計數文字仍可讀的下限。
    -->
    <div class="flex w-full flex-col gap-5 py-1 [--cell:26px] sm:[--cell:30px] lg:[--cell:38px]">
      <div v-for="row in rows" :key="row.barIndex" class="flex items-start gap-3">
        <span
          class="w-5 shrink-0 pt-3 text-right font-mono text-[11px] tabular-nums"
          :class="row.barIndex === cursorBar ? 'text-ink-100' : 'text-ink-600'"
        >{{ row.barIndex + 1 }}</span>

          <!-- 拍與拍之間 16px、拍內 6px：視覺分組就是「拍」 -->
        <div class="flex gap-4">
          <div v-for="group in row.beats" :key="group.beat" class="flex gap-1.5">
            <button
              v-for="cell in group.cells"
              :key="cell.index"
              type="button"
              class="flex w-[var(--cell)] shrink-0 flex-col items-center gap-1.5 rounded disabled:cursor-default"
              :data-cursor="isCursor(row.barIndex, cell.index)"
              :disabled="!editable"
              :aria-label="t('rhythm.cellAria', {
                bar: row.barIndex + 1,
                cell: cell.index + 1,
                role: t(`rhythm.role.${cell.role}`),
              })"
              @click="onCell(row.barIndex, cell.index)"
            >
              <span
                class="grid aspect-square w-full place-items-center rounded transition-colors motion-reduce:transition-none"
                :class="[
                  ROLE_CLASS[cell.role],
                  isCursor(row.barIndex, cell.index) ? 'outline outline-2 outline-offset-2 outline-ink-50' : '',
                  editable ? 'hover:brightness-125' : '',
                ]"
              >
                <span v-if="cell.role === 'rest'" class="h-1 w-1 rounded-full bg-ink-700" />
              </span>
              <!-- w-full + overflow-hidden：格寬壓到下限時，計數文字不得溢出去撞到隔壁格 -->
              <span
                class="w-full overflow-hidden text-center font-mono text-[11px] leading-none"
                :class="cell.beatHead ? 'font-bold text-ink-100' : 'text-ink-500'"
              >{{ cell.label }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
