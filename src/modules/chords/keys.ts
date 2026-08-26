/**
 * 和弦線共用的調選項與驗證（對應音階線的 shared.ts）。
 *
 * 順序＝五度下行，與 12 調循環走的方向一致，所以選單與循環讀起來是同一件事。
 * 同音異名在五度圈上是同一格（圈上寫 F#、這份清單寫 Gb），選單只收一種拼寫，
 * 因此從五度圈點回來的調要先經 toPracticeKey() 正規化，否則會寫進一個
 * 選單裡不存在的值——畫面上會變成「沒有任何一格被選中」。
 */
import { parseNoteName, type NoteName } from '@/core/theory'
import { DESCENDING_FIFTHS } from '@/components/CircleOfFifths/geometry'

export const PRACTICE_KEYS: readonly NoteName[] = DESCENDING_FIFTHS

export function isPracticeKey(value: unknown): value is NoteName {
  return typeof value === 'string' && PRACTICE_KEYS.includes(value as NoteName)
}

/** 五度圈上的拼寫 → 選單的拼寫（F# → Gb）；不在 12 調內回退第一個 */
export function toPracticeKey(key: NoteName): NoteName {
  const pc = parseNoteName(key).pc
  return PRACTICE_KEYS.find((candidate) => parseNoteName(candidate).pc === pc) ?? PRACTICE_KEYS[0]!
}
