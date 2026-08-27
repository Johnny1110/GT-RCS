/**
 * 曲式展開器（Phase 8 / F8-2）：段落定義 + 展開順序 → 一個 chorus 的小節表。
 *
 * ## 與 realizeProgression 的分工
 *
 * realizeProgression 服務的是「一段四到十二小節的進行」，用累加位置決定和弦落在第幾小節。
 * 曲式不能那樣算：平分小節會出現 1/3，累加三次是 0.999…，floor 之後整首往前錯一小節。
 * 所以本層以**小節為單位**逐格展開（parseChartBars 已經把小節切好了），
 * 跨小節不做任何浮點累加，浮點只出現在單一小節內的 offsetBeats。
 *
 * ## 為什麼展開整個 chorus 而不是「當前段落」
 *
 * 反覆由呼叫端取模（`bar % chorusLength`），與既有和弦模組同一種做法——
 * 時鐘不因為換段而重排，強制切換也只是小節游標的位移。
 *
 * 本檔為純函式，無狀態。
 */
import { parseProgression, realizeChord } from './parser'
import { parseChartBars, ChartTextError } from './chartText'
import type {
  BarChord, ChartForm, ChartSection, ExpandFormOptions, FormBar, SectionSpan,
} from './types'

/** 段落展開成小節（同一個段落在 form 裡出現幾次就共用這份解析結果） */
function sectionBars(section: ChartSection): ReturnType<typeof parseChartBars> {
  return parseChartBars(section.bars)
}

function findSection(form: ChartForm, label: string): ChartSection {
  const section = form.sections.find((s) => s.label === label)
  if (!section) {
    // 拼錯段名不該安靜地少一段：那會讓整首曲子短八小節而使用者只覺得「怪怪的」
    throw new ChartTextError(`Form references undefined section "${label}"`, 0)
  }
  return section
}

/**
 * 展開曲式。
 *
 * @returns 一個 chorus 的每一小節，bar 由 1 起算連續遞增。
 */
export function expandForm(form: ChartForm, options: ExpandFormOptions): FormBar[] {
  const cache = new Map<string, ReturnType<typeof parseChartBars>>()
  const bars: FormBar[] = []
  let bar = 1

  form.form.forEach((label, sectionIndex) => {
    const section = findSection(form, label)
    let parsed = cache.get(label)
    if (!parsed) {
      parsed = sectionBars(section)
      cache.set(label, parsed)
    }
    const harmonyLevel = section.harmonyLevel ?? options.harmonyLevel
    for (const chartBar of parsed) {
      const count = chartBar.tokens.length
      const beats = options.beatsPerBar / count
      const chords: BarChord[] = chartBar.tokens.map((raw, i) => ({
        chord: realizeChord(parseProgression(raw, harmonyLevel)[0]!, { ...options, harmonyLevel }),
        offsetBeats: i * beats,
        beats,
      }))
      bars.push({ bar, sectionIndex, label, chords })
      bar += 1
    }
  })

  if (bars.length === 0) throw new ChartTextError('Form expands to zero bars', 0)
  return bars
}

/** form 陣列每一項佔哪幾小節（曲式圖、段落循環用） */
export function sectionSpans(form: ChartForm): SectionSpan[] {
  const cache = new Map<string, number>()
  const spans: SectionSpan[] = []
  let firstBar = 1

  form.form.forEach((label, index) => {
    let count = cache.get(label)
    if (count === undefined) {
      count = sectionBars(findSection(form, label)).length
      cache.set(label, count)
    }
    spans.push({ index, label, firstBar, bars: count })
    firstBar += count
  })
  return spans
}

/** 一個 chorus 有幾小節 */
export function formBarCount(form: ChartForm): number {
  return sectionSpans(form).reduce((sum, span) => sum + span.bars, 0)
}

/**
 * 這一小節在第 beat 拍（1-based，可帶小數）該響的和弦。
 * comping 示範音與畫面的「當前和弦」共用這一支——各自判斷遲早會出現
 * 「畫面寫著 Dm7、耳朵聽到 G7」。
 */
export function chordAtBeat(bar: FormBar | undefined, beat: number): BarChord | undefined {
  if (!bar || bar.chords.length === 0) return undefined
  const offset = beat - 1
  let found = bar.chords[0]
  for (const candidate of bar.chords) {
    // 浮點容差：1/3 拍的偏移算出來是 1.3333…，用 >= 直接比會漏掉邊界那一格
    if (candidate.offsetBeats <= offset + 1e-6) found = candidate
    else break
  }
  return found
}
