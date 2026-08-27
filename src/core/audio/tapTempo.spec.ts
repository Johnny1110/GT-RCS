/**
 * TapTempo 行為鎖定（core 層）。
 * 敲擊時刻是傳進來的純資料，所以「人手不準」的每一種情況都寫得出測試。
 */
import { describe, expect, it } from 'vitest'
import { BPM_MAX, BPM_MIN } from './types'
import { TAP_MIN_TAPS, TAP_TIMEOUT_SECONDS, TapTempo } from './tapTempo'

/** 依序敲擊，回傳最後一次的結果 */
function tapAll(tempo: TapTempo, times: readonly number[]) {
  let result = tempo.tap(times[0]!)
  for (const t of times.slice(1)) result = tempo.tap(t)
  return result
}

describe('TapTempo', () => {
  it('第一下算不出 BPM——一下不構成間隔', () => {
    const tempo = new TapTempo()
    expect(tempo.tap(10)).toEqual({ taps: 1, bpm: null })
  })

  it('第二下就給得出 BPM（TAP_MIN_TAPS = 2）', () => {
    const tempo = new TapTempo()
    const result = tapAll(tempo, [0, 0.5])
    expect(TAP_MIN_TAPS).toBe(2)
    expect(result.taps).toBe(2)
    expect(result.bpm).toBe(120)
  })

  it('等間隔敲擊算出對應的 BPM', () => {
    for (const [interval, bpm] of [[1, 60], [0.5, 120], [0.75, 80], [0.6, 100]] as const) {
      const tempo = new TapTempo()
      const times = [0, interval, interval * 2, interval * 3, interval * 4]
      expect(tapAll(tempo, times).bpm).toBe(bpm)
    }
  })

  it('取平均而不是取最後一次間隔：一次手抖不會讓數字跟著跳', () => {
    const tempo = new TapTempo()
    // 穩定 0.5s，最後一下早了 0.1s。只看最後一段會得到 150 BPM
    const result = tapAll(tempo, [0, 0.5, 1.0, 1.5, 1.9])
    expect(60 / 0.4).toBeCloseTo(150)
    expect(result.bpm).toBeLessThan(150)
    expect(result.bpm).toBeGreaterThan(120)
  })

  it('只平均最近 window 次間隔：使用者加速時數字追得上手', () => {
    const tempo = new TapTempo({ window: 2 })
    // 前段 1s（60），後段 0.5s（120）。視窗 2 只看後面兩個間隔
    expect(tapAll(tempo, [0, 1, 2, 2.5, 3]).bpm).toBe(120)
  })

  it('間隔超過 timeout 就重新起算，不會把停頓算成一個超慢的間隔', () => {
    const tempo = new TapTempo()
    tapAll(tempo, [0, 0.5, 1.0])
    const afterPause = tempo.tap(1.0 + TAP_TIMEOUT_SECONDS + 0.01)
    expect(afterPause).toEqual({ taps: 1, bpm: null })
  })

  it('重新起算後，新的敲擊序列不受舊間隔汙染', () => {
    const tempo = new TapTempo()
    tapAll(tempo, [0, 1, 2]) // 60 BPM
    const restart = 2 + TAP_TIMEOUT_SECONDS + 1
    expect(tapAll(tempo, [restart, restart + 0.5, restart + 1]).bpm).toBe(120)
  })

  it('時間倒退（換分頁、系統校時）視同重新開始，不產生負間隔', () => {
    const tempo = new TapTempo()
    tapAll(tempo, [10, 10.5])
    expect(tempo.tap(5)).toEqual({ taps: 1, bpm: null })
  })

  it('同一時刻重複觸發不會除以零', () => {
    const tempo = new TapTempo()
    tempo.tap(3)
    expect(tempo.tap(3)).toEqual({ taps: 1, bpm: null })
  })

  it('敲得過快或過慢一律夾在 BPM_MIN–BPM_MAX', () => {
    const fast = new TapTempo()
    expect(tapAll(fast, [0, 0.05, 0.1]).bpm).toBe(BPM_MAX)

    // 略短於 timeout 的間隔＝略高於 30 BPM，仍在合法範圍內
    const slow = new TapTempo()
    const gap = TAP_TIMEOUT_SECONDS - 0.001
    expect(tapAll(slow, [0, gap, gap * 2]).bpm).toBeGreaterThanOrEqual(BPM_MIN)
  })

  it('reset() 之後從頭起算', () => {
    const tempo = new TapTempo()
    tapAll(tempo, [0, 0.5, 1])
    expect(tempo.taps).toBe(3)
    tempo.reset()
    expect(tempo.taps).toBe(0)
    expect(tempo.tap(1.2)).toEqual({ taps: 1, bpm: null })
  })

  it('taps 計數與回傳值一致，UI 才能顯示「再敲 N 下」', () => {
    const tempo = new TapTempo()
    expect(tempo.tap(0).taps).toBe(1)
    expect(tempo.taps).toBe(1)
    expect(tempo.tap(0.5).taps).toBe(2)
    expect(tempo.taps).toBe(2)
  })
})
