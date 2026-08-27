/**
 * comping 格子運算的防線。
 * beatsToNextHit 是這裡唯一有難度的一支：算錯不會有錯音，只會「聽起來糊糊的」。
 */
import { describe, expect, it } from 'vitest'
import { parseCells } from '@/core/audio'
import { beatsToNextHit, cellIndexOf, compRoleAt, isCompHit } from './comping'

const FREDDIE = [parseCells('o.|o.|o.|o.')]
const CHARLESTON = [parseCells('X.|.o|..|..')]
const BALLAD = [parseCells('X.|..|o.|..')]
const CLAVE = [parseCells('..|o.|o.|..'), parseCells('X.|.o|..|o.')]

describe('cellIndexOf', () => {
  it('拍與拍內細分 → 小節內格號', () => {
    expect(cellIndexOf(1, 1, 2)).toBe(0)
    expect(cellIndexOf(1, 2, 2)).toBe(1)
    expect(cellIndexOf(3, 1, 2)).toBe(4)
    expect(cellIndexOf(2, 3, 4)).toBe(6)
  })
})

describe('compRoleAt / isCompHit', () => {
  it('單小節的圖形每一小節重複', () => {
    expect(isCompHit(CHARLESTON, 1, 0)).toBe(true)
    expect(isCompHit(CHARLESTON, 1, 3)).toBe(true)
    expect(isCompHit(CHARLESTON, 1, 1)).toBe(false)
    expect(isCompHit(CHARLESTON, 7, 3)).toBe(true)
  })

  it('兩小節的圖形照 bar 交替（clave 的 2 面與 3 面）', () => {
    expect(isCompHit(CLAVE, 1, 0)).toBe(false)
    expect(isCompHit(CLAVE, 1, 2)).toBe(true)
    expect(isCompHit(CLAVE, 2, 0)).toBe(true)
    expect(isCompHit(CLAVE, 3, 0)).toBe(false)
    expect(isCompHit(CLAVE, 4, 0)).toBe(true)
  })

  it('格子外一律 rest（資料短了不該被當成敲點）', () => {
    expect(compRoleAt(CHARLESTON, 1, 99)).toBe('rest')
    expect(compRoleAt([], 1, 0)).toBe('rest')
  })
})

describe('beatsToNextHit', () => {
  it('四分音符 comping：每一擊響一拍', () => {
    expect(beatsToNextHit(FREDDIE, 1, 0, 2, 4)).toBe(1)
    expect(beatsToNextHit(FREDDIE, 1, 6, 2, 4)).toBe(1)
  })

  it('Charleston：1 → 2 的反拍是 1.5 拍，反拍 → 下一小節的 1 是 2.5 拍', () => {
    expect(beatsToNextHit(CHARLESTON, 1, 0, 2, 4)).toBe(1.5)
    expect(beatsToNextHit(CHARLESTON, 1, 3, 2, 4)).toBe(2.5)
  })

  it('抒情曲的 1 與 3：各響兩拍', () => {
    expect(beatsToNextHit(BALLAD, 1, 0, 2, 4)).toBe(2)
    expect(beatsToNextHit(BALLAD, 1, 4, 2, 4)).toBe(2)
  })

  it('跨小節時看的是下一小節的那一列（兩小節圖形不會算錯）', () => {
    // 第 1 小節最後一擊在第 3 拍；下一擊是第 2 小節的第 1 拍
    expect(beatsToNextHit(CLAVE, 1, 4, 2, 4)).toBe(2)
  })

  it('整個循環只有一擊時給循環長度，並以兩小節封頂', () => {
    const sparse = [parseCells('X.|..|..|..')]
    expect(beatsToNextHit(sparse, 1, 0, 2, 4)).toBe(4)
    const twoBarSparse = [parseCells('X.|..|..|..'), parseCells('..|..|..|..')]
    expect(beatsToNextHit(twoBarSparse, 1, 0, 2, 4)).toBe(8)
  })
})
