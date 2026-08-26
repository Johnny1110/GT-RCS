import { describe, it, expect } from 'vitest'
import { buildChordStrip, loopIndex, type ChordStripOptions } from './timeline'

const SYMBOLS = ['Dm7', 'G7', 'Cmaj7', 'Am7']

function strip(overrides: Partial<ChordStripOptions> = {}) {
  return buildChordStrip({
    firstBar: 1,
    count: 4,
    activeBar: 1,
    symbolAt: (bar) => SYMBOLS[loopIndex(bar, SYMBOLS.length)],
    captionAt: (bar) => `bar ${loopIndex(bar, SYMBOLS.length) + 1}`,
    nowLabel: 'NOW',
    nextLabel: 'NEXT',
    ...overrides,
  })
}

describe('buildChordStrip', () => {
  it('整段進行都在，格子的順序等於小節的順序', () => {
    expect(strip().map((e) => e.symbol)).toEqual(SYMBOLS)
  })

  it('游標所在的格子是 current，下一格是 next，其餘是 future', () => {
    expect(strip().map((e) => e.state)).toEqual(['current', 'next', 'future', 'future'])
  })

  it('游標往前走時格子不動，只有狀態換位（與節奏譜同一種讀法）', () => {
    const moved = strip({ activeBar: 3 })
    expect(moved.map((e) => e.symbol)).toEqual(SYMBOLS)
    expect(moved.map((e) => e.state)).toEqual(['past', 'past', 'current', 'next'])
  })

  it('barOffset 是「距離當前小節幾小節」——點下去就是位移多少', () => {
    expect(strip({ activeBar: 3 }).map((e) => e.barOffset)).toEqual([-2, -1, 0, 1])
  })

  it('當前與下一格用譯好的字，其餘用小節標籤', () => {
    expect(strip().map((e) => e.caption)).toEqual(['NOW', 'NEXT', 'bar 3', 'bar 4'])
  })

  it('查不到和弦的小節整格跳過（記法壞掉時不畫空格）', () => {
    const sparse = strip({ symbolAt: (bar) => (bar === 2 ? undefined : SYMBOLS[loopIndex(bar, 4)]) })
    expect(sparse.map((e) => e.symbol)).toEqual(['Dm7', 'Cmaj7', 'Am7'])
  })

  it('段落不從第 1 小節起算時，位移仍以絕對小節計算（12 調循環的第二個調）', () => {
    const second = strip({ firstBar: 5, activeBar: 6 })
    expect(second.map((e) => e.barOffset)).toEqual([-1, 0, 1, 2])
  })

  it('沒有小節就沒有格子', () => {
    expect(strip({ count: 0 })).toEqual([])
  })
})

describe('loopIndex', () => {
  it('1-based 小節 → 0-based 索引，走完一輪繞回開頭', () => {
    expect([1, 2, 3, 4, 5].map((b) => loopIndex(b, 4))).toEqual([0, 1, 2, 3, 0])
  })

  it('小節數 0（transport 尚未送出第一個 tick）不會算出負索引', () => {
    expect(loopIndex(0, 4)).toBe(3)
    expect(loopIndex(-3, 4)).toBe(0)
  })

  it('空進行回傳 0 而不是 NaN', () => {
    expect(loopIndex(5, 0)).toBe(0)
  })
})
