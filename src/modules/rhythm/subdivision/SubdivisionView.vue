<script setup lang="ts">
/**
 * 切分專項（PRD F4-3）：由淺入深的課表，示範 click 帶著使用者卡格線。
 *
 * 課表的 pattern 刻意**不可編輯**——「e 位專練」一旦被改成別的東西，
 * 分級就失去意義。自訂請到律動風格模組（F4-4.4）。
 */
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import RhythmSheet from '@/components/RhythmSheet/RhythmSheet.vue'
import KnowledgeCard from '@/components/ui/KnowledgeCard.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import { useModuleSettings } from '@/composables/useModuleSettings'
import { usePresetNavigation } from '@/composables/usePresetNavigation'
import { usePracticeSession } from '@/composables/usePracticeSession'
import { usePracticeTransport } from '@/composables/usePracticeTransport'
import { useTransportTick } from '@/composables/useTransportTick'
import { isSilentBar } from '@/core/audio'
import { useTransportStore } from '@/stores/transport'
import { COUNT_STYLES } from '@/components/RhythmSheet/counting'
import { SUBDIVISION_STAGES, findStage } from '../presets'
import {
  DEMO_SILENCE_OPTIONS, demoSilenceFromKey, demoSilenceKey, resolveCountStyle,
  resolvePatternId, resolveStageId, useActiveCell, usePatternPlayback,
} from '../shared'
import { SUBDIVISION_DEFAULTS, type SubdivisionSettings } from './settings'

const MODULE_ID = 'rhythm.subdivision'

const { t } = useI18n()
const settings = useModuleSettings<SubdivisionSettings>(MODULE_ID, SUBDIVISION_DEFAULTS)
settings.stageId = resolveStageId(settings.stageId, SUBDIVISION_DEFAULTS.stageId)
settings.countStyle = resolveCountStyle(settings.countStyle, SUBDIVISION_DEFAULTS.countStyle)

const transport = useTransportStore()
const stage = computed(() => findStage(settings.stageId) ?? SUBDIVISION_STAGES[0]!)
/** ←→ 換 preset（F5-4）：清單順序與畫面上的選單一致 */
usePresetNavigation({
  items: () => stage.value.patterns.map((p) => p.id),
  current: () => settings.patternId,
  select: (id) => { settings.patternId = id },
})


// 換課表時，原本選的 pattern 不屬於新課表 → 落到該級的第一個
watch(stage, (value) => {
  settings.patternId = resolvePatternId(value.patterns, settings.patternId)
}, { immediate: true })

const pattern = computed(
  () => stage.value.patterns.find((p) => p.id === settings.patternId) ?? stage.value.patterns[0]!,
)

usePatternPlayback(pattern)
usePracticeTransport(settings)
usePracticeSession({
  moduleId: MODULE_ID,
  params: () => ({ stageId: settings.stageId, patternId: settings.patternId }),
})

const { position, playing } = useTransportTick()
const activeCell = useActiveCell(() => pattern.value.ticksPerBeat)

watch(() => settings.demoSilence, (key) => {
  transport.setDemoSilence(demoSilenceFromKey(key))
}, { immediate: true })

/** 靜默段落要讓使用者一眼看到自己現在有沒有依靠 */
const silent = computed(
  () => playing.value && isSilentBar(position.bar, demoSilenceFromKey(settings.demoSilence)),
)

const stageOptions = computed(() =>
  SUBDIVISION_STAGES.map((s) => ({ value: s.id, label: t(s.titleKey) })),
)
const patternOptions = computed(() =>
  stage.value.patterns.map((p) => ({ value: p.id, label: t(p.titleKey) })),
)
const countOptions = computed(() =>
  COUNT_STYLES.map((s) => ({ value: s, label: t(`rhythm.countStyle.${s}`) })),
)
const demoOptions = computed(() =>
  DEMO_SILENCE_OPTIONS.map((mode) => ({
    value: demoSilenceKey(mode),
    label: mode ? t('rhythm.demoOption', { demo: mode.demoBars, silent: mode.silentBars }) : t('rhythm.demoOff'),
  })),
)
const knowledgeId = computed(() => stage.value.knowledgeIds?.[0])
</script>

<template>
  <div class="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-6 p-6">
    <header class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h1 class="rcs-h1">{{ t('modules.rhythm.subdivision.title') }}</h1>
      <p class="text-sm text-ink-400">{{ t('modules.rhythm.subdivision.description') }}</p>
    </header>

    <div class="flex flex-wrap items-start gap-x-8 gap-y-4">
      <div class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('rhythm.stage') }}</span>
        <SegmentedControl v-model="settings.stageId" :options="stageOptions" :aria-label="t('rhythm.stage')" wrap />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('rhythm.pattern') }}</span>
        <SegmentedControl v-model="settings.patternId" :options="patternOptions" :aria-label="t('rhythm.pattern')" wrap />
      </div>
    </div>

    <p class="max-w-[65ch] text-sm text-ink-400">{{ t(stage.descriptionKey) }}</p>

    <section class="flex min-w-0 flex-col gap-4 rcs-panel p-5">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <p class="rcs-micro">
          {{ t(pattern.titleKey) }}
        </p>
        <p
          v-if="playing"
          class="rounded px-2 py-0.5 rcs-micro"
          :class="silent ? 'bg-ink-50 text-ink-950' : 'text-ink-400'"
        >
          {{ silent ? t('rhythm.statusSilent') : t('rhythm.statusDemo') }}
        </p>
      </div>

      <RhythmSheet
        :bars="pattern.bars"
        :time-sig="pattern.timeSig"
        :ticks-per-beat="pattern.ticksPerBeat"
        :count-style="settings.countStyle"
        :active-bar="position.bar"
        :active-cell="activeCell"
        :playing="playing"
      />
    </section>

    <div class="flex flex-wrap items-start gap-x-8 gap-y-4">
      <div class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('rhythm.demoSilence') }}</span>
        <SegmentedControl v-model="settings.demoSilence" :options="demoOptions" :aria-label="t('rhythm.demoSilence')" wrap />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('rhythm.counting') }}</span>
        <SegmentedControl v-model="settings.countStyle" :options="countOptions" :aria-label="t('rhythm.counting')" />
      </div>
    </div>

    <p class="max-w-[65ch] text-sm text-ink-400">{{ t('rhythm.subdivisionHint') }}</p>

    <KnowledgeCard v-if="knowledgeId" :entry-id="knowledgeId" />
  </div>
</template>
