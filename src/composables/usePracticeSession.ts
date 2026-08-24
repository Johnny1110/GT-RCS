/**
 * 練習計時與日誌寫入（PRD F2-2）。
 *
 * 規則：play 開始累計，stop 或離開頁面結束並寫入 practiceLog；
 * 過短的 session 由 practiceLog store 依 MIN_LOGGED_SESSION_SEC 擋掉
 * （避免隨手按一下播放就留下一筆紀錄）。
 *
 * 時間來源用 Date.now()：這是「牆上時鐘」的用途（練了多久），
 * 與節拍計算無關——節拍一律走 IClock / AudioContext（architecture.md §8 反模式 2）。
 * now 可注入以利測試。
 */
import { onUnmounted, watch } from 'vue'
import { usePracticeLogStore } from '@/stores/practiceLog'
import { useTransportStore } from '@/stores/transport'

export interface PracticeSessionOptions {
  moduleId: string
  /** 每次寫入時取當下練習參數（調、音階、pattern…） */
  params: () => Record<string, unknown>
  now?: () => number
}

export interface PracticeSession {
  /** 手動結算（頁面離開或切換練習目標時呼叫）；回傳是否寫入日誌 */
  flush: () => boolean
}

export function usePracticeSession(options: PracticeSessionOptions): PracticeSession {
  const now = options.now ?? (() => Date.now())
  const transport = useTransportStore()
  const log = usePracticeLogStore()
  let startedAt: number | null = null

  function flush(): boolean {
    if (startedAt === null) return false
    const durationSec = Math.round((now() - startedAt) / 1000)
    startedAt = null
    return log.addEntry({
      date: new Date(now()).toISOString(),
      moduleId: options.moduleId,
      durationSec,
      bpm: transport.bpm,
      params: options.params(),
    })
  }

  watch(
    () => transport.playing,
    (playing) => {
      if (playing) startedAt = now()
      else flush()
    },
  )

  // 直接結算，不依賴 watcher —— 卸載時 watcher 已停止，事件不會再送達
  onUnmounted(flush)

  return { flush }
}
