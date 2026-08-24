/**
 * core/audio — 型別契約
 * 架構規則：本層不 import Vue；與 Web Audio 的耦合只發生在
 * WebAudioClock 與 SynthClickVoice 兩個 adapter，其餘皆純邏輯（可測）。
 */

export interface TimeSignature {
  beats: number
  /** 拍值分母：4 = 四分音符為一拍，8 = 八分音符為一拍（6/8 用） */
  unit: 4 | 8
}

/** 每拍細分數：1=正拍、2=八分、4=十六分、3=三連音 */
export type TicksPerBeat = 1 | 2 | 3 | 4

/** click 角色（同時是節奏 pattern 的格子值）：與音色、視覺一一對應 */
export type CellRole = 'accent' | 'normal' | 'ghost' | 'rest'
export type SoundingRole = Exclude<CellRole, 'rest'>

/**
 * 排程產生的單一 tick。
 * audioTime 為 AudioContext 時間軸上的絕對秒數；
 * UI 與發聲端都以它為準 —— 這是「聲音視覺同步」的唯一橋樑。
 */
export interface TickEvent {
  audioTime: number
  /** 1-based 小節數（從 play 起算，跨調循環的調數換算由練習模組負責） */
  bar: number
  /** 1-based 拍數 */
  beat: number
  /** 1-based 拍內細分索引 */
  tick: number
  role: CellRole
}

/**
 * 節奏 pattern（Phase 4 / F4-1 的核心資料模型）。
 * bars 每小節一個陣列，長度必須等於 beats * ticksPerBeat。
 */
export interface RhythmPattern {
  id: string
  titleKey: string
  timeSig: TimeSignature
  ticksPerBeat: TicksPerBeat
  /** shuffle/swing 量 0–100（50=直拍、66≈全 shuffle）；省略 = 直拍 */
  swing?: number
  bars: readonly (readonly CellRole[])[]
  defaultBpm: number
}

export const BPM_MIN = 30
export const BPM_MAX = 300

/** 會發聲的角色（rest 除外），供音量/靜音等迴圈使用 */
export const SOUNDING_ROLES = ['accent', 'normal', 'ghost'] as const

export const TICKS_PER_BEAT_VALUES = [1, 2, 3, 4] as const

export function isTicksPerBeat(value: unknown): value is TicksPerBeat {
  return TICKS_PER_BEAT_VALUES.some((t) => t === value)
}

/**
 * 可選拍號表（音樂領域資料，非 UI 專屬）。
 * BPM 的「一拍」＝分母單位：6/8 的 BPM 指八分音符，符合 Transport 的排程語意。
 */
export const TIME_SIGNATURES = {
  '2/4': { beats: 2, unit: 4 },
  '3/4': { beats: 3, unit: 4 },
  '4/4': { beats: 4, unit: 4 },
  '6/8': { beats: 6, unit: 8 },
  '12/8': { beats: 12, unit: 8 },
} as const satisfies Record<string, TimeSignature>

export type TimeSignatureKey = keyof typeof TIME_SIGNATURES

export const DEFAULT_TIME_SIGNATURE_KEY: TimeSignatureKey = '4/4'

/** 由字串取拍號；未知值（含損毀的持久化資料）回退 4/4 */
export function resolveTimeSignature(key: string): TimeSignature {
  for (const [k, sig] of Object.entries(TIME_SIGNATURES)) {
    if (k === key) return { ...sig }
  }
  return { ...TIME_SIGNATURES[DEFAULT_TIME_SIGNATURE_KEY] }
}

/** 由拍號反查 key（transport → 設定持久化用）；無對應回退 4/4 */
export function timeSignatureKey(sig: TimeSignature): TimeSignatureKey {
  for (const [k, candidate] of Object.entries(TIME_SIGNATURES)) {
    if (candidate.beats === sig.beats && candidate.unit === sig.unit) return k as TimeSignatureKey
  }
  return DEFAULT_TIME_SIGNATURE_KEY
}
