/**
 * Lookahead 排程器（"A Tale of Two Clocks" pattern）。
 *
 * 職責單一：以背景 timer 週期性醒來，把 lookahead 視窗內的 tick
 * 從 TickSource 拉出並廣播給 listeners（Observer）。
 * 它不懂 BPM、拍號、pattern —— 那是 TickSource（Transport）的事。
 */
import type { IClock } from './clock'
import type { TickEvent } from './types'

/** tick 供應者：回傳的 audioTime 必須單調不遞減 */
export interface TickSource {
  next(): TickEvent
}

export type TickListener = (e: TickEvent) => void

export interface SchedulerOptions {
  /** 排程視窗（秒）：提前多久把 tick 交給 listener */
  lookaheadSec: number
  /** timer 週期（毫秒）；0 = 不啟動 timer（測試手動呼叫 tick()） */
  intervalMs: number
}

const DEFAULT_OPTIONS: SchedulerOptions = { lookaheadSec: 0.1, intervalMs: 25 }

/** 單次 tick() 的排程上限，防止異常 TickSource 造成無窮迴圈 */
const MAX_EVENTS_PER_TICK = 1000

export class LookaheadScheduler {
  private readonly listeners = new Set<TickListener>()
  private source: TickSource | null = null
  private pending: TickEvent | null = null
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly clock: IClock,
    private readonly options: SchedulerOptions = DEFAULT_OPTIONS,
  ) {}

  addListener(fn: TickListener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  get running(): boolean {
    return this.source !== null
  }

  start(source: TickSource): void {
    this.stop()
    this.source = source
    this.pending = source.next()
    if (this.options.intervalMs > 0) {
      this.timer = setInterval(() => this.tick(), this.options.intervalMs)
    }
    this.tick()
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
    this.source = null
    this.pending = null
  }

  /** 把 lookahead 視窗內的 tick 全部發出（timer 呼叫；測試可手動呼叫） */
  tick(): void {
    if (!this.source) return
    const horizon = this.clock.now() + this.options.lookaheadSec
    let emitted = 0
    while (this.pending && this.pending.audioTime < horizon) {
      if (++emitted > MAX_EVENTS_PER_TICK) {
        throw new Error('LookaheadScheduler: TickSource is not advancing audioTime')
      }
      const event = this.pending
      for (const fn of this.listeners) fn(event)
      this.pending = this.source.next()
    }
  }
}
