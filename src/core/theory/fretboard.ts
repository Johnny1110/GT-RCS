/**
 * 指板推導：(調弦, 格數, 音集合) → 每弦每格的已拼寫音。
 * 純函式。UI 的 Fretboard 組件只吃這裡的輸出，不做任何樂理計算。
 */
import { parseNoteName, mod12 } from './intervals'
import type { FretCell, Note, Tuning } from './types'

/** 標準調弦，string 1（高音 e）→ string 6（低音 E） */
export const STANDARD_TUNING: Tuning = ['E', 'B', 'G', 'D', 'A', 'E']

export const DEFAULT_FRET_COUNT = 22

/**
 * 將音集合映射到指板。notes 內同 pitch class 以先到者為準
 * （藍調音階 b5 與 5 為不同 pc，不受影響）。
 */
export function mapToFretboard(
  notes: readonly Note[],
  tuning: Tuning = STANDARD_TUNING,
  fretCount: number = DEFAULT_FRET_COUNT,
): FretCell[] {
  const byPc = new Map<number, Note>()
  for (const n of notes) if (!byPc.has(n.pc)) byPc.set(n.pc, n)

  const cells: FretCell[] = []
  tuning.forEach((open, i) => {
    const openPc = parseNoteName(open).pc
    for (let fret = 0; fret <= fretCount; fret++) {
      const note = byPc.get(mod12(openPc + fret))
      if (note) cells.push({ string: i + 1, fret, note })
    }
  })
  return cells
}
