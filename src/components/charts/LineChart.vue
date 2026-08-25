<script setup lang="ts">
/**
 * 折線圖（純顯示組件）——BPM 進步軌跡用。
 *
 * 幾何來自 charts/geometry.ts 的 lineLayout()。y 軸刻意不從 0 起算：
 * 這張圖要回答的是「我從 80 推到 100 了嗎」，壓在 0–300 的軸上那條線幾乎是平的。
 * 最低與最高值直接標在線上，讀者才知道自己在看多大的範圍。
 */
import { computed } from 'vue'
import { lineLayout } from './geometry'

export interface LineValue {
  key: string
  label: string
  value: number
}

const props = withDefaults(
  defineProps<{
    values: readonly LineValue[]
    unit: string
    ariaLabel: string
    height?: number
  }>(),
  { height: 72 },
)

const VIEW_WIDTH = 320

const layout = computed(() =>
  lineLayout(props.values, { width: VIEW_WIDTH, height: props.height }),
)

const last = computed(() => layout.value.points.at(-1))
const first = computed(() => layout.value.points[0])
/** 進步幅度：終點減起點。負數也照實顯示——退步也是資訊 */
const delta = computed(() => (last.value && first.value ? last.value.value - first.value.value : 0))
</script>

<template>
  <figure class="flex w-full flex-col gap-1">
    <svg
      :viewBox="`0 0 ${VIEW_WIDTH} ${height}`"
      class="block w-full"
      role="img"
      :aria-label="ariaLabel"
    >
      <path
        v-if="layout.path"
        :d="layout.path"
        fill="none"
        stroke="var(--color-ink-300)"
        stroke-width="1.5"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
      <circle
        v-for="point in layout.points"
        :key="point.key"
        :cx="point.x" :cy="point.y" r="2.5"
        :fill="point === last ? 'var(--color-ink-50)' : 'var(--color-ink-500)'"
      >
        <title>{{ point.key }} · {{ point.value }} {{ unit }}</title>
      </circle>
    </svg>

    <figcaption class="flex items-baseline gap-2 font-mono text-[11px] tabular-nums text-ink-500">
      <span>{{ first?.value }}</span>
      <span class="text-ink-700">→</span>
      <span class="text-sm font-bold text-ink-50">{{ last?.value }}</span>
      <span>{{ unit }}</span>
      <span v-if="delta !== 0" class="ml-auto" :class="delta > 0 ? 'text-ink-300' : 'text-ink-600'">
        {{ delta > 0 ? '+' : '' }}{{ delta }}
      </span>
    </figcaption>
  </figure>
</template>
