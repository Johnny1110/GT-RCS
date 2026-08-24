<script setup lang="ts">
/**
 * 音階跟練（PRD F2-2）：指板全覆蓋 + 節拍視覺 + 練習日誌。
 * 從音階總覽帶入的 ?root=&scale= 會覆寫本模組設定（承接 Explorer 的選擇）。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { SCALE_FORMULAS, SCALE_SIGNATURE_DEGREE, mapToFretboard, scalePositions, spell } from '@/core/theory'
import Fretboard from '@/components/Fretboard/Fretboard.vue'
import BeatLamps from '@/components/ui/BeatLamps.vue'
import KnowledgeCard from '@/components/ui/KnowledgeCard.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import { useModuleSettings } from '@/composables/useModuleSettings'
import { usePracticeSession } from '@/composables/usePracticeSession'
import { usePracticeTransport } from '@/composables/usePracticeTransport'
import { useTransportTick } from '@/composables/useTransportTick'
import { usePracticeLogStore } from '@/stores/practiceLog'
import { useTransportStore } from '@/stores/transport'
import { KEYS, SCALE_TYPES, isKey, isScaleType } from '../shared'
import { SCALE_PRACTICE_DEFAULTS, type ScalePracticeSettings } from './settings'

const MODULE_ID = 'scales.practice'

const { t } = useI18n()
const route = useRoute()
const settings = useModuleSettings<ScalePracticeSettings>(MODULE_ID, SCALE_PRACTICE_DEFAULTS)

if (!isKey(settings.root)) settings.root = SCALE_PRACTICE_DEFAULTS.root
if (!isScaleType(settings.scale)) settings.scale = SCALE_PRACTICE_DEFAULTS.scale

// 承接音階總覽的選擇（?root=A&scale=dorian）
onMounted(() => {
  if (isKey(route.query.root)) settings.root = route.query.root
  if (isScaleType(route.query.scale)) settings.scale = route.query.scale
})

usePracticeTransport(settings)
usePracticeSession({
  moduleId: MODULE_ID,
  params: () => ({ root: settings.root, scale: settings.scale }),
})

const transport = useTransportStore()
const log = usePracticeLogStore()
const { position, playing } = useTransportTick()

const notes = computed(() => spell(settings.root, SCALE_FORMULAS[settings.scale]))
const cells = computed(() => mapToFretboard(notes.value))
const rootPc = computed(() => notes.value[0]?.pc ?? 0)
const signatureDegree = computed(() => SCALE_SIGNATURE_DEGREE[settings.scale])

/** 指型輔助框（同音階總覽）：一次聚焦一個把位，換調或換音階時取消聚焦 */
const positions = computed(() => scalePositions(settings.root, settings.scale))
const focusedPositionId = ref<string | null>(null)
watch(() => [settings.root, settings.scale], () => { focusedPositionId.value = null })

const keyOptions = computed(() => KEYS.map((key) => ({ value: key, label: key })))
const scaleOptions = computed(() =>
  SCALE_TYPES.map((scale) => ({ value: scale, label: t(`scale.${scale}`) })),
)

/** 本模組的累計練習時間（分鐘），來自練習日誌 */
const totalMinutes = computed(() =>
  Math.round(
    log.entries
      .filter((entry) => entry.moduleId === MODULE_ID)
      .reduce((sum, entry) => sum + entry.durationSec, 0) / 60,
  ),
)
</script>

<template>
  <div class="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 p-6">
    <header class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h1 class="text-2xl font-semibold text-ink-50">{{ t('modules.scales.practice.title') }}</h1>
      <p class="text-sm text-ink-400">{{ t('modules.scales.practice.description') }}</p>
      <p v-if="totalMinutes > 0" class="ml-auto font-mono text-xs text-ink-500">
        {{ t('practice.totalMinutes', { minutes: totalMinutes }) }}
      </p>
    </header>

    <div class="flex flex-wrap items-start gap-x-8 gap-y-4">
      <div class="flex flex-col gap-1.5">
        <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">{{ t('explorer.key') }}</span>
        <SegmentedControl v-model="settings.root" :options="keyOptions" :aria-label="t('explorer.key')" wrap />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">{{ t('explorer.scale') }}</span>
        <SegmentedControl v-model="settings.scale" :options="scaleOptions" :aria-label="t('explorer.scale')" wrap />
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-lg border border-ink-700 bg-ink-900 px-5 py-3">
      <div class="flex flex-col gap-1">
        <span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">{{ t('metronome.bar') }}</span>
        <span class="font-mono text-2xl font-bold tabular-nums text-ink-50">
          {{ playing ? position.bar : '—' }}
        </span>
      </div>
      <div class="flex flex-col gap-1">
        <span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">{{ t('transport.beat') }}</span>
        <BeatLamps
          :beats="transport.timeSig.beats"
          :current="position.beat"
          :active="playing"
          :size="16"
          :gap="10"
        />
      </div>
      <p class="ml-auto max-w-sm text-xs leading-6 text-ink-500">{{ t('practice.hint') }}</p>
    </div>

    <div class="flex flex-col gap-2">
      <Fretboard
        v-model:focused-position-id="focusedPositionId"
        :cells="cells"
        :root-pc="rootPc"
        :positions="positions"
        position-mode="focus"
        label-mode="degree"
      />
      <p class="text-xs text-ink-500">{{ t('fretboard.scalePositionHint') }}</p>
    </div>

    <p v-if="signatureDegree" class="font-mono text-xs text-ink-500">
      {{ t('explorer.signatureNote', { degree: signatureDegree }) }}
    </p>

    <KnowledgeCard entry-id="scale.practice-tips" />
  </div>
</template>
