import { describe, it, expect } from 'vitest'
import { COUNT_STYLES, countToken, isCountStyle } from './counting'

describe('節奏譜計數', () => {
  it('16 分：1 e & a', () => {
    expect([1, 2, 3, 4].map((t) => countToken(t, 4))).toEqual(['beat', 'e', 'and', 'a'])
  })

  it('8 分：1 &；三連音：1 trip let；正拍只有拍數', () => {
    expect([1, 2].map((t) => countToken(t, 2))).toEqual(['beat', 'and'])
    expect([1, 2, 3].map((t) => countToken(t, 3))).toEqual(['beat', 'trip', 'let'])
    expect(countToken(1, 1)).toBe('beat')
  })

  it('每種細分的第一格都是 beat（計數列的拍首必定加重）', () => {
    for (const tpb of [1, 2, 3, 4] as const) expect(countToken(1, tpb)).toBe('beat')
  })

  it('超出範圍的 tick 回退為 beat，不會印出空白', () => {
    expect(countToken(9, 2)).toBe('beat')
    expect(countToken(0, 4)).toBe('beat')
  })

  it('isCountStyle 只接受兩種計數法', () => {
    expect(COUNT_STYLES.every(isCountStyle)).toBe(true)
    expect(['', 'zh', null].some(isCountStyle)).toBe(false)
  })
})
