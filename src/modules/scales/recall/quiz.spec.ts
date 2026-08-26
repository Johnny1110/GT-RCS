import { describe, it, expect } from 'vitest'
import { SCALE_FORMULAS, parseNoteName, spell } from '@/core/theory'
import { KEYS, SCALE_TYPES } from '../shared'
import {
  accuracy, buildQuestion, cellAt, chromaticBoard, emptyScore, hasPosition,
  recallItems, refillBag, samePosition, shuffleBag,
} from './quiz'

/** 固定序列的假亂數：測試不靠運氣 */
function sequence(values: readonly number[]): () => number {
  let i = 0
  return () => values[i++ % values.length] ?? 0
}

describe('recallItems（出題池）', () => {
  it('音名語言＝12 個標準拼寫，涵蓋 12 個不同的 pitch class', () => {
    const items = recallItems('note', 'C', 'ionian')
    expect(items).toHaveLength(12)
    expect(new Set(items.map((i) => i.pc)).size).toBe(12)
    expect(items.map((i) => i.label)).toEqual([...KEYS])
  })

  it('度數語言＝該音階的度數，跟著音階換', () => {
    expect(recallItems('degree', 'A', 'dorian').map((i) => i.label))
      .toEqual([...SCALE_FORMULAS.dorian])
    expect(recallItems('degree', 'A', 'minorPentatonic').map((i) => i.label))
      .toEqual([...SCALE_FORMULAS.minorPentatonic])
  })

  it('度數語言的 pitch class 與 spell() 一致（出題池回溯得到公式表）', () => {
    const items = recallItems('degree', 'Eb', 'lydian')
    expect(items.map((i) => i.pc)).toEqual(spell('Eb', SCALE_FORMULAS.lydian).map((n) => n.pc))
  })

  it('每個項目都帶著它在指板上的所有位置，且位置的音高就是該項目', () => {
    for (const item of recallItems('degree', 'G', 'blues')) {
      expect(item.cells.length, `${item.label} 在 22 格指板上應該不只一格`).toBeGreaterThan(3)
      for (const cell of item.cells) expect(cell.note.pc).toBe(item.pc)
    }
  })

  it('12 調 × 全部音階都出得了題（不丟例外、不出空池）', () => {
    for (const key of KEYS) {
      for (const scale of SCALE_TYPES) {
        const items = recallItems('degree', key, scale)
        expect(items.length, `${key} ${scale}`).toBe(SCALE_FORMULAS[scale].length)
        for (const item of items) expect(item.cells.length, `${key} ${scale} ${item.label}`).toBeGreaterThan(0)
      }
    }
  })
})

describe('buildQuestion', () => {
  const items = recallItems('note', 'C', 'ionian')
  const first = items[0]!

  it('find 方向不指定某一格——整塊指板都是答案', () => {
    expect(buildQuestion(first, 'find', () => 0.5).prompt).toBeNull()
  })

  it('name 方向抽一格，且抽到的一定是該項目的位置之一', () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const question = buildQuestion(first, 'name', () => r)
      expect(question.prompt).not.toBeNull()
      expect(hasPosition(first.cells, question.prompt!)).toBe(true)
    }
  })

  it('亂數回傳 1（邊界）不會抽到陣列外', () => {
    expect(buildQuestion(first, 'name', () => 1).prompt).not.toBeNull()
  })
})

describe('shuffleBag / refillBag', () => {
  const items = recallItems('degree', 'A', 'minorPentatonic')

  it('洗牌保留全部項目，不多不少', () => {
    const bag = shuffleBag(items, sequence([0.1, 0.9, 0.4, 0.7, 0.2]))
    expect(bag).toHaveLength(items.length)
    expect(new Set(bag.map((i) => i.label))).toEqual(new Set(items.map((i) => i.label)))
  })

  it('補牌時把重複的那一張換掉——一副牌的交界處是唯一會連續出兩次的地方', () => {
    const bag = refillBag(items, () => 0, items[0]!.label)
    expect(bag[0]?.label).not.toBe(items[0]!.label)
    expect(bag).toHaveLength(items.length)
  })

  it('沒有要避開的項目時照原樣發（第一輪）', () => {
    expect(refillBag(items, () => 0, null)).toHaveLength(items.length)
  })

  it('只有一個項目時不會卡住（理論上不會發生，但不能無限迴圈）', () => {
    const single = items.slice(0, 1)
    expect(refillBag(single, () => 0, single[0]!.label)).toHaveLength(1)
  })
})

describe('位置比對', () => {
  it('同弦同格才算同一格', () => {
    expect(samePosition({ string: 3, fret: 5 }, { string: 3, fret: 5 })).toBe(true)
    expect(samePosition({ string: 3, fret: 5 }, { string: 4, fret: 5 })).toBe(false)
    expect(samePosition({ string: 3, fret: 5 }, { string: 3, fret: 6 })).toBe(false)
  })

  it('空弦（fret 0）是一格，不是「沒有」', () => {
    expect(hasPosition([{ string: 1, fret: 0 }], { string: 1, fret: 0 })).toBe(true)
    expect(hasPosition([], { string: 1, fret: 0 })).toBe(false)
  })
})

describe('chromaticBoard（誤點回饋的來源）', () => {
  it('每一格都查得到音——回饋一定說得出「你點的是什麼」', () => {
    const board = chromaticBoard('C')
    for (let string = 1; string <= 6; string++) {
      for (let fret = 0; fret <= 22; fret++) {
        expect(cellAt(board, { string, fret }), `第 ${string} 弦第 ${fret} 格`).toBeDefined()
      }
    }
  })

  it('空弦音就是標準調弦（第 6 弦 E、第 1 弦 E、第 5 弦 A）', () => {
    const board = chromaticBoard('C')
    expect(cellAt(board, { string: 6, fret: 0 })?.note.pc).toBe(parseNoteName('E').pc)
    expect(cellAt(board, { string: 1, fret: 0 })?.note.pc).toBe(parseNoteName('E').pc)
    expect(cellAt(board, { string: 5, fret: 0 })?.note.pc).toBe(parseNoteName('A').pc)
  })

  it('第 6 弦第 5 格是 A（吉他手的定位點）', () => {
    expect(cellAt(chromaticBoard('C'), { string: 6, fret: 5 })?.note.pc).toBe(parseNoteName('A').pc)
  })

  it('12 個調都拼得出完整的半音階（拼寫走 core，不丟例外）', () => {
    for (const key of KEYS) {
      const board = chromaticBoard(key)
      expect(new Set(board.map((c) => c.note.pc)).size, key).toBe(12)
    }
  })
})

describe('計分', () => {
  it('還沒作答時正確率是 0，不是 NaN', () => {
    expect(accuracy(emptyScore())).toBe(0)
  })

  it('正確率＝命中 ÷（命中＋誤點＋漏掉）', () => {
    expect(accuracy({ questions: 2, hits: 8, misses: 2, missed: 0 })).toBe(80)
    expect(accuracy({ questions: 2, hits: 6, misses: 2, missed: 2 })).toBe(60)
  })

  it('漏掉的算進分母——換題時沒找到的不能當作沒發生', () => {
    expect(accuracy({ questions: 1, hits: 5, misses: 0, missed: 5 })).toBe(50)
  })
})
