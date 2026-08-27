import type { PracticeTransportSettings } from '@/composables/usePracticeTransport'
import type { DemoSilenceMode } from '@/core/audio'
import type { NoteName } from '@/core/theory'
import { isFeelId, type FeelId } from './feels'

/** 和弦怎麼響：完整 comping／只有低音根音／關閉 */
export type CompMode = 'chords' | 'bass' | 'off'
export const COMP_MODES: readonly CompMode[] = ['chords', 'bass', 'off']

export function isCompMode(value: unknown): value is CompMode {
  return COMP_MODES.includes(value as CompMode)
}

export interface JazzBookSettings extends PracticeTransportSettings {
  /** 內建曲庫的 id，或 `user:<id>` 指向使用者自己的曲譜 */
  chartId: string
  /** 移調後的調；曲譜本身只存級數，這裡決定它落在哪個調 */
  key: NoteName
  /** 可覆寫曲子建議的 feel */
  feelId: FeelId
  /** -1 = 整首循環；否則是 form 陣列的索引（只循環那一段） */
  loopSectionIndex: number
  comp: CompMode
  /** 每 N 遍換一個調（沿五度下行）；0 = 不換調 */
  keyRotation: number
  /** 示範／靜默循環，見 SILENCE_OPTIONS */
  silence: string
}

export const USER_CHART_PREFIX = 'user:'

export function userChartRef(id: string): string {
  return `${USER_CHART_PREFIX}${id}`
}

export function userChartId(chartId: string): string | null {
  return chartId.startsWith(USER_CHART_PREFIX) ? chartId.slice(USER_CHART_PREFIX.length) : null
}

/**
 * 示範／靜默循環。標準曲的單位是**段落**不是小節，所以是 4 與 8——
 * 一段 A 通常八小節，「示範一段、自己撐一段」正是這個練習的核心用法。
 */
export const SILENCE_OPTIONS: readonly (DemoSilenceMode | null)[] = [
  null,
  { demoBars: 4, silentBars: 4 },
  { demoBars: 8, silentBars: 8 },
]

export function silenceKey(mode: DemoSilenceMode | null): string {
  return mode ? `${mode.demoBars}-${mode.silentBars}` : 'off'
}

export function silenceFromKey(key: unknown): DemoSilenceMode | null {
  return SILENCE_OPTIONS.find((m) => silenceKey(m) === key) ?? null
}

/** 每調遍數：1 是一路換調（最難也最有用），4 給還在記曲式的人多幾遍 */
export const KEY_ROTATION_OPTIONS = [0, 1, 2, 4] as const

export function isKeyRotation(value: unknown): value is number {
  return KEY_ROTATION_OPTIONS.includes(value as never)
}

export function resolveFeelId(value: unknown, fallback: FeelId): FeelId {
  return isFeelId(value) ? value : fallback
}

/**
 * 預設值：爵士藍調、F 調、Medium Swing、整首循環、完整 comping。
 * 第一次打開就是一首聽得懂的曲子——比任何說明都有效。
 */
export const JAZZ_BOOK_DEFAULTS: JazzBookSettings = {
  chartId: 'jazz-blues',
  key: 'F',
  feelId: 'mediumSwing',
  loopSectionIndex: -1,
  comp: 'chords',
  keyRotation: 0,
  silence: 'off',
  bpm: 140,
  timeSig: '4/4',
  ticksPerBeat: 2,
}
