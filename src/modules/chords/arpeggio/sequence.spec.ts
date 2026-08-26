/**
 * 行為鎖定：琶音音序與「第幾格彈第幾個音」的對應。
 *
 * 這一組測試守的是「畫面圈的音」與「耳朵聽到的音」共用同一份順序——
 * 兩邊一旦各自算，症狀是畫面圈著 3 音、喇叭響 b7，而且只有耳朵好的人聽得出來。
 */
import { describe, it, expect } from 'vitest'
import { spell, CHORD_FORMULAS } from '@/core/theory'
import {
  arpeggioOrder, fitsBar, isArpeggioDirection, orderedTones, slotOf, slotsPerBar, stepAt, toneIndexAt,
} from './sequence'

const DM7 = spell('D', CHORD_FORMULAS.m7)

describe('arpeggioOrder', () => {
  it('上行＝公式原本的順序', () => {
    expect(arpeggioOrder(4, 'up')).toEqual([0, 1, 2, 3])
  })

  it('下行＝倒過來（從七音下來）', () => {
    expect(arpeggioOrder(4, 'down')).toEqual([3, 2, 1, 0])
  })

  it('上下行不重複頭尾：折返點只彈一次', () => {
    expect(arpeggioOrder(4, 'upDown')).toEqual([0, 1, 2, 3, 2, 1])
  })

  it('三和弦與兩音也不炸（上下行長度 2n-2）', () => {
    expect(arpeggioOrder(3, 'upDown')).toEqual([0, 1, 2, 1])
    expect(arpeggioOrder(2, 'upDown')).toEqual([0, 1])
    expect(arpeggioOrder(1, 'upDown')).toEqual([0])
  })

  it('沒有音就沒有序列（空和弦不該產生一格靜音以外的東西）', () => {
    expect(arpeggioOrder(0, 'up')).toEqual([])
  })
})

describe('isArpeggioDirection', () => {
  it('擋掉竄改過的持久化值', () => {
    expect(isArpeggioDirection('upDown')).toBe(true)
    expect(isArpeggioDirection('sideways')).toBe(false)
    expect(isArpeggioDirection(undefined)).toBe(false)
  })
})

describe('slotOf / slotsPerBar', () => {
  it('正拍（每拍 1 格）：第 n 拍就是第 n-1 格', () => {
    expect([1, 2, 3, 4].map((beat) => slotOf(beat, 1, 1))).toEqual([0, 1, 2, 3])
    expect(slotsPerBar(4, 1)).toBe(4)
  })

  it('八分細分：一拍兩格，反拍是奇數格', () => {
    expect(slotOf(1, 2, 2)).toBe(1)
    expect(slotOf(3, 1, 2)).toBe(4)
    expect(slotsPerBar(4, 2)).toBe(8)
  })

  it('十六分細分：第 2 拍的第 3 個十六分是第 6 格', () => {
    expect(slotOf(2, 3, 4)).toBe(6)
    expect(slotsPerBar(4, 4)).toBe(16)
  })

  it('6/8 的一小節六格（上下行 6 音正好對齊）', () => {
    expect(slotsPerBar(6, 1)).toBe(6)
  })

  it('transport 尚未送出第一個 tick（0/0）時不會算出負格', () => {
    expect(slotOf(0, 0, 2)).toBe(0)
    expect(slotsPerBar(0, 0)).toBe(1)
  })
})

describe('stepAt / toneIndexAt', () => {
  const upDown = arpeggioOrder(4, 'upDown')

  it('序列循環：格數超過序列長度就繞回開頭', () => {
    expect([0, 1, 5, 6, 7].map((slot) => stepAt(upDown.length, slot))).toEqual([0, 1, 5, 0, 1])
  })

  it('第 n 格 → 第幾個和弦內音（上下行走到第 5 格是回頭的 5 音）', () => {
    expect([0, 1, 2, 3, 4, 5].map((slot) => toneIndexAt(upDown, slot))).toEqual([0, 1, 2, 3, 2, 1])
  })

  it('4 格小節配 4 音上行：每個小節線都落在根音上', () => {
    const up = arpeggioOrder(4, 'up')
    expect([0, 4, 8].map((slot) => toneIndexAt(up, slot))).toEqual([0, 0, 0])
  })

  it('空序列回 undefined（呼叫端不發聲，而不是發出第 0 個音）', () => {
    expect(stepAt(0, 3)).toBeUndefined()
    expect(toneIndexAt([], 3)).toBeUndefined()
  })
})

describe('fitsBar', () => {
  it('4 音上行對 4 格小節：對齊', () => {
    expect(fitsBar(4, 4)).toBe(true)
    expect(fitsBar(4, 8)).toBe(true)
  })

  it('6 音上下行對 4 格小節：對不齊（畫面要提示改細分）', () => {
    expect(fitsBar(6, 4)).toBe(false)
    expect(fitsBar(6, 8)).toBe(false)
  })

  it('6 音上下行對 6 格（6/8）或 12 格（三連音）小節：對齊', () => {
    expect(fitsBar(6, 6)).toBe(true)
    expect(fitsBar(6, 12)).toBe(true)
  })

  it('空序列不算對齊', () => {
    expect(fitsBar(0, 4)).toBe(false)
  })
})

describe('orderedTones', () => {
  it('依索引序列排出要彈的音（上下行會重複中間的音）', () => {
    const tones = orderedTones(DM7, arpeggioOrder(DM7.length, 'upDown'))
    expect(tones.map((note) => note.name)).toEqual(['D', 'F', 'A', 'C', 'A', 'F'])
    expect(tones.map((note) => note.degree)).toEqual(['1', 'b3', '5', 'b7', '5', 'b3'])
  })

  it('索引超出範圍就跳過，不產生 undefined 的音點', () => {
    expect(orderedTones(DM7, [0, 9])).toHaveLength(1)
  })
})
