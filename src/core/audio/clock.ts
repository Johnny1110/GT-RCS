/**
 * 時鐘抽象（依賴反轉）：排程器只依賴 IClock，
 * 生產環境注入 WebAudioClock，測試注入 ManualClock。
 * 禁止在排程邏輯中直接呼叫 AudioContext.currentTime 或 Date.now()。
 */
export interface IClock {
  /** 單調遞增的目前時間（秒） */
  now(): number
}

/** 測試用手動時鐘 */
export class ManualClock implements IClock {
  private t = 0
  now(): number {
    return this.t
  }
  advance(seconds: number): void {
    this.t += seconds
  }
}

/** 包裝 AudioContext 時鐘（唯一允許讀 currentTime 的地方） */
export class WebAudioClock implements IClock {
  constructor(private readonly ctx: AudioContext) {}
  now(): number {
    return this.ctx.currentTime
  }
}
