<script setup lang="ts">
/**
 * 和弦時間軸（純顯示）：當前和弦反白，下一個以虛線框預告。
 * 預告固定提前一小節——換把需要時間，臨到才顯示等於沒顯示。
 */
export type TimelineState = 'past' | 'current' | 'next' | 'future'

export interface TimelineEntry {
  key: string
  /** 顯示的和弦名，如 Dm7 */
  symbol: string
  /** 上方小字，如級數或小節數 */
  caption: string
  state: TimelineState
}

defineProps<{ entries: readonly TimelineEntry[] }>()
</script>

<template>
  <ol class="grid grid-cols-2 gap-2 sm:grid-cols-4">
    <li
      v-for="entry in entries"
      :key="entry.key"
      class="flex flex-col gap-0.5 rounded-md border px-3 py-2"
      :class="{
        'border-ink-50 bg-ink-50': entry.state === 'current',
        'border-dashed border-ink-500': entry.state === 'next',
        'border-ink-700': entry.state === 'future',
        'border-ink-800 opacity-50': entry.state === 'past',
      }"
    >
      <span
        class="font-mono text-[10px] uppercase tracking-[0.16em]"
        :class="entry.state === 'current' ? 'text-ink-600' : 'text-ink-500'"
      >{{ entry.caption }}</span>
      <span
        class="font-mono text-lg font-bold tabular-nums"
        :class="entry.state === 'current' ? 'text-ink-950' : 'text-ink-300'"
      >{{ entry.symbol }}</span>
    </li>
  </ol>
</template>
