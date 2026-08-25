import { describe, it, expect } from 'vitest'
import { lineLayout, niceCeil, shortDay, stackedBarLayout, toMinutes } from './geometry'

describe('niceCeil', () => {
  it('進位到 1／2／5 × 10^n（軸標好讀）', () => {
    expect(niceCeil(37)).toBe(50)
    expect(niceCeil(12)).toBe(20)
    expect(niceCeil(7)).toBe(10)
    expect(niceCeil(1)).toBe(1)
    expect(niceCeil(120)).toBe(200)
    expect(niceCeil(210)).toBe(500)
  })

  it('0 與負數回 0（不是 NaN 或 -Infinity）', () => {
    expect(niceCeil(0)).toBe(0)
    expect(niceCeil(-5)).toBe(0)
  })
})

describe('stackedBarLayout', () => {
  const groups = ['rhythm', 'chords', 'scales'] as const
  const rows = [
    { key: '2026-08-24', values: { rhythm: 10, chords: 0, scales: 20 } },
    { key: '2026-08-25', values: { rhythm: 5, chords: 5, scales: 0 } },
  ]
  const layout = stackedBarLayout(rows, { width: 200, height: 118, groups })

  it('每一列一根長條，等寬且不重疊', () => {
    expect(layout.bars).toHaveLength(2)
    const [a, b] = layout.bars
    expect(a!.width).toBeCloseTo(b!.width, 6)
    expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x + 0.001)
  })

  it('值為 0 的分組不產生區段（0 高度的矩形是雜訊）', () => {
    expect(layout.bars[0]!.segments.map((s) => s.group)).toEqual(['rhythm', 'scales'])
    expect(layout.bars[1]!.segments.map((s) => s.group)).toEqual(['rhythm', 'chords'])
  })

  it('由下往上堆疊，且疊起來不超過基線', () => {
    const bar = layout.bars[0]!
    const bottom = bar.segments[0]!
    const top = bar.segments[1]!
    expect(bottom.y + bottom.height).toBeCloseTo(layout.baselineY, 6)
    expect(top.y + top.height).toBeCloseTo(bottom.y, 6)
    expect(top.y).toBeGreaterThanOrEqual(0)
  })

  it('高度按比例：30 對 10 的長條高度是三倍', () => {
    expect(layout.bars[0]!.total).toBe(30)
    expect(layout.bars[1]!.total).toBe(10)
    const h = (b: (typeof layout.bars)[number]): number =>
      b.segments.reduce((s, seg) => s + seg.height, 0)
    expect(h(layout.bars[0]!) / h(layout.bars[1]!)).toBeCloseTo(3, 6)
  })

  it('全部是 0 也畫得出軸（不會除以零）', () => {
    const empty = stackedBarLayout(
      [{ key: 'a', values: { rhythm: 0, chords: 0, scales: 0 } }],
      { width: 100, height: 100, groups },
    )
    expect(empty.max).toBeGreaterThan(0)
    expect(empty.bars[0]!.segments).toEqual([])
    expect(empty.ticks.every((t) => Number.isFinite(t.y))).toBe(true)
  })

  it('沒有資料列不炸', () => {
    const none = stackedBarLayout([], { width: 100, height: 100, groups })
    expect(none.bars).toEqual([])
    expect(none.ticks).toHaveLength(3)
  })

  it('y 軸刻度由下往上遞增，最低一格落在基線', () => {
    expect(layout.ticks[0]).toMatchObject({ value: 0, y: layout.baselineY })
    expect(layout.ticks.at(-1)!.value).toBe(layout.max)
    expect(layout.ticks.at(-1)!.y).toBeLessThan(layout.ticks[0]!.y)
  })

  it('底部替 x 軸標籤留白（長條不會壓到日期）', () => {
    expect(layout.baselineY).toBeLessThan(layout.height)
  })
})

describe('lineLayout', () => {
  const values = [
    { key: 'd1', value: 80 },
    { key: 'd2', value: 90 },
    { key: 'd3', value: 100 },
  ]
  const layout = lineLayout(values, { width: 180, height: 80 })

  it('y 軸不從 0 起算——BPM 80→100 的差別要看得出來', () => {
    expect(layout.min).toBe(80)
    expect(layout.max).toBe(100)
    expect(layout.points[0]!.y).toBeGreaterThan(layout.points[2]!.y) // 值越大越上面
  })

  it('x 由左到右等距，左右各留出端點圓的空間（貼齊畫布會被切成半個圓）', () => {
    expect(layout.points[0]!.x).toBeGreaterThan(0)
    expect(layout.points.at(-1)!.x).toBeLessThan(180)
    // 等距：中間點落在頭尾正中
    const [a, b, c] = layout.points
    expect(b!.x - a!.x).toBeCloseTo(c!.x - b!.x, 6)
  })

  it('path 由 M 起頭、其餘 L 相連', () => {
    expect(layout.path.startsWith('M')).toBe(true)
    expect(layout.path.match(/L/g)).toHaveLength(2)
  })

  it('四邊都留白，端點不貼邊（圓點不會被切掉）', () => {
    for (const point of layout.points) {
      expect(point.y).toBeGreaterThan(0)
      expect(point.y).toBeLessThan(80)
      expect(point.x).toBeGreaterThan(0)
      expect(point.x).toBeLessThan(180)
    }
  })

  it('所有值一樣時不除以零，線畫在中間', () => {
    const flat = lineLayout([{ key: 'a', value: 90 }, { key: 'b', value: 90 }], { width: 100, height: 80 })
    expect(flat.points.every((p) => Number.isFinite(p.y))).toBe(true)
    expect(flat.points[0]!.y).toBeCloseTo(flat.points[1]!.y, 6)
  })

  it('單點畫在中央、沒有 path（一個點連不成線）', () => {
    const single = lineLayout([{ key: 'a', value: 90 }], { width: 100, height: 80 })
    expect(single.points[0]!.x).toBe(50)
    expect(single.path).toBe('')
  })

  it('空資料不炸', () => {
    expect(lineLayout([], { width: 100, height: 80 }).points).toEqual([])
  })
})

describe('格式化', () => {
  it('秒換算分鐘（四捨五入——練習以分鐘計）', () => {
    expect(toMinutes(600)).toBe(10)
    expect(toMinutes(89)).toBe(1)
    expect(toMinutes(0)).toBe(0)
  })

  it('日期軸標籤去掉補零與年份', () => {
    expect(shortDay('2026-08-05')).toBe('8/5')
    expect(shortDay('2026-12-31')).toBe('12/31')
    expect(shortDay('壞掉')).toBe('壞掉')
  })
})
