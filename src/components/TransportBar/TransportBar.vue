<script setup lang="ts">
/**
 * TransportBar — 播放控制列（練習頁常駐底部）。
 *
 * 架構契約：本組件是 **container**——允許使用 useTransportStore，
 * 但不得直接碰 core/audio 的類別（一律經 store）。
 *
 * 拍號與細分播放中也可切換 —— core Transport 會排到下一個小節線生效，
 * 不會留下長度不明的殘拍（Phase 4 起）。掛著節奏 pattern 時兩者改由 pattern
 * 決定，此處轉為唯讀顯示，避免出現「譜上畫 16 分、click 卻響 8 分」。
 * TODO(opus) Phase 5 / F5-4：全域鍵盤快捷鍵（space 播放、↑↓ 調 BPM）掛載於此。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  BPM_MAX, BPM_MIN, SOUNDING_ROLES, TICKS_PER_BEAT_VALUES, TIME_SIGNATURES,
  resolveTimeSignature, subdivisionLabel, timeSignatureKey, type SoundingRole,
} from '@/core/audio'
import BeatLamps from '@/components/ui/BeatLamps.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import { useTransportStore } from '@/stores/transport'

const { t } = useI18n()
const transport = useTransportStore()

const timeSigOptions = Object.keys(TIME_SIGNATURES).map((key) => ({ value: key, label: key }))
const currentTimeSig = computed(() => timeSignatureKey(transport.timeSig))

/**
 * 細分以音符名稱標記，且隨拍號分母改變：4/4 的「一拍兩格」是八分，
 * 6/8 的「一拍兩格」是十六分 —— 標籤由 core 的 subdivisionLabel 算出，不寫死。
 */
const subdivisions = computed(() =>
  TICKS_PER_BEAT_VALUES.map((t) => ({
    value: String(t),
    label: subdivisionLabel(transport.timeSig.unit, t),
  })),
)
const currentSubdivision = computed(() => String(transport.ticksPerBeat))
const currentSubdivisionLabel = computed(
  () => subdivisionLabel(transport.timeSig.unit, transport.ticksPerBeat),
)

function onBpmInput(event: Event): void {
  transport.setBpm(Number((event.target as HTMLInputElement).value))
}

function onVolumeInput(role: SoundingRole, event: Event): void {
  transport.setVoiceVolume(role, Number((event.target as HTMLInputElement).value) / 100)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-7 gap-y-4 border-t-2 border-ink-700 bg-ink-900 px-5 py-3">
    <button
      type="button"
      class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink-50 text-ink-950 hover:bg-white"
      :aria-label="transport.playing ? t('transport.stop') : t('transport.play')"
      @click="transport.toggle()"
    >
      <span class="text-sm leading-none">{{ transport.playing ? '■' : '▶' }}</span>
    </button>

    <div class="flex flex-col gap-1">
      <span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">{{ t('transport.bpm') }}</span>
      <div class="flex items-center gap-3">
        <span class="font-mono text-2xl font-bold leading-none tabular-nums text-ink-50">{{ transport.bpm }}</span>
        <input
          class="rcs-range w-28"
          type="range"
          :min="BPM_MIN"
          :max="BPM_MAX"
          :value="transport.bpm"
          :aria-label="t('transport.bpm')"
          @input="onBpmInput"
        >
      </div>
    </div>

    <div v-if="transport.patternDriven" class="flex flex-col gap-1">
      <span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">{{ t('transport.meter') }}</span>
      <p class="font-mono text-sm leading-[26px] tabular-nums text-ink-300">
        {{ currentTimeSig }}<span class="mx-1.5 text-ink-600">·</span>{{ currentSubdivisionLabel }}
        <span class="ml-2 text-[10px] uppercase tracking-[0.16em] text-ink-500">{{ t('transport.fromPattern') }}</span>
      </p>
    </div>

    <template v-else>
      <div class="flex flex-col gap-1">
        <span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">{{ t('transport.timeSignature') }}</span>
        <SegmentedControl
          :model-value="currentTimeSig"
          :options="timeSigOptions"
          :aria-label="t('transport.timeSignature')"
          @update:model-value="transport.setTimeSignature(resolveTimeSignature($event))"
        />
      </div>

      <div class="flex flex-col gap-1">
        <span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">{{ t('transport.subdivision') }}</span>
        <SegmentedControl
          :model-value="currentSubdivision"
          :options="subdivisions"
          :aria-label="t('transport.subdivision')"
          @update:model-value="transport.setTicksPerBeat(Number($event))"
        />
      </div>
    </template>

    <div class="flex flex-col gap-1">
      <span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">{{ t('transport.beat') }}</span>
      <BeatLamps
        :beats="transport.timeSig.beats"
        :current="transport.position.beat"
        :active="transport.playing"
        :gap="transport.timeSig.beats > 6 ? 5 : 8"
      />
    </div>

    <div class="ml-auto flex items-end gap-4">
      <div v-for="role in SOUNDING_ROLES" :key="role" class="flex flex-col gap-1">
        <button
          type="button"
          class="text-left font-mono text-[10px] uppercase tracking-[0.16em] hover:text-ink-100"
          :class="transport.voiceMuted[role] ? 'text-ink-600 line-through' : 'text-ink-500'"
          :aria-pressed="transport.voiceMuted[role]"
          @click="transport.toggleVoiceMute(role)"
        >
          {{ t(`transport.voice.${role}`) }}
        </button>
        <input
          class="rcs-range w-16"
          type="range"
          min="0"
          max="100"
          :value="Math.round(transport.voiceVolumes[role] * 100)"
          :disabled="transport.voiceMuted[role]"
          :aria-label="t('transport.volumeOf', { voice: t(`transport.voice.${role}`) })"
          @input="onVolumeInput(role, $event)"
        >
      </div>
    </div>
  </div>
</template>
