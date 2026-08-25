<script setup lang="ts">
/**
 * 和弦示範音控制（PRD F5-1）：模式 + 音量。
 * 純顯示組件——狀態在 transport store，這裡只轉發。三條和弦練習線共用。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CHORD_DEMO_MODES, type ChordDemoMode } from '@/core/audio'
import { useTransportStore } from '@/stores/transport'
import SegmentedControl from './SegmentedControl.vue'

const { t } = useI18n()
const transport = useTransportStore()

const options = computed(() =>
  CHORD_DEMO_MODES.map((mode) => ({ value: mode, label: t(`chordDemo.${mode}`) })),
)

function onVolumeInput(event: Event): void {
  const target = event.target as HTMLInputElement
  transport.setChordVolume(Number(target.value) / 100)
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
      {{ t('chordDemo.label') }}
    </span>
    <div class="flex items-center gap-3">
      <SegmentedControl
        :model-value="transport.chordDemo"
        :options="options"
        :aria-label="t('chordDemo.label')"
        @update:model-value="transport.setChordDemo($event as ChordDemoMode)"
      />
      <input
        v-if="transport.chordDemo !== 'off'"
        class="rcs-range w-20"
        type="range"
        min="0"
        max="100"
        :value="Math.round(transport.chordVolume * 100)"
        :aria-label="t('chordDemo.volume')"
        @input="onVolumeInput"
      >
    </div>
  </div>
</template>
