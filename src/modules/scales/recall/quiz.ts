/**
 * 指板回想的出題與比對（純函式，PRD F7-1／F7-3）。
 *
 * 為什麼出題邏輯不放 core：出題是**練習設計**，不是樂理。
 * core 只回答「A dorian 的 b3 是哪個音、它在指板哪幾格」，
 * 「該不該考這一題、考到什麼算對」是模組層的事——與 modules/chords/cycle.ts 同一條界線。
 *
 * 兩個正交設定決定四種練法（PRD F7-1）：
 * - 方向 find／name：你點位置，還是你說名字
 * - 語言 note／degree：絕對音名，還是相對某個調的度數
 *
 * 比對一律以 **pitch class** 為準，不比拼寫：F# 與 Gb 在指板上是同一格，
 * 要求猜對拼寫等於把回想測驗變成拼寫測驗（PRD 實作決策 4）。
 */
import {
  CHROMATIC_DEGREES, SCALE_FORMULAS, mapToFretboard, spell, spellDegree,
  type FretCell, type FretPosition, type NoteName, type PitchClass, type ScaleType,
} from '@/core/theory'
import { KEYS } from '../shared'

export type RecallDirection = 'find' | 'name'
export type RecallLanguage = 'note' | 'degree'

export interface RecallItem {
  /** 顯示名：音名如 'F#'、度數如 'b3' */
  label: string
  pc: PitchClass
  /** 這個項目在全指板的所有位置——find 的答案、name 的抽樣來源 */
  cells: FretCell[]
}

/**
 * 出題池。音名用 12 個標準拼寫（含 F# 與 Db，這兩個都是要背的名字），
 * 度數用音階公式推導——兩者都回溯得到公式表，畫面零 hardcode 音名。
 */
export function recallItems(
  language: RecallLanguage,
  root: NoteName,
  scale: ScaleType,
): RecallItem[] {
  const notes = language === 'degree'
    ? spell(root, SCALE_FORMULAS[scale])
    : KEYS.map((key) => spellDegree(key, '1'))
  return notes.map((note) => ({
    label: language === 'degree' ? note.degree : note.name,
    pc: note.pc,
    cells: mapToFretboard([note]),
  }))
}

export interface RecallQuestion {
  item: RecallItem
  /** name 方向要辨認的那一格；find 方向為 null（整塊指板都是答案） */
  prompt: FretPosition | null
}

export function buildQuestion(
  item: RecallItem,
  direction: RecallDirection,
  random: () => number,
): RecallQuestion {
  if (direction === 'find' || item.cells.length === 0) return { item, prompt: null }
  const index = Math.min(Math.floor(random() * item.cells.length), item.cells.length - 1)
  const cell = item.cells[index]
  return { item, prompt: cell ? { string: cell.string, fret: cell.fret } : null }
}

/**
 * 洗一副牌、發完再洗（Fisher–Yates）。
 * 純隨機會連續出同一題，也會整輪漏掉某些音；五聲音階只有 5 個度數時特別明顯。
 * random 由呼叫端注入——這一層要能被固定的序列測起來。
 */
export function shuffleBag(items: readonly RecallItem[], random: () => number): RecallItem[] {
  const bag = [...items]
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.min(Math.floor(random() * (i + 1)), i)
    const swap = bag[i]
    const other = bag[j]
    if (swap === undefined || other === undefined) continue
    bag[i] = other
    bag[j] = swap
  }
  return bag
}

/**
 * 補牌。剛發完的那一張又排在新牌的最前面 = 連續兩題一樣，
 * 所以把它跟第二張對調——一副牌的交界處是唯一會出現重複的地方。
 */
export function refillBag(
  items: readonly RecallItem[],
  random: () => number,
  avoidLabel: string | null,
): RecallItem[] {
  const bag = shuffleBag(items, random)
  const first = bag[0]
  const second = bag[1]
  if (avoidLabel !== null && first !== undefined && second !== undefined && first.label === avoidLabel) {
    bag[0] = second
    bag[1] = first
  }
  return bag
}

export function samePosition(a: FretPosition, b: FretPosition): boolean {
  return a.string === b.string && a.fret === b.fret
}

export function hasPosition(list: readonly FretPosition[], position: FretPosition): boolean {
  return list.some((item) => samePosition(item, position))
}

/**
 * 全指板每一格的音（以 root 拼寫）。點錯時要說得出「你點的是什麼」——
 * 只說「錯」沒有教學價值，說「那是 D」才會當場修正心智地圖（PRD 實作決策 5）。
 */
export function chromaticBoard(root: NoteName): FretCell[] {
  return mapToFretboard(spell(root, CHROMATIC_DEGREES))
}

export function cellAt(board: readonly FretCell[], position: FretPosition): FretCell | undefined {
  return board.find((cell) => samePosition(cell, position))
}

export interface RecallScore {
  /** 出過幾題 */
  questions: number
  /** 答對幾格（find）／幾題（name） */
  hits: number
  /** 點錯幾次 */
  misses: number
  /** 換題時還沒找到的格數 */
  missed: number
}

export function emptyScore(): RecallScore {
  return { questions: 0, hits: 0, misses: 0, missed: 0 }
}

/** 正確率＝命中 ÷（命中＋誤點＋漏掉）。還沒作答時回 0，不回 NaN */
export function accuracy(score: RecallScore): number {
  const attempts = score.hits + score.misses + score.missed
  return attempts === 0 ? 0 : Math.round((score.hits / attempts) * 100)
}
