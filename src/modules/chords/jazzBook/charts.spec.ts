/**
 * 曲庫的防線。
 *
 * 兩種錯誤這裡各擋一種：
 * 1. **樂理**：某一首在某個調拼不出來（Gb 調的借用和弦會用到重降記號）
 * 2. **法律**：公版曲的收錄門檻寫成測試——出版年晚於界線的曲子不得進 repo。
 *    這一條與 ads.spec 是同一種做法：要放寬就得先改測試，那一刻就會有人問「為什麼」。
 */
import { describe, expect, it } from 'vitest'
import { expandForm, formBarCount, sectionSpans } from '@/core/theory'
import { DESCENDING_FIFTHS } from '@/components/CircleOfFifths/geometry'
import { BUILT_IN_CHARTS, CHART_GROUPS, DRILL_CHARTS, STANDARD_CHARTS, findChart } from './charts'
import { findFeel, resolveFeel } from './feels'

/**
 * 公版界線：美國以「1930 年（含）以前出版」為準（截至 2026 年）。
 * 屬地不同時取最保守者；有疑義的一律不進 repo，留給使用者自行輸入。
 */
const PUBLIC_DOMAIN_CUTOFF = 1930

function optionsFor(chart: (typeof BUILT_IN_CHARTS)[number], key: (typeof DESCENDING_FIFTHS)[number]) {
  return { key, harmonyLevel: chart.harmonyLevel, beatsPerBar: resolveFeel(chart.feel).timeSig.beats }
}

describe('曲庫', () => {
  it('id 全站唯一', () => {
    const ids = BUILT_IN_CHARTS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('每一首都能在 12 個調展開，且和弦名不含未解析的記號', () => {
    for (const chart of BUILT_IN_CHARTS) {
      for (const key of DESCENDING_FIFTHS) {
        const bars = expandForm(chart, optionsFor(chart, key))
        expect(bars.length, `${chart.id} in ${key}`).toBe(formBarCount(chart))
        for (const bar of bars) {
          for (const { chord } of bar.chords) {
            expect(chord.symbol, `${chart.id} in ${key}`).toMatch(/^[A-G](#|##|b|bb)?[a-zA-Z0-9/#]*$/)
          }
        }
      }
    }
  })

  it('form 引用的段落都有定義，且每一段至少一小節', () => {
    for (const chart of BUILT_IN_CHARTS) {
      const labels = new Set(chart.sections.map((s) => s.label))
      for (const label of chart.form) expect(labels.has(label), `${chart.id}: ${label}`).toBe(true)
      for (const span of sectionSpans(chart)) expect(span.bars, `${chart.id}: ${span.label}`).toBeGreaterThan(0)
    }
  })

  it('每一首的 feel 都存在於 feel 表', () => {
    for (const chart of BUILT_IN_CHARTS) {
      expect(findFeel(chart.feel), chart.id).toBeDefined()
    }
  })

  it('形式練習不帶作者資訊（它們不對應任何特定樂曲）', () => {
    for (const chart of DRILL_CHARTS) expect(chart.origin.kind, chart.id).toBe('drill')
  })

  it('公版曲一律標作者與出版年，且出版年不晚於公版界線', () => {
    for (const chart of STANDARD_CHARTS) {
      expect(chart.origin.kind, chart.id).toBe('public-domain')
      if (chart.origin.kind !== 'public-domain') continue
      expect(chart.origin.composer.trim(), chart.id).not.toBe('')
      expect(chart.origin.firstPublished, `${chart.id} 出版年超過公版界線`)
        .toBeLessThanOrEqual(PUBLIC_DOMAIN_CUTOFF)
    }
  })

  it('分組涵蓋全部曲目', () => {
    expect(CHART_GROUPS.flatMap((g) => g.charts)).toHaveLength(BUILT_IN_CHARTS.length)
  })

  it('小節數：曲式是不是它宣稱的那個長度', () => {
    const bars = (id: string) => formBarCount(findChart(id)!)
    expect(bars('jazz-blues')).toBe(12)
    expect(bars('bird-blues')).toBe(12)
    expect(bars('minor-blues')).toBe(12)
    expect(bars('rhythm-a')).toBe(8)
    expect(bars('rhythm-bridge')).toBe(8)
    expect(bars('rhythm-full')).toBe(32)
    expect(bars('aaba-32')).toBe(32)
    expect(bars('sweet-georgia-brown')).toBe(32)
  })

  it('抽樣：爵士藍調在 F 調的每一小節', () => {
    const chart = findChart('jazz-blues')!
    const bars = expandForm(chart, optionsFor(chart, 'F'))
    expect(bars.map((b) => b.chords.map((c) => c.chord.symbol).join(' '))).toEqual([
      'F7', 'Bb7', 'F7', 'Cm7 F7', 'Bb7', 'Bdim7', 'F7', 'D7', 'Gm7', 'C7', 'F7 D7', 'Gm7 C7',
    ])
  })

  it('抽樣：Rhythm Changes 的 A 段與橋段（Bb 調）', () => {
    const a = findChart('rhythm-a')!
    expect(expandForm(a, optionsFor(a, 'Bb')).map((b) => b.chords.map((c) => c.chord.symbol).join(' '))).toEqual([
      'Bb6 Gm7', 'Cm7 F7', 'Dm7 G7', 'Cm7 F7', 'Ebmaj7', 'Ebm6', 'Bb6 G7', 'Cm7 F7',
    ])
    const bridge = findChart('rhythm-bridge')!
    expect(expandForm(bridge, optionsFor(bridge, 'Bb')).map((b) => b.chords[0]!.chord.symbol)).toEqual([
      'D7', 'D7', 'G7', 'G7', 'C7', 'C7', 'F7', 'F7',
    ])
  })

  it('抽樣：大三度循環走完一圈回到出發點（C 調）', () => {
    const chart = findChart('major-thirds')!
    expect(expandForm(chart, optionsFor(chart, 'C')).map((b) => b.chords.map((c) => c.chord.symbol).join(' ')))
      .toEqual(['Cmaj7 Eb7', 'Abmaj7 B7', 'Emaj7 G7', 'Cmaj7'])
  })

  it('抽樣：小調 2-5-1 用到新補的 7b9 與 mMaj7', () => {
    const chart = findChart('minor-251')!
    expect(expandForm(chart, optionsFor(chart, 'A')).map((b) => b.chords[0]!.chord.symbol))
      .toEqual(['Bm7b5', 'E7b9', 'AmMaj7', 'AmMaj7'])
  })
})
