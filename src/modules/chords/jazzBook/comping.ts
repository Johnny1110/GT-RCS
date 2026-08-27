/**
 * comping 的格子運算（純函式，練習設計層——與 arpeggio/sequence.ts 同一條界線）。
 *
 * core 回答「這個和弦有哪些音」；「這一格該不該敲、敲多久」是 comping 的定義，
 * 屬於模組層。畫面與示範音共用這一份，各自算一次遲早會出現
 * 「看到的敲點與聽到的敲點差半拍」。
 */
import type { CellRole } from '@/core/audio'

export type CompGrid = readonly (readonly CellRole[])[]

/** tick（1-based 拍、1-based 拍內細分）→ 小節內 0-based 格號 */
export function cellIndexOf(beat: number, tick: number, ticksPerBeat: number): number {
  return (beat - 1) * ticksPerBeat + (tick - 1)
}

/** comp 格子是循環的：兩小節的圖形在第 3 小節回到第一列 */
function rowFor(grid: CompGrid, bar: number): readonly CellRole[] | undefined {
  if (grid.length === 0) return undefined
  return grid[(((bar - 1) % grid.length) + grid.length) % grid.length]
}

/** 這一格的角色；格子外一律 'rest'（資料短了不該當成敲點） */
export function compRoleAt(grid: CompGrid, bar: number, cellIndex: number): CellRole {
  return rowFor(grid, bar)?.[cellIndex] ?? 'rest'
}

export function isCompHit(grid: CompGrid, bar: number, cellIndex: number): boolean {
  return compRoleAt(grid, bar, cellIndex) !== 'rest'
}

/**
 * 從這一格到下一個敲點有幾拍——和弦就響這麼久。
 *
 * 為什麼不用整小節：四分音符 comping 若每下都響滿一小節，四個和弦會疊在一起糊成一片。
 * 找不到下一個敲點（整個循環只有這一擊）時給整個循環的長度，並以兩小節封頂：
 * 再長就變成 pad 而不是 comping 了。
 */
export function beatsToNextHit(
  grid: CompGrid,
  bar: number,
  cellIndex: number,
  ticksPerBeat: number,
  beatsPerBar: number,
): number {
  const cellsPerBar = beatsPerBar * ticksPerBeat
  const span = cellsPerBar * Math.max(1, grid.length)
  for (let step = 1; step <= span; step++) {
    const absolute = cellIndex + step
    const barOffset = Math.floor(absolute / cellsPerBar)
    if (isCompHit(grid, bar + barOffset, absolute % cellsPerBar)) {
      return step / ticksPerBeat
    }
  }
  return Math.min(span / ticksPerBeat, beatsPerBar * 2)
}
