/**
 * 測試用最小 AudioContext（happy-dom 沒有 Web Audio）。
 * 只實作 SynthClickVoice 與 WebAudioClock 實際會呼叫的介面，
 * 讓 transport 的真實路徑（含 rAF 迴圈）能在單元測試中跑起來。
 */
import { vi } from 'vitest'

function node(): Record<string, unknown> {
  const self = {
    connect: (target: unknown) => target,
    disconnect: () => undefined,
    gain: { value: 0, setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
    frequency: { value: 0, setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
    type: 'sine',
    start: () => undefined,
    stop: () => undefined,
  }
  return self
}

export class FakeAudioContext {
  currentTime = 0
  state: AudioContextState = 'running'
  destination = node()
  createGain = () => node()
  createOscillator = () => node()
  createBiquadFilter = () => node()
  resume = (): Promise<void> => Promise.resolve()
  close = (): Promise<void> => Promise.resolve()
  /** 讓測試推進音訊時鐘 */
  advance(seconds: number): void {
    this.currentTime += seconds
  }
}

/** 安裝 stub，回傳當前實例的取得函式 */
export function stubAudioContext(): () => FakeAudioContext | null {
  let instance: FakeAudioContext | null = null
  vi.stubGlobal(
    'AudioContext',
    class extends FakeAudioContext {
      constructor() {
        super()
        instance = this as unknown as FakeAudioContext
      }
    },
  )
  return () => instance
}

/**
 * 會錄下音訊圖的 stub：用來驗證「合成出來的東西符合規格」——
 * pad 的低通是否真的壓在 click 頻段以下、strum 的音符是否真的錯開、複音數有沒有超過上限。
 * 這些是 PRD 寫死的數字，不是實作細節，值得測。
 *
 * 依賴一個假設：合成器每個音都照 oscillator → filter → gain 的順序建節點，
 * 因此 filter/gain 一律歸給最近建立的 oscillator。建構子裡的 master gain 沒有 oscillator
 * 可歸屬，會被忽略——這正是我們要的。
 */
export interface RecordedOscillator {
  type: string
  frequency: number
  startedAt: number
  stoppedAt: number | null
  lowpass: number | null
  /** gain 包絡的 (時間, 值) 序列 */
  envelope: { time: number; value: number }[]
}

export class RecordingAudioContext {
  currentTime = 0
  state: AudioContextState = 'running'
  readonly oscillators: RecordedOscillator[] = []
  destination = { connect: (t: unknown) => t, disconnect: () => undefined }

  private current: RecordedOscillator | null = null

  createOscillator = (): unknown => {
    const record: RecordedOscillator = {
      type: 'sine', frequency: 0, startedAt: 0, stoppedAt: null, lowpass: null, envelope: [],
    }
    this.oscillators.push(record)
    this.current = record
    return {
      set type(value: string) { record.type = value },
      get type() { return record.type },
      frequency: { value: 0, setValueAtTime: (v: number) => { record.frequency = v } },
      connect: (target: unknown) => target,
      disconnect: () => undefined,
      start: (t: number) => { record.startedAt = t },
      stop: (t?: number) => { record.stoppedAt = t ?? null },
      onended: null,
    }
  }

  createBiquadFilter = (): unknown => {
    const record = this.current
    const frequency = { _value: 0, get value() { return this._value },
      set value(v: number) { this._value = v; if (record) record.lowpass = v } }
    return { type: 'lowpass', frequency, connect: (t: unknown) => t, disconnect: () => undefined }
  }

  createGain = (): unknown => {
    const record = this.current
    const push = (value: number, time: number): void => { record?.envelope.push({ time, value }) }
    return {
      gain: {
        value: 0,
        setValueAtTime: push,
        exponentialRampToValueAtTime: push,
      },
      connect: (target: unknown) => target,
      disconnect: () => undefined,
    }
  }

  resume = (): Promise<void> => Promise.resolve()
  close = (): Promise<void> => Promise.resolve()
}
