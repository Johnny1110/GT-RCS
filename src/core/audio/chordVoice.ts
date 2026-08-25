/**
 * 和弦示範音 — Strategy pattern（與 ClickVoice 同一套骨架，PRD F5-1）。
 *
 * 設計前提：**click 才是主角**。示範音的存在是「讓你聽見和弦換了」，不是伴奏，
 * 更不是擬真吉他音。因此三件事是規格而不是調味：
 * - 預設 off：不主動加東西到使用者耳朵裡。
 * - **頻段與 click 錯開**：click 是 1kHz 以上的短脈衝，pad 一律過 800Hz 以下的低通，
 *   兩者在手機外放喇叭上才不會糊成一團（PRD F5-1 風險表）。
 * - strum 預設音量低於 pad：它有起音，比鋪底更容易蓋掉拍點。
 *
 * 音高從哪來不是這一層的事：core/theory 的 voiceChord() 決定彈哪幾個音，
 * 這裡只負責把 MIDI 音高變成聲音。
 */
import { midiToFrequency } from '../theory/voicing'

export type ChordDemoMode = 'off' | 'pad' | 'strum'

export const CHORD_DEMO_MODES = ['off', 'pad', 'strum'] as const

export function isChordDemoMode(value: unknown): value is ChordDemoMode {
  return CHORD_DEMO_MODES.some((mode) => mode === value)
}

export interface ChordVoice {
  /**
   * 在 audioTime（AudioContext 時間軸）發出一組音高。
   * durationSec 是這個和弦該響多久（通常是一個小節）——pad 靠它決定延音長度。
   */
  play(midis: readonly number[], audioTime: number, durationSec: number): void
  setMode(mode: ChordDemoMode): void
  /** 音量 0–1，獨立於 click 音量 */
  setVolume(volume: number): void
  /** 停止播放：把還在響的音收掉，否則按停止之後 pad 還會拖一個小節 */
  stopAll(): void
}

/** 測試 / SSR 用：不發聲 */
export class NullChordVoice implements ChordVoice {
  play(): void {}
  setMode(): void {}
  setVolume(): void {}
  stopAll(): void {}
}

interface ModeSpec {
  /** 低通截止頻率（Hz）：pad 壓在 click 頻段以下 */
  lowpass: number
  /** 起音時間（秒） */
  attack: number
  /** 放音時間（秒）；pad 在小節末尾淡出，strum 是自然衰減 */
  release: number
  /** 基礎音量係數（再乘上使用者音量） */
  gain: number
  /** 各音之間的錯開時間（秒）：0 = 同時發聲 */
  stagger: number
  /** strum 的自然衰減長度（秒）；pad 為 null＝撐滿 durationSec */
  decay: number | null
  type: OscillatorType
}

const MODE_SPECS: Readonly<Record<Exclude<ChordDemoMode, 'off'>, ModeSpec>> = {
  // 鋪底：慢起音、撐滿整個小節，低通壓到 click 頻段以下
  pad: { lowpass: 700, attack: 0.08, release: 0.25, gain: 0.28, stagger: 0, decay: null, type: 'triangle' },
  // 掃弦：音符錯開 14ms（PRD 的 10–20ms），起音快、自然衰減
  strum: { lowpass: 2200, attack: 0.006, release: 0.12, gain: 0.18, stagger: 0.014, decay: 1.4, type: 'sawtooth' },
}

/** 指數包絡不能到 0，以此值代表無聲 */
const SILENCE = 0.0001
/** 同時發聲的音數上限（行動裝置效能，PRD F5-1 §4） */
const MAX_POLYPHONY = 6

/** Web Audio 合成和弦音（零外部資源）。本層第三個、也是最後一個 Web Audio adapter。 */
export class SynthChordVoice implements ChordVoice {
  private mode: ChordDemoMode = 'off'
  private volume = 0.5
  private readonly master: GainNode
  /** 還在響的音源：stopAll 要收得掉，否則按停止之後 pad 會拖過去 */
  private active = new Set<OscillatorNode>()

  constructor(private readonly ctx: AudioContext) {
    this.master = ctx.createGain()
    this.master.gain.value = 1
    this.master.connect(ctx.destination)
  }

  play(midis: readonly number[], audioTime: number, durationSec: number): void {
    if (this.mode === 'off' || this.volume <= 0 || midis.length === 0) return
    const spec = MODE_SPECS[this.mode]
    // 排程時刻已過（分頁被節流後回來）就立刻發聲，不排到過去
    const base = Math.max(audioTime, this.ctx.currentTime)
    const peak = Math.max(SILENCE, spec.gain * this.volume)

    for (const [index, midi] of midis.slice(0, MAX_POLYPHONY).entries()) {
      const t0 = base + index * spec.stagger
      // pad 撐滿小節；strum 自然衰減，但不超過小節長度（免得下一個和弦疊上來）
      const body = spec.decay === null ? durationSec : Math.min(spec.decay, durationSec)
      const end = t0 + Math.max(spec.attack + spec.release, body)

      const osc = this.ctx.createOscillator()
      osc.type = spec.type
      osc.frequency.setValueAtTime(midiToFrequency(midi), t0)

      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = spec.lowpass

      const gain = this.ctx.createGain()
      gain.gain.setValueAtTime(SILENCE, t0)
      gain.gain.exponentialRampToValueAtTime(peak, t0 + spec.attack)
      gain.gain.exponentialRampToValueAtTime(SILENCE, end)

      osc.connect(filter).connect(gain).connect(this.master)
      osc.start(t0)
      osc.stop(end + 0.02)

      this.active.add(osc)
      osc.onended = (): void => {
        this.active.delete(osc)
      }
    }
  }

  setMode(mode: ChordDemoMode): void {
    this.mode = mode
    if (mode === 'off') this.stopAll()
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume))
  }

  stopAll(): void {
    for (const osc of this.active) {
      try {
        osc.stop()
      } catch {
        // 已經停過或還沒 start：不是錯誤，收乾淨就好
      }
    }
    this.active.clear()
  }
}
