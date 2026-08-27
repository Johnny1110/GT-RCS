/**
 * 曲式展開的防線。
 *
 * 最容易寫錯而且最難察覺的兩件事：
 * 1. 小節內偏移（半小節換和弦到底從第幾拍開始）——錯了聽起來只是「怪」
 * 2. 同一個 label 在 form 裡出現多次時的身分（A A B A 的第一個 A 與第四個 A）
 */
import { describe, expect, it } from 'vitest'
import { chordAtBeat, expandForm, formBarCount, sectionSpans } from './form'
import type { ChartForm } from './types'

const AABA: ChartForm = {
  homeKey: 'C',
  form: ['A', 'A', 'B', 'A'],
  sections: [
    { label: 'A', bars: '| Imaj7 | vim7 | iim7 V7 | Imaj7 |' },
    { label: 'B', bars: '| IVmaj7 | bVII7 |' },
  ],
}

const options = { key: 'C' as const, harmonyLevel: 'seventh' as const, beatsPerBar: 4 }

describe('expandForm', () => {
  it('展開成一個 chorus 的連續小節', () => {
    const bars = expandForm(AABA, options)
    expect(bars).toHaveLength(4 + 4 + 2 + 4)
    expect(bars.map((b) => b.bar)).toEqual([...Array(14).keys()].map((i) => i + 1))
    expect(formBarCount(AABA)).toBe(14)
  })

  it('每一小節記得自己屬於 form 的第幾項——同一個 label 出現多次也分得開', () => {
    const bars = expandForm(AABA, options)
    expect(bars[0]?.sectionIndex).toBe(0)
    expect(bars[4]?.sectionIndex).toBe(1)
    expect(bars[8]?.sectionIndex).toBe(2)
    expect(bars[10]?.sectionIndex).toBe(3)
    expect(bars[10]?.label).toBe('A')
  })

  it('一小節兩個和弦：偏移是 0 與 2 拍，各佔兩拍', () => {
    const bar = expandForm(AABA, options)[2]!
    expect(bar.chords.map((c) => c.chord.symbol)).toEqual(['Dm7', 'G7'])
    expect(bar.chords.map((c) => c.offsetBeats)).toEqual([0, 2])
    expect(bar.chords.map((c) => c.beats)).toEqual([2, 2])
  })

  it('三拍子的偏移跟著拍號走', () => {
    const waltz: ChartForm = { homeKey: 'C', form: ['A'], sections: [{ label: 'A', bars: '| I V |' }] }
    const bar = expandForm(waltz, { ...options, beatsPerBar: 3 })[0]!
    expect(bar.chords.map((c) => c.offsetBeats)).toEqual([0, 1.5])
  })

  it('移調只換 key，小節結構不變', () => {
    const bars = expandForm(AABA, { ...options, key: 'Eb' })
    expect(bars).toHaveLength(14)
    expect(bars[0]?.chords[0]?.chord.symbol).toBe('Ebmaj7')
    expect(bars[8]?.chords[0]?.chord.symbol).toBe('Abmaj7')
  })

  it('form 指到不存在的段落 → 丟例外，不安靜地少一段', () => {
    const broken: ChartForm = { ...AABA, form: ['A', 'C'] }
    expect(() => expandForm(broken, options)).toThrow(/undefined section/)
  })
})

describe('sectionSpans', () => {
  it('每一段的起始小節與長度', () => {
    expect(sectionSpans(AABA)).toEqual([
      { index: 0, label: 'A', firstBar: 1, bars: 4 },
      { index: 1, label: 'A', firstBar: 5, bars: 4 },
      { index: 2, label: 'B', firstBar: 9, bars: 2 },
      { index: 3, label: 'A', firstBar: 11, bars: 4 },
    ])
  })
})

describe('chordAtBeat', () => {
  const bar = expandForm(AABA, options)[2]!

  it('小節內的位置決定和弦（半小節換和弦的關鍵）', () => {
    expect(chordAtBeat(bar, 1)?.chord.symbol).toBe('Dm7')
    expect(chordAtBeat(bar, 2.5)?.chord.symbol).toBe('Dm7')
    expect(chordAtBeat(bar, 3)?.chord.symbol).toBe('G7')
    expect(chordAtBeat(bar, 4.75)?.chord.symbol).toBe('G7')
  })

  it('除不盡的偏移不會因為浮點誤差掉回上一個和弦', () => {
    const triple: ChartForm = { homeKey: 'C', form: ['A'], sections: [{ label: 'A', bars: '| I ii V |' }] }
    const third = expandForm(triple, options)[0]!
    // 三個和弦平分 4/4 → 偏移 0、4/3、8/3；第三個的起點正是 1 + 8/3
    expect(chordAtBeat(third, 1 + 8 / 3)?.chord.symbol).toBe('G7')
  })

  it('沒有小節就沒有和弦', () => {
    expect(chordAtBeat(undefined, 1)).toBeUndefined()
  })
})
