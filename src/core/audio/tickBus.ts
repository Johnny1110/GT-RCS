/**
 * TickBus：聲音 → 視覺的同步橋樑（producer/consumer queue）。
 *
 * 排程器提前 ~100ms 發出 tick（audioTime 在未來）；
 * UI 以 requestAnimationFrame 呼叫 drainUpTo(clock.now())，
 * 只消費「已經到時間」的 tick 來更新 highlight —— 視覺永不超前聲音。
 */
import type { TickEvent } from './types'

export class TickBus {
  private queue: TickEvent[] = []

  /** 作為 TickListener 掛到 Transport 上 */
  readonly push = (e: TickEvent): void => {
    this.queue.push(e)
  }

  /** 取出 audioTime <= now 的所有 tick（依時間序） */
  drainUpTo(now: number): TickEvent[] {
    let count = 0
    while (count < this.queue.length) {
      const head = this.queue[count]
      if (head === undefined || head.audioTime > now) break
      count++
    }
    return this.queue.splice(0, count)
  }

  clear(): void {
    this.queue = []
  }
}
