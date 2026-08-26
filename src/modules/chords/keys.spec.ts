import { describe, it, expect } from 'vitest'
import { parseNoteName } from '@/core/theory'
import { CIRCLE_MAJOR } from '@/components/CircleOfFifths/geometry'
import { PRACTICE_KEYS, isPracticeKey, toPracticeKey } from './keys'

describe('和弦線的調選項', () => {
  it('12 個調、無重複 pitch class', () => {
    expect(PRACTICE_KEYS).toHaveLength(12)
    expect(new Set(PRACTICE_KEYS.map((k) => parseNoteName(k).pc)).size).toBe(12)
  })

  it('isPracticeKey 擋掉竄改過的持久化值', () => {
    expect(isPracticeKey('Gb')).toBe(true)
    expect(isPracticeKey('H')).toBe(false)
    expect(isPracticeKey(7)).toBe(false)
    expect(isPracticeKey(undefined)).toBe(false)
  })

  it('五度圈上的每一個大調都換得回選單裡的拼寫', () => {
    for (const major of CIRCLE_MAJOR) {
      const key = toPracticeKey(major)
      expect(isPracticeKey(key), `${major} → ${key}`).toBe(true)
      expect(parseNoteName(key).pc, `${major} 換算後音高不同`).toBe(parseNoteName(major).pc)
    }
  })

  it('同音異名換成選單用的那一種（圈上 F#、選單 Gb）', () => {
    expect(toPracticeKey('F#')).toBe('Gb')
    expect(toPracticeKey('C')).toBe('C')
  })
})
