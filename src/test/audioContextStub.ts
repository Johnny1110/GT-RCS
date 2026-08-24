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
