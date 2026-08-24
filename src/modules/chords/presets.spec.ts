/**
 * Preset 資料的防線：每個進行都必須在 12 個調展開成功。
 * 這裡最容易出錯的是拼寫（Gb 調的借用和弦會用到重降記號）與
 * barsPerChord 長度對不上 token 數，兩者都會在此爆出來。
 */
import { describe, it, expect } from 'vitest'
import { parseProgression, progressionBarCount, realizeProgression } from '@/core/theory'
import { DESCENDING_FIFTHS } from '@/components/CircleOfFifths/geometry'
import { CIRCLE_PROGRESSIONS, PRACTICE_LEVELS, findCircleProgression, findLevel } from './presets'

const ALL_PRESETS = [
  ...CIRCLE_PROGRESSIONS,
  ...PRACTICE_LEVELS.flatMap((level) => level.progressions),
]

describe('progression presets', () => {
  it('每個 preset 的 barsPerChord 長度等於和弦數', () => {
    for (const preset of ALL_PRESETS) {
      expect(parseProgression(preset.tokens, preset.harmonyLevel).length, preset.id)
        .toBe(preset.barsPerChord.length)
    }
  })

  it('每個 preset 都能在 12 個調展開，且和弦名不含未解析的記號', () => {
    for (const preset of ALL_PRESETS) {
      for (const key of DESCENDING_FIFTHS) {
        const bars = realizeProgression(preset, { key, harmonyLevel: preset.harmonyLevel })
        const symbols = bars.flatMap((bar) => bar.chords.map((chord) => chord.symbol))
        expect(symbols.length, `${preset.id} in ${key}`).toBeGreaterThan(0)
        for (const symbol of symbols) {
          expect(symbol, `${preset.id} in ${key}`).toMatch(/^[A-G](#|##|b|bb)?[a-zA-Z0-9]*$/)
        }
      }
    }
  })

  it('id 全站唯一', () => {
    const ids = ALL_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('12 小節藍調確實是 12 小節', () => {
    const blues = findCircleProgression('blues12')
    expect(blues).toBeDefined()
    expect(progressionBarCount(blues!)).toBe(12)
  })

  it('分級課表由淺入深，每級至少 3 個進行', () => {
    expect(PRACTICE_LEVELS).toHaveLength(5)
    for (const level of PRACTICE_LEVELS) {
      expect(level.progressions.length, level.id).toBeGreaterThanOrEqual(3)
    }
    expect(findLevel('level1')?.progressions[0]?.harmonyLevel).toBe('triad')
    expect(findLevel('level3')?.progressions[0]?.harmonyLevel).toBe('seventh')
  })

  it('C 調抽樣：借用與副屬的和弦名正確', () => {
    const check = (id: string, expected: string[]) => {
      const preset = ALL_PRESETS.find((p) => p.id === id)
      expect(preset, id).toBeDefined()
      const symbols = realizeProgression(preset!, { key: 'C', harmonyLevel: preset!.harmonyLevel })
        .flatMap((bar) => bar.chords.map((c) => c.symbol))
      expect(symbols, id).toEqual(expected)
    }
    check('l5-borrowed', ['Cmaj7', 'Fm7', 'Cmaj7', 'Cmaj7'])
    check('l5-bVII', ['Cmaj7', 'Bbmaj7', 'Fmaj7', 'Cmaj7'])
    check('l5-secondary', ['Cmaj7', 'A7', 'Dm7', 'G7'])
    check('l5-neosoul', ['Cmaj9', 'Am9', 'Dm9', 'G7'])
    check('l2-diatonic', ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim', 'C'])
  })
})
