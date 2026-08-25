/**
 * 聲位的行為鎖定測試。
 * 「密集、落在中音域、換和弦時聲部就近移動」就是這個功能的規格。
 */
import { describe, it, expect } from 'vitest'
import { CHORD_FORMULAS } from './formulas'
import { spell } from './spelling'
import { MAX_VOICES, VOICING_CENTER, midiToFrequency, voiceChord } from './voicing'
import type { Note } from './types'

const chord = (root: Parameters<typeof spell>[0], quality: keyof typeof CHORD_FORMULAS): Note[] =>
  spell(root, CHORD_FORMULAS[quality])

describe('voiceChord', () => {
  it('原位：由低到高遞增，且每個和弦音都在（三和弦 3 個聲部）', () => {
    const voices = voiceChord(chord('C', 'maj'))
    expect(voices).toHaveLength(3)
    expect([...voices].sort((a, b) => a - b)).toEqual(voices)
    expect(voices.map((m) => m % 12)).toEqual([0, 4, 7])
  })

  it('密集聲位：全部聲部落在一個八度多一點的範圍內', () => {
    for (const quality of ['maj', 'm7', '7', 'maj7', 'm7b5'] as const) {
      const voices = voiceChord(chord('C', quality))
      const span = voices[voices.length - 1]! - voices[0]!
      expect(span, quality).toBeLessThanOrEqual(12)
    }
  })

  it('落在中音域：重心貼近 C4，不會跑到聽不見的低音或刺耳的高音', () => {
    for (const root of ['C', 'F#', 'Bb', 'A'] as const) {
      const voices = voiceChord(chord(root, 'maj7'))
      const centroid = voices.reduce((s, m) => s + m, 0) / voices.length
      expect(Math.abs(centroid - VOICING_CENTER), root).toBeLessThanOrEqual(8)
    }
  })

  it('聲部不夠時先丟五音而不是延伸音（C13 四聲部＝1-3-b7-13）', () => {
    const thirteenth = chord('C', '13') // 1 3 5 b7 9 13 —— 六個音取四個
    const degrees = voiceChord(thirteenth, { maxVoices: 4 }).map((m) => m % 12)
    expect(degrees).toContain(0) // 根音
    expect(degrees).toContain(4) // 3 音
    expect(degrees).toContain(10) // b7
    expect(degrees).toContain(9) // 13 —— 這個和弦之所以叫 13 的原因
    expect(degrees).not.toContain(7) // 5 音最不帶顏色，先丟它
  })

  it('sus4 的四音與三音同級（它是和弦身分，不是裝飾）', () => {
    const degrees = voiceChord(chord('C', 'sus4'), { maxVoices: 2 }).map((m) => m % 12)
    expect(degrees).toEqual([0, 5])
  })

  it('聲部數可調，且硬夾在 2–6（手機複音數上限）', () => {
    const tones = chord('C', '13')
    expect(voiceChord(tones, { maxVoices: 2 })).toHaveLength(2)
    expect(voiceChord(tones, { maxVoices: 99 })).toHaveLength(MAX_VOICES)
    expect(voiceChord(tones, { maxVoices: 0 })).toHaveLength(2)
  })

  it('聲部連接：C → F 的總移動距離小於直接跳回 F 原位', () => {
    const cmaj = voiceChord(chord('C', 'maj7'))
    const led = voiceChord(chord('F', 'maj7'), { previous: cmaj })
    const rootPosition = voiceChord(chord('F', 'maj7'))

    const travel = (voices: number[]): number =>
      voices.reduce((sum, p) => sum + Math.min(...cmaj.map((q) => Math.abs(p - q))), 0)

    expect(travel(led)).toBeLessThan(travel(rootPosition))
    // 就近移動不是「不動」：和弦真的換了
    expect(led.map((m) => m % 12).sort()).not.toEqual(cmaj.map((m) => m % 12).sort())
  })

  it('走一遍 2-5-1，每次換和弦的最大單一聲部移動不超過大三度', () => {
    const progression = [chord('D', 'm7'), chord('G', '7'), chord('C', 'maj7')]
    let previous: number[] = []
    for (const tones of progression) {
      const voices = voiceChord(tones, previous.length ? { previous } : {})
      if (previous.length) {
        for (const pitch of voices) {
          const nearest = Math.min(...previous.map((q) => Math.abs(pitch - q)))
          expect(nearest).toBeLessThanOrEqual(4)
        }
      }
      previous = voices
    }
  })

  it('聲位不會逐次往上飄（連續 12 個和弦後重心仍在中音域）', () => {
    let previous: number[] = []
    for (let i = 0; i < 12; i++) {
      const root = (['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'] as const)[i]!
      previous = voiceChord(chord(root, 'maj7'), { previous })
    }
    const centroid = previous.reduce((s, m) => s + m, 0) / previous.length
    expect(Math.abs(centroid - VOICING_CENTER)).toBeLessThanOrEqual(8)
  })

  it('空和弦不炸', () => {
    expect(voiceChord([])).toEqual([])
  })
})

describe('midiToFrequency', () => {
  it('A4 = MIDI 69 = 440Hz，八度為兩倍頻', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 6)
    expect(midiToFrequency(81)).toBeCloseTo(880, 6)
    expect(midiToFrequency(60)).toBeCloseTo(261.626, 3)
  })
})
