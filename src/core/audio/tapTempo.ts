/**
 * 敲擊測速（tap tempo）——純函式核心。
 *
 * 吉他手心裡的速度是「這首歌聽起來像這樣」，不是「112」。TapTempo 讓耳朵直接
 * 抵達數字：跟著哼的節奏敲幾下，速度就出來了，不必先猜一個數字再用滑桿逼近。
 *
 * **為什麼不吃 IClock**：時間戳由呼叫端傳進來。core 的規則是「時間一律經 IClock」，
 * 而 IClock 的存在理由是排程不能碰真時鐘；這裡連時鐘都不需要——敲擊時刻本來就是
 * 外部事件的屬性，傳進來之後整個類別就是一串數字進、一個 BPM 出，可以窮舉測試。
 * 這也不是節拍：它不參與排程，不會讓 click 飄拍（`architecture.md` 反模式清單針對的是
 * 「用 setInterval／Date.now() 產生節拍」，敲擊測速是使用者輸入的量測）。
 *
 * 演算法上的三個決定，每一個都是為了「人手不準」：
 * 1. **取平均而不是取最後一次間隔**：手的抖動有正有負，平均會互相抵銷；
 *    只看最後一下的話，畫面上的數字會跟著每一次手抖跳動，看起來像壞掉。
 * 2. **只平均最近幾次**（預設 4 = 4/4 的一個小節）：使用者敲著敲著會加速或減速，
 *    把三十秒前的敲擊算進來只會讓數字追不上現在的手。
 * 3. **間隔過長就重來**：中間停下來想事情，再敲的那一下不是一個間隔而是一個新的開始。
 *    上限取 2 秒＝30 BPM，剛好是 BPM_MIN——比這慢的敲擊本來就表達不出合法速度。
 */
import { BPM_MAX, BPM_MIN } from './types'

/** 算得出 BPM 的最少敲擊數：兩下才構成一個間隔 */
export const TAP_MIN_TAPS = 2

/** 預設平均視窗（間隔數）＝ 4/4 的一個小節 */
export const TAP_WINDOW = 4

/** 超過這個間隔就當成重新開始；2 秒 = 30 BPM = BPM_MIN */
export const TAP_TIMEOUT_SECONDS = 2

export interface TapTempoResult {
  /** 已納入本次測量的敲擊數（含這一下）。UI 用它顯示「再敲 N 下」 */
  taps: number
  /** 敲擊數不足 TAP_MIN_TAPS 時為 null——沒算出來就誠實回報，不給一個猜的數字 */
  bpm: number | null
}

export interface TapTempoOptions {
  /** 平均視窗（間隔數），預設 TAP_WINDOW */
  window?: number
  /** 重新開始的間隔上限（秒），預設 TAP_TIMEOUT_SECONDS */
  timeoutSeconds?: number
}

export class TapTempo {
  private readonly window: number
  private readonly timeout: number
  /** 最近幾次的間隔（秒），最舊在前 */
  private intervals: number[] = []
  private last: number | null = null
  private count = 0

  constructor(options: TapTempoOptions = {}) {
    this.window = Math.max(1, Math.trunc(options.window ?? TAP_WINDOW))
    this.timeout = options.timeoutSeconds ?? TAP_TIMEOUT_SECONDS
  }

  /** 已納入本次測量的敲擊數 */
  get taps(): number {
    return this.count
  }

  /**
   * 記一次敲擊。`now` 需為單調遞增的秒數（呼叫端用 performance.now() / 1000）。
   * 時間倒退（換分頁、系統校時）視同重新開始，而不是算出一個負的間隔。
   */
  tap(now: number): TapTempoResult {
    const previous = this.last
    this.last = now

    if (previous === null || now <= previous || now - previous > this.timeout) {
      this.intervals = []
      this.count = 1
      return { taps: 1, bpm: null }
    }

    this.intervals.push(now - previous)
    if (this.intervals.length > this.window) this.intervals.shift()
    this.count += 1

    return { taps: this.count, bpm: this.bpm() }
  }

  /** 放棄本次測量：下一下敲擊重新起算 */
  reset(): void {
    this.intervals = []
    this.last = null
    this.count = 0
  }

  /**
   * 平均間隔換算 BPM，夾在合法範圍內。
   * 夾住而不是拒絕：敲得比 300 還快通常是手滑連點，給上限比給 null 好懂。
   */
  private bpm(): number | null {
    if (this.intervals.length === 0) return null
    const mean = this.intervals.reduce((sum, v) => sum + v, 0) / this.intervals.length
    if (mean <= 0) return null
    return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(60 / mean)))
  }
}
