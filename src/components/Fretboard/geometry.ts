/**
 * 指板幾何（純函式，可測）。
 * 採「等距格寬」而非真實比例：這是資訊圖不是琴頸照片，高把位的音點需要同等辨識度。
 * 視覺規格見 docs/design-system.md §5。
 */
export interface FretLine {
  fret: number
  x: number
  width: number
  /** fret 0 為琴枕，較粗且較亮 */
  nut: boolean
}

export interface StringLine {
  string: number
  y: number
  width: number
}

export interface InlayDot {
  cx: number
  cy: number
}

export interface FretNumber {
  fret: number
  x: number
  y: number
  /** 指位記號所在格（3/5/7/9/12/15…），標記較亮 */
  marker: boolean
}

export interface FretboardLayout {
  width: number
  height: number
  dotR: number
  labelSize: number
  fretLines: FretLine[]
  strings: StringLine[]
  inlays: InlayDot[]
  fretNumbers: FretNumber[]
  /** 音點中心 x；fret 0（空弦）落在琴枕左側的獨立欄 */
  cellX(fret: number): number
  /** 音點中心 y；string 為 1-based，1 = 高音 e 弦（最上方） */
  cellY(string: number): number
}

const PAD_TOP = 20
const PAD_RIGHT = 12
/** 琴枕左側的空弦音點欄寬 */
const OPEN_COL = 44
const FRET_NUM_ROW = 26
const FRET_W = 42
const STRING_GAP = 28
const DOT_R = 11
const LABEL_SIZE = 10

const SINGLE_INLAY_FRETS = [3, 5, 7, 9, 15, 17, 19, 21]
const DOUBLE_INLAY_STEP = 12

/** 低音弦較粗：string 1 → 0.8px，每往低音加 0.28px */
function stringWidth(string: number): number {
  return 0.8 + (string - 1) * 0.28
}

export function fretboardLayout(fretCount: number, stringCount: number): FretboardLayout {
  const boardBottom = PAD_TOP + (stringCount - 1) * STRING_GAP
  const cellX = (fret: number): number =>
    fret === 0 ? OPEN_COL - OPEN_COL / 2 : OPEN_COL + (fret - 0.5) * FRET_W
  const cellY = (string: number): number => PAD_TOP + (string - 1) * STRING_GAP

  const fretLines: FretLine[] = []
  const fretNumbers: FretNumber[] = []
  for (let fret = 0; fret <= fretCount; fret++) {
    fretLines.push({
      fret,
      x: OPEN_COL + fret * FRET_W,
      width: fret === 0 ? 4 : 1.5,
      nut: fret === 0,
    })
    if (fret > 0) {
      fretNumbers.push({
        fret,
        x: cellX(fret),
        y: boardBottom + 20,
        marker: SINGLE_INLAY_FRETS.includes(fret) || fret % DOUBLE_INLAY_STEP === 0,
      })
    }
  }

  const strings: StringLine[] = []
  for (let string = 1; string <= stringCount; string++) {
    strings.push({ string, y: cellY(string), width: stringWidth(string) })
  }

  const inlays: InlayDot[] = []
  const midY = (PAD_TOP + boardBottom) / 2
  for (const fret of SINGLE_INLAY_FRETS) {
    if (fret <= fretCount) inlays.push({ cx: cellX(fret), cy: midY })
  }
  for (let fret = DOUBLE_INLAY_STEP; fret <= fretCount; fret += DOUBLE_INLAY_STEP) {
    inlays.push({ cx: cellX(fret), cy: PAD_TOP + STRING_GAP * 1.5 })
    inlays.push({ cx: cellX(fret), cy: boardBottom - STRING_GAP * 1.5 })
  }

  return {
    width: OPEN_COL + fretCount * FRET_W + PAD_RIGHT,
    height: boardBottom + FRET_NUM_ROW,
    dotR: DOT_R,
    labelSize: LABEL_SIZE,
    fretLines,
    strings,
    inlays,
    fretNumbers,
    cellX,
    cellY,
  }
}

/** 把位快速跳轉的目標格（PRD F1-4：窄螢幕橫向捲動輔助） */
export const POSITION_MARKS = [0, 5, 12] as const

/** 讓某一格捲動到可視範圍左緣（略留邊距） */
export function scrollLeftForFret(layout: FretboardLayout, fret: number): number {
  return Math.max(0, layout.cellX(fret) - layout.dotR - 24)
}
