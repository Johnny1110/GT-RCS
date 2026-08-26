/**
 * 課表資料的防線（與 presets.spec.ts 同一種）：每條課表都必須在 12 個調展開成功。
 * 最容易出錯的兩件事：記法打錯（品質不在公式表內）與 12 調裡某個調拼不出來
 * （Gb 調的減七要用到重降記號）。兩者都在這裡爆，而不是在使用者的畫面上。
 */
import { describe, it, expect } from 'vitest'
import { parseProgression, realizeProgression } from '@/core/theory'
import { DESCENDING_FIFTHS } from '@/components/CircleOfFifths/geometry'
import { buildCircleCycle } from '../cycle'
import { ARPEGGIO_DRILLS, drillChordCount, findArpeggioDrill } from './drills'

function symbolsIn(id: string, key: string): string[] {
  const drill = findArpeggioDrill(id)
  expect(drill, id).toBeDefined()
  return realizeProgression(drill!, { key: key as never, harmonyLevel: drill!.harmonyLevel })
    .flatMap((bar) => bar.chords.map((chord) => chord.symbol))
}

describe('琶音課表', () => {
  it('id 唯一', () => {
    const ids = ARPEGGIO_DRILLS.map((drill) => drill.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('每條課表的 barsPerChord 長度等於和弦數（一個琶音一小節）', () => {
    for (const drill of ARPEGGIO_DRILLS) {
      expect(parseProgression(drill.tokens, drill.harmonyLevel).length, drill.id)
        .toBe(drill.barsPerChord.length)
      expect(drill.barsPerChord.every((bars) => bars === 1), drill.id).toBe(true)
    }
  })

  it('每條課表都能在 12 個調展開，和弦名不含未解析的記號', () => {
    for (const drill of ARPEGGIO_DRILLS) {
      for (const key of DESCENDING_FIFTHS) {
        const symbols = symbolsIn(drill.id, key)
        expect(symbols.length, `${drill.id} in ${key}`).toBe(drillChordCount(drill))
        for (const symbol of symbols) {
          expect(symbol, `${drill.id} in ${key}`).toMatch(/^[A-G](#|##|b|bb)?[a-zA-Z0-9]*$/)
        }
      }
    }
  })

  /** 使用者要的就是這四種：大七、屬七、小七、半減。課表少掉一種等於練習缺一角 */
  it('順階七和弦走完調內七個和弦，四種實用品質都在裡面', () => {
    expect(symbolsIn('diatonic7', 'C'))
      .toEqual(['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7b5'])
  })

  it('小調 2-5-1 的 ii 是半減、V 仍是屬七（小調的 V 用大三度）', () => {
    expect(symbolsIn('minor251', 'C')).toEqual(['Dm7b5', 'G7', 'Cm7'])
  })

  it('單一品質的課表一個調只有一個和弦（沿五度圈換的是調，不是和弦）', () => {
    for (const id of ['maj7', 'dom7', 'min7', 'halfDim7', 'dim7']) {
      expect(drillChordCount(findArpeggioDrill(id)!), id).toBe(1)
    }
    expect(symbolsIn('maj7', 'Eb')).toEqual(['Ebmaj7'])
    expect(symbolsIn('halfDim7', 'A')).toEqual(['Am7b5'])
  })

  it('減七在 Gb 調拼得出來（重降記號是正確拼寫，不是壞掉）', () => {
    const drill = findArpeggioDrill('dim7')!
    const chord = realizeProgression(drill, { key: 'Gb', harmonyLevel: 'seventh' })[0]?.chords[0]
    expect(chord?.symbol).toBe('Gbdim7')
    expect(chord?.tones.map((tone) => tone.name)).toEqual(['Gb', 'Bbb', 'Dbb', 'Fbb'])
  })

  it('沿五度圈走 12 調：每個調一遍，順序是五度下行', () => {
    const drill = findArpeggioDrill('dom7')!
    const cycle = buildCircleCycle(drill, { barsPerKey: drillChordCount(drill), startKey: 'C' })
    expect(cycle).toHaveLength(12)
    expect(cycle.slice(0, 4).map((bar) => bar.chords[0]?.symbol)).toEqual(['C7', 'F7', 'Bb7', 'Eb7'])
  })

  it('每調走兩遍＝同一個調重複整份課表（小節表長度加倍）', () => {
    const drill = findArpeggioDrill('major251')!
    const cycle = buildCircleCycle(drill, { barsPerKey: drillChordCount(drill) * 2, startKey: 'C' })
    expect(cycle).toHaveLength(72)
    expect(cycle.slice(0, 6).map((bar) => bar.chords[0]?.symbol))
      .toEqual(['Dm7', 'G7', 'Cmaj7', 'Dm7', 'G7', 'Cmaj7'])
    expect(cycle[6]?.key).toBe('F')
  })

  it('找不到的 id 回 undefined（持久化的課表可能已被移除）', () => {
    expect(findArpeggioDrill('nope')).toBeUndefined()
  })
})
