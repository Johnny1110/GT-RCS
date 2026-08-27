<script setup lang="ts">
/**
 * 節拍器 — Click 引擎的獨立驗證頁（PRD F1-6）。
 * 拍點視覺完全由 Transport 的 tick 驅動（useTransportTick），不自走時鐘。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BeatLamps from '@/components/ui/BeatLamps.vue'
import { useModuleSettings } from '@/composables/useModuleSettings'
import { usePracticeTransport } from '@/composables/usePracticeTransport'
import { useTransportTick } from '@/composables/useTransportTick'
import { useTransportStore } from '@/stores/transport'
import { METRONOME_DEFAULTS, type MetronomeSettings } from './settings'

const { t } = useI18n()
const settings = useModuleSettings<MetronomeSettings>('rhythm.metronome', METRONOME_DEFAULTS)
usePracticeTransport(settings)

const transport = useTransportStore()
const { position, playing } = useTransportTick()
const beats = computed(() => transport.timeSig.beats)

/** 停止時顯示破折號：計數器的 0 會被讀成「壞掉了」，而不是「還沒開始」 */
const EMPTY = '—'
const barLabel = computed(() => (playing.value ? String(position.bar) : EMPTY))
const beatLabel = computed(() => (playing.value ? String(position.beat) : EMPTY))
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-10 p-6">
    <header class="flex flex-col items-center gap-1">
      <h1 class="rcs-h1">{{ t('modules.rhythm.metronome.title') }}</h1>
      <p class="text-sm text-ink-400">{{ t('modules.rhythm.metronome.description') }}</p>
    </header>

    <BeatLamps :beats="beats" :current="position.beat" :active="playing" :size="52" :gap="20" />

    <div class="flex items-end gap-10">
      <div class="flex flex-col items-center gap-1">
        <span class="rcs-micro">{{ t('metronome.bar') }}</span>
        <span class="rcs-data text-4xl text-ink-50">{{ barLabel }}</span>
      </div>
      <div class="flex flex-col items-center gap-1">
        <span class="rcs-micro">{{ t('metronome.beatOf') }}</span>
        <span class="rcs-data text-4xl text-ink-50">
          {{ beatLabel }}<span class="text-xl text-ink-400">/{{ beats }}</span>
        </span>
      </div>
    </div>

    <p class="max-w-md text-center text-sm text-ink-400">{{ t('metronome.hint') }}</p>
  </div>
</template>
