/**
 * 和弦把位（把位框）：把 22 格上散落的和弦音切成幾個看得出來的指型區塊。
 *
 * 為什麼需要這一層：mapToFretboard 會吐出「全指板每一個和弦音」——一個七和弦
 * 在 22 格上有 40 幾個音點。全部畫出來資訊是完整的，但使用者看不出「哪幾個音
 * 湊成一個可以按的指型」，等於看不出把位。
 *
 * 錨定規則（吉他的指型就是這樣命名的）：可移動和弦指型一律以**低音弦上的根音**
 * 為錨——根音在 6 弦（E 型）、5 弦（A 型）、4 弦（D 型）。因此把位 = 以某條低音弦
 * 的根音為起點、往高把位延伸 POSITION_SPAN 格的區間。
 *
 * 純函式：不知道畫布、不知道像素。框怎麼畫是 components/Fretboard/geometry.ts 的事。
 */
import { DEFAULT_FRET_COUNT, STANDARD_TUNING } from './fretboard'
import { mod12, parseNoteName } from './intervals'
import type { PitchClass, Tuning } from './types'

/** 一個把位涵蓋的格數：4 格是手不移動按得到的範圍，第 5 格留給延伸音的伸展 */
export const POSITION_SPAN = 5
/** 根音在這幾格之內時，琴枕本身就是 barre —— 把位往下延伸到空弦（開放和弦的指型會用到空弦） */
const NUT_REACH = 3
/** 窄於此的殘框不畫：指板末端只剩兩格時框起來只是雜訊 */
const MIN_POSITION_WIDTH = 3
/** 由最低音弦往上取幾條弦當錨（6/5/4 弦＝吉他三種可移動指型） */
const ANCHOR_STRING_COUNT = 3

export interface FretboardPosition {
  /** 穩定識別（錨定弦-錨定格），供 UI 記住使用者選了哪一個把位 */
  id: string
  /** 框住的格範圍（含）；fromFret 0 代表這個把位用得到空弦 */
  fromFret: number
  toFret: number
  /** 根音所在弦（1 = 高音 e）。6 弦根音＝E 型、5 弦＝A 型、4 弦＝D 型 */
  rootString: number
  rootFret: number
}

export interface ChordPositionOptions {
  tuning?: Tuning
  fretCount?: number
  span?: number
}

/**
 * 算出一個和弦在指板上的把位框。
 *
 * 重疊處理：候選框依起始格排序，同起始格時**低音弦優先**（6 弦指型比 4 弦指型
 * 更常用），接著貪婪地丟掉與已接受的框重疊者。結果保證互不重疊，
 * 因此畫出來的框永遠是清楚分隔的區塊，不會疊成一團。
 *
 * 未被任何框涵蓋的音點仍然存在（它們確實是和弦音），由 UI 以低透明度呈現。
 */
export function chordPositions(
  rootPc: PitchClass,
  options: ChordPositionOptions = {},
): FretboardPosition[] {
  const {
    tuning = STANDARD_TUNING,
    fretCount = DEFAULT_FRET_COUNT,
    span = POSITION_SPAN,
  } = options

  const lowest = tuning.length
  const anchorStrings: number[] = []
  for (let i = 0; i < ANCHOR_STRING_COUNT; i++) {
    const string = lowest - i
    if (string >= 1) anchorStrings.push(string)
  }

  const candidates: FretboardPosition[] = []
  for (const rootString of anchorStrings) {
    const openPc = parseNoteName(tuning[rootString - 1] ?? 'E').pc
    for (let rootFret = 0; rootFret <= fretCount; rootFret++) {
      if (mod12(openPc + rootFret) !== rootPc) continue
      const fromFret = rootFret <= NUT_REACH ? 0 : rootFret
      const toFret = Math.min(fretCount, rootFret + span - 1)
      if (toFret - fromFret + 1 < MIN_POSITION_WIDTH) continue
      candidates.push({ id: `${rootString}-${rootFret}`, fromFret, toFret, rootString, rootFret })
    }
  }

  candidates.sort((a, b) => a.fromFret - b.fromFret || b.rootString - a.rootString)

  const accepted: FretboardPosition[] = []
  for (const candidate of candidates) {
    const previous = accepted[accepted.length - 1]
    if (previous && candidate.fromFret <= previous.toFret) continue
    accepted.push(candidate)
  }
  return accepted
}

/** 某一格是否落在把位內（UI 判斷音點該亮還是該暗） */
export function isInPosition(position: FretboardPosition, fret: number): boolean {
  return fret >= position.fromFret && fret <= position.toFret
}

export function findPosition(
  positions: readonly FretboardPosition[],
  id: string | null | undefined,
): FretboardPosition | undefined {
  return id ? positions.find((p) => p.id === id) : undefined
}
