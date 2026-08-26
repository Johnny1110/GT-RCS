import { describe, it, expect } from 'vitest'
import { buildCircleCycle, cycleBarAt, firstBarOfKey, keySequence, nextChordAfter } from './cycle'
import { findCircleProgression } from './presets'

const preset2516 = findCircleProgression('2516')!
const blues = findCircleProgression('blues12')!

describe('keySequence', () => {
  it('從 C 開始逆時針：C F Bb Eb…', () => {
    expect(keySequence('C').slice(0, 5)).toEqual(['C', 'F', 'Bb', 'Eb', 'Ab'])
  })

  it('可從任一調起算，仍是 12 個不同的調', () => {
    const seq = keySequence('Eb')
    expect(seq[0]).toBe('Eb')
    expect(seq[1]).toBe('Ab')
    expect(new Set(seq).size).toBe(12)
  })

  it('未知起始調回退為預設順序（不丟例外）', () => {
    expect(keySequence('C#' as never)[0]).toBe('C')
  })
})

describe('buildCircleCycle', () => {
  const cycle = buildCircleCycle(preset2516, { barsPerKey: 8, startKey: 'C' })

  it('12 調 × 每調 8 小節 = 96 小節，globalBar 連續', () => {
    expect(cycle).toHaveLength(96)
    expect(cycle[0]?.globalBar).toBe(1)
    expect(cycle[95]?.globalBar).toBe(96)
    cycle.forEach((bar, i) => expect(bar.globalBar).toBe(i + 1))
  })

  it('每 8 小節換一個調，順序為五度下行', () => {
    expect(cycle[0]?.key).toBe('C')
    expect(cycle[7]?.key).toBe('C')
    expect(cycle[8]?.key).toBe('F')
    expect(cycle[16]?.key).toBe('Bb')
    expect(cycle[8]?.barInKey).toBe(1)
    expect(cycle[15]?.barInKey).toBe(8)
  })

  it('進行短於 barsPerKey 時重複（2516 四小節 → 8 小節走兩輪）', () => {
    const symbols = cycle.slice(0, 8).map((bar) => bar.chords[0]?.symbol)
    expect(symbols).toEqual(['Dm7', 'G7', 'Cmaj7', 'Am7', 'Dm7', 'G7', 'Cmaj7', 'Am7'])
  })

  it('進行長於 barsPerKey 時截斷（12 小節藍調在 8 小節設定下只走前 8 小節）', () => {
    const short = buildCircleCycle(blues, { barsPerKey: 8, startKey: 'C' })
    expect(short.slice(0, 8).map((b) => b.chords[0]?.symbol))
      .toEqual(['C7', 'F7', 'C7', 'C7', 'F7', 'F7', 'C7', 'C7'])
  })

  it('第二個調的和弦已換調（F 調的 2516）', () => {
    expect(cycle.slice(8, 12).map((bar) => bar.chords[0]?.symbol))
      .toEqual(['Gm7', 'C7', 'Fmaj7', 'Dm7'])
  })
})

describe('cycleBarAt / nextChordAfter', () => {
  const cycle = buildCircleCycle(preset2516, { barsPerKey: 4, startKey: 'C' })

  it('依 transport 小節數查表，走完一輪繞回開頭', () => {
    expect(cycleBarAt(cycle, 1)?.chords[0]?.symbol).toBe('Dm7')
    expect(cycleBarAt(cycle, 5)?.key).toBe('F')
    expect(cycleBarAt(cycle, 48)?.key).toBe('G')
    expect(cycleBarAt(cycle, 49)?.key).toBe('C') // 繞回
    expect(cycleBarAt(cycle, 49)?.chords[0]?.symbol).toBe('Dm7')
  })

  it('提前一小節預告下一個和弦，跨調時預告的是新調的和弦', () => {
    expect(nextChordAfter(cycle, 1)?.symbol).toBe('G7')
    expect(nextChordAfter(cycle, 4)?.symbol).toBe('Gm7') // 第 4 小節時已預告 F 調
  })

  it('空循環不炸', () => {
    expect(cycleBarAt([], 3)).toBeUndefined()
    expect(nextChordAfter([], 3)).toBeUndefined()
  })
})

describe('firstBarOfKey', () => {
  const cycle = buildCircleCycle(preset2516, { barsPerKey: 8, startKey: 'C' })

  it('回傳那個調的第一小節（點五度圈就是跳到這裡）', () => {
    expect(firstBarOfKey(cycle, 'C')).toBe(1)
    expect(firstBarOfKey(cycle, 'F')).toBe(9)
    expect(firstBarOfKey(cycle, 'G')).toBe(89)
  })

  it('同音異名視為同一個調（圈上寫 F#、循環表裡寫 Gb）', () => {
    expect(firstBarOfKey(cycle, 'Gb')).toBe(49)
    expect(firstBarOfKey(cycle, 'F#')).toBe(49)
  })

  it('起始調換了，同一個調的位置跟著換', () => {
    expect(firstBarOfKey(buildCircleCycle(preset2516, { barsPerKey: 4, startKey: 'Eb' }), 'Eb')).toBe(1)
  })

  it('空循環回傳 undefined（呼叫端不跳）', () => {
    expect(firstBarOfKey([], 'C')).toBeUndefined()
  })
})
