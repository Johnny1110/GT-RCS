/**
 * 拼寫引擎：給定主音與度數公式，輸出「字母正確」的音名。
 *
 * 演算法：度數的數字決定目標字母（root 字母 + (n-1) 個字母步），
 * 再以「目標 pc − 該字母自然 pc」推得升降記號。
 * 這保證 F# 大調拼出 E#、Db 屬七拼出 Cb、Cdim7 拼出 Bbb。
 */
import { LETTERS, LETTER_PC, accidentalToString, mod12, parseDegree, parseNoteName } from './intervals'
import type { DegreeLabel, Note, NoteName } from './types'

/** 拼寫單一度數。root 需為合法拼寫音名（如 'F#'、'Bb'）。 */
export function spellDegree(root: NoteName, label: DegreeLabel): Note {
  const r = parseNoteName(root)
  const d = parseDegree(label)
  const rootLetterIdx = LETTERS.indexOf(r.letter)
  const letter = LETTERS[(rootLetterIdx + d.number - 1) % 7]
  if (letter === undefined) throw new Error(`Unreachable: letter index out of range`)
  const pc = mod12(r.pc + d.semitones)
  let accidental = pc - LETTER_PC[letter]
  if (accidental > 6) accidental -= 12
  if (accidental < -6) accidental += 12
  if (Math.abs(accidental) > 2) {
    throw new Error(`Unspellable within double accidentals: root=${root} degree=${label}`)
  }
  return { pc, name: `${letter}${accidentalToString(accidental)}` as NoteName, degree: label }
}

/** 展開整組公式（和弦或音階）為已拼寫音列 */
export function spell(root: NoteName, formula: readonly DegreeLabel[]): Note[] {
  return formula.map((label) => spellDegree(root, label))
}
