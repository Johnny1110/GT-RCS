/**
 * 把位（把位框）：把 22 格上散落的音點切成看得出來的指型區塊。
 *
 * 為什麼需要這一層：mapToFretboard 會吐出「全指板每一個屬於這組音的音點」——一個
 * 七和弦有 40 幾點、一個七音音階有 90 幾點。全部畫出來資訊是完整的，但使用者看不出
 * 「哪幾個音湊成一個手不移動就按得到的指型」，等於看不出把位。
 *
 * 兩種把位系統，兩套錨定規則（吉他就是這樣教的）：
 * - 和弦（chordPositions）：以**低音弦上的根音**為錨——6 弦（E 型）、5 弦（A 型）、
 *   4 弦（D 型）。彼此互不重疊，可以同時畫出來鋪滿琴頸。
 * - 音階（scalePositions）：以**最低弦上的每一個音階音**為錨，一個八度內有幾個音就有
 *   幾個把位（七音音階 7 個、五聲 5 個）。這些把位**天生互相重疊**（相鄰把位共用兩三格），
 *   所以 UI 一次只畫一個（Fretboard 的 positionMode='focus'）。
 *
 * 框 = 手的位置，不是嚴格的指法：框內所有音點都在同一個手型構得到的範圍內，
 * 所以框會比「每弦剛好 N 個音」的指法多含一兩個音——那些音本來就按得到。
 *
 * 純函式：不知道畫布、不知道像素。框怎麼畫是 components/Fretboard/geometry.ts 的事。
 */
import { SCALE_FORMULAS, type ScaleType } from './formulas'
import { DEFAULT_FRET_COUNT, STANDARD_TUNING } from './fretboard'
import { mod12, parseNoteName } from './intervals'
import { spell } from './spelling'
import type { DegreeLabel, Note, NoteName, PitchClass, Tuning } from './types'

/** 和弦把位涵蓋的格數：4 格是手不移動按得到的範圍，第 5 格留給延伸音的伸展 */
export const POSITION_SPAN = 5
/** 根音在這幾格之內時，琴枕本身就是 barre —— 把位往下延伸到空弦（開放和弦的指型會用到空弦） */
const NUT_REACH = 3
/** 窄於此的殘框不畫：指板末端只剩兩格時框起來只是雜訊 */
const MIN_POSITION_WIDTH = 3
/** 音階把位至少四格（五聲盒型就是四格）；更窄的是指板末端切剩的殘料，不是把位 */
const MIN_SCALE_POSITION_WIDTH = 4
/** 由最低音弦往上取幾條弦當錨（6/5/4 弦＝吉他三種可移動和弦指型） */
const ANCHOR_STRING_COUNT = 3
/** 音階把位只取一個八度內的錨點：再往上是同一組指型高八度重複，列出來只是雜訊 */
const OCTAVE = 12

export interface FretboardPosition {
  /** 穩定識別（錨定弦-錨定格），供 UI 記住使用者選了哪一個把位 */
  id: string
  /** 框住的格範圍（含）；fromFret 0 代表這個把位用得到空弦 */
  fromFret: number
  toFret: number
  /** 錨定音所在弦（1 = 高音 e）。和弦：根音在 6 弦＝E 型、5 弦＝A 型、4 弦＝D 型 */
  anchorString: number
  anchorFret: number
  /** 錨定音的度數。和弦把位恆為 '1'（以根音錨定）；音階把位＝這個指型從第幾度音起 */
  anchorDegree: DegreeLabel
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
  for (const anchorString of anchorStrings) {
    const openPc = parseNoteName(tuning[anchorString - 1] ?? 'E').pc
    for (let anchorFret = 0; anchorFret <= fretCount; anchorFret++) {
      if (mod12(openPc + anchorFret) !== rootPc) continue
      const fromFret = anchorFret <= NUT_REACH ? 0 : anchorFret
      const toFret = Math.min(fretCount, anchorFret + span - 1)
      if (toFret - fromFret + 1 < MIN_POSITION_WIDTH) continue
      candidates.push({
        id: `${anchorString}-${anchorFret}`,
        fromFret,
        toFret,
        anchorString,
        anchorFret,
        anchorDegree: '1',
      })
    }
  }

  candidates.sort((a, b) => a.fromFret - b.fromFret || b.anchorString - a.anchorString)

  const accepted: FretboardPosition[] = []
  for (const candidate of candidates) {
    const previous = accepted[accepted.length - 1]
    if (previous && candidate.fromFret <= previous.toFret) continue
    accepted.push(candidate)
  }
  return accepted
}

export interface ScalePositionOptions {
  tuning?: Tuning
  fretCount?: number
}

/**
 * 指型骨架：算把位用的音集合可以不等於音階本身。
 *
 * 藍調音階是「小調五聲 + b5」，b5 是夾在 4 與 5 之間的經過音——用 6 個音去分配每弦音數
 * 會讓指型每過一條弦就往下漂一格（每弦前進 4 個半音，弦距卻是 5 個），算出來的框沒有意義。
 * 吉他手實際上也是按五聲盒型再把 b5 塞進去，所以骨架取五聲；落在框內的 b5 音點自然被含住。
 */
const POSITION_SKELETON: Partial<Record<ScaleType, readonly DegreeLabel[]>> = {
  blues: SCALE_FORMULAS.minorPentatonic,
}

/**
 * 每弦音數：讓「每弦前進的半音數」盡量貼近弦距（標準調弦平均約 5 個半音），
 * 指型才不會一條弦一條弦地往上或往下漂。七音音階得 3（3NPS）、五聲得 2（盒型）。
 */
function notesPerString(scaleSize: number): number {
  return Math.max(2, Math.round((scaleSize * 5) / 12))
}

/**
 * 各弦空弦音高（相對最低弦，含八度）。
 * 調弦只給音名（pitch class），八度靠「每條弦比下一條高，最少 1 個半音」推回來；
 * 相鄰兩弦同音名（如某些 drop / 12 弦調弦）視為差一個八度。
 */
function openStringPitches(tuning: Tuning): number[] {
  const pcs = tuning.map((name) => parseNoteName(name).pc)
  const pitches = new Array<number>(tuning.length)
  const lowIndex = tuning.length - 1
  pitches[lowIndex] = pcs[lowIndex] ?? 0
  for (let i = lowIndex - 1; i >= 0; i--) {
    const step = mod12((pcs[i] ?? 0) - (pcs[i + 1] ?? 0))
    pitches[i] = (pitches[i + 1] ?? 0) + (step === 0 ? OCTAVE : step)
  }
  return pitches
}

/** 下一個音階音（嚴格往上找，保證收斂：音階至少有一個音） */
function nextScalePitch(pitch: number, scalePcs: ReadonlySet<number>): number {
  let next = pitch + 1
  while (!scalePcs.has(mod12(next))) next++
  return next
}

/**
 * 從某個起音走完一遍指型（最低弦 → 最高弦，每弦 perString 個音），回傳涵蓋的格範圍。
 * 這就是把位框的定義：手放在這個範圍內，這一趟音階不用移動左手就走得完。
 */
function walkPosition(
  startPitch: number,
  scalePcs: ReadonlySet<number>,
  openPitches: readonly number[],
  perString: number,
): { min: number; max: number } {
  let pitch = startPitch
  let min = Infinity
  let max = -Infinity
  for (let string = openPitches.length; string >= 1; string--) {
    const open = openPitches[string - 1] ?? 0
    for (let i = 0; i < perString; i++) {
      const fret = pitch - open
      if (fret < min) min = fret
      if (fret > max) max = fret
      pitch = nextScalePitch(pitch, scalePcs)
    }
  }
  return { min, max }
}

/**
 * 算出一個音階在指板上的把位框。
 *
 * 錨點＝最低弦上一個八度內的每一個音階音，因此把位數 = 音階音數
 * （七音音階 7 個、五聲 5 個），編號慣例上的「第 N 把位」就是錨在第 N 個音階音的那一個。
 * 標籤用錨定音的**度數**而非序號：'1' 的框就是根音起的盒型，'b3' 的框從小三度起，
 * 這比「第 2 個」多說了一件事，而且直接對得上音點上的度數標記。
 *
 * 與和弦把位的關鍵差異：這些框**互相重疊**（相鄰把位共用兩三格，音階本來就是這樣接把的），
 * 不做去重——去掉重疊的等於刪掉一半的把位。UI 因此一次只畫一個框。
 */
export function scalePositions(
  root: NoteName,
  scale: ScaleType,
  options: ScalePositionOptions = {},
): FretboardPosition[] {
  const { tuning = STANDARD_TUNING, fretCount = DEFAULT_FRET_COUNT } = options
  if (tuning.length === 0) return []

  const notes: Note[] = spell(root, POSITION_SKELETON[scale] ?? SCALE_FORMULAS[scale])
  const scalePcs = new Set<number>(notes.map((note) => note.pc))
  const perString = notesPerString(scalePcs.size)
  const openPitches = openStringPitches(tuning)
  const lowest = tuning.length
  const lowOpen = openPitches[lowest - 1] ?? 0

  const byPc = new Map<number, Note>()
  for (const note of notes) if (!byPc.has(note.pc)) byPc.set(note.pc, note)

  const positions: FretboardPosition[] = []
  for (let fret = 0; fret < OCTAVE && fret <= fretCount; fret++) {
    const anchor = byPc.get(mod12(lowOpen + fret))
    if (!anchor) continue
    const walk = walkPosition(lowOpen + fret, scalePcs, openPitches, perString)
    // 有些指型會往琴枕外延伸（高音弦上的音落在第 -1 格）——那個把位在這個八度按不出來，
    // 整組往上移一個八度。音階每 12 半音重複，所以指型不變，只是整個框平移 12 格。
    const octaveShift = walk.min < 0 ? OCTAVE : 0
    const anchorFret = fret + octaveShift
    // 夾回指板範圍：短琴頸（或高把位）走出去的音按不到，框就到指板末端為止
    const fromFret = walk.min + octaveShift
    const toFret = Math.min(fretCount, walk.max + octaveShift)
    if (toFret - fromFret + 1 < MIN_SCALE_POSITION_WIDTH) continue
    positions.push({
      id: `${lowest}-${anchorFret}`,
      fromFret,
      toFret,
      anchorString: lowest,
      anchorFret,
      anchorDegree: anchor.degree,
    })
  }
  return positions.sort((a, b) => a.fromFret - b.fromFret)
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
