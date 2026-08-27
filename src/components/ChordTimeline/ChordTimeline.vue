<script setup lang="ts">
/**
 * 和弦時間軸（純顯示 + 選取事件）：當前和弦反白，下一個以虛線框預告。
 * 預告固定提前一小節——換把需要時間，臨到才顯示等於沒顯示。
 *
 * 條目由呼叫端組出**整段進行**（見 modules/chords/timeline.ts），
 * 格子位置固定、游標在上面移動，與節奏譜是同一種讀法。
 * `selectable` 時每一格都可點：emit 的 barOffset 是「距離當前小節幾小節」，
 * 呼叫端拿它去移動小節游標＝強制切換到那個和弦。
 */
export type TimelineState = 'past' | 'current' | 'next' | 'future'

export interface TimelineEntry {
  key: string
  /** 顯示的和弦名，如 Dm7 */
  symbol: string
  /** 上方小字，如級數或小節數 */
  caption: string
  state: TimelineState
  /** 相對當前小節的位移（可為負，代表要繞一圈才會再輪到） */
  barOffset: number
}

defineProps<{
  entries: readonly TimelineEntry[]
  /** 每一格是否可點選（強制切換到該和弦） */
  selectable?: boolean
  /** 整份清單的無障礙名稱（可點時說明點下去會發生什麼） */
  label?: string
}>()

const emit = defineEmits<{ (e: 'select', barOffset: number): void }>()
</script>

<template>
  <ol class="grid grid-cols-2 gap-2 sm:grid-cols-4" :aria-label="label">
    <li v-for="entry in entries" :key="entry.key">
      <component
        :is="selectable ? 'button' : 'div'"
        :type="selectable ? 'button' : undefined"
        class="flex w-full flex-col gap-0.5 rounded-md border px-3 py-2 text-left"
        :class="[
          {
            'border-ink-50 bg-ink-50': entry.state === 'current',
            'border-dashed border-ink-500': entry.state === 'next',
            'border-ink-700': entry.state === 'future',
            'border-ink-800 opacity-50': entry.state === 'past',
          },
          selectable && entry.state !== 'current' ? 'hover:border-ink-500 hover:opacity-100' : '',
        ]"
        :aria-current="entry.state === 'current' ? 'true' : undefined"
        @click="selectable && emit('select', entry.barOffset)"
      >
        <span
          class="rcs-micro"
          :class="entry.state === 'current' ? 'text-ink-600' : 'text-ink-400'"
        >{{ entry.caption }}</span>
        <span
          class="rcs-data text-lg"
          :class="entry.state === 'current' ? 'text-ink-950' : 'text-ink-300'"
        >{{ entry.symbol }}</span>
      </component>
    </li>
  </ol>
</template>
