<script setup lang="ts">
/**
 * 分段控制（design-system.md §5）：選中片段以黑白反轉表示，不使用 accent 色。
 * 值一律為 string——數值型設定（如 ticksPerBeat）由呼叫端轉換。
 */
export interface SegmentedOption {
  value: string
  label: string
}

withDefaults(
  defineProps<{
    modelValue: string
    options: readonly SegmentedOption[]
    ariaLabel?: string
    disabled?: boolean
    wrap?: boolean
  }>(),
  { disabled: false, wrap: false },
)

defineEmits<{ (e: 'update:modelValue', value: string): void }>()
</script>

<template>
  <div
    class="inline-flex gap-0.5 rounded border border-ink-700 bg-ink-900 p-0.5"
    :class="wrap ? 'flex-wrap' : ''"
    role="group"
    :aria-label="ariaLabel"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="rounded-[3px] px-3 py-1 font-mono text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
      :class="option.value === modelValue
        ? 'bg-ink-50 font-bold text-ink-950'
        : 'text-ink-400 hover:bg-ink-800 hover:text-ink-100'"
      :aria-pressed="option.value === modelValue"
      :disabled="disabled"
      @click="$emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
