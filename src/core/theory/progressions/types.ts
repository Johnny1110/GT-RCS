/**
 * 和弦進行引擎 — 型別契約（實作見 parser.ts，Phase 3 / F3-2）
 */
import type { ChordQuality } from '../formulas'
import type { DegreeLabel, Note, NoteName } from '../types'

/** 和聲層級：三和弦或七和弦（決定無顯式品質時的推導結果） */
export type HarmonyLevel = 'triad' | 'seventh'

/**
 * 和弦內音的度數要相對誰標記：
 * - 'chordRoot'：相對該和弦根音（Fm → 1 b3 5），指板顏色以和弦為錨
 * - 'key'：相對進行的主調（C 調的 Fm → 4 b6 1），看得出借用關係
 */
export type DegreeReference = 'chordRoot' | 'key'

/** 解析後的一個進行 token（尚未帶入調） */
export interface ProgressionToken {
  /** 原始輸入片段，如 'ii'、'V7'、'bVII'、'V/ii' */
  raw: string
  /** 級數（含借用修飾），如 '2'、'5'、'b7'；副屬則為其自身根音級數 */
  degree: DegreeLabel
  /** 顯式或推導出的和弦品質 */
  quality: ChordQuality
  /** 副屬和弦目標級數（'V/ii' 的 'ii' → '2'），無則省略 */
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
  /** 本進行預設以三和弦或七和弦呈現 */
  harmonyLevel: HarmonyLevel
  knowledgeIds?: readonly string[]
}

export interface RealizeOptions {
  key: NoteName
  /** 'triad' 推導三和弦品質、'seventh' 推導七和弦品質（顯式品質不受影響） */
  harmonyLevel: HarmonyLevel
  /** 預設 'chordRoot' */
  degreeReference?: DegreeReference
}

// ─── 曲式（Phase 8 / F8-2）────────────────────────────────────────────────
// 一段進行（ProgressionPreset）與一首曲子的差別是**段落**：A、A2、B、A3。
// 反覆記號、1st/2nd ending、D.S. al Coda 一律不做——那些是排版的省字法，
// 跟練需要的是「第 27 小節該彈什麼」。段落展開成陣列之後，段落循環、
// 強制切換、chorus 計數全部退化成索引運算（決策見 docs/PRD/phase-08.md §4.2）。

/** 一個段落。bars 是小節線記法，文法見 progressions/chartText.ts */
export interface ChartSection {
  /** 段落標記，樂手通用的字母（A / A2 / B / Intro / Coda）；不翻譯 */
  label: string
  /** 小節線記法，如 `| I6 vim7 | iim7 V7 |` */
  bars: string
  /** 這一段的和聲層級；省略時沿用整份曲譜的設定 */
  harmonyLevel?: HarmonyLevel
}

/** 曲式：記譜調 + 段落定義 + 展開順序 */
export interface ChartForm {
  /** 記譜調——級數的錨。使用者可移調，這只是「譜上寫的調」 */
  homeKey: NoteName
  /** 段落展開順序，如 ['A', 'A2', 'B', 'A3']；即一個 chorus */
  form: readonly string[]
  sections: readonly ChartSection[]
}

/**
 * 小節內的一個和弦。
 * offsetBeats 是 RealizedBar 沒有的資訊：一小節兩個和弦時，第二個從第幾拍開始。
 * comping 示範音要排得準就得知道這件事（RealizedBar 只知道「這小節有這幾個和弦」）。
 */
export interface BarChord {
  chord: RealizedChord
  /** 距小節起點的偏移，單位＝拍 */
  offsetBeats: number
  /** 佔幾拍 */
  beats: number
}

/** 展開後的一小節 */
export interface FormBar {
  /** 1-based 絕對小節（一個 chorus 內） */
  bar: number
  /** 這一小節屬於 form 陣列的第幾項（0-based） */
  sectionIndex: number
  /** 該段落的標記（A / B…） */
  label: string
  chords: BarChord[]
}

/** form 陣列的一項在整個 chorus 裡佔哪幾小節（曲式圖與段落循環用） */
export interface SectionSpan {
  /** form 陣列裡的索引（0-based）——同一個 label 可能出現多次，索引才是身分 */
  index: number
  label: string
  /** 1-based 起始小節 */
  firstBar: number
  bars: number
}

export interface ExpandFormOptions extends RealizeOptions {
  /** 一小節幾拍（＝拍號分子）；決定 BarChord 的 offsetBeats */
  beatsPerBar: number
}

/** 曲譜文字的解析結果（匯入／編輯用；feel 由模組層驗證，core 不認識 feel id） */
export interface ChartDraft {
  title: string
  homeKey: NoteName
  feel: string
  bpm: number | null
  form: string[]
  sections: ChartSection[]
}
