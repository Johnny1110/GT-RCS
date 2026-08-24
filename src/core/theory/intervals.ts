/**
 * 音程數學：度數標記與音名的解析、pitch class 運算。
 * 純函式、無狀態。所有 12 平均律計算的最底層。
 */
import type {
  ChromaticDegree, DegreeLabel, Letter, NoteName, ParsedDegree, PitchClass,
} from './types'

/** 字母循環（拼寫引擎用：3 度 = 前進 2 個字母） */
export const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

export const LETTER_PC: Readonly<Record<Letter, PitchClass>> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
}

/** 大調音程的半音數（度數數字 → 半音；延伸音程照算） */
const MAJOR_NUMBER_SEMITONES: Readonly<Record<number, number>> = {
  1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11,
  8: 12, 9: 14, 10: 16, 11: 17, 12: 19, 13: 21,
}

/** 八度內 12 個半音的正規度數標記（索引 = 距主音的半音數） */
export const CHROMATIC_DEGREES: readonly ChromaticDegree[] = [
  '1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7',
]

export function mod12(n: number): PitchClass {
  return (((n % 12) + 12) % 12) as PitchClass
}

const DEGREE_RE = /^(bb|b|##|#)?(1[0-3]|[1-9])$/

export function parseDegree(label: DegreeLabel): ParsedDegree {
  const m = DEGREE_RE.exec(label)
  if (!m) throw new Error(`Invalid degree label: ${label}`)
  const acc = m[1] ?? ''
  const number = Number(m[2])
  const base = MAJOR_NUMBER_SEMITONES[number]
  if (base === undefined) throw new Error(`Unsupported degree number: ${label}`)
  const accidentalOffset = acc === '' ? 0 : acc.startsWith('b') ? -acc.length : acc.length
  return { label, number, accidentalOffset, semitones: base + accidentalOffset }
}

/** 度數 → 相對主音的 pitch class 差（延伸音程摺回八度內） */
export function degreeInterval(label: DegreeLabel): PitchClass {
  return mod12(parseDegree(label).semitones)
}

const NOTE_RE = /^([A-G])(bb|b|##|#)?$/

export interface ParsedNoteName {
  letter: Letter
  accidentalOffset: number
  pc: PitchClass
}

export function parseNoteName(name: NoteName): ParsedNoteName {
  const m = NOTE_RE.exec(name)
  if (!m) throw new Error(`Invalid note name: ${name}`)
  const letter = m[1] as Letter
  const acc = m[2] ?? ''
  const accidentalOffset = acc === '' ? 0 : acc.startsWith('b') ? -acc.length : acc.length
  return { letter, accidentalOffset, pc: mod12(LETTER_PC[letter] + accidentalOffset) }
}

export function accidentalToString(offset: number): string {
  if (offset === 0) return ''
  if (offset > 0) return '#'.repeat(offset)
  return 'b'.repeat(-offset)
}

/** 半音距離 → 正規度數標記（例：距 C 八個半音 → 'b6'） */
export function chromaticDegree(semitones: number): ChromaticDegree {
  const label = CHROMATIC_DEGREES[mod12(semitones)]
  if (label === undefined) throw new Error('Unreachable: interval out of range')
  return label
}
