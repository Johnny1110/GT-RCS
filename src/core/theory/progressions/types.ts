/**
 * 和弦進行引擎 — 型別契約（實作見 parser.ts，Phase 3 / F3-2）
 */
import type { ChordQuality } from '../formulas'
import type { DegreeLabel, Note, NoteName } from '../types'

/** 解析後的一個進行 token（尚未帶入調） */
export interface ProgressionToken {
  /** 原始輸入片段，如 'ii'、'V7'、'bVII'、'V/ii' */
  raw: string
  /** 級數（含借用修飾），如 '2'、'5'、'b7' */
  degree: DegreeLabel
  /** 顯式或推導出的和弦品質 */
  quality: ChordQuality
  /** 副屬和弦目標級數（'V/ii' 的 'ii'），無則省略 */
  secondaryOf?: DegreeLabel
}

/** 帶入調之後的實際和弦 */
export interface RealizedChord {
  token: ProgressionToken
  root: Note
  /** 顯示名，如 'Dm7'、'G7'、'Fm' */
  symbol: string
  /** 和弦內音（已拼寫），供指板全覆蓋顯示 */
  tones: Note[]
}

/** 展開為小節序列（跟練 timeline 的資料來源） */
export interface RealizedBar {
  bar: number
  chords: RealizedChord[]
}

export interface ProgressionPreset {
  id: string
  titleKey: string
  /** 級數記法字串，見 parser.ts 文法 */
  tokens: string
  /** 每個和弦佔的小節數，長度需等於 token 數（0.5 = 半小節） */
  barsPerChord: readonly number[]
  defaultBpm: number
  knowledgeIds?: readonly string[]
}

export interface RealizeOptions {
  key: NoteName
  /** 'triad' 推導三和弦品質、'seventh' 推導七和弦品質（顯式品質不受影響） */
  harmonyLevel: 'triad' | 'seventh'
}
