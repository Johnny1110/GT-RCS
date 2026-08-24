/**
 * core/theory — 型別契約（全站樂理的單一真相來源）
 *
 * 架構規則（見 docs/architecture.md）：
 * - core/** 不得 import Vue / Pinia / DOM API，必須是純 TS。
 * - 任何「音」的顯示（指板、五度圈、和弦名）一律由本層計算，UI 不得 hardcode 音名。
 */

/** 半音音高類別，C=0（不含八度資訊） */
export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11

export type Letter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
export type Accidental = '' | '#' | 'b' | '##' | 'bb'

/** 有拼寫的音名，如 'C' | 'F#' | 'Bb' | 'E#' | 'Cb' */
export type NoteName = `${Letter}${Accidental}`

/**
 * 度數標記（相對主音）。
 * - ChromaticDegree：八度內 12 個半音的正規標記（色彩系統以此為錨）
 * - 延伸標記（9/11/13、b9…）供和弦公式使用；拼寫時字母由數字決定
 *   （例：b5 與 #4 同音高但拼不同字母），顏色則依實際半音距離對應。
 */
export type ChromaticDegree =
  | '1' | 'b2' | '2' | 'b3' | '3' | '4' | '#4' | '5' | 'b6' | '6' | 'b7' | '7'
export type DegreeLabel =
  | ChromaticDegree
  | 'b5' | '#5' | 'bb7'
  | '9' | 'b9' | '#9' | '11' | '#11' | '13' | 'b13'

export interface ParsedDegree {
  label: DegreeLabel
  /** 度數的數字部分（b9 → 9） */
  number: number
  /** 升降修飾量（b=-1、#=+1，可疊加） */
  accidentalOffset: number
  /** 相對主音的半音數（可能 >= 12，延伸音程） */
  semitones: number
}

/** 一個已拼寫、已定位（相對主音）的音 */
export interface Note {
  pc: PitchClass
  /** 正確拼寫音名（F# 大調的七音是 E# 不是 F） */
  name: NoteName
  degree: DegreeLabel
}

/** 調弦：string 1（高音 e）→ string N（低音）。預設 6 弦標準調弦。 */
export type Tuning = readonly NoteName[]

/** 指板上的一格（string 1-based 由高音弦起算；fret 0 = 空弦） */
export interface FretCell {
  string: number
  fret: number
  note: Note
}
