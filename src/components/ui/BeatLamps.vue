<script setup lang="ts">
/**
 * 拍燈：當前拍亮白，其餘 ink-700。資料來自 Transport 的 tick（不自走時鐘）。
 */
withDefaults(
  defineProps<{
    beats: number
    current: number
    active: boolean
    size?: number
    gap?: number
  }>(),
  { size: 10, gap: 8 },
)
</script>

<template>
  <div class="flex items-center" :style="{ gap: `${gap}px` }" role="presentation">
    <span
      v-for="n in beats"
      :key="n"
      class="rounded-full transition-colors duration-100 motion-reduce:transition-none"
      :class="active && current === n ? 'bg-ink-50' : 'bg-ink-700'"
      :style="{ width: `${size}px`, height: `${size}px` }"
    />
  </div>
</template>
