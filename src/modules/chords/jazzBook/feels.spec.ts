/**
 * Feel 表的防線：click 與 comp 是兩張格子，**只要有一張對不齊網格，
 * comping 就會敲在不存在的格子上**——而症狀是「某些拍子的和弦沒響」，很難查。
 */
import { describe, expect, it } from 'vitest'
import { BPM_MAX, BPM_MIN, SWING_MAX, SWING_MIN } from '@/core/audio'
import { FEELS, findFeel, isFeelId, resolveFeel } from './feels'

describe('feel 表', () => {
  it('id 唯一', () => {
    expect(new Set(FEELS.map((f) => f.id)).size).toBe(FEELS.length)
  })

  it('click 的每一小節格數 = 拍數 × 細分', () => {
    for (const feel of FEELS) {
      const expected = feel.timeSig.beats * feel.ticksPerBeat
      for (const bar of feel.click.bars) expect(bar.length, feel.id).toBe(expected)
    }
  })

  it('comp 與 click 對齊同一個網格', () => {
    for (const feel of FEELS) {
      const expected = feel.timeSig.beats * feel.ticksPerBeat
      expect(feel.comp.length, feel.id).toBeGreaterThan(0)
      for (const bar of feel.comp) expect(bar.length, feel.id).toBe(expected)
    }
  })

  it('每個 feel 的 click 與 comp 都至少有一個發聲格', () => {
    for (const feel of FEELS) {
      expect(feel.click.bars.flat().some((c) => c !== 'rest'), `${feel.id} click`).toBe(true)
      expect(feel.comp.flat().some((c) => c !== 'rest'), `${feel.id} comp`).toBe(true)
    }
  })

  it('速度區間合法且落在 Transport 的範圍內', () => {
    for (const feel of FEELS) {
      const { min, default: fallback, max } = feel.bpm
      expect(min, feel.id).toBeGreaterThanOrEqual(BPM_MIN)
      expect(max, feel.id).toBeLessThanOrEqual(BPM_MAX)
      expect(min, feel.id).toBeLessThanOrEqual(fallback)
      expect(fallback, feel.id).toBeLessThanOrEqual(max)
      expect(feel.click.defaultBpm, feel.id).toBe(fallback)
    }
  })

  it('swing 在合法範圍內，且 click 與 feel 一致', () => {
    for (const feel of FEELS) {
      expect(feel.swing, feel.id).toBeGreaterThanOrEqual(SWING_MIN)
      expect(feel.swing, feel.id).toBeLessThanOrEqual(SWING_MAX)
      expect(feel.click.swing, feel.id).toBe(feel.swing)
    }
  })

  it('不認得的 feel 一律回退，不丟例外（持久化與曲譜都是不可信輸入）', () => {
    expect(findFeel('nope')).toBeUndefined()
    expect(resolveFeel('nope').id).toBe('mediumSwing')
    expect(resolveFeel(undefined).id).toBe('mediumSwing')
    expect(isFeelId('bossa')).toBe(true)
    expect(isFeelId('nope')).toBe(false)
  })

  it('Jazz Waltz 是唯一的三拍子', () => {
    expect(FEELS.filter((f) => f.timeSig.beats === 3).map((f) => f.id)).toEqual(['jazzWaltz'])
  })
})
