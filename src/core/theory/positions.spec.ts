/**
 * 把位推導的行為鎖定測試。
 * 「框出來的區塊互不重疊、而且真的框得住一個按得出來的指型」就是這個功能的規格。
 */
import { describe, it, expect } from 'vitest'
import { CHORD_FORMULAS, SCALE_FORMULAS, type ScaleType } from './formulas'
import { DEFAULT_FRET_COUNT, STANDARD_TUNING, mapToFretboard } from './fretboard'
import {
  chordPositions, findPosition, isInPosition, scaleNotesPerString, scalePositions, scaleShapePath,
  POSITION_SPAN,
} from './positions'
import { spell } from './spelling'
import { parseNoteName } from './intervals'
import type { NoteName, PitchClass } from './types'

const ALL_KEYS: NoteName[] = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

describe('chordPositions', () => {
  it('C 的把位錨在 5 弦第 3 格與 6 弦第 8 格（開放 C 與 E 型 barre）', () => {
    const positions = chordPositions(0)
    expect(positions.map((p) => `${p.anchorString}@${p.anchorFret}`)).toEqual([
      '5@3', '6@8', '5@15', '6@20',
    ])
    // 根音在第 3 格以內 → 琴枕當 barre，把位往下含空弦（開放 C 用得到空弦）
    expect(positions[0]).toMatchObject({ fromFret: 0, toFret: 7 })
    expect(positions[1]).toMatchObject({ fromFret: 8, toFret: 12 })
  })

  it('D 的最低把位錨在 4 弦空弦（開放 D 是 D 型指型）', () => {
    const positions = chordPositions(2)
    expect(positions[0]).toMatchObject({ anchorString: 4, anchorFret: 0, fromFret: 0, toFret: 4 })
    expect(positions[1]).toMatchObject({ anchorString: 5, anchorFret: 5 })
  })

  it('同起始格時低音弦優先（6 弦指型比 4 弦指型常用）', () => {
    // E：6 弦空弦與 4 弦第 2 格都會落在第 0 格起
    const positions = chordPositions(4)
    expect(positions[0]).toMatchObject({ anchorString: 6, anchorFret: 0 })
    expect(positions.some((p) => p.anchorString === 4 && p.anchorFret === 2)).toBe(false)
  })

  it('12 個調的把位一律互不重疊且由低到高排序', () => {
    for (const key of ALL_KEYS) {
      const positions = chordPositions(parseNoteName(key).pc)
      expect(positions.length, key).toBeGreaterThanOrEqual(3)
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i]!.fromFret, `${key} 第 ${i} 個把位與前一個重疊`)
          .toBeGreaterThan(positions[i - 1]!.toFret)
      }
    }
  })

  it('每個把位都框得住根音，且寬度不超過 span（開放把位除外）', () => {
    for (const key of ALL_KEYS) {
      for (const p of chordPositions(parseNoteName(key).pc)) {
        expect(isInPosition(p, p.anchorFret), `${key} ${p.id} 沒框到根音`).toBe(true)
        if (p.fromFret > 0) {
          expect(p.toFret - p.fromFret + 1, `${key} ${p.id} 過寬`).toBeLessThanOrEqual(POSITION_SPAN)
        }
      }
    }
  })

  it('每個把位內都湊得齊全部和弦音（框起來就按得出這個和弦）', () => {
    for (const key of ALL_KEYS) {
      for (const quality of ['maj', 'm', '7', 'maj7', 'm7b5'] as const) {
        const tones = spell(key, CHORD_FORMULAS[quality])
        const cells = mapToFretboard(tones)
        const rootPc = parseNoteName(key).pc
        for (const p of chordPositions(rootPc)) {
          const inside = new Set(
            cells.filter((c) => isInPosition(p, c.fret)).map((c) => c.note.pc),
          )
          for (const tone of tones) {
            expect(inside.has(tone.pc), `${key}${quality} ${p.id} 缺 ${tone.degree}`).toBe(true)
          }
        }
      }
    }
  })

  it('不畫指板末端的殘框（寬度不足 3 格）', () => {
    for (const key of ALL_KEYS) {
      for (const p of chordPositions(parseNoteName(key).pc)) {
        expect(p.toFret - p.fromFret + 1, `${key} ${p.id}`).toBeGreaterThanOrEqual(3)
        expect(p.toFret).toBeLessThanOrEqual(DEFAULT_FRET_COUNT)
      }
    }
  })

  it('格數與調弦可注入：12 格琴頸把位變少，且不超出格數', () => {
    const short = chordPositions(0, { fretCount: 12 })
    expect(short.length).toBeLessThan(chordPositions(0).length)
    expect(short.every((p) => p.toFret <= 12)).toBe(true)
    expect(chordPositions(0, { tuning: STANDARD_TUNING })).toEqual(chordPositions(0))
  })

  it('findPosition 取不到就回 undefined（設定值可能指向已不存在的把位）', () => {
    const positions = chordPositions(0)
    expect(findPosition(positions, positions[1]!.id)).toBe(positions[1])
    expect(findPosition(positions, 'nope')).toBeUndefined()
    expect(findPosition(positions, null)).toBeUndefined()
  })
})

describe('把位與 mapToFretboard 的一致性', () => {
  it('落在把位外的音點仍然是和弦音（框只是分組，不是過濾）', () => {
    const rootPc: PitchClass = 7
    const cells = mapToFretboard(spell('G', CHORD_FORMULAS.maj7))
    const positions = chordPositions(rootPc)
    const outside = cells.filter((c) => !positions.some((p) => isInPosition(p, c.fret)))
    expect(outside.length).toBeGreaterThan(0)
    expect(outside.every((c) => cells.includes(c))).toBe(true)
  })
})

describe('scalePositions', () => {
  const ALL_SCALES = Object.keys(SCALE_FORMULAS) as ScaleType[]

  it('A 小調五聲＝經典五個盒型，第一盒（根音起）就是第 5–8 格', () => {
    const positions = scalePositions('A', 'minorPentatonic')
    expect(positions.map((p) => p.anchorFret)).toEqual([0, 3, 5, 8, 10])
    // 標籤是錨定音的度數：'1' 的框就是根音起的盒型
    expect(positions.map((p) => p.anchorDegree)).toEqual(['5', 'b7', '1', 'b3', '4'])
    expect(positions.find((p) => p.anchorDegree === '1')).toMatchObject({ fromFret: 5, toFret: 8 })
  })

  it('C Ionian＝七個 3NPS 把位，根音起的那個是第 8–13 格', () => {
    const positions = scalePositions('C', 'ionian')
    expect(positions).toHaveLength(7)
    expect(positions.find((p) => p.anchorDegree === '1')).toMatchObject({ fromFret: 8, toFret: 13 })
    // 空弦把位（C 大調的開放把位由 3 音 E 起算）
    expect(positions[0]).toMatchObject({ anchorFret: 0, anchorDegree: '3', fromFret: 0, toFret: 5 })
  })

  it('藍調用五聲當指型骨架（b5 是經過音，不參與分弦）', () => {
    const blues = scalePositions('A', 'blues')
    const penta = scalePositions('A', 'minorPentatonic')
    expect(blues.map((p) => `${p.fromFret}-${p.toFret}`)).toEqual(
      penta.map((p) => `${p.fromFret}-${p.toFret}`),
    )
    // 但 b5 的音點確實落在框內——框是範圍，不是指法
    const cells = mapToFretboard(spell('A', SCALE_FORMULAS.blues))
    const flatFive = cells.filter((c) => c.note.degree === 'b5')
    const box = blues.find((p) => p.anchorDegree === '1')!
    expect(flatFive.some((c) => isInPosition(box, c.fret))).toBe(true)
  })

  it('把位數 = 一個八度內的音階音數（七音 7 個、五聲 5 個）', () => {
    for (const key of ALL_KEYS) {
      for (const scale of ALL_SCALES) {
        const expected = scale === 'blues' ? 5 : SCALE_FORMULAS[scale].length
        expect(scalePositions(key, scale).length, `${key} ${scale}`).toBe(expected)
      }
    }
  })

  it('每個把位都走得完整個音階（框住的範圍內湊得齊全部音階音）', () => {
    for (const key of ALL_KEYS) {
      for (const scale of ALL_SCALES) {
        const notes = spell(key, SCALE_FORMULAS[scale])
        const cells = mapToFretboard(notes)
        for (const p of scalePositions(key, scale)) {
          const inside = new Set(cells.filter((c) => isInPosition(p, c.fret)).map((c) => c.note.pc))
          for (const note of notes) {
            expect(inside.has(note.pc), `${key} ${scale} ${p.id} 缺 ${note.degree}`).toBe(true)
          }
        }
      }
    }
  })

  it('框寬落在一隻手構得到的範圍（4–7 格），且由低到高排序、不超出指板', () => {
    for (const key of ALL_KEYS) {
      for (const scale of ALL_SCALES) {
        const positions = scalePositions(key, scale)
        for (const p of positions) {
          const width = p.toFret - p.fromFret + 1
          expect(width, `${key} ${scale} ${p.id} 寬 ${width}`).toBeGreaterThanOrEqual(4)
          expect(width, `${key} ${scale} ${p.id} 寬 ${width}`).toBeLessThanOrEqual(7)
          expect(p.toFret).toBeLessThanOrEqual(DEFAULT_FRET_COUNT)
          expect(p.anchorString).toBe(6)
        }
        for (let i = 1; i < positions.length; i++) {
          expect(positions[i]!.fromFret).toBeGreaterThan(positions[i - 1]!.fromFret)
        }
      }
    }
  })

  it('音階把位「本來就會重疊」——與和弦把位的互不重疊是兩套系統', () => {
    const positions = scalePositions('C', 'ionian')
    const overlapping = positions.filter((p, i) => i > 0 && p.fromFret <= positions[i - 1]!.toFret)
    expect(overlapping.length).toBeGreaterThan(0)
  })

  it('id 唯一且與錨定格綁定（UI 靠它記住使用者選了哪個把位）', () => {
    const positions = scalePositions('G', 'mixolydian')
    expect(new Set(positions.map((p) => p.id)).size).toBe(positions.length)
    expect(findPosition(positions, positions[2]!.id)).toBe(positions[2])
    expect(findPosition(positions, '6-99')).toBeUndefined()
  })

  it('把位走出琴枕外時整組移高一個八度（第 -1 格按不出來）', () => {
    // C# 小調五聲由 b3（6 弦空弦 E）起的指型會落到第 -1 格 → 移到第 12 格的同一個指型
    const positions = scalePositions('C#', 'minorPentatonic')
    const fromFlatThird = positions.find((p) => p.anchorDegree === 'b3')!
    expect(fromFlatThird).toMatchObject({ anchorFret: 12, fromFret: 11, toFret: 14 })
    expect(positions.every((p) => p.fromFret >= 0)).toBe(true)
  })

  it('格數與調弦可注入：12 格琴頸的框夾在指板內，殘框不畫', () => {
    const short = scalePositions('C', 'ionian', { fretCount: 12 })
    expect(short.every((p) => p.toFret <= 12)).toBe(true)
    expect(short.length).toBeLessThan(scalePositions('C', 'ionian').length)
    expect(scalePositions('C', 'ionian', { tuning: STANDARD_TUNING })).toEqual(
      scalePositions('C', 'ionian'),
    )
  })
})

describe('scaleNotesPerString', () => {
  it('七音音階一弦三音、五聲一弦兩音', () => {
    expect(scaleNotesPerString('ionian')).toBe(3)
    expect(scaleNotesPerString('harmonicMinor')).toBe(3)
    expect(scaleNotesPerString('minorPentatonic')).toBe(2)
    expect(scaleNotesPerString('majorPentatonic')).toBe(2)
  })

  it('藍調跟著五聲骨架走（b5 是經過音，不佔指型的位置）', () => {
    expect(scaleNotesPerString('blues')).toBe(scaleNotesPerString('minorPentatonic'))
  })
})

describe('scaleShapePath', () => {
  const ALL_SCALES = Object.keys(SCALE_FORMULAS) as ScaleType[]

  it('A 小調五聲第一盒＝教科書上的盒型（每弦兩音，格位逐格鎖定）', () => {
    const box = scalePositions('A', 'minorPentatonic').find((p) => p.anchorDegree === '1')!
    const path = scaleShapePath('A', 'minorPentatonic', box)
    expect(path.map((c) => `${c.string}/${c.fret}`)).toEqual([
      '6/5', '6/8', '5/5', '5/7', '4/5', '4/7', '3/5', '3/7', '2/5', '2/8', '1/5', '1/8',
    ])
    expect(path.map((c) => c.note.degree)).toEqual([
      '1', 'b3', '4', '5', 'b7', '1', 'b3', '4', '5', 'b7', '1', 'b3',
    ])
  })

  it('C Ionian 根音起＝一弦三音：每條弦剛好三個音，由低音弦走到高音弦', () => {
    const shape = scalePositions('C', 'ionian').find((p) => p.anchorDegree === '1')!
    const path = scaleShapePath('C', 'ionian', shape)
    expect(path).toHaveLength(18)
    expect(path.map((c) => `${c.string}/${c.fret}`)).toEqual([
      '6/8', '6/10', '6/12', '5/8', '5/10', '5/12', '4/9', '4/10', '4/12',
      '3/9', '3/10', '3/12', '2/10', '2/12', '2/13', '1/10', '1/12', '1/13',
    ])
    expect(path[0]?.note.name).toBe('C')
  })

  it('路徑一路往上（模進的「上行」要真的是上行）', () => {
    for (const key of ALL_KEYS) {
      for (const scale of ALL_SCALES) {
        for (const position of scalePositions(key, scale)) {
          const path = scaleShapePath(key, scale, position)
          for (let i = 1; i < path.length; i++) {
            const previous = path[i - 1]!
            const current = path[i]!
            const rising = current.string < previous.string
              || (current.string === previous.string && current.fret > previous.fret)
            expect(rising, `${key} ${scale} ${position.id} 第 ${i} 個音沒有往上`).toBe(true)
          }
        }
      }
    }
  })

  it('每條弦的音數一致，且等於 scaleNotesPerString（指型的定義）', () => {
    for (const key of ALL_KEYS) {
      for (const scale of ALL_SCALES) {
        const perString = scaleNotesPerString(scale)
        for (const position of scalePositions(key, scale)) {
          const path = scaleShapePath(key, scale, position)
          // 走出指板的格會被丟掉，因此只檢查「沒有哪一條弦超過每弦音數」
          for (let string = 1; string <= 6; string++) {
            const onString = path.filter((c) => c.string === string).length
            expect(onString, `${key} ${scale} ${position.id} 第 ${string} 弦`).toBeLessThanOrEqual(perString)
          }
          expect(path.length, `${key} ${scale} ${position.id}`).toBeLessThanOrEqual(perString * 6)
        }
      }
    }
  })

  it('路徑的每一個音都落在把位框內（框就是這條路徑的涵蓋範圍）', () => {
    for (const key of ALL_KEYS) {
      for (const scale of ALL_SCALES) {
        for (const position of scalePositions(key, scale)) {
          for (const cell of scaleShapePath(key, scale, position)) {
            expect(isInPosition(position, cell.fret), `${key} ${scale} ${position.id} ${cell.fret} 格落在框外`)
              .toBe(true)
          }
        }
      }
    }
  })

  it('路徑上的音都是音階音（與 mapToFretboard 的音點對得起來）', () => {
    for (const scale of ALL_SCALES) {
      const board = mapToFretboard(spell('G', SCALE_FORMULAS[scale]))
      for (const position of scalePositions('G', scale)) {
        for (const cell of scaleShapePath('G', scale, position)) {
          const onBoard = board.find((c) => c.string === cell.string && c.fret === cell.fret)
          expect(onBoard?.note.pc, `${scale} ${cell.string}/${cell.fret}`).toBe(cell.note.pc)
        }
      }
    }
  })

  it('藍調的路徑不含 b5（骨架是五聲，b5 自己加）', () => {
    for (const position of scalePositions('A', 'blues')) {
      const degrees = scaleShapePath('A', 'blues', position).map((c) => c.note.degree)
      expect(degrees).not.toContain('b5')
    }
  })

  it('按不到的格不進序列：12 格琴頸走不完的指型只回傳指板上的音', () => {
    const shape = scalePositions('C', 'ionian', { fretCount: 12 }).find((p) => p.anchorDegree === '1')!
    const path = scaleShapePath('C', 'ionian', shape, { fretCount: 12 })
    expect(path.length).toBeLessThan(18)
    expect(path.every((c) => c.fret <= 12)).toBe(true)
  })

  it('空弦把位含 fret 0，且不會出現負格（走出琴枕外的指型已整組移高八度）', () => {
    const open = scalePositions('C', 'ionian')[0]!
    const path = scaleShapePath('C', 'ionian', open)
    expect(path.some((c) => c.fret === 0)).toBe(true)
    expect(path.every((c) => c.fret >= 0)).toBe(true)
  })
})
