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
 * 全域鍵盤快捷鍵掛在這裡（F5-4）：本組件只在練習頁存在，作用範圍剛好就是
 * 「有 click 的頁面」。實作在 composables/useKeyboardShortcuts.ts。
 *
 * **版面分三區，依「多久碰一次」排序**（器材面板的分區邏輯）：
 *   ① 主控 —— 播放 + 速度：練習中一直在碰
 *   ② 拍點 —— 拍號 / 細分 / 拍燈：一首曲子設定一次，然後一直在看
 *   ③ 混音 —— 三個音色的音量與靜音、快捷鍵說明：設定一次就不再碰
 * 三區之間用 1px 雕刻線分開（`.rcs-divider`）。窄螢幕會換行，
 * 這時垂直線會橫跨在錯的地方，所以只在 lg 以上顯示。
 *
 * 敲擊測速的實例持有在這一層：鍵盤的 `T` 與畫面上的 TAP 鈕必須是同一次測量，
 * 各自 useTapTempo() 會得到兩串互不相干的間隔（詳見 useTapTempo.ts）。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  SOUNDING_ROLES, TICKS_PER_BEAT_VALUES, TIME_SIGNATURES,
  resolveTimeSignature, subdivisionLabel, timeSignatureKey, type SoundingRole,
} from '@/core/audio'
import BeatLamps from '@/components/ui/BeatLamps.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import TransportIcon from '@/components/ui/TransportIcon.vue'
import TempoControl from './TempoControl.vue'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useTapTempo } from '@/composables/useTapTempo'
import { useShortcutsStore } from '@/stores/shortcuts'
import { useTransportStore } from '@/stores/transport'

const { t } = useI18n()
const transport = useTransportStore()
const shortcuts = useShortcutsStore()

const tapTempo = useTapTempo()
useKeyboardShortcuts({ onTap: tapTempo.tap })

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

function onVolumeInput(role: SoundingRole, event: Event): void {
  transport.setVoiceVolume(role, Number((event.target as HTMLInputElement).value) / 100)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-6 gap-y-4 border-t-2 border-ink-700 bg-ink-900 px-5 py-3">
    <!-- ① 主控 -->
    <button
      type="button"
      class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink-50 text-ink-950 transition-transform duration-100 hover:bg-white active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
      :aria-label="transport.playing ? t('transport.stop') : t('transport.play')"
      @click="transport.toggle()"
    >
      <TransportIcon :playing="transport.playing" />
    </button>

    <TempoControl
      :bpm="transport.bpm"
      :taps="tapTempo.taps.value"
      @update:bpm="transport.setBpm($event)"
      @tap="tapTempo.tap()"
    />

    <span class="rcs-divider hidden lg:block" aria-hidden="true" />

    <!-- ② 拍點 -->
    <div v-if="transport.patternDriven" class="flex flex-col gap-1.5">
      <span class="rcs-micro">{{ t('transport.meter') }}</span>
      <p class="font-mono text-sm leading-[26px] tabular-nums text-ink-300">
        {{ currentTimeSig }}<span class="mx-1.5 text-ink-600" aria-hidden="true">·</span>{{ currentSubdivisionLabel }}
        <span class="ml-2 rcs-micro">{{ t('transport.fromPattern') }}</span>
      </p>
    </div>

    <template v-else>
      <div class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('transport.timeSignature') }}</span>
        <SegmentedControl
          :model-value="currentTimeSig"
          :options="timeSigOptions"
          :aria-label="t('transport.timeSignature')"
          @update:model-value="transport.setTimeSignature(resolveTimeSignature($event))"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('transport.subdivision') }}</span>
        <SegmentedControl
          :model-value="currentSubdivision"
          :options="subdivisions"
          :aria-label="t('transport.subdivision')"
          @update:model-value="transport.setTicksPerBeat(Number($event))"
        />
      </div>
    </template>

    <div class="flex flex-col gap-1.5">
      <span class="rcs-micro">{{ t('transport.beat') }}</span>
      <BeatLamps
        :beats="transport.timeSig.beats"
        :current="transport.position.beat"
        :active="transport.playing"
        :gap="transport.timeSig.beats > 6 ? 5 : 8"
      />
    </div>

    <!-- ③ 混音：ml-auto 只出現一次，整區靠右 -->
    <div class="ml-auto flex items-center gap-4">
      <span class="rcs-divider hidden lg:block" aria-hidden="true" />

      <div v-for="role in SOUNDING_ROLES" :key="role" class="flex flex-col gap-1.5">
        <button
          type="button"
          class="rcs-micro text-left hover:text-ink-100"
          :class="transport.voiceMuted[role] ? 'text-ink-600 line-through' : 'text-ink-400'"
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

      <button
        type="button"
        class="rcs-step shrink-0"
        :aria-label="t('shortcuts.title')"
        @click="shortcuts.toggleHelp()"
      >
        ?
      </button>
    </div>
  </div>
</template>
