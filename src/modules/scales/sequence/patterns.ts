/**
 * 模進型（純函式，模組層）。
 *
 * 界線與 modules/scales/recall/quiz.ts、modules/chords/arpeggio/sequence.ts 相同：
 * core 回答「A 小調五聲的第一盒在哪幾格、照什麼順序走」（scaleShapePath），
 * 「這條路徑要怎麼重排成一條練習」是**練習設計**，屬於模組層。
 *
 * 一個模型長出全部的模進型——兩個正交參數：
 *
 *     size     一組幾個音
 *     interval 組內每一步跳幾個**音階級數**（1 = 級進、2 = 隔一個音…）
 *
 * 每一組的起點往上移一個音階音（模進的定義就是「同一個音型往上搬」）。
 * 於是 (3,1) 是三個一組、(2,2) 是三度、(4,2) 是七和弦分解——不必為每一種寫一份產生器，
 * 新增一種模進只要在 SEQUENCE_PATTERNS 加一行。
 *
 * **interval 算的是音階級數不是音程**：七音音階的 (2,2) 是三度，同一組參數放到五聲上
 * 會變成三度或四度。這是特性不是 bug——五聲的「跳音」本來就是這個聲音。
 *
 * 時間模型與琶音模組的差別，是這個模組最容易寫錯的地方：
 * 琶音是「小節線換和弦」，所以格號每個小節重算；模進是**一條跨小節的跑道**，
 * 序列連續前進到走完才回頭（`absoluteSlot`）。每小節重算會讓序列永遠停在第一組。
 */
import type { FretCell } from '@/core/theory'

export type SequenceDirection = 'up' | 'down' | 'upDown'

export const SEQUENCE_DIRECTIONS = ['up', 'down', 'upDown'] as const

export function isSequenceDirection(value: unknown): value is SequenceDirection {
  return SEQUENCE_DIRECTIONS.some((direction) => direction === value)
}

export interface SequencePattern {
  id: string
  titleKey: string
  /** 一組幾個音 */
  size: number
  /** 組內每一步跳幾個音階級數（1 = 級進） */
  interval: number
}

/**
 * 八種模進型，涵蓋一弦三音與五聲盒型的常用素材。
 * 順序＝由易到難：先把級進走順，再談跳音與分解和弦。
 */
export const SEQUENCE_PATTERNS: readonly SequencePattern[] = [
  { id: 'straight', titleKey: 'seqPattern.straight', size: 1, interval: 1 },
  { id: 'threes', titleKey: 'seqPattern.threes', size: 3, interval: 1 },
  { id: 'fours', titleKey: 'seqPattern.fours', size: 4, interval: 1 },
  { id: 'sixes', titleKey: 'seqPattern.sixes', size: 6, interval: 1 },
  { id: 'thirds', titleKey: 'seqPattern.thirds', size: 2, interval: 2 },
  { id: 'fourths', titleKey: 'seqPattern.fourths', size: 2, interval: 3 },
  { id: 'triads', titleKey: 'seqPattern.triads', size: 3, interval: 2 },
  { id: 'sevenths', titleKey: 'seqPattern.sevenths', size: 4, interval: 2 },
]

export function findSequencePattern(id: unknown): SequencePattern | undefined {
  return SEQUENCE_PATTERNS.find((pattern) => pattern.id === id)
}

/** 上行：每一組的起點往上一個音階音，直到最後一個音出不了指型為止 */
function ascending(length: number, pattern: SequencePattern): number[] {
  const size = Math.max(1, Math.floor(pattern.size))
  const interval = Math.max(1, Math.floor(pattern.interval))
  const span = (size - 1) * interval
  const indices: number[] = []
  for (let start = 0; start + span < length; start++) {
    for (let step = 0; step < size; step++) indices.push(start + step * interval)
  }
  return indices
}

/**
 * 模進的索引序列（相對指型路徑）。回傳索引而不是音，是因為同一份順序要同時餵給
 * 畫面（音名）與示範音（音高）——各自排一次，遲早出現畫面圈著 4、耳朵聽到 5。
 *
 * 下行＝把整條上行倒過來：得到的正是「從最高音起、每組往下走」的標準下行模進。
 *
 * 上下行在折返點會**重複一個音**（…3-4-5 | 5-4-3…），與琶音模組的取捨相反：
 * 那裡是四個音一輪，去掉重複才不會拖拍；這裡分組是節奏的骨架（三個一組就是三連音），
 * 為了少彈一個音把組拆散，練的東西就沒了。寧可多彈一個音。
 *
 * 指型短到一組都走不完時回空陣列——那是設定問題，不該偷偷改成別的練習。
 */
export function sequenceIndices(
  length: number,
  pattern: SequencePattern,
  direction: SequenceDirection,
): number[] {
  if (length <= 0) return []
  const up = ascending(length, pattern)
  if (direction === 'up') return up
  const down = [...up].reverse()
  return direction === 'down' ? down : [...up, ...down]
}

/** 一小節有幾格（拍數 × 每拍細分）；參數不合法時至少回 1，呼叫端永遠除得下去 */
export function slotsPerBar(beats: number, ticksPerBeat: number): number {
  return Math.max(1, Math.floor(beats) * Math.floor(ticksPerBeat))
}

/** TickEvent 的位置（皆 1-based） */
export interface TickPosition {
  bar: number
  beat: number
  tick: number
}

/**
 * 從播放起點算起的絕對格號（0-based）。
 * 模進的序列比一個小節長得多，所以格號不能每個小節重算——重算的症狀是
 * 序列永遠停在第一組，而且看起來很像「速度不對」而不是「算錯了」。
 */
export function absoluteSlot(at: TickPosition, beats: number, ticksPerBeat: number): number {
  const perBeat = Math.max(1, Math.floor(ticksPerBeat))
  const bar = Math.max(1, Math.floor(at.bar))
  const beat = Math.max(1, Math.floor(at.beat))
  const tick = Math.max(1, Math.floor(at.tick))
  return (bar - 1) * slotsPerBar(beats, perBeat) + (beat - 1) * perBeat + (tick - 1)
}

/** 第 slot 格該彈序列裡的第幾個音（序列循環）；空序列回 undefined */
export function stepAt(sequenceLength: number, slot: number): number | undefined {
  if (sequenceLength <= 0) return undefined
  return ((slot % sequenceLength) + sequenceLength) % sequenceLength
}

/** 第幾組（0-based）。序列是一組接一組排出來的，所以整除就是組號 */
export function groupOf(step: number, size: number): number {
  return Math.floor(step / Math.max(1, Math.floor(size)))
}

export function groupCount(sequenceLength: number, size: number): number {
  return Math.ceil(sequenceLength / Math.max(1, Math.floor(size)))
}

/** 某一組的索引（畫面上只畫「現在這一組」，整條序列有四十幾個音，畫出來沒人看得完） */
export function groupIndices(
  sequence: readonly number[],
  group: number,
  size: number,
): number[] {
  const width = Math.max(1, Math.floor(size))
  const start = Math.max(0, group) * width
  return sequence.slice(start, start + width)
}

/**
 * 序列要走幾個小節才會再度落在小節線上（lcm(序列長度, 每小節格數) / 每小節格數）。
 *
 * 這是模進最有價值也最容易被誤會的地方：三個一組配四分音符，第二組就從反拍開始，
 * 使用者會以為是拍子跑掉了。說出「7 個小節之後回到開頭」，它就從 bug 變成練習內容。
 */
export function alignmentBars(sequenceLength: number, slots: number): number {
  if (sequenceLength <= 0 || slots <= 0) return 0
  let a = sequenceLength
  let b = slots
  while (b !== 0) [a, b] = [b, a % b]
  return sequenceLength / a
}

/** 依索引序列把指型路徑排成要彈的順序（畫面與示範音共用的那一份） */
export function orderedCells(path: readonly FretCell[], indices: readonly number[]): FretCell[] {
  return indices.flatMap((index) => {
    const cell = path[index]
    return cell ? [cell] : []
  })
}
