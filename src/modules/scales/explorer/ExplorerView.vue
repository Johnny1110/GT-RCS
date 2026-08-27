<script setup lang="ts">
/**
 * 音階總覽（PRD F2-1）：任選調與音階，22 格指板全覆蓋 + 特徵音標註 + 知識卡。
 * 「開始跟練」把當前選擇以 query 傳給 scales.practice——模組間不互讀設定。
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  SCALE_FORMULAS, SCALE_SIGNATURE_DEGREE, mapToFretboard, scalePositions, spell, type DegreeLabel,
} from '@/core/theory'
import { colorForInterval } from '@/core/colors'
import Fretboard from '@/components/Fretboard/Fretboard.vue'
import KnowledgeCard from '@/components/ui/KnowledgeCard.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import { useModuleSettings } from '@/composables/useModuleSettings'
import { usePresetNavigation } from '@/composables/usePresetNavigation'
import { usePracticeTransport } from '@/composables/usePracticeTransport'
import { scaleKnowledgeId } from '@/content/knowledge'
import { KEYS, SCALE_TYPES, isKey, isScaleType } from '../shared'
import { EXPLORER_DEFAULTS, type ExplorerSettings } from './settings'

const { t } = useI18n()
const settings = useModuleSettings<ExplorerSettings>('scales.explorer', EXPLORER_DEFAULTS)

// localStorage 可被竄改或因公式表演進而過期 → 回退預設值
if (!isKey(settings.root)) settings.root = EXPLORER_DEFAULTS.root
if (!isScaleType(settings.scale)) settings.scale = EXPLORER_DEFAULTS.scale
if (settings.labelMode !== 'degree' && settings.labelMode !== 'noteName') {
  settings.labelMode = EXPLORER_DEFAULTS.labelMode
}

usePracticeTransport(settings)
/** ←→ 換 preset（F5-4）：清單順序與畫面上的選單一致 */
usePresetNavigation({
  items: () => SCALE_TYPES,
  current: () => settings.scale,
  select: (id) => { settings.scale = id as typeof settings.scale },
})


const notes = computed(() => spell(settings.root, SCALE_FORMULAS[settings.scale]))
const cells = computed(() => mapToFretboard(notes.value))
const rootPc = computed(() => notes.value[0]?.pc ?? 0)
const formula = computed(() => notes.value.map((n) => n.degree).join(' '))
const signatureDegree = computed<DegreeLabel | undefined>(() => SCALE_SIGNATURE_DEGREE[settings.scale])

/**
 * 指型輔助框：全指板 90 幾個音點看不出把位。框由 core 推導（畫面不算樂理）。
 * 音階把位彼此重疊，因此用 focus 模式一次只看一個；換調或換音階時取消聚焦
 * ——把位 id 綁在錨定格上，留著上一個音階的選擇只會指到不存在的框。
 */
const positions = computed(() => scalePositions(settings.root, settings.scale))
const focusedPositionId = ref<string | null>(null)
watch(() => [settings.root, settings.scale], () => { focusedPositionId.value = null })

const keyOptions = computed(() => KEYS.map((key) => ({ value: key, label: key })))
const scaleOptions = computed(() =>
  SCALE_TYPES.map((scale) => ({ value: scale, label: t(`scale.${scale}`) })),
)
const labelOptions = computed(() => [
  { value: 'degree', label: t('explorer.labelDegree') },
  { value: 'noteName', label: t('explorer.labelNoteName') },
])

const noteDots = computed(() =>
  notes.value.map((note) => {
    const color = colorForInterval(rootPc.value, note.pc)
    return {
      note,
      hex: color.hex,
      textHex: color.textHex,
      signature: note.degree === signatureDegree.value,
    }
  }),
)
</script>

<template>
  <div class="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 p-6">
    <header class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h1 class="rcs-h1">{{ t('modules.scales.explorer.title') }}</h1>
      <p class="text-sm text-ink-400">{{ t('modules.scales.explorer.description') }}</p>
      <RouterLink
        class="ml-auto rcs-btn-primary px-4 py-1.5 text-sm"
        :to="{ path: '/scales/practice', query: { root: settings.root, scale: settings.scale } }"
      >
        {{ t('explorer.startPractice') }}
      </RouterLink>
    </header>

    <div class="flex flex-wrap items-start gap-x-8 gap-y-4">
      <div class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('explorer.key') }}</span>
        <SegmentedControl v-model="settings.root" :options="keyOptions" :aria-label="t('explorer.key')" wrap />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('explorer.scale') }}</span>
        <SegmentedControl v-model="settings.scale" :options="scaleOptions" :aria-label="t('explorer.scale')" wrap />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="rcs-micro">{{ t('explorer.labelMode') }}</span>
        <SegmentedControl v-model="settings.labelMode" :options="labelOptions" :aria-label="t('explorer.labelMode')" />
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <Fretboard
        v-model:focused-position-id="focusedPositionId"
        :cells="cells"
        :root-pc="rootPc"
        :label-mode="settings.labelMode"
        :positions="positions"
        position-mode="focus"
      />
      <p class="text-xs text-ink-400">{{ t('fretboard.scalePositionHint') }}</p>
    </div>

    <section class="flex flex-col gap-3">
      <div class="flex flex-wrap items-start gap-3">
        <div v-for="dot in noteDots" :key="dot.note.degree" class="flex w-11 flex-col items-center gap-1">
          <span
            class="grid h-10 w-10 place-items-center rounded-full font-mono text-sm font-bold"
            :class="dot.signature ? 'ring-2 ring-ink-50 ring-offset-2 ring-offset-ink-950' : ''"
            :style="{ backgroundColor: dot.hex, color: dot.textHex }"
          >{{ dot.note.name }}</span>
          <span class="font-mono text-[11px]" :class="dot.signature ? 'text-ink-100' : 'text-ink-400'">
            {{ dot.note.degree }}
          </span>
        </div>
      </div>

      <p class="font-mono text-xs text-ink-400">
        {{ settings.root }} {{ t(`scale.${settings.scale}`) }} · {{ formula }}
      </p>
      <p v-if="signatureDegree" class="text-xs text-ink-400">
        {{ t('explorer.signatureNote', { degree: signatureDegree }) }}
      </p>
    </section>

    <KnowledgeCard :entry-id="scaleKnowledgeId(settings.scale)" />
  </div>
</template>
