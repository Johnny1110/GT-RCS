/**
 * Transport（facade）：全站唯一的「播放狀態 + 拍點供應」入口。
 * 練習模組一律透過 Transport 控制播放，不得自建 timer 或直接操作 scheduler。
 *
 * 實作為 TickSource：next() 逐一生成 tick。時間推進的唯一規則是
 * 「累加『下一格與已排定那一格的偏移差』× 每拍秒數」——
 * 偏移差來自 pattern 編譯出的時刻表（core/audio/pattern.ts），
 * 因此 swing 這種非等距細分不必動排程核心。
 *
 * 生效時機（契約）：
 * - setBpm：下一個 tick（不動已排程的 tick）
 * - setSwing：下一個尚未排程的格（當下小節即重編譯）
 * - setPattern / setTimeSignature / setTicksPerBeat：播放中排到下一個小節線，
 *   停止中立即生效。小節對齊是刻意的——播放中換拍號若不對齊小節，
 *   使用者會聽到一個長度不明的殘拍。
 */
import type { IClock } from './clock'
import {
  SWING_STRAIGHT, clampSwing, compileBar, isSilentBar, metronomeBar, silenceSlots,
  type DemoSilenceMode, type PatternSlot,
} from './pattern'
import { LookaheadScheduler, type TickListener, type TickSource } from './scheduler'
import { BPM_MAX, BPM_MIN, type RhythmPattern, type TickEvent, type TicksPerBeat, type TimeSignature } from './types'

export interface TransportState {
  bpm: number
  timeSig: TimeSignature
  ticksPerBeat: TicksPerBeat
  swing: number
  patternId: string | null
  playing: boolean
}

/** play() 後第一拍的緩衝（秒），避免起手 tick 已在過去 */
const START_DELAY_SEC = 0.1

export class Transport implements TickSource {
  private bpm = 90
  private timeSig: TimeSignature = { beats: 4, unit: 4 }
  private ticksPerBeat: TicksPerBeat = 1
  private pattern: RhythmPattern | null = null
  private swing = SWING_STRAIGHT
  private demoSilence: DemoSilenceMode | null = null

  /** 待小節線生效的變更；null = 無變更（pattern 用盒子包住，才能區分「不改」與「改成 null」） */
  private pendingTimeSig: TimeSignature | null = null
  private pendingTicksPerBeat: TicksPerBeat | null = null
  private pendingPattern: { value: RhythmPattern | null } | null = null

  private bar = 1
  private slots: PatternSlot[] = []
  private slotIndex = 0
  /** 已排定時刻的那一格之偏移；重編譯（swing）後仍以它為基準，時間不會倒退 */
  private lastOffsetBeats = 0
  private nextTime = 0

  constructor(
    private readonly clock: IClock,
    private readonly scheduler: LookaheadScheduler,
  ) {}

  getState(): TransportState {
    return {
      bpm: this.bpm,
      timeSig: { ...this.timeSig },
      ticksPerBeat: this.ticksPerBeat,
      swing: this.swing,
      patternId: this.pattern?.id ?? null,
      playing: this.scheduler.running,
    }
  }

  /** listener 同時服務發聲端（ClickVoice）與 UI 端（TickBus） */
  addTickListener(fn: TickListener): () => void {
    return this.scheduler.addListener(fn)
  }

  play(): void {
    this.bar = 1
    this.slotIndex = 0
    this.loadBar()
    this.lastOffsetBeats = this.slots[0]?.offsetBeats ?? 0
    this.nextTime = this.clock.now() + START_DELAY_SEC
    this.scheduler.start(this)
  }

  stop(): void {
    this.scheduler.stop()
  }

  /** 下一個 tick 生效 */
  setBpm(bpm: number): void {
    this.bpm = Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm)))
  }

  /** 播放中排到下一個小節線生效 */
  setTimeSignature(sig: TimeSignature): void {
    if (this.scheduler.running) this.pendingTimeSig = { ...sig }
    else this.timeSig = { ...sig }
  }

  setTicksPerBeat(t: TicksPerBeat): void {
    if (this.scheduler.running) this.pendingTicksPerBeat = t
    else this.ticksPerBeat = t
  }

  /**
   * 掛上／卸下節奏 pattern。pattern 一旦掛上就由它決定拍號與細分
   * （節奏譜畫的是什麼，就該響什麼）。
   * pattern.swing 只是 preset 的建議值，實際 swing 一律以 setSwing 為準——
   * 使用者調過的 swing 不該因為換了同風格的另一個 pattern 就被蓋掉。
   */
  setPattern(pattern: RhythmPattern | null): void {
    const timeSig = pattern ? { ...pattern.timeSig } : this.timeSig
    const ticksPerBeat = pattern ? pattern.ticksPerBeat : this.ticksPerBeat
    if (this.scheduler.running) {
      this.pendingPattern = { value: pattern }
      this.pendingTimeSig = timeSig
      this.pendingTicksPerBeat = ticksPerBeat
    } else {
      this.pattern = pattern
      this.timeSig = timeSig
      this.ticksPerBeat = ticksPerBeat
    }
  }

  /** 下一個尚未排程的格生效（當下小節重編譯，不等小節線） */
  setSwing(percent: number): void {
    this.swing = clampSwing(percent)
    if (this.scheduler.running) this.buildSlots()
  }

  /** 示範／靜默循環；null = 全程示範。切換於下一個小節生效。 */
  setDemoSilence(mode: DemoSilenceMode | null): void {
    this.demoSilence = mode ? { ...mode } : null
  }

  /** TickSource 實作：生成下一個 tick 並推進位置 */
  next(): TickEvent {
    const slot = this.slots[this.slotIndex]
    const event: TickEvent = {
      audioTime: this.nextTime,
      bar: this.bar,
      beat: slot?.beat ?? 1,
      tick: slot?.tick ?? 1,
      role: slot?.role ?? 'rest',
    }
    this.advance()
    return event
  }

  private advance(): void {
    // BPM 每次重讀 → setBpm 於下一個 tick 生效
    const secondsPerBeat = 60 / this.bpm
    const currentBarBeats = this.timeSig.beats
    const previous = this.lastOffsetBeats
    this.slotIndex += 1

    if (this.slotIndex >= this.slots.length) {
      this.bar += 1
      this.loadBar() // 小節線：吸收待生效的 pattern／拍號／細分
      this.slotIndex = 0
      const first = this.slots[0]?.offsetBeats ?? 0
      this.nextTime += (currentBarBeats - previous + first) * secondsPerBeat
      this.lastOffsetBeats = first
      return
    }

    const offset = this.slots[this.slotIndex]?.offsetBeats ?? previous
    // 夾在 0：swing 於小節中途改變時，保住 scheduler 要求的「時間單調不遞減」
    this.nextTime += Math.max(0, offset - previous) * secondsPerBeat
    this.lastOffsetBeats = offset
  }

  private loadBar(): void {
    if (this.pendingTimeSig) this.timeSig = this.pendingTimeSig
    if (this.pendingTicksPerBeat) this.ticksPerBeat = this.pendingTicksPerBeat
    if (this.pendingPattern) this.pattern = this.pendingPattern.value
    this.pendingTimeSig = null
    this.pendingTicksPerBeat = null
    this.pendingPattern = null
    this.buildSlots()
  }

  private buildSlots(): void {
    const bars = this.pattern?.bars
    const cells = bars && bars.length > 0
      ? bars[(this.bar - 1) % bars.length] ?? []
      : metronomeBar(this.timeSig, this.ticksPerBeat)
    const slots = compileBar(cells, this.timeSig, this.ticksPerBeat, this.swing)
    this.slots = isSilentBar(this.bar, this.demoSilence) ? silenceSlots(slots) : slots
  }
}
