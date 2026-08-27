/**
 * 指板推導：(調弦, 格數, 音集合) → 每弦每格的已拼寫音。
 * 純函式。UI 的 Fretboard 組件只吃這裡的輸出，不做任何樂理計算。
 */
import { parseNoteName, mod12 } from './intervals'
import type { FretCell, FretPosition, Note, Tuning } from './types'

/** 標準調弦，string 1（高音 e）→ string 6（低音 E） */
export const STANDARD_TUNING: Tuning = ['E', 'B', 'G', 'D', 'A', 'E']

export const DEFAULT_FRET_COUNT = 22

/** 標準調弦第 6 弦 E2 的 MIDI 音高。調弦只給音名（沒有八度），八度要有一個錨 */
export const LOWEST_STRING_MIDI = 40

/**
 * 各弦空弦的實際音高（MIDI，index 0 = string 1）。
 *
 * 兩條推導規則：
 * - 最低弦取「與標準第 6 弦 E2 最近的那個八度」——drop D 因此落在 D2 而不是 D3。
 * - 其餘各弦由下往上疊：每條弦比下一條高，最少 1 個半音；同音名（某些 drop／12 弦調弦）
 *   視為差一個八度。
 *
 * 為什麼需要絕對音高：pitch class 說得出「這是 A」，說不出「這是哪一個 A」。
 * 指板上的音要發得出聲，就得先變成音高——與 voicing.ts 對和弦做的是同一件事。
 */
export function openStringMidis(tuning: Tuning = STANDARD_TUNING): number[] {
  const pcs = tuning.map((name) => parseNoteName(name).pc)
  const midis = new Array<number>(tuning.length)
  const lowIndex = tuning.length - 1
  if (lowIndex < 0) return midis
  const above = LOWEST_STRING_MIDI + mod12((pcs[lowIndex] ?? 0) - LOWEST_STRING_MIDI)
  midis[lowIndex] = above - LOWEST_STRING_MIDI > 6 ? above - 12 : above
  for (let i = lowIndex - 1; i >= 0; i--) {
    const step = mod12((pcs[i] ?? 0) - (pcs[i + 1] ?? 0))
    midis[i] = (midis[i + 1] ?? 0) + (step === 0 ? 12 : step)
  }
  return midis
}

/**
 * 指板座標 → MIDI 音高（fret 0 = 空弦）。
 * 弦號超出調弦範圍是呼叫端的錯，但這裡回退而不丟例外：發聲路徑跑在排程回呼裡，
 * 丟例外會讓那一批 tick 整個排不進去（聽起來是「聲音突然停了」，比一個怪音難查得多）。
 */
export function fretMidi(position: FretPosition, tuning: Tuning = STANDARD_TUNING): number {
  const open = openStringMidis(tuning)[position.string - 1]
  return (open ?? LOWEST_STRING_MIDI) + position.fret
}

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
