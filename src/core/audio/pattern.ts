/**
 * 節奏 pattern → 絕對時刻表的編譯層（PRD F4-1）。
 *
 * 為什麼要有這一層：swing 讓細分「不等距」，若把位移邏輯散在 Transport 的
 * 時間推進處，之後每加一種 feel（三連音、16 分 swing、6/8）都要動排程核心。
 * 這裡把「一小節 → 每格的角色與偏移」編譯成純資料，Transport 只吃時刻表。
 * 偏移一律以「拍」為單位（拍值＝拍號分母），與 BPM 解耦——換 BPM 不必重編譯。
 *
 * 本檔為純函式，無狀態、無 Vue、無 Web Audio。
 */
import type { CellRole, RhythmPattern, TicksPerBeat, TimeSignature } from './types'

/** 直拍：反拍落在正中間 */
export const SWING_STRAIGHT = 50
/**
 * 全 shuffle：反拍落在三連音第 3 格 → 偏移 2/3 拍 → 200/3 ≈ 66.7%。
 * 業界（含多數 DAW）習慣以「66%」稱呼它，UI 顯示四捨五入為 67%；
 * 排程一律用這個精確值，不用 66，避免每拍差 0.7% 的可聽誤差。
 */
export const SWING_SHUFFLE = 200 / 3
export const SWING_MIN = 50
/** 上限 75%：再往後反拍會貼上下一個正拍，聽起來是拖拍而非 shuffle */
export const SWING_MAX = 75

export function clampSwing(percent: number): number {
  if (!Number.isFinite(percent)) return SWING_STRAIGHT
  return Math.min(SWING_MAX, Math.max(SWING_MIN, percent))
}

/** 單一細分格：它在小節裡的位置、角色與（含 swing 的）時間偏移 */
export interface PatternSlot {
  /** 小節內 0-based 細分序號，對應 pattern.bars[n] 的索引 */
  index: number
  /** 1-based 拍數 */
  beat: number
  /** 1-based 拍內細分序號 */
  tick: number
  role: CellRole
  /** 距小節起點的偏移，單位＝一拍（拍值＝拍號分母） */
  offsetBeats: number
}

/**
 * 拍內第 index 格（0-based）距該拍起點的偏移。
 *
 * swing 的作法是「成對位移」：把細分兩兩配對，後半格依 swing% 往後推。
 * - 8 分（tpb=2）：一對＝一拍，50% → 0.5 拍、66.7% → 2/3 拍（三連音第 3 格）
 * - 16 分（tpb=4）：一對＝半拍，swing 同時作用於 1-e 與 &-a 兩對（16th swing）
 * - 三連音（tpb=3）與正拍（tpb=1）：本身就是 swing 的目的地／無反拍，維持等距
 */
export function swingOffsetBeats(index: number, ticksPerBeat: TicksPerBeat, swing: number): number {
  if (ticksPerBeat % 2 !== 0) return index / ticksPerBeat
  const ratio = clampSwing(swing) / 100
  const pairDuration = 2 / ticksPerBeat
  const pair = Math.floor(index / 2)
  const offbeat = index % 2 === 1
  return pair * pairDuration + (offbeat ? pairDuration * ratio : 0)
}

/** 一小節有幾格 */
export function cellsPerBar(timeSig: TimeSignature, ticksPerBeat: TicksPerBeat): number {
  return timeSig.beats * ticksPerBeat
}

/**
 * 編譯一小節。
 * cells 長度不符時以 'rest' 補足、多的忽略——持久化與自訂編輯的資料視為不可信輸入。
 */
export function compileBar(
  cells: readonly CellRole[],
  timeSig: TimeSignature,
  ticksPerBeat: TicksPerBeat,
  swing: number = SWING_STRAIGHT,
): PatternSlot[] {
  const total = cellsPerBar(timeSig, ticksPerBeat)
  const slots: PatternSlot[] = []
  for (let index = 0; index < total; index++) {
    const beatIndex = Math.floor(index / ticksPerBeat)
    const tickIndex = index % ticksPerBeat
    slots.push({
      index,
      beat: beatIndex + 1,
      tick: tickIndex + 1,
      role: cells[index] ?? 'rest',
      offsetBeats: beatIndex + swingOffsetBeats(tickIndex, ticksPerBeat, swing),
    })
  }
  return slots
}

/** 預設節拍器 pattern：小節首拍 accent、其餘拍 normal、拍內細分 ghost（無 pattern 時的行為） */
export function metronomeBar(timeSig: TimeSignature, ticksPerBeat: TicksPerBeat): CellRole[] {
  const cells: CellRole[] = []
  for (let index = 0; index < cellsPerBar(timeSig, ticksPerBeat); index++) {
    const tickIndex = index % ticksPerBeat
    if (tickIndex !== 0) cells.push('ghost')
    else cells.push(index === 0 ? 'accent' : 'normal')
  }
  return cells
}

/**
 * 「示範 → 靜默」模式（PRD F4-3.3）：示範 N 小節後靜音 N 小節，
 * 只留小節首的 click，考驗使用者自己撐住節奏。
 */
export interface DemoSilenceMode {
  demoBars: number
  silentBars: number
}

/** bar 為 1-based（自 play 起算） */
export function isSilentBar(bar: number, mode: DemoSilenceMode | null): boolean {
  if (!mode || mode.demoBars <= 0 || mode.silentBars <= 0) return false
  const cycle = mode.demoBars + mode.silentBars
  return (bar - 1) % cycle >= mode.demoBars
}

/**
 * 靜默小節的角色：只留第一格 accent 當定位點，其餘轉 rest。
 * rest 照樣發 tick——游標要繼續走，使用者才知道自己走到哪一格。
 */
export function silenceSlots(slots: readonly PatternSlot[]): PatternSlot[] {
  return slots.map((slot) => ({ ...slot, role: slot.index === 0 ? 'accent' : 'rest' }))
}

/**
 * pattern 速記法：一個字元一格，讓 preset 庫在原始碼裡就看得出節奏形狀。
 * `X`＝重音、`o`＝一般、`g`＝鬼音、`.`＝休止；空白與 `|` 只是分組用的視覺輔助。
 * 打錯字直接丟例外——preset 是寫死的資料，錯了要在測試就爆，不該悄悄變成休止。
 */
const NOTATION: Readonly<Record<string, CellRole>> = {
  X: 'accent', o: 'normal', g: 'ghost', '.': 'rest',
}

export function parseCells(notation: string): CellRole[] {
  const cells: CellRole[] = []
  for (const char of notation) {
    if (char === ' ' || char === '|') continue
    const role = NOTATION[char]
    if (!role) throw new Error(`Unknown rhythm notation character: ${char}`)
    cells.push(role)
  }
  return cells
}

/** 角色清單（供編輯模式循環切換：rest → normal → accent → ghost → rest） */
export const CELL_ROLE_CYCLE = ['rest', 'normal', 'accent', 'ghost'] as const

export function nextCellRole(role: CellRole): CellRole {
  const i = CELL_ROLE_CYCLE.indexOf(role as (typeof CELL_ROLE_CYCLE)[number])
  return CELL_ROLE_CYCLE[(i + 1) % CELL_ROLE_CYCLE.length] ?? 'rest'
}

export function isCellRole(value: unknown): value is CellRole {
  return value === 'accent' || value === 'normal' || value === 'ghost' || value === 'rest'
}

/**
 * 把來源不明的格子資料（localStorage 的自訂 pattern）修成合法尺寸。
 * 壞掉的格子一律變 rest：寧可少響一下，也不要因資料損毀而整頁掛掉。
 */
export function normalizeBars(
  bars: unknown,
  timeSig: TimeSignature,
  ticksPerBeat: TicksPerBeat,
  barCount: number,
): CellRole[][] {
  const total = cellsPerBar(timeSig, ticksPerBeat)
  const source = Array.isArray(bars) ? bars : []
  return Array.from({ length: barCount }, (_, barIndex) => {
    const cells: unknown = source[barIndex]
    const list = Array.isArray(cells) ? cells : []
    return Array.from({ length: total }, (_, i) => (isCellRole(list[i]) ? list[i] : 'rest'))
  })
}

/** pattern 的格子尺寸是否與其拍號／細分一致（preset 庫的測試防線） */
export function isConsistentPattern(pattern: RhythmPattern): boolean {
  const total = cellsPerBar(pattern.timeSig, pattern.ticksPerBeat)
  return pattern.bars.length > 0 && pattern.bars.every((bar) => bar.length === total)
}
