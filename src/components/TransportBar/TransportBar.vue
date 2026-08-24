<script setup lang="ts">
/**
 * TransportBar — 播放控制列（練習頁常駐底部）。
 *
 * 架構契約：本組件是 **container**——允許使用 useTransportStore，
 * 但不得直接碰 core/audio 的類別（一律經 store）。
 *
 * 拍號與細分僅停止中可切換（core Transport 契約），播放中呈現 disabled。
 * TODO(opus) Phase 5 / F5-4：全域鍵盤快捷鍵（space 播放、↑↓ 調 BPM）掛載於此。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { BPM_MAX, BPM_MIN, SOUNDING_ROLES, TIME_SIGNATURES, resolveTimeSignature, timeSignatureKey, type SoundingRole } from '@/core/audio'
import BeatLamps from '@/components/ui/BeatLamps.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import { useTransportStore } from '@/stores/transport'

const { t } = useI18n()
const transport = useTransportStore()

const timeSigOptions = Object.keys(TIME_SIGNATURES).map((key) => ({ value: key, label: key }))
const currentTimeSig = computed(() => timeSignatureKey(transport.timeSig))

/** 細分以吉他手的用語標記：4=四分、8=八分、8T=八分三連、16=十六分 */
const SUBDIVISIONS = [
  { value: '1', label: '4' },
  { value: '2', label: '8' },
  { value: '3', label: '8T' },
  { value: '4', label: '16' },
] as const
const currentSubdivision = computed(() => String(transport.ticksPerBeat))

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

    <div class="flex flex-col gap-1">
      <span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">{{ t('transport.timeSignature') }}</span>
      <SegmentedControl
        :model-value="currentTimeSig"
        :options="timeSigOptions"
        :aria-label="t('transport.timeSignature')"
        :disabled="transport.playing"
        @update:model-value="transport.setTimeSignature(resolveTimeSignature($event))"
      />
    </div>

    <div class="flex flex-col gap-1">
      <span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">{{ t('transport.subdivision') }}</span>
      <SegmentedControl
        :model-value="currentSubdivision"
        :options="SUBDIVISIONS"
        :aria-label="t('transport.subdivision')"
        :disabled="transport.playing"
        @update:model-value="transport.setTicksPerBeat(Number($event))"
      />
    </div>

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
