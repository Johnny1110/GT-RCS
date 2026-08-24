/**
 * 進行引擎的可執行規格（Phase 3 / F3-2）。
 * 這些測試由 Phase 1 的 test.todo 清單轉成，行為一旦通過即不可回歸。
 */
import { describe, it, expect } from 'vitest'
import {
  ProgressionSyntaxError, parseProgression, progressionBarCount, realizeProgression,
} from './parser'
import type { ProgressionPreset } from './types'

const preset = (tokens: string, barsPerChord: number[], harmonyLevel: 'triad' | 'seventh' = 'seventh'): ProgressionPreset => ({
  id: 'test', titleKey: 'test', tokens, barsPerChord, defaultBpm: 80, harmonyLevel,
})

const symbolsIn = (tokens: string, key: Parameters<typeof realizeProgression>[1]['key'], level: 'triad' | 'seventh' = 'seventh') => {
  const count = parseProgression(tokens, level).length
  return realizeProgression(preset(tokens, Array<number>(count).fill(1), level), { key, harmonyLevel: level })
    .flatMap((bar) => bar.chords.map((chord) => chord.symbol))
}

describe('parseProgression', () => {
  it("'2516' 數字簡寫 → ii V I vi（seventh 層級：C 調得 Dm7 G7 Cmaj7 Am7）", () => {
    expect(parseProgression('2516').map((t) => t.degree)).toEqual(['2', '5', '1', '6'])
    expect(symbolsIn('2516', 'C')).toEqual(['Dm7', 'G7', 'Cmaj7', 'Am7'])
  })

  it("'ii V7 Imaj7 vi' 顯式品質與推導品質混用", () => {
    expect(parseProgression('ii V7 Imaj7 vi').map((t) => t.quality)).toEqual(['m7', '7', 'maj7', 'm7'])
    expect(symbolsIn('ii V7 Imaj7 vi', 'C')).toEqual(['Dm7', 'G7', 'Cmaj7', 'Am7'])
  })

  it("'4536251' → IV V iii vi ii V I", () => {
    expect(parseProgression('4536251').map((t) => t.degree)).toEqual(['4', '5', '3', '6', '2', '5', '1'])
    expect(symbolsIn('4536251', 'C')).toEqual(['Fmaj7', 'G7', 'Em7', 'Am7', 'Dm7', 'G7', 'Cmaj7'])
  })

  it("大小寫決定三和弦品質：'I vi IV V' → maj m maj maj", () => {
    expect(parseProgression('I vi IV V', 'triad').map((t) => t.quality)).toEqual(['maj', 'm', 'maj', 'maj'])
    expect(symbolsIn('I vi IV V', 'C', 'triad')).toEqual(['C', 'Am', 'F', 'G'])
  })

  it('借用：C 大調 iv → Fm、bVII → Bb、bVI → Ab、bIII → Eb', () => {
    expect(symbolsIn('iv bVII bVI bIII', 'C', 'triad')).toEqual(['Fm', 'Bb', 'Ab', 'Eb'])
    expect(parseProgression('bVII', 'triad')[0]?.degree).toBe('b7')
  })

  it('借用在七和弦層級仍依大小寫給基本品質（iv → Fm7、bVII → Bbmaj7）', () => {
    expect(symbolsIn('iv bVII', 'C')).toEqual(['Fm7', 'Bbmaj7'])
  })

  it('副屬：C 大調 V/ii → A7、V/V → D7、V/IV → C7（品質固定屬七）', () => {
    expect(symbolsIn('V/ii V/V V/IV', 'C')).toEqual(['A7', 'D7', 'C7'])
    const token = parseProgression('V/ii')[0]
    expect(token?.quality).toBe('7')
    expect(token?.secondaryOf).toBe('2')
    expect(token?.degree).toBe('6')
  })

  it('副屬在其他調也正確：Eb 調 V/ii → C7', () => {
    expect(symbolsIn('V/ii', 'Eb')).toEqual(['C7'])
  })

  it('非法 token 丟 ProgressionSyntaxError 且 tokenIndex 正確', () => {
    const cases: [string, number][] = [
      ['ii V bogus vi', 2],
      ['ii V Xmaj7', 2],
      ['I IV #II', 2],
      ['ii ii/V', 1],
    ]
    for (const [input, index] of cases) {
      try {
        parseProgression(input)
        throw new Error(`expected "${input}" to throw`)
      } catch (error) {
        expect(error, input).toBeInstanceOf(ProgressionSyntaxError)
        expect((error as ProgressionSyntaxError).tokenIndex, input).toBe(index)
      }
    }
  })

  it('空輸入與非法數字簡寫直接報錯，不猜測', () => {
    expect(() => parseProgression('')).toThrow(ProgressionSyntaxError)
    expect(() => parseProgression('   ')).toThrow(ProgressionSyntaxError)
    expect(() => parseProgression('2580')).toThrow(ProgressionSyntaxError)
  })

  it('羅馬數字長短比對正確（IV 不會被讀成 I + V）', () => {
    expect(parseProgression('IV VII III VI II V I', 'triad').map((t) => t.degree))
      .toEqual(['4', '7', '3', '6', '2', '5', '1'])
  })
})

describe('realizeProgression', () => {
  it('12 調全展開：2516 的 symbol 序列', () => {
    const keys = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'B', 'E', 'A', 'D', 'G'] as const
    const realized = keys.map((key) => symbolsIn('2516', key).join(' '))
    expect(realized).toEqual([
      'Dm7 G7 Cmaj7 Am7',
      'Gm7 C7 Fmaj7 Dm7',
      'Cm7 F7 Bbmaj7 Gm7',
      'Fm7 Bb7 Ebmaj7 Cm7',
      'Bbm7 Eb7 Abmaj7 Fm7',
      'Ebm7 Ab7 Dbmaj7 Bbm7',
      'Abm7 Db7 Gbmaj7 Ebm7',
      'C#m7 F#7 Bmaj7 G#m7',
      'F#m7 B7 Emaj7 C#m7',
      'Bm7 E7 Amaj7 F#m7',
      'Em7 A7 Dmaj7 Bm7',
      'Am7 D7 Gmaj7 Em7',
    ])
  })

  it("degreeReference='key' 時 Fm 的 Ab 標為 b6（相對 C 調）", () => {
    const chord = realizeProgression(preset('iv', [1], 'triad'), {
      key: 'C', harmonyLevel: 'triad', degreeReference: 'key',
    })[0]?.chords[0]
    expect(chord?.symbol).toBe('Fm')
    expect(chord?.tones.map((t) => `${t.name}=${t.degree}`)).toEqual(['F=4', 'Ab=b6', 'C=1'])
  })

  it("degreeReference 預設為 chordRoot（Fm → 1 b3 5）", () => {
    const chord = realizeProgression(preset('iv', [1], 'triad'), { key: 'C', harmonyLevel: 'triad' })[0]?.chords[0]
    expect(chord?.tones.map((t) => t.degree)).toEqual(['1', 'b3', '5'])
  })

  it('0.5 小節：一小節容納兩個和弦', () => {
    const bars = realizeProgression(preset('ii V7 Imaj7', [0.5, 0.5, 1]), { key: 'C', harmonyLevel: 'seventh' })
    expect(bars).toHaveLength(2)
    expect(bars[0]?.chords.map((c) => c.symbol)).toEqual(['Dm7', 'G7'])
    expect(bars[1]?.chords.map((c) => c.symbol)).toEqual(['Cmaj7'])
  })

  it('barsPerChord 長度與和弦數不符時直接報錯', () => {
    expect(() => realizeProgression(preset('ii V7 Imaj7', [1, 1]), { key: 'C', harmonyLevel: 'seventh' }))
      .toThrow(ProgressionSyntaxError)
  })

  it('progressionBarCount 計算總小節數', () => {
    expect(progressionBarCount(preset('ii V7 Imaj7 vi', [0.5, 0.5, 1, 1]))).toBe(3)
    expect(progressionBarCount(preset('ii V7', [1, 1]))).toBe(2)
  })
})
