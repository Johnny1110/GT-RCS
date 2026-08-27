/**
 * 曲譜文字記法的防線。
 *
 * 這一層的價值全在**錯誤訊息指得準不準**：使用者輸入 32 小節，錯一格若只說
 * 「解析失敗」等於沒說。所以每一種語法錯誤都測 barIndex／line，不只測有丟例外。
 */
import { describe, expect, it } from 'vitest'
import { ChartTextError, chartBarCount, formatChartText, parseChartBars, parseChartText } from './chartText'

describe('parseChartBars', () => {
  it('以小節線切小節，首尾的 | 只是分隔符不是空小節', () => {
    expect(parseChartBars('| I | V | I |')).toHaveLength(3)
    expect(parseChartBars('I | V | I')).toHaveLength(3)
    expect(chartBarCount('| I | V | I |')).toBe(3)
  })

  it('一小節內以空白分隔的和弦平分該小節', () => {
    const bars = parseChartBars('| I6 vim7 | iim7 V7 | IVmaj7 |')
    expect(bars[0]?.tokens).toEqual(['I6', 'vim7'])
    expect(bars[2]?.tokens).toEqual(['IVmaj7'])
  })

  it('% 複製前一小節', () => {
    const bars = parseChartBars('| iim7 V7 | % | I |')
    expect(bars[1]?.tokens).toEqual(['iim7', 'V7'])
  })

  it('% 不能是第一小節（沒有東西可以複製）', () => {
    expect(() => parseChartBars('| % | I |')).toThrow(ChartTextError)
  })

  it('% 不能與其他和弦混寫', () => {
    expect(() => parseChartBars('| I | % V7 |')).toThrow(/only symbol/i)
  })

  it('空小節是錯誤，不當成「延續前一個和弦」', () => {
    // 猜測會讓打錯的譜安靜地變成別的曲子——寧可報錯
    const error = catchChartError(() => parseChartBars('| I |  | V |'))
    expect(error?.barIndex).toBe(1)
  })

  it('一小節超過 4 個和弦視為漏打小節線', () => {
    const error = catchChartError(() => parseChartBars('| I ii iii IV V |'))
    expect(error?.barIndex).toBe(0)
    expect(error?.message).toMatch(/bar line/)
  })

  it('和弦本身的錯字在解析期就爆，而且指得出第幾小節', () => {
    const error = catchChartError(() => parseChartBars('| I | V7 | Xyz | I |'))
    expect(error?.barIndex).toBe(2)
  })

  it('沒有任何小節 → 錯誤', () => {
    expect(() => parseChartBars('')).toThrow(ChartTextError)
    expect(() => parseChartBars('||')).toThrow(ChartTextError)
  })
})

const FULL = [
  'title: Rhythm Changes',
  'key: Bb',
  'feel: mediumSwing',
  'form: A B',
  'A: | I6 vim7 | iim7 V7 |',
  'B: | V/vi | % |',
].join('\n')

describe('parseChartText', () => {
  it('讀出標頭與段落', () => {
    const draft = parseChartText(FULL)
    expect(draft.title).toBe('Rhythm Changes')
    expect(draft.homeKey).toBe('Bb')
    expect(draft.feel).toBe('mediumSwing')
    expect(draft.form).toEqual(['A', 'B'])
    expect(draft.sections.map((s) => s.label)).toEqual(['A', 'B'])
  })

  it('省略 form 時依段落定義順序展開', () => {
    const draft = parseChartText('key: C\nA: | I |\nB: | V |')
    expect(draft.form).toEqual(['A', 'B'])
  })

  it('form 指到不存在的段落 → 錯誤（拼錯段名不該安靜地少一段）', () => {
    expect(() => parseChartText('key: C\nform: A C\nA: | I |')).toThrow(/undefined section/)
  })

  it('缺 key、重複段落、重複標頭都報錯並帶行號', () => {
    expect(() => parseChartText('A: | I |')).toThrow(/Missing "key/)
    expect(catchChartError(() => parseChartText('key: C\nA: | I |\nA: | V |'))?.line).toBe(3)
    expect(catchChartError(() => parseChartText('key: C\nkey: D\nA: | I |'))?.line).toBe(2)
  })

  it('不認得的調直接拒絕，不猜', () => {
    expect(() => parseChartText('key: H\nA: | I |')).toThrow(/Unknown key/)
  })

  it('# 開頭是註解，空行忽略', () => {
    const draft = parseChartText('# 我的譜\n\nkey: C\nA: | I |')
    expect(draft.sections).toHaveLength(1)
  })

  it('feel 不在這一層驗證（core 不認識模組的 feel 清單）', () => {
    expect(parseChartText('key: C\nfeel: whatever\nA: | I |').feel).toBe('whatever')
  })

  it('formatChartText 與 parseChartText 互為反向（round-trip）', () => {
    const draft = parseChartText(FULL)
    const again = parseChartText(formatChartText(draft))
    expect(again).toEqual(draft)
  })
})

function catchChartError(fn: () => unknown): ChartTextError | null {
  try {
    fn()
    return null
  } catch (error) {
    return error instanceof ChartTextError ? error : null
  }
}
