<script setup lang="ts">
/**
 * 堆疊長條圖（純顯示組件）。
 *
 * 架構契約：
 * - 幾何一律來自 charts/geometry.ts 的 stackedBarLayout()，組件不算座標。
 * - **顏色由呼叫端給**，而且一律是灰階：這是節奏／和弦／音階的分組，不是音高，
 *   色彩只屬於音樂（design-system §1.1）。三條線靠亮度分，不靠色相。
 * - x 軸標籤由呼叫端決定要不要標（row.label 為空字串就不標）——28 根長條全標會糊掉。
 */
import { computed } from 'vue'
import { stackedBarLayout } from './geometry'

export interface ChartSeries {
  key: string
  label: string
  /** CSS 顏色（灰階 token） */
  color: string
}

export interface BarRow {
  key: string
  /** x 軸標籤；空字串 = 這一根不標 */
  label: string
  values: Readonly<Record<string, number>>
}

const props = withDefaults(
  defineProps<{
    rows: readonly BarRow[]
    series: readonly ChartSeries[]
    /** 值的單位（顯示在 aria 與 y 軸），如「分鐘」 */
    unit: string
    ariaLabel: string
    height?: number
  }>(),
  { height: 132 },
)

/** 內部座標系寬度；SVG 以 viewBox 等比縮放到容器寬度 */
const VIEW_WIDTH = 560

const layout = computed(() =>
  stackedBarLayout(props.rows, {
    width: VIEW_WIDTH,
    height: props.height,
    groups: props.series.map((s) => s.key),
  }),
)

const colorOf = computed<Record<string, string>>(() =>
  Object.fromEntries(props.series.map((s) => [s.key, s.color])),
)
</script>

<template>
  <figure class="flex w-full flex-col gap-2">
    <svg
      :viewBox="`0 0 ${VIEW_WIDTH} ${height}`"
      class="block w-full"
      role="img"
      :aria-label="ariaLabel"
      preserveAspectRatio="none"
    >
      <line
        v-for="tick in layout.ticks"
        :key="`grid-${tick.value}`"
        x1="0" :x2="VIEW_WIDTH" :y1="tick.y" :y2="tick.y"
        stroke="var(--color-ink-800)" stroke-width="1"
        vector-effect="non-scaling-stroke"
      />

      <g v-for="bar in layout.bars" :key="bar.key">
        <rect
          v-for="segment in bar.segments"
          :key="`${bar.key}-${segment.group}`"
          :x="bar.x" :y="segment.y" :width="bar.width" :height="segment.height"
          :fill="colorOf[segment.group]"
        />
        <title>{{ bar.key }} · {{ Math.round(bar.total) }} {{ unit }}</title>
      </g>
    </svg>

    <!-- 標籤放在 SVG 外：preserveAspectRatio=none 會把 SVG 內的字一起拉扁 -->
    <div class="flex w-full">
      <span
        v-for="bar in layout.bars"
        :key="`label-${bar.key}`"
        class="min-w-0 flex-1 text-center font-mono text-[10px] tabular-nums text-ink-400"
      >{{ rows.find((r) => r.key === bar.key)?.label }}</span>
    </div>

    <figcaption class="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span v-for="s in series" :key="s.key" class="flex items-center gap-1.5 font-mono text-[11px] text-ink-400">
        <span class="h-2.5 w-2.5 rounded-[2px]" :style="{ backgroundColor: s.color }" />
        {{ s.label }}
      </span>
      <span class="ml-auto font-mono text-[10px] tabular-nums text-ink-400">
        {{ Math.round(layout.max) }} {{ unit }}
      </span>
    </figcaption>
  </figure>
</template>
