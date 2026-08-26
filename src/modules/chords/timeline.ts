/**
 * 和弦時間軸的條目組裝（純函式，三個和弦模組共用）。
 *
 * 為什麼是「整段進行」而不是原本滾動的 4 格視窗：使用者要能直接點任何一個和弦
 * 強制切換過去，看不到的和弦就點不到。改成格子位置固定、游標在上面移動之後，
 * 讀法與節奏譜一致（譜不動、游標動），跟練時也不必追著跳動的格子看。
 *
 * 一段有多長由呼叫端決定：固定調練習＝整個進行，12 調循環＝當前這個調的小節。
 */
import type { TimelineEntry } from '@/components/ChordTimeline/ChordTimeline.vue'

export interface ChordStripOptions {
  /** 這一段的第一個絕對小節（1-based） */
  firstBar: number
  /** 這一段有幾小節 */
  count: number
  /** 游標所在的絕對小節 */
  activeBar: number
  /** 第 bar 小節該顯示的和弦名；undefined = 跳過這一格 */
  symbolAt: (bar: number) => string | undefined
  /** 第 bar 小節的說明小字（通常是段內小節數） */
  captionAt: (bar: number) => string
  /** 「當前」「下一個」的譯文——純函式不碰 i18n */
  nowLabel: string
  nextLabel: string
}

export function buildChordStrip(options: ChordStripOptions): TimelineEntry[] {
  const entries: TimelineEntry[] = []
  for (let i = 0; i < options.count; i++) {
    const bar = options.firstBar + i
    const symbol = options.symbolAt(bar)
    if (symbol === undefined) continue
    const barOffset = bar - options.activeBar
    entries.push({
      key: `${bar}`,
      symbol,
      caption: barOffset === 0
        ? options.nowLabel
        : barOffset === 1 ? options.nextLabel : options.captionAt(bar),
      state: barOffset === 0
        ? 'current'
        : barOffset === 1 ? 'next' : barOffset < 0 ? 'past' : 'future',
      barOffset,
    })
  }
  return entries
}

/** 絕對小節 → 反覆段落內的 0-based 索引（小節數為 0 或負值都安全） */
export function loopIndex(bar: number, length: number): number {
  if (length <= 0) return 0
  return (((bar - 1) % length) + length) % length
}
