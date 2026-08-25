/**
 * 圖表幾何（純函式，可測）。
 *
 * 為什麼不引圖表庫：資料量只有 28 個長條與幾十個點，任何圖表庫的體積都遠大於
 * 這裡的計算量，而首屏 bundle < 200KB gz 是 PRD 的硬指標（F5-2 風險表）。
 * 座標算在這裡、畫在 .vue，跟 Fretboard／CircleOfFifths 是同一套分工。
 */

export interface StackedSegment {
  /** 分組鍵（顏色由組件決定，幾何層不管顏色） */
  group: string
  y: number
  height: number
  value: number
}

export interface StackedBar {
  /** 原始資料的鍵（日期），供 tooltip 與 aria 使用 */
  key: string
  x: number
  width: number
  total: number
  /** 由下往上堆疊的區段；值為 0 的區段不產生（畫出來是 0 高度的雜訊） */
  segments: StackedSegment[]
}

export interface StackedBarLayout {
  width: number
  height: number
  bars: StackedBar[]
  /** y 軸刻度（值 + 像素位置），由下往上 */
  ticks: { value: number; y: number }[]
  /** 圖表區域的基線 y（長條由此往上長） */
  baselineY: number
  max: number
}

export interface StackedBarOptions {
  width: number
  height: number
  /** 底部留給 x 軸標籤的高度 */
  axisHeight?: number
  /** 長條之間的間隙（像素） */
  gap?: number
  /** 堆疊順序，由下往上 */
  groups: readonly string[]
  /** y 軸最大值的下限——全部是 0 時也要畫得出格線 */
  minMax?: number
}

const DEFAULT_AXIS_HEIGHT = 18
const DEFAULT_GAP = 2
/** y 軸格線數（含 0）：3 條就夠讀出量級，再多就變成方格紙 */
const TICK_COUNT = 3

/**
 * 把刻度上限進位到好讀的數字（1／2／5 × 10^n）。
 * 「37 分鐘」的軸標到 40 比標到 37 好讀，這是圖表的常識不是實作細節。
 */
export function niceCeil(value: number): number {
  if (value <= 0) return 0
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)))
  const normalized = value / magnitude
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return step * magnitude
}

export function stackedBarLayout(
  rows: readonly { key: string; values: Readonly<Record<string, number>> }[],
  options: StackedBarOptions,
): StackedBarLayout {
  const {
    width, height, groups,
    axisHeight = DEFAULT_AXIS_HEIGHT,
    gap = DEFAULT_GAP,
    minMax = 1,
  } = options

  const baselineY = height - axisHeight
  const totals = rows.map((row) => groups.reduce((sum, g) => sum + (row.values[g] ?? 0), 0))
  const max = Math.max(minMax, niceCeil(Math.max(0, ...totals)))
  const slot = rows.length === 0 ? 0 : width / rows.length
  const barWidth = Math.max(1, slot - gap)
  const scale = (value: number): number => (value / max) * baselineY

  const bars: StackedBar[] = rows.map((row, index) => {
    const segments: StackedSegment[] = []
    let cursor = baselineY
    for (const group of groups) {
      const value = row.values[group] ?? 0
      if (value <= 0) continue
      const segmentHeight = scale(value)
      cursor -= segmentHeight
      segments.push({ group, y: cursor, height: segmentHeight, value })
    }
    return {
      key: row.key,
      x: index * slot + gap / 2,
      width: barWidth,
      total: totals[index] ?? 0,
      segments,
    }
  })

  const ticks = Array.from({ length: TICK_COUNT }, (_, i) => {
    const value = (max / (TICK_COUNT - 1)) * i
    return { value, y: baselineY - scale(value) }
  })

  return { width, height, bars, ticks, baselineY, max }
}

export interface LinePoint {
  key: string
  value: number
  x: number
  y: number
}

export interface LineLayout {
  width: number
  height: number
  points: LinePoint[]
  /** SVG path 的 d 屬性；點少於 2 個時為空字串 */
  path: string
  min: number
  max: number
}

export interface LineOptions {
  width: number
  height: number
  /** 上下留白，讓端點的圓不會被畫布切掉 */
  padding?: number
  /** 左右留白，同上——端點落在 x=0 會被切成半個圓 */
  paddingX?: number
}

const DEFAULT_LINE_PADDING = 8
const DEFAULT_LINE_PADDING_X = 4

/**
 * 折線佈局。y 軸**不從 0 起算**：BPM 從 80 進步到 100 若壓在 0–100 的軸上幾乎看不出來，
 * 而這張圖的用途正是「看出那 20 的差別」。四邊各留一點空間，端點的圓才不會被畫布切掉。
 */
export function lineLayout(
  values: readonly { key: string; value: number }[],
  options: LineOptions,
): LineLayout {
  const { width, height, padding = DEFAULT_LINE_PADDING, paddingX = DEFAULT_LINE_PADDING_X } = options
  if (values.length === 0) return { width, height, points: [], path: '', min: 0, max: 0 }

  const numbers = values.map((v) => v.value)
  const rawMin = Math.min(...numbers)
  const rawMax = Math.max(...numbers)
  // 全部一樣高時給一個假的範圍，否則除以零
  const span = rawMax - rawMin
  const min = span === 0 ? rawMin - 1 : rawMin
  const max = span === 0 ? rawMax + 1 : rawMax

  const usable = height - padding * 2
  const usableWidth = width - paddingX * 2
  const step = values.length === 1 ? 0 : usableWidth / (values.length - 1)

  const points: LinePoint[] = values.map((entry, index) => ({
    key: entry.key,
    value: entry.value,
    x: values.length === 1 ? width / 2 : paddingX + index * step,
    y: padding + usable - ((entry.value - min) / (max - min)) * usable,
  }))

  const path = points.length < 2
    ? ''
    : points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')

  return { width, height, points, path, min, max }
}

/** 秒 → 分鐘（統計一律以分鐘呈現：練習以分鐘計，秒是雜訊） */
export function toMinutes(seconds: number): number {
  return Math.round(seconds / 60)
}

/** 'YYYY-MM-DD' → 'M/D'（x 軸標籤；不經 i18n，數字格式全語系相同） */
export function shortDay(day: string): string {
  const [, month, date] = day.split('-')
  return month && date ? `${Number(month)}/${Number(date)}` : day
}
