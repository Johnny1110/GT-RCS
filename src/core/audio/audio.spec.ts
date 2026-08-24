/**
 * 音訊層行為鎖定測試：ManualClock 驗證排程正確性（不需要真 AudioContext）。
 * 這組測試就是「click 不飄拍」的規格。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ManualClock } from './clock'
import { LookaheadScheduler } from './scheduler'
import { Transport } from './transport'
import { TickBus } from './tickBus'
import {
  TIME_SIGNATURES, isTicksPerBeat, resolveTimeSignature, timeSignatureKey, type TickEvent,
} from './types'

function setup() {
  const clock = new ManualClock()
  const scheduler = new LookaheadScheduler(clock, { lookaheadSec: 0.1, intervalMs: 0 })
  const transport = new Transport(clock, scheduler)
  const events: TickEvent[] = []
  transport.addTickListener((e) => events.push(e))
  return { clock, scheduler, transport, events }
}

describe('Transport + LookaheadScheduler', () => {
  let s: ReturnType<typeof setup>
  beforeEach(() => {
    s = setup()
  })

  it('120 BPM 四分音符 tick 間距為 0.5 秒，時間單調遞增', () => {
    s.transport.setBpm(120)
    s.transport.play()
    for (let i = 0; i < 20; i++) {
      s.clock.advance(0.1)
      s.scheduler.tick()
    }
    expect(s.events.length).toBeGreaterThanOrEqual(4)
    for (let i = 1; i < s.events.length; i++) {
      const dt = s.events[i]!.audioTime - s.events[i - 1]!.audioTime
      expect(dt).toBeCloseTo(0.5, 9)
    }
  })

  it('只排程 lookahead 視窗內的 tick（不會一次吐完未來）', () => {
    s.transport.setBpm(60)
    s.transport.play()
    s.scheduler.tick()
    // t=0、lookahead 0.1、首拍在 0.1：視窗內最多 1 個 tick
    expect(s.events.length).toBeLessThanOrEqual(1)
  })

  it('4/4 拍角色：小節首拍 accent、其餘 normal；bar/beat 計數正確', () => {
    s.transport.setBpm(240)
    s.transport.play()
    for (let i = 0; i < 30; i++) {
      s.clock.advance(0.25)
      s.scheduler.tick()
    }
    const first8 = s.events.slice(0, 8)
    expect(first8.map((e) => e.role)).toEqual([
      'accent', 'normal', 'normal', 'normal',
      'accent', 'normal', 'normal', 'normal',
    ])
    expect(first8.map((e) => e.bar)).toEqual([1, 1, 1, 1, 2, 2, 2, 2])
    expect(first8.map((e) => e.beat)).toEqual([1, 2, 3, 4, 1, 2, 3, 4])
  })

  it('細分 tick（16 分）標為 ghost，tick 計數 1..4', () => {
    s.transport.setTicksPerBeat(4)
    s.transport.setBpm(60)
    s.transport.play()
    for (let i = 0; i < 20; i++) {
      s.clock.advance(0.25)
      s.scheduler.tick()
    }
    const beat1 = s.events.slice(0, 4)
    expect(beat1.map((e) => e.role)).toEqual(['accent', 'ghost', 'ghost', 'ghost'])
    expect(beat1.map((e) => e.tick)).toEqual([1, 2, 3, 4])
  })

  it('setBpm 於下一個 tick 生效（不影響已排程的 tick）', () => {
    s.transport.setBpm(60)
    s.transport.play()
    for (let i = 0; i < 40; i++) {
      s.clock.advance(0.1)
      s.scheduler.tick()
      if (s.events.length === 2) s.transport.setBpm(120)
    }
    const dt01 = s.events[1]!.audioTime - s.events[0]!.audioTime
    const dtLater = s.events[4]!.audioTime - s.events[3]!.audioTime
    expect(dt01).toBeCloseTo(1.0, 9)
    expect(dtLater).toBeCloseTo(0.5, 9)
  })

  it('6/8：每小節 6 拍，第 1 拍 accent', () => {
    s.transport.setTimeSignature({ beats: 6, unit: 8 })
    s.transport.setBpm(240)
    s.transport.play()
    for (let i = 0; i < 30; i++) {
      s.clock.advance(0.25)
      s.scheduler.tick()
    }
    const first6 = s.events.slice(0, 6)
    expect(first6.map((e) => e.role)).toEqual([
      'accent', 'normal', 'normal', 'normal', 'normal', 'normal',
    ])
    expect(s.events[6]?.bar).toBe(2)
  })

  it('stop 後不再發 tick；重新 play 位置歸零', () => {
    s.transport.setBpm(120)
    s.transport.play()
    s.clock.advance(1)
    s.scheduler.tick()
    const countAfterStop = (s.transport.stop(), s.clock.advance(5), s.scheduler.tick(), s.events.length)
    s.transport.play()
    s.clock.advance(0.2)
    s.scheduler.tick()
    expect(s.events.length).toBeGreaterThan(countAfterStop)
    expect(s.events[countAfterStop]?.bar).toBe(1)
    expect(s.events[countAfterStop]?.beat).toBe(1)
  })
})

describe('TickBus（視覺同步）', () => {
  it('drainUpTo 只吐出已到時的 tick，順序保持', () => {
    const bus = new TickBus()
    const mk = (t: number): TickEvent => ({ audioTime: t, bar: 1, beat: 1, tick: 1, role: 'normal' })
    bus.push(mk(0.1))
    bus.push(mk(0.2))
    bus.push(mk(0.3))
    expect(bus.drainUpTo(0.25).map((e) => e.audioTime)).toEqual([0.1, 0.2])
    expect(bus.drainUpTo(0.25)).toEqual([])
    expect(bus.drainUpTo(0.35).map((e) => e.audioTime)).toEqual([0.3])
  })
})

describe('長時穩定性（PRD F1-3 驗收：10 分鐘無漂移）', () => {
  it('90 BPM 連續 10 分鐘，累積誤差 < 1ms 且拍距處處一致', () => {
    const s = setup()
    s.transport.setBpm(90)
    s.transport.play()
    // 模擬 10 分鐘：每 25ms 醒來一次（與正式排程 timer 同頻）
    for (let i = 0; i < 600 * 40; i++) {
      s.clock.advance(0.025)
      s.scheduler.tick()
    }
    const expectedInterval = 60 / 90
    expect(s.events.length).toBeGreaterThan(890)

    const first = s.events[0]!.audioTime
    const last = s.events[s.events.length - 1]!
    const drift = last.audioTime - (first + (s.events.length - 1) * expectedInterval)
    expect(Math.abs(drift)).toBeLessThan(0.001)

    for (let i = 1; i < s.events.length; i++) {
      expect(s.events[i]!.audioTime - s.events[i - 1]!.audioTime).toBeCloseTo(expectedInterval, 9)
    }
  })

  it('分頁被節流（長時間未醒來）後補排程不亂序，時間仍單調遞增', () => {
    const s = setup()
    s.transport.setBpm(120)
    s.transport.play()
    s.clock.advance(5) // 模擬背景分頁停擺 5 秒
    s.scheduler.tick()
    s.clock.advance(0.1)
    s.scheduler.tick()
    for (let i = 1; i < s.events.length; i++) {
      expect(s.events[i]!.audioTime).toBeGreaterThan(s.events[i - 1]!.audioTime)
      expect(s.events[i]!.bar * 10 + s.events[i]!.beat)
        .toBeGreaterThan(s.events[i - 1]!.bar * 10 + s.events[i - 1]!.beat)
    }
  })
})

describe('拍號表與驗證（持久化資料的防線）', () => {
  it('resolveTimeSignature 解析已知 key，未知值回退 4/4', () => {
    expect(resolveTimeSignature('6/8')).toEqual({ beats: 6, unit: 8 })
    expect(resolveTimeSignature('12/8')).toEqual({ beats: 12, unit: 8 })
    expect(resolveTimeSignature('7/16')).toEqual({ beats: 4, unit: 4 })
    expect(resolveTimeSignature('')).toEqual({ beats: 4, unit: 4 })
  })

  it('timeSignatureKey 反查；無對應回退 4/4', () => {
    expect(timeSignatureKey({ beats: 3, unit: 4 })).toBe('3/4')
    expect(timeSignatureKey({ beats: 6, unit: 8 })).toBe('6/8')
    expect(timeSignatureKey({ beats: 5, unit: 4 })).toBe('4/4')
  })

  it('每個拍號 key 與其 beats/unit 互為往返', () => {
    for (const [key, sig] of Object.entries(TIME_SIGNATURES)) {
      expect(timeSignatureKey(sig)).toBe(key)
      expect(resolveTimeSignature(key)).toEqual(sig)
    }
  })

  it('isTicksPerBeat 只接受 1/2/3/4', () => {
    expect([1, 2, 3, 4].every(isTicksPerBeat)).toBe(true)
    expect([0, 5, 1.5, '2', null, undefined].some(isTicksPerBeat)).toBe(false)
  })
})
