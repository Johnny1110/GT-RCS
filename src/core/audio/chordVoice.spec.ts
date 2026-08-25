/**
 * 和弦示範音的行為鎖定測試。
 * PRD F5-1 寫死的數字（頻段錯開、錯開時間、複音上限、預設 off）是規格，不是實作細節。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { RecordingAudioContext } from '@/test/audioContextStub'
import { CHORD_DEMO_MODES, NullChordVoice, SynthChordVoice, isChordDemoMode, type ChordVoice } from './chordVoice'

/** C maj7 的中音域聲位 */
const CHORD = [60, 64, 67, 71]
const BAR = 2 // 秒

describe('SynthChordVoice', () => {
  let ctx: RecordingAudioContext
  let voice: SynthChordVoice

  beforeEach(() => {
    ctx = new RecordingAudioContext()
    voice = new SynthChordVoice(ctx as unknown as AudioContext)
  })

  it('預設 off：不主動加東西到使用者耳朵裡', () => {
    voice.play(CHORD, 1, BAR)
    expect(ctx.oscillators).toHaveLength(0)
  })

  it('音量 0 等同不發聲（不是發出無聲的 oscillator）', () => {
    voice.setMode('pad')
    voice.setVolume(0)
    voice.play(CHORD, 1, BAR)
    expect(ctx.oscillators).toHaveLength(0)
  })

  it('pad 的低通壓在 click 頻段（1kHz 以上）之下——兩者在手機喇叭上才分得開', () => {
    voice.setMode('pad')
    voice.play(CHORD, 1, BAR)
    expect(ctx.oscillators).toHaveLength(CHORD.length)
    for (const osc of ctx.oscillators) {
      expect(osc.lowpass).not.toBeNull()
      expect(osc.lowpass!).toBeLessThan(1000)
    }
  })

  it('pad 同時發聲並撐滿整個小節', () => {
    voice.setMode('pad')
    voice.play(CHORD, 1, BAR)
    const starts = ctx.oscillators.map((o) => o.startedAt)
    expect(new Set(starts).size).toBe(1)
    const last = ctx.oscillators[0]!.envelope.at(-1)!
    expect(last.time - starts[0]!).toBeGreaterThanOrEqual(BAR)
  })

  it('strum 的音符錯開 10–20ms，由低音往高音', () => {
    voice.setMode('strum')
    voice.play(CHORD, 1, BAR)
    const starts = ctx.oscillators.map((o) => o.startedAt)
    expect(starts).toHaveLength(CHORD.length)
    for (let i = 1; i < starts.length; i++) {
      const gap = starts[i]! - starts[i - 1]!
      expect(gap).toBeGreaterThanOrEqual(0.01)
      expect(gap).toBeLessThanOrEqual(0.02)
    }
    // 低音先響：頻率遞增
    expect(ctx.oscillators.map((o) => Math.round(o.frequency))).toEqual(
      [...ctx.oscillators.map((o) => Math.round(o.frequency))].sort((a, b) => a - b),
    )
  })

  it('strum 音量低於 pad（有起音，更容易蓋掉拍點）', () => {
    voice.setMode('pad')
    voice.play(CHORD, 1, BAR)
    const padPeak = Math.max(...ctx.oscillators[0]!.envelope.map((e) => e.value))

    const strumCtx = new RecordingAudioContext()
    const strum = new SynthChordVoice(strumCtx as unknown as AudioContext)
    strum.setMode('strum')
    strum.play(CHORD, 1, BAR)
    const strumPeak = Math.max(...strumCtx.oscillators[0]!.envelope.map((e) => e.value))

    expect(strumPeak).toBeLessThan(padPeak)
  })

  it('strum 不會拖過小節線（下一個和弦不會疊在上一個上面）', () => {
    voice.setMode('strum')
    const short = 0.4
    voice.play(CHORD, 1, short)
    for (const osc of ctx.oscillators) {
      expect(osc.envelope.at(-1)!.time - osc.startedAt).toBeLessThanOrEqual(short + 0.001)
    }
  })

  it('複音數硬夾在 6（行動裝置效能）', () => {
    voice.setMode('pad')
    voice.play([48, 52, 55, 59, 62, 65, 69, 72], 1, BAR)
    expect(ctx.oscillators).toHaveLength(6)
  })

  it('MIDI 音高換算成正確頻率（A4 = 440Hz）', () => {
    voice.setMode('pad')
    voice.play([69], 1, BAR)
    expect(ctx.oscillators[0]!.frequency).toBeCloseTo(440, 6)
  })

  it('排程時刻已過就立刻發聲，不排到過去（分頁被節流後回來）', () => {
    ctx.currentTime = 10
    voice.setMode('pad')
    voice.play(CHORD, 1, BAR)
    expect(ctx.oscillators[0]!.startedAt).toBe(10)
  })

  it('stopAll 把還在響的音收掉（按停止之後 pad 不該拖一個小節）', () => {
    voice.setMode('pad')
    voice.play(CHORD, 1, BAR)
    const scheduled = ctx.oscillators.map((o) => o.stoppedAt)
    voice.stopAll()
    expect(ctx.oscillators.every((o) => o.stoppedAt === null)).toBe(true)
    expect(scheduled.every((t) => t !== null)).toBe(true)
  })

  it('切回 off 也會收掉正在響的音', () => {
    voice.setMode('pad')
    voice.play(CHORD, 1, BAR)
    voice.setMode('off')
    expect(ctx.oscillators.every((o) => o.stoppedAt === null)).toBe(true)
  })

  it('空和弦不炸', () => {
    voice.setMode('pad')
    voice.play([], 1, BAR)
    expect(ctx.oscillators).toHaveLength(0)
  })
})

describe('ChordDemoMode', () => {
  it('三種模式，off 為第一個（預設）', () => {
    expect(CHORD_DEMO_MODES).toEqual(['off', 'pad', 'strum'])
  })

  it('isChordDemoMode 擋掉持久化資料裡的垃圾', () => {
    expect(isChordDemoMode('pad')).toBe(true)
    expect(isChordDemoMode('PAD')).toBe(false)
    expect(isChordDemoMode(undefined)).toBe(false)
  })

  it('NullChordVoice 全部是 no-op（測試 / SSR）', () => {
    const voice: ChordVoice = new NullChordVoice()
    expect(() => {
      voice.play([60], 0, 1)
      voice.setMode('pad')
      voice.setVolume(1)
      voice.stopAll()
    }).not.toThrow()
  })
})
