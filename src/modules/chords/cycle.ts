/**
 * 12 調循環模型（PRD F3-3）：把一個進行沿五度圈逆時針展開成完整的小節表。
 * 純函式——跟練畫面只是依當前小節查表，不在畫面裡算樂理。
 */
import {
  parseNoteName, realizeProgression,
  type NoteName, type ProgressionPreset, type RealizedChord,
} from '@/core/theory'
import { DESCENDING_FIFTHS } from '@/components/CircleOfFifths/geometry'

export interface CycleBar {
  /** 1-based，橫跨整個循環 */
  globalBar: number
  key: NoteName
  /** 0-based，第幾個調 */
  keyIndex: number
  /** 1-based，該調內的第幾小節 */
  barInKey: number
  chords: RealizedChord[]
}

export interface CycleOptions {
  /** 每個調停留幾小節（進行不足則重複、超過則截斷） */
  barsPerKey: number
  /** 從哪個調開始，之後逆時針（五度下行）走完 12 調 */
  startKey: NoteName
}

/** 把 DESCENDING_FIFTHS 轉到指定起始調 */
export function keySequence(startKey: NoteName): NoteName[] {
  const start = DESCENDING_FIFTHS.indexOf(startKey)
  const offset = start < 0 ? 0 : start
  return DESCENDING_FIFTHS.map((_, i) => {
    const key = DESCENDING_FIFTHS[(offset + i) % DESCENDING_FIFTHS.length]
    if (key === undefined) throw new Error('Unreachable: circle table out of sync')
    return key
  })
}

export function buildCircleCycle(preset: ProgressionPreset, options: CycleOptions): CycleBar[] {
  const bars: CycleBar[] = []
  let globalBar = 1

  keySequence(options.startKey).forEach((key, keyIndex) => {
    const realized = realizeProgression(preset, { key, harmonyLevel: preset.harmonyLevel })
    for (let barInKey = 1; barInKey <= options.barsPerKey; barInKey++) {
      // 進行短於 barsPerKey 就重複，長於就截斷
      const source = realized[(barInKey - 1) % realized.length]
      bars.push({
        globalBar,
        key,
        keyIndex,
        barInKey,
        chords: source?.chords ?? [],
      })
      globalBar += 1
    }
  })

  return bars
}

/** 依 transport 的小節數取循環中的位置（超過總長就繞回開頭） */
export function cycleBarAt(cycle: readonly CycleBar[], transportBar: number): CycleBar | undefined {
  if (cycle.length === 0) return undefined
  const index = ((transportBar - 1) % cycle.length + cycle.length) % cycle.length
  return cycle[index]
}

/** 下一小節的第一個和弦（提前一小節預告，換把才來得及） */
export function nextChordAfter(cycle: readonly CycleBar[], transportBar: number): RealizedChord | undefined {
  const next = cycleBarAt(cycle, transportBar + 1)
  return next?.chords[0]
}

/**
 * 某個調在循環中的第一個小節（點五度圈強制切換調用）。
 * 以 pitch class 比對——圈上寫 F#、循環表裡寫 Gb，指的是同一個調。
 */
export function firstBarOfKey(cycle: readonly CycleBar[], key: NoteName): number | undefined {
  const pc = parseNoteName(key).pc
  return cycle.find((bar) => parseNoteName(bar.key).pc === pc)?.globalBar
}
