/**
 * Click 音色 — Strategy pattern。
 * Transport/scheduler 不知道聲音怎麼發；發聲端只是一個 TickListener，
 * 對非 rest 角色呼叫 ClickVoice.trigger(role, audioTime)。
 * 換音色 = 換一個 ClickVoice 實作，其他層零改動。
 */
import type { SoundingRole } from './types'

export interface ClickVoice {
  trigger(role: SoundingRole, audioTime: number): void
  /** 音量 0–1，各角色獨立（PRD F1-3） */
  setVolume(role: SoundingRole, volume: number): void
  setMuted(role: SoundingRole, muted: boolean): void
}

/** 測試 / SSR 用：不發聲 */
export class NullClickVoice implements ClickVoice {
  trigger(): void {}
  setVolume(): void {}
  setMuted(): void {}
}

/**
 * 三音色的設計意圖（PRD F1-3）：以「頻段」而非音量區分，
 * 手機外放喇叭的低頻響應差，僅靠音量差在外放時會分不出來。
 * - accent：最高頻、下滑最快 → 撥弦提示，穿透力最強
 * - normal：中頻，中性拍點
 * - ghost：低頻並過低通 → 悶音感，明顯「鈍」而不只是「小聲」
 */
interface VoiceSpec {
  startFreq: number
  endFreq: number
  /** 衰減時長（秒） */
  decay: number
  /** 該角色的基礎音量係數（再乘上使用者音量） */
  gain: number
  type: OscillatorType
  lowpass?: number
}

const VOICE_SPECS: Readonly<Record<SoundingRole, VoiceSpec>> = {
  accent: { startFreq: 2400, endFreq: 1400, decay: 0.045, gain: 1, type: 'triangle' },
  normal: { startFreq: 1400, endFreq: 900, decay: 0.05, gain: 0.7, type: 'triangle' },
  ghost: { startFreq: 520, endFreq: 300, decay: 0.07, gain: 0.42, type: 'sine', lowpass: 700 },
}

/** 指數包絡不能到 0，以此值代表無聲 */
const SILENCE = 0.0001
/** 起音時間：太短會有 click pop，太長會糊掉拍點 */
const ATTACK_SEC = 0.002

/** Web Audio 合成音色（零外部資源）。與 WebAudioClock 同為本層唯二的 Web Audio adapter。 */
export class SynthClickVoice implements ClickVoice {
  private readonly volumes: Record<SoundingRole, number> = { accent: 1, normal: 0.8, ghost: 0.5 }
  private readonly muted: Record<SoundingRole, boolean> = { accent: false, normal: false, ghost: false }
  private readonly master: GainNode

  constructor(private readonly ctx: AudioContext) {
    this.master = ctx.createGain()
    this.master.gain.value = 0.6
    this.master.connect(ctx.destination)
  }

  trigger(role: SoundingRole, audioTime: number): void {
    if (this.muted[role] || this.volumes[role] <= 0) return
    const spec = VOICE_SPECS[role]
    // 排程時刻已過（分頁被節流後回來）就立刻發聲，不排到過去
    const t0 = Math.max(audioTime, this.ctx.currentTime)
    const end = t0 + spec.decay

    const osc = this.ctx.createOscillator()
    osc.type = spec.type
    osc.frequency.setValueAtTime(spec.startFreq, t0)
    osc.frequency.exponentialRampToValueAtTime(spec.endFreq, end)

    const gain = this.ctx.createGain()
    const peak = Math.max(SILENCE, spec.gain * this.volumes[role])
    gain.gain.setValueAtTime(SILENCE, t0)
    gain.gain.exponentialRampToValueAtTime(peak, t0 + ATTACK_SEC)
    gain.gain.exponentialRampToValueAtTime(SILENCE, end)

    let source: AudioNode = osc
    if (spec.lowpass !== undefined) {
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = spec.lowpass
      osc.connect(filter)
      source = filter
    }
    source.connect(gain).connect(this.master)

    osc.start(t0)
    osc.stop(end + 0.02)
  }

  setVolume(role: SoundingRole, volume: number): void {
    this.volumes[role] = Math.min(1, Math.max(0, volume))
  }

  setMuted(role: SoundingRole, muted: boolean): void {
    this.muted[role] = muted
  }
}
