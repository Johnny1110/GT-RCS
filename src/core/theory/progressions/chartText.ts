/**
 * 曲譜文字記法 — 白名單 parser（Phase 8 / F8-1）
 *
 * ## 為什麼不用 `tokens` + `barsPerChord` 兩個平行陣列
 *
 * 內建 preset 那套（見 types.ts 的 ProgressionPreset）在四小節的進行上很好用，
 * 但一首曲子有 32–64 小節：兩個陣列必須等長、而且 barsPerChord 的總和要等於小節數，
 * 人工維護必錯，錯了還只會表現成「第 17 小節之後整首歪掉」。
 * 小節線記法把小節數寫在字面上，一眼數得出來：
 *
 *     | I6 vim7 | iim7 V7 | iiim7 V/ii | iim7 V7 |
 *
 * ## 文法
 *
 * - `|` 分隔小節，首尾的 `|` 可省略。
 * - 一小節內以空白分隔和弦，**n 個和弦平分該小節**（1 → 整小節、2 → 各半、4 → 各 1/4）。
 *   單一小節最多 4 個和弦——再多幾乎一定是漏打了小節線，寧可報錯也不要安靜地擠進去。
 * - `%` = 與前一小節完全相同（單獨成一小節，不與其他和弦混寫）。
 * - 空小節（`| |`）是錯誤，**不是**「延續前一個和弦」——猜測會讓打錯的譜安靜地變成別的曲子。
 * - 和弦本身的文法完全沿用 parser.ts 的級數記法，這裡不新增第二套和弦語法。
 *
 * ## 為什麼不換算成 barsPerChord 再丟給 realizeProgression
 *
 * 平分小節會產生 1/3 這種除不盡的值，而 realizeProgression 是用「累加位置再 floor」
 * 決定和弦落在第幾小節的。0.333… 累加三次是 0.999…，floor 之後整首往前錯一小節。
 * 所以本層直接輸出**以小節為單位的結構**，由 form.ts 逐小節展開，跨小節不做浮點累加。
 *
 * 本檔為純函式，錯誤一律帶行號與小節序號（編輯器要指得出是哪一格打錯）。
 */
import { parseNoteName } from '../intervals'
import { ProgressionSyntaxError, parseProgression } from './parser'
import type { NoteName } from '../types'
import type { ChartDraft, ChartSection } from './types'

export class ChartTextError extends Error {
  constructor(
    message: string,
    /** 1-based 行號；單獨解析一段時為 0 */
    readonly line: number,
    /** 0-based 小節序號；與小節無關的錯誤為 -1 */
    readonly barIndex: number = -1,
  ) {
    super(message)
    this.name = 'ChartTextError'
  }
}

/** 一小節：1–4 個和弦 token，平分這一小節 */
export interface ChartBar {
  tokens: readonly string[]
}

/** 一小節最多幾個和弦（超過幾乎必定是漏打小節線） */
export const MAX_CHORDS_PER_BAR = 4

/** 段落標記：字母開頭，後接字母或數字（A、A2、B、Intro、Coda） */
const LABEL_RE = /^[A-Za-z][A-Za-z0-9]*$/

/**
 * 解析一段的小節序列。
 * @param line 錯誤訊息用的行號（1-based）；獨立呼叫時給 0
 */
export function parseChartBars(text: string, line = 0): ChartBar[] {
  const segments = text.split('|')
  // 首尾的 `|` 會切出空字串，那是分隔符不是空小節，去掉之後再判斷
  if (segments.length > 0 && segments[0]!.trim() === '') segments.shift()
  if (segments.length > 0 && segments[segments.length - 1]!.trim() === '') segments.pop()
  if (segments.length === 0) throw new ChartTextError('Section has no bars', line)

  const bars: ChartBar[] = []
  segments.forEach((segment, barIndex) => {
    const tokens = segment.trim().split(/\s+/).filter((t) => t !== '')
    if (tokens.length === 0) {
      throw new ChartTextError(`Bar ${barIndex + 1} is empty`, line, barIndex)
    }
    if (tokens.some((t) => t === '%')) {
      if (tokens.length > 1) {
        throw new ChartTextError(`"%" must be the only symbol in bar ${barIndex + 1}`, line, barIndex)
      }
      const previous = bars[barIndex - 1]
      if (!previous) {
        throw new ChartTextError('"%" cannot be the first bar — there is nothing to repeat', line, barIndex)
      }
      bars.push({ tokens: [...previous.tokens] })
      return
    }
    if (tokens.length > MAX_CHORDS_PER_BAR) {
      throw new ChartTextError(
        `Bar ${barIndex + 1} has ${tokens.length} chords (max ${MAX_CHORDS_PER_BAR}) — a missing bar line?`,
        line,
        barIndex,
      )
    }
    // 和弦本身也在這裡驗證：把「這一格打錯字」擋在解析期，
    // 否則錯誤要等到展開曲式（甚至播放）才爆，而且指不出是哪一小節。
    for (const token of tokens) {
      try {
        parseProgression(token)
      } catch (error) {
        const detail = error instanceof ProgressionSyntaxError ? error.message : String(error)
        throw new ChartTextError(`Bar ${barIndex + 1}: ${detail}`, line, barIndex)
      }
    }
    bars.push({ tokens })
  })
  return bars
}

/** 小節數（不解析和弦，只數小節——編輯器的即時提示用） */
export function chartBarCount(text: string): number {
  return parseChartBars(text).length
}

const HEADER_KEYS = ['title', 'key', 'feel', 'bpm', 'form'] as const
type HeaderKey = (typeof HEADER_KEYS)[number]

function isHeaderKey(value: string): value is HeaderKey {
  return (HEADER_KEYS as readonly string[]).includes(value)
}

/**
 * 解析一份完整曲譜（匯入／匯出格式，F8-8）：
 *
 *     title: Rhythm Changes
 *     key: Bb
 *     feel: mediumSwing
 *     form: A A2 B A3
 *     A:  | I6 vim7 | iim7 V7 | ... |
 *     A2: | ... |
 *
 * `feel` 不在本層驗證——feel 是模組層的資料，core 不認識它的 id 清單。
 */
export function parseChartText(text: string): ChartDraft {
  const lines = text.split(/\r?\n/)
  const headers = new Map<HeaderKey, string>()
  const sections: ChartSection[] = []
  const seenLabels = new Set<string>()

  lines.forEach((raw, index) => {
    const line = index + 1
    const trimmed = raw.trim()
    if (trimmed === '' || trimmed.startsWith('#')) return

    const colon = trimmed.indexOf(':')
    if (colon < 0) {
      throw new ChartTextError(`Line ${line}: expected "<name>: <value>"`, line)
    }
    const name = trimmed.slice(0, colon).trim()
    const value = trimmed.slice(colon + 1).trim()

    if (isHeaderKey(name)) {
      if (headers.has(name)) throw new ChartTextError(`Line ${line}: duplicate "${name}"`, line)
      if (value === '') throw new ChartTextError(`Line ${line}: "${name}" is empty`, line)
      headers.set(name, value)
      return
    }
    if (!LABEL_RE.test(name)) {
      throw new ChartTextError(`Line ${line}: "${name}" is neither a header nor a section label`, line)
    }
    if (seenLabels.has(name)) throw new ChartTextError(`Line ${line}: duplicate section "${name}"`, line)
    // 解析一次以驗證文法；存進去的仍是原文（資料檔要保持可讀）
    parseChartBars(value, line)
    seenLabels.add(name)
    sections.push({ label: name, bars: value })
  })

  if (sections.length === 0) throw new ChartTextError('Chart has no sections', 0)

  const rawKey = headers.get('key') ?? ''
  if (rawKey === '') throw new ChartTextError('Missing "key:"', 0)
  let homeKey: NoteName
  try {
    parseNoteName(rawKey as NoteName)
    homeKey = rawKey as NoteName
  } catch {
    throw new ChartTextError(`Unknown key "${rawKey}"`, 0)
  }

  const form = (headers.get('form') ?? sections.map((s) => s.label).join(' ')).split(/\s+/).filter((s) => s !== '')
  for (const label of form) {
    if (!seenLabels.has(label)) throw new ChartTextError(`Form references undefined section "${label}"`, 0)
  }

  const rawBpm = headers.get('bpm')
  const bpm = rawBpm === undefined ? null : Number(rawBpm)
  if (bpm !== null && !Number.isFinite(bpm)) throw new ChartTextError(`Invalid bpm "${rawBpm}"`, 0)

  return {
    title: headers.get('title') ?? sections[0]!.label,
    homeKey,
    feel: headers.get('feel') ?? '',
    bpm,
    form,
    sections,
  }
}

/** ChartDraft → 文字（匯出）。與 parseChartText 互為反向，round-trip 由測試鎖定 */
export function formatChartText(draft: ChartDraft): string {
  const width = Math.max(...draft.sections.map((s) => s.label.length)) + 1
  const lines = [
    `title: ${draft.title}`,
    `key: ${draft.homeKey}`,
    ...(draft.feel === '' ? [] : [`feel: ${draft.feel}`]),
    ...(draft.bpm === null ? [] : [`bpm: ${draft.bpm}`]),
    `form: ${draft.form.join(' ')}`,
    ...draft.sections.map((s) => `${`${s.label}:`.padEnd(width + 1)}${s.bars}`),
  ]
  return `${lines.join('\n')}\n`
}
