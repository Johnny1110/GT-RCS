/**
 * Transport（facade）：全站唯一的「播放狀態 + 拍點供應」入口。
 * 練習模組一律透過 Transport 控制播放，不得自建 timer 或直接操作 scheduler。
 *
 * 實作為 TickSource：next() 逐一生成 tick，BPM 於「下一個 tick」生效。
 *
 * TODO(opus) Phase 4 / F4-1：
 *  - setPattern(pattern: RhythmPattern)：以 pattern.bars 決定各 tick 的 role
 *    與 rest（rest 照發 tick 供游標移動，但 listener 端不發聲）
 *  - swing：直拍位移法 —— 偶數 tick（反拍）的 audioTime 依 swing% 延後，
 *    實作於 next() 的時間推進處，並補測試（66% 時反拍落在三連音第 3 格）
 *  - 6/8 的兩大拍 feel（accent 於 1、4）切換
 */
import type { IClock } from './clock'
import { LookaheadScheduler, type TickListener, type TickSource } from './scheduler'
import { BPM_MAX, BPM_MIN, type CellRole, type TickEvent, type TicksPerBeat, type TimeSignature } from './types'

export interface TransportState {
  bpm: number
  timeSig: TimeSignature
  ticksPerBeat: TicksPerBeat
  playing: boolean
}

/** play() 後第一拍的緩衝（秒），避免起手 tick 已在過去 */
const START_DELAY_SEC = 0.1

export class Transport implements TickSource {
  private bpm = 90
  private timeSig: TimeSignature = { beats: 4, unit: 4 }
  private ticksPerBeat: TicksPerBeat = 1
  private position = { bar: 1, beat: 1, tick: 1 }
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
      playing: this.scheduler.running,
    }
  }

  /** listener 同時服務發聲端（ClickVoice）與 UI 端（TickBus） */
  addTickListener(fn: TickListener): () => void {
    return this.scheduler.addListener(fn)
  }

  play(): void {
    this.position = { bar: 1, beat: 1, tick: 1 }
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

  /** 停止中才可切換（播放中換拍號的小節對齊語意留給 TODO(opus) Phase 4） */
  setTimeSignature(sig: TimeSignature): void {
    if (this.scheduler.running) return
    this.timeSig = { ...sig }
  }

  setTicksPerBeat(t: TicksPerBeat): void {
    if (this.scheduler.running) return
    this.ticksPerBeat = t
  }

  /** TickSource 實作：生成下一個 tick 並推進位置 */
  next(): TickEvent {
    const event: TickEvent = {
      audioTime: this.nextTime,
      bar: this.position.bar,
      beat: this.position.beat,
      tick: this.position.tick,
      role: this.roleAt(this.position.beat, this.position.tick),
    }
    // BPM 每次重讀 → setBpm 於下一個 tick 生效
    this.nextTime += 60 / this.bpm / this.ticksPerBeat
    this.advance()
    return event
  }

  /** 預設節拍器 pattern：小節首拍 accent、其他拍 normal、拍內細分 ghost */
  private roleAt(beat: number, tick: number): CellRole {
    if (tick !== 1) return 'ghost'
    return beat === 1 ? 'accent' : 'normal'
  }

  private advance(): void {
    const p = this.position
    p.tick += 1
    if (p.tick > this.ticksPerBeat) {
      p.tick = 1
      p.beat += 1
      if (p.beat > this.timeSig.beats) {
        p.beat = 1
        p.bar += 1
      }
    }
  }
}
