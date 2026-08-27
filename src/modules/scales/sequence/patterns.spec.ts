/**
 * 行為鎖定：模進的索引序列、分組，以及「第幾格彈第幾個音」的跨小節推進。
 *
 * 這一組測試守兩件事：
 * 1. 畫面圈的音與耳朵聽到的音共用同一份順序（兩邊各自排一次遲早不一致）。
 * 2. 格號是**絕對**的。每小節重算會讓序列永遠停在第一組，而症狀看起來像速度不對。
 */
import { describe, it, expect } from 'vitest'
import { scalePositions, scaleShapePath } from '@/core/theory'
import {
  SEQUENCE_PATTERNS, absoluteSlot, alignmentBars, findSequencePattern, groupCount, groupIndices,
  groupOf, isSequenceDirection, orderedCells, sequenceIndices, slotsPerBar, stepAt,
  type SequencePattern,
} from './patterns'

const pattern = (id: string): SequencePattern => findSequencePattern(id)!

describe('SEQUENCE_PATTERNS', () => {
  it('id 與 titleKey 都唯一（選單重複＝有一個永遠選不到）', () => {
    expect(new Set(SEQUENCE_PATTERNS.map((p) => p.id)).size).toBe(SEQUENCE_PATTERNS.length)
    expect(new Set(SEQUENCE_PATTERNS.map((p) => p.titleKey)).size).toBe(SEQUENCE_PATTERNS.length)
  })

  it('每一型的 size 與 interval 都 ≥ 1（0 會產生無限長或空序列）', () => {
    for (const p of SEQUENCE_PATTERNS) {
      expect(p.size, p.id).toBeGreaterThanOrEqual(1)
      expect(p.interval, p.id).toBeGreaterThanOrEqual(1)
    }
  })

  it('findSequencePattern 擋掉竄改過的持久化值', () => {
    expect(findSequencePattern('threes')?.size).toBe(3)
    expect(findSequencePattern('nope')).toBeUndefined()
    expect(findSequencePattern(null)).toBeUndefined()
  })
})

describe('sequenceIndices', () => {
  it('直上直下＝路徑本身的順序', () => {
    expect(sequenceIndices(5, pattern('straight'), 'up')).toEqual([0, 1, 2, 3, 4])
  })

  it('三個一組：每組起點往上一個音，最後一組結束在最高音', () => {
    expect(sequenceIndices(5, pattern('threes'), 'up')).toEqual([0, 1, 2, 1, 2, 3, 2, 3, 4])
  })

  it('三度＝隔一個音的兩音組', () => {
    expect(sequenceIndices(5, pattern('thirds'), 'up')).toEqual([0, 2, 1, 3, 2, 4])
  })

  it('四度＝隔兩個音；七和弦分解＝隔一個音的四音組', () => {
    expect(sequenceIndices(5, pattern('fourths'), 'up')).toEqual([0, 3, 1, 4])
    expect(sequenceIndices(8, pattern('sevenths'), 'up')).toEqual([0, 2, 4, 6, 1, 3, 5, 7])
  })

  it('下行＝從最高音起、每組往下走（整條上行倒過來）', () => {
    expect(sequenceIndices(5, pattern('threes'), 'down')).toEqual([4, 3, 2, 3, 2, 1, 2, 1, 0])
  })

  it('上下行在折返點重複一個音——分組不能拆，寧可多彈一個音', () => {
    const upDown = sequenceIndices(4, pattern('threes'), 'upDown')
    expect(upDown).toEqual([0, 1, 2, 1, 2, 3, 3, 2, 1, 2, 1, 0])
    // 長度仍是 size 的整數倍：每一組都完整，三連音才不會被切斷
    expect(upDown.length % 3).toBe(0)
  })

  it('任何組合的索引都落在路徑範圍內（越界就是圈到不存在的格）', () => {
    for (const p of SEQUENCE_PATTERNS) {
      for (const direction of ['up', 'down', 'upDown'] as const) {
        for (const length of [12, 15, 18]) {
          for (const index of sequenceIndices(length, p, direction)) {
            expect(index, `${p.id}/${direction}/${length}`).toBeGreaterThanOrEqual(0)
            expect(index, `${p.id}/${direction}/${length}`).toBeLessThan(length)
          }
        }
      }
    }
  })

  it('每一型在最短的指型（五聲 12 音）上都走得完至少一組', () => {
    for (const p of SEQUENCE_PATTERNS) {
      expect(sequenceIndices(12, p, 'up').length, p.id).toBeGreaterThanOrEqual(p.size)
    }
  })

  it('指型短到一組都走不完就回空序列（不偷偷改成別的練習）', () => {
    expect(sequenceIndices(3, pattern('sevenths'), 'up')).toEqual([])
    expect(sequenceIndices(0, pattern('straight'), 'up')).toEqual([])
  })
})

describe('分組', () => {
  const sequence = sequenceIndices(5, pattern('threes'), 'up')

  it('groupOf / groupCount：序列是一組接一組排出來的', () => {
    expect(groupOf(0, 3)).toBe(0)
    expect(groupOf(2, 3)).toBe(0)
    expect(groupOf(3, 3)).toBe(1)
    expect(groupCount(sequence.length, 3)).toBe(3)
  })

  it('groupIndices 取出「現在這一組」', () => {
    expect(groupIndices(sequence, 0, 3)).toEqual([0, 1, 2])
    expect(groupIndices(sequence, 2, 3)).toEqual([2, 3, 4])
    expect(groupIndices(sequence, 99, 3)).toEqual([])
  })
})

describe('絕對格號（跨小節連續前進）', () => {
  it('第 1 小節第 1 拍第 1 格 = 0', () => {
    expect(absoluteSlot({ bar: 1, beat: 1, tick: 1 }, 4, 1)).toBe(0)
  })

  it('小節換了格號要繼續往前，不是回到 0', () => {
    expect(absoluteSlot({ bar: 2, beat: 1, tick: 1 }, 4, 1)).toBe(4)
    expect(absoluteSlot({ bar: 3, beat: 2, tick: 1 }, 4, 1)).toBe(9)
  })

  it('細分算進格號：4/4 八分音符一小節 8 格', () => {
    expect(slotsPerBar(4, 2)).toBe(8)
    expect(absoluteSlot({ bar: 1, beat: 2, tick: 2 }, 4, 2)).toBe(3)
    expect(absoluteSlot({ bar: 2, beat: 1, tick: 1 }, 4, 2)).toBe(8)
  })

  it('停止播放（bar 0）不會算出負格號', () => {
    expect(absoluteSlot({ bar: 0, beat: 0, tick: 0 }, 4, 1)).toBe(0)
  })

  it('stepAt 循環：走完整條序列就回到第一個音', () => {
    expect(stepAt(9, 0)).toBe(0)
    expect(stepAt(9, 9)).toBe(0)
    expect(stepAt(9, 10)).toBe(1)
    expect(stepAt(0, 3)).toBeUndefined()
  })
})

describe('alignmentBars', () => {
  it('除得盡就是 1 個小節回到開頭', () => {
    expect(alignmentBars(4, 4)).toBe(1)
    expect(alignmentBars(8, 8)).toBe(1)
  })

  it('除不盡時算出「幾個小節之後回到小節線」', () => {
    expect(alignmentBars(28, 8)).toBe(7)
    expect(alignmentBars(16, 8)).toBe(2)
    expect(alignmentBars(9, 4)).toBe(9)
  })

  it('空序列不炸', () => {
    expect(alignmentBars(0, 4)).toBe(0)
    expect(alignmentBars(9, 0)).toBe(0)
  })
})

describe('與指型路徑接起來（core → 模組）', () => {
  const box = scalePositions('A', 'minorPentatonic').find((p) => p.anchorDegree === '1')!
  const path = scaleShapePath('A', 'minorPentatonic', box)

  it('四個一組的第一組＝盒型的前四個音', () => {
    const sequence = sequenceIndices(path.length, pattern('fours'), 'up')
    const first = orderedCells(path, groupIndices(sequence, 0, 4))
    expect(first.map((c) => `${c.string}/${c.fret}`)).toEqual(['6/5', '6/8', '5/5', '5/7'])
    expect(first.map((c) => c.note.degree)).toEqual(['1', 'b3', '4', '5'])
  })

  it('第二組往上移一個音（模進的定義）', () => {
    const sequence = sequenceIndices(path.length, pattern('fours'), 'up')
    const second = orderedCells(path, groupIndices(sequence, 1, 4))
    expect(second.map((c) => c.note.degree)).toEqual(['b3', '4', '5', 'b7'])
  })

  it('orderedCells 跳過越界索引（路徑被指板末端截斷時不畫幽靈音點）', () => {
    expect(orderedCells(path, [0, 999]).length).toBe(1)
  })

  it('一弦三音的路徑接得起來：C Ionian 三個一組的第一組是 C-D-E', () => {
    const shape = scalePositions('C', 'ionian').find((p) => p.anchorDegree === '1')!
    const threeNps = scaleShapePath('C', 'ionian', shape)
    const sequence = sequenceIndices(threeNps.length, pattern('threes'), 'up')
    expect(orderedCells(threeNps, groupIndices(sequence, 0, 3)).map((c) => c.note.name))
      .toEqual(['C', 'D', 'E'])
  })
})

describe('isSequenceDirection', () => {
  it('擋掉竄改過的持久化值', () => {
    expect(isSequenceDirection('upDown')).toBe(true)
    expect(isSequenceDirection('sideways')).toBe(false)
    expect(isSequenceDirection(undefined)).toBe(false)
  })
})
