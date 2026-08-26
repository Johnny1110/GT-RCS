/**
 * 琶音音序（純函式，模組層）。
 *
 * 界線與 modules/scales/recall/quiz.ts 相同：core 回答「Dm7 有哪些音、在指板哪幾格」，
 * 「這些音要照什麼順序、在第幾格響」是**練習設計**，屬於模組層。
 *
 * 一條規則決定整個模組的時間行為：
 *
 *     第 n 格（細分格）彈序列裡的第 n % 序列長度 個音，格數在每個和弦的開頭重新算。
 *
 * 也就是說音符跟著 click 的細分走，不是自己走一條時間線（反模式清單第 2 條）。
 * 4/4 正拍下一小節 4 格，正好是一個七和弦的四個音——這是預設值好用的原因。
 * 序列長度除不盡小節格數時（上下行 6 音 vs 4 格）序列會在小節線被切斷，
 * 這不是 bug 而是「不足重複、超過截斷」的同一條規則（見 cycle.ts）；
 * 畫面必須說出來，使用者才知道要改細分而不是以為壞了。
 */
import type { Note } from '@/core/theory'

export type ArpeggioDirection = 'up' | 'down' | 'upDown'

export const ARPEGGIO_DIRECTIONS = ['up', 'down', 'upDown'] as const

export function isArpeggioDirection(value: unknown): value is ArpeggioDirection {
  return ARPEGGIO_DIRECTIONS.some((direction) => direction === value)
}

/**
 * 音序＝和弦內音的**索引**序列，不是音本身。
 * 回傳索引是因為同一個順序要同時餵給兩邊：畫面上的音名（Note[]）與示範音的音高（MIDI[]）。
 * 兩邊各自排一次順序，遲早會不一致——那時畫面圈著 3 音、耳朵聽到 b7。
 *
 * 上下行不重複頭尾（1 3 5 b7 5 3 → 回到 1 就是下一輪的開頭），
 * 這是實際練琴時的走法：折返點只彈一次。
 */
export function arpeggioOrder(count: number, direction: ArpeggioDirection): number[] {
  if (count <= 0) return []
  const up = Array.from({ length: count }, (_, i) => i)
  if (direction === 'up') return up
  if (direction === 'down') return [...up].reverse()
  return [...up, ...up.slice(1, -1).reverse()]
}

/** 一小節有幾格（拍數 × 每拍細分）；參數不合法時至少回 1，呼叫端永遠除得下去 */
export function slotsPerBar(beats: number, ticksPerBeat: number): number {
  return Math.max(1, Math.floor(beats) * Math.floor(ticksPerBeat))
}

/** TickEvent 的 (beat, tick) → 小節內的第幾格（0-based）。兩者都是 1-based */
export function slotOf(beat: number, tick: number, ticksPerBeat: number): number {
  const perBeat = Math.max(1, Math.floor(ticksPerBeat))
  return Math.max(0, Math.floor(beat) - 1) * perBeat + Math.max(0, Math.floor(tick) - 1)
}

/** 第 slot 格該彈序列裡的第幾個音（序列循環）；空序列回 undefined */
export function stepAt(orderLength: number, slot: number): number | undefined {
  if (orderLength <= 0) return undefined
  return ((slot % orderLength) + orderLength) % orderLength
}

/** 這一格該彈哪個和弦內音的索引；查不到（空和弦）回 undefined */
export function toneIndexAt(order: readonly number[], slot: number): number | undefined {
  const step = stepAt(order.length, slot)
  return step === undefined ? undefined : order[step]
}

/**
 * 序列在這個小節格數下走不走得完整（除得盡＝每個小節線都落在序列的開頭）。
 * 除不盡不影響正確性，只影響練習體驗，所以這是給畫面提示用的判斷。
 */
export function fitsBar(orderLength: number, slots: number): boolean {
  if (orderLength <= 0 || slots <= 0) return false
  return slots % orderLength === 0
}

/** 依音序把和弦內音排成要彈的順序（畫面上的音序列） */
export function orderedTones(tones: readonly Note[], order: readonly number[]): Note[] {
  return order.flatMap((index) => {
    const note = tones[index]
    return note ? [note] : []
  })
}
