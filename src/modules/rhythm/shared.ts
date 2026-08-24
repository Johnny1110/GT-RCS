/**
 * 節奏線共用的接線與選項（模組內共用，非跨類別——與 scales/shared.ts 同樣的分工）。
 */
import { computed, onUnmounted, watch, type ComputedRef, type Ref } from 'vue'
import type { DemoSilenceMode, RhythmPattern } from '@/core/audio'
import { QUALITY_SUFFIX, type ChordQuality, type NoteName } from '@/core/theory'
import { isCountStyle, type CountStyle } from '@/components/RhythmSheet/counting'
import { useTransportStore } from '@/stores/transport'
import { findStage, findStyle } from './presets'

/** 節奏模組的設定共通欄位（除了 PracticeTransportSettings 的三項） */
export interface RhythmSheetSettings {
  patternId: string
  countStyle: CountStyle
}

/**
 * 把 pattern 掛上 Transport，離開練習時卸下。
 *
 * 為什麼要卸下：pattern 會接管拍號與細分，若帶著它離開，
 * 下一個練習的 TransportBar 會變成唯讀而且響錯拍號。
 */
export function usePatternPlayback(pattern: Ref<RhythmPattern | null> | ComputedRef<RhythmPattern | null>): void {
  const transport = useTransportStore()
  watch(pattern, (value, previous) => {
    transport.setPattern(value)
    // BPM 的「一拍」＝拍號分母，所以 4/4 的 90 與 6/8 的 90 是兩種速度。
    // 換到不同拍值的 pattern 時沿用舊 BPM 沒有意義，改採 preset 的建議值；
    // 同拍值之間則尊重使用者調過的 BPM。
    if (value && previous && value.timeSig.unit !== previous.timeSig.unit) {
      transport.setBpm(value.defaultBpm)
    }
  }, { immediate: true })
  onUnmounted(() => transport.setPattern(null))
}

/**
 * 當前格號（0-based）。position 來自 TickBus 已到時的 tick，
 * 因此節奏譜游標與聲音同步；未播放時回 -1（沒有游標）。
 */
export function useActiveCell(ticksPerBeat: () => number): ComputedRef<number> {
  const transport = useTransportStore()
  return computed(() => {
    if (!transport.playing || transport.position.beat < 1) return -1
    return (transport.position.beat - 1) * ticksPerBeat() + (transport.position.tick - 1)
  })
}

/** 示範／靜默的可選組合（PRD F4-3.3：N 可設 2/4） */
export const DEMO_SILENCE_OPTIONS: readonly (DemoSilenceMode | null)[] = [
  null,
  { demoBars: 2, silentBars: 2 },
  { demoBars: 4, silentBars: 4 },
]

export function demoSilenceKey(mode: DemoSilenceMode | null): string {
  return mode ? `${mode.demoBars}-${mode.silentBars}` : 'off'
}

export function demoSilenceFromKey(key: string): DemoSilenceMode | null {
  return DEMO_SILENCE_OPTIONS.find((m) => demoSilenceKey(m) === key) ?? null
}

/** 建議和弦符號：只存根音與性質，符號一律由公式表組出（architecture §8 反模式 1） */
export function chordHintSymbol(hint: { root: NoteName; quality: ChordQuality }): string {
  return `${hint.root}${QUALITY_SUFFIX[hint.quality]}`
}

/** 持久化與 query 都是不可信輸入，取用前先驗證 */
export function resolveStageId(value: unknown, fallback: string): string {
  return typeof value === 'string' && findStage(value) ? value : fallback
}

export function resolveStyleId(value: unknown, fallback: string): string {
  return typeof value === 'string' && findStyle(value) ? value : fallback
}

export function resolveCountStyle(value: unknown, fallback: CountStyle): CountStyle {
  return isCountStyle(value) ? value : fallback
}

export function resolvePatternId(patterns: readonly RhythmPattern[], value: unknown): string {
  const first = patterns[0]?.id ?? ''
  return typeof value === 'string' && patterns.some((p) => p.id === value) ? value : first
}
