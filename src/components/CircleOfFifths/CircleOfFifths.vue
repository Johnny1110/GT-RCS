<script setup lang="ts">
/**
 * CircleOfFifths — 五度圈通用組件（PRD F3-1）。
 *
 * 架構契約：純 props in / events out。不 import stores、不做樂理計算
 * （調內和弦位置由 geometry.diatonicPlacement 提供）。
 *
 * 兩種用法：
 * - 互動：不傳 currentChordPc，點選扇形發出 selectKey
 * - 跟練：傳入 tonic 與 currentChordPc，組件只負責渲染 highlight
 */
import { computed } from 'vue'
import { colorForInterval } from '@/core/colors'
import { parseNoteName, spellDegree, type NoteName, type PitchClass } from '@/core/theory'
import { circleLayout, diatonicPlacement, sectorIndexForPitch } from './geometry'

const props = withDefaults(
  defineProps<{
    /** 目前的調（大調主音）；未指定則不 highlight 任何調 */
    tonic?: NoteName | undefined
    /** 跟練模式：目前正在響的和弦根音 pitch class；undefined = 無當前和弦 */
    currentChordPc?: number | undefined
    /** 是否可點選切換調 */
    interactive?: boolean
  }>(),
  { interactive: false },
)

const emit = defineEmits<{ (e: 'selectKey', key: NoteName): void }>()

const layout = circleLayout()

const placement = computed(() => (props.tonic ? diatonicPlacement(props.tonic) : null))
const tonicPc = computed<PitchClass | null>(() => (props.tonic ? parseNoteName(props.tonic).pc : null))

/** vii°：調內唯一不在圈上的和弦，以徽章顯示 */
const diminished = computed(() => (props.tonic ? spellDegree(props.tonic, '7').name : null))

const currentIndex = computed(() =>
  props.currentChordPc === undefined ? -1 : sectorIndexForPitch(props.currentChordPc),
)

interface SectorView {
  index: number
  major: NoteName
  minor: NoteName
  majorPath: string
  minorPath: string
  majorLabel: { x: number; y: number }
  minorLabel: { x: number; y: number }
  isTonic: boolean
  outerDegree: string | undefined
  innerDegree: string | undefined
  outerColor: string | undefined
  innerColor: string | undefined
}

const sectors = computed<SectorView[]>(() =>
  layout.sectors.map((sector) => {
    const outerDegree = placement.value?.outer[sector.index]
    const innerDegree = placement.value?.inner[sector.index]
    const root = tonicPc.value
    const colorFor = (name: NoteName): string | undefined =>
      root === null ? undefined : colorForInterval(root, parseNoteName(name).pc).hex
    return {
      index: sector.index,
      major: sector.major,
      minor: sector.minor,
      majorPath: sector.majorPath,
      minorPath: sector.minorPath,
      majorLabel: sector.majorLabel,
      minorLabel: sector.minorLabel,
      isTonic: placement.value?.tonicIndex === sector.index,
      outerDegree,
      innerDegree,
      outerColor: outerDegree ? colorFor(sector.major) : undefined,
      innerColor: innerDegree ? colorFor(sector.minor) : undefined,
    }
  }),
)

function onSelect(key: NoteName): void {
  if (props.interactive) emit('selectKey', key)
}
</script>

<template>
  <svg
    :viewBox="`0 0 ${layout.size} ${layout.size}`"
    class="block w-full max-w-[320px]"
    role="img"
    :aria-label="tonic ? `Circle of fifths, key of ${tonic}` : 'Circle of fifths'"
  >
    <g v-for="sector in sectors" :key="sector.index">
      <!-- 外圈：大調 -->
      <path
        :d="sector.majorPath"
        :fill="sector.isTonic ? 'var(--color-ink-50)' : sector.outerDegree ? 'var(--color-ink-800)' : 'var(--color-ink-900)'"
        stroke="var(--color-ink-700)"
        stroke-width="1"
        :class="interactive ? 'cursor-pointer' : ''"
        @click="onSelect(sector.major)"
      />
      <text
        :x="sector.majorLabel.x" :y="sector.majorLabel.y" dy="-0.1em"
        text-anchor="middle" font-family="var(--font-mono)" font-size="14" font-weight="700"
        :fill="sector.isTonic ? 'var(--color-ink-950)' : sector.outerDegree ? 'var(--color-ink-100)' : 'var(--color-ink-600)'"
        class="pointer-events-none"
      >{{ sector.major }}</text>
      <circle
        v-if="sector.outerColor"
        :cx="sector.majorLabel.x" :cy="sector.majorLabel.y + 13" r="4.5"
        :fill="sector.outerColor" class="pointer-events-none"
      />

      <!-- 內圈：關係小調 -->
      <path
        :d="sector.minorPath"
        :fill="sector.innerDegree ? 'var(--color-ink-800)' : 'var(--color-ink-900)'"
        stroke="var(--color-ink-700)"
        stroke-width="1"
        :class="interactive ? 'cursor-pointer' : ''"
        @click="onSelect(sector.minor)"
      />
      <text
        :x="sector.minorLabel.x" :y="sector.minorLabel.y" dy="-0.05em"
        text-anchor="middle" font-family="var(--font-mono)" font-size="11" font-weight="700"
        :fill="sector.innerDegree ? 'var(--color-ink-100)' : 'var(--color-ink-600)'"
        class="pointer-events-none"
      >{{ sector.minor }}m</text>
      <circle
        v-if="sector.innerColor"
        :cx="sector.minorLabel.x" :cy="sector.minorLabel.y + 11" r="4"
        :fill="sector.innerColor" class="pointer-events-none"
      />
    </g>

    <!-- 跟練模式：當前和弦以白圈標記 -->
    <template v-for="sector in sectors" :key="`now-${sector.index}`">
      <circle
        v-if="currentIndex === sector.index"
        :cx="sector.majorLabel.x" :cy="sector.majorLabel.y - 2" r="22"
        fill="none" stroke="var(--color-ink-50)" stroke-width="2" class="pointer-events-none"
      />
    </template>

    <!-- 圓心：當前調與 vii° -->
    <text
      v-if="tonic" :x="layout.center" :y="layout.center - 4" text-anchor="middle"
      font-family="var(--font-mono)" font-size="16" font-weight="700" fill="var(--color-ink-50)"
    >{{ tonic }}</text>
    <text
      v-if="diminished" :x="layout.center" :y="layout.center + 14" text-anchor="middle"
      font-family="var(--font-mono)" font-size="9" fill="var(--color-ink-500)"
    >vii dim = {{ diminished }}</text>
  </svg>
</template>
