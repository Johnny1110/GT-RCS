/**
 * 樂理引擎行為鎖定測試。
 * 這些測試是架構的一部分：拼寫規則、公式內容一旦通過即不可回歸。
 */
import { describe, it, expect } from 'vitest'
import { degreeInterval, mod12, parseDegree, parseNoteName } from './intervals'
import { spell, spellDegree } from './spelling'
import { CHORD_FORMULAS, SCALE_FORMULAS } from './formulas'
import { fretMidi, mapToFretboard, openStringMidis, STANDARD_TUNING } from './fretboard'
import type { NoteName } from './types'

const names = (root: NoteName, formula: Parameters<typeof spell>[1]) =>
  spell(root, formula).map((n) => n.name)

describe('intervals', () => {
  it('mod12 處理負數', () => {
    expect(mod12(-1)).toBe(11)
    expect(mod12(-13)).toBe(11)
    expect(mod12(12)).toBe(0)
  })

  it('parseDegree：延伸與變化度數', () => {
    expect(parseDegree('1').semitones).toBe(0)
    expect(parseDegree('b3').semitones).toBe(3)
    expect(parseDegree('#4').semitones).toBe(6)
    expect(parseDegree('b5').semitones).toBe(6)
    expect(parseDegree('bb7').semitones).toBe(9)
    expect(parseDegree('9').semitones).toBe(14)
    expect(parseDegree('b13').semitones).toBe(20)
  })

  it('degreeInterval 將延伸音程摺回八度內', () => {
    expect(degreeInterval('9')).toBe(2)
    expect(degreeInterval('11')).toBe(5)
    expect(degreeInterval('13')).toBe(9)
    expect(degreeInterval('b9')).toBe(1)
  })

  it('parseNoteName：升降與 pc', () => {
    expect(parseNoteName('C').pc).toBe(0)
    expect(parseNoteName('F#').pc).toBe(6)
    expect(parseNoteName('Bb').pc).toBe(10)
    expect(parseNoteName('E#').pc).toBe(5)
    expect(parseNoteName('Cb').pc).toBe(11)
  })
})

describe('spelling（字母正確性）', () => {
  it('C 大調音階', () => {
    expect(names('C', SCALE_FORMULAS.ionian)).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B'])
  })

  it('F# 大調七音拼 E#（不是 F）', () => {
    expect(names('F#', SCALE_FORMULAS.ionian)).toEqual(['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'])
  })

  it('Db 大調用降記號拼寫', () => {
    expect(names('Db', SCALE_FORMULAS.ionian)).toEqual(['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C'])
  })

  it('Db7 的 b7 拼 Cb（不是 B）', () => {
    expect(names('Db', CHORD_FORMULAS['7'])).toEqual(['Db', 'F', 'Ab', 'Cb'])
  })

  it('Cdim7 的 bb7 拼 Bbb', () => {
    expect(names('C', CHORD_FORMULAS.dim7)).toEqual(['C', 'Eb', 'Gb', 'Bbb'])
  })

  it('藍調音階同時含 b5 與 5，拼寫字母不同', () => {
    expect(names('A', SCALE_FORMULAS.blues)).toEqual(['A', 'C', 'D', 'Eb', 'E', 'G'])
  })

  it('和聲小調的導音（Bb 和聲小調 → A）', () => {
    expect(names('Bb', SCALE_FORMULAS.harmonicMinor)).toEqual(['Bb', 'C', 'Db', 'Eb', 'F', 'Gb', 'A'])
  })

  it('spellDegree 保留 degree 標記與 pc', () => {
    const n = spellDegree('C', 'b3')
    expect(n).toEqual({ pc: 3, name: 'Eb', degree: 'b3' })
  })

  it('12 個常用調 × 全部音階公式：展開不丟例外且音數正確', () => {
    const roots: NoteName[] = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F']
    for (const root of roots) {
      for (const formula of Object.values(SCALE_FORMULAS)) {
        expect(spell(root, formula)).toHaveLength(formula.length)
      }
    }
  })
})

describe('fretboard', () => {
  it('標準調弦：string 1 為高音 e、string 6 為低音 E', () => {
    expect(STANDARD_TUNING[0]).toBe('E')
    expect(STANDARD_TUNING).toHaveLength(6)
  })

  it('C 大三和弦全指板覆蓋：22 格內每弦涵蓋 C/E/G 全部位置', () => {
    const cells = mapToFretboard(spell('C', CHORD_FORMULAS.maj))
    const string1 = cells.filter((c) => c.string === 1)
    // 高音 e 弦（E 開放）：E=0/12, G=3/15, C=8/20 → 22 格內共 6 格
    expect(string1.map((c) => c.fret)).toEqual([0, 3, 8, 12, 15, 20])
    expect(string1[0]?.note.name).toBe('E')
    expect(string1[2]?.note.name).toBe('C')
  })

  it('空弦（fret 0）包含在結果中', () => {
    const cells = mapToFretboard(spell('E', CHORD_FORMULAS.maj))
    expect(cells.some((c) => c.fret === 0 && c.string === 1)).toBe(true)
  })
})

describe('指板音高（發聲用的絕對音高）', () => {
  it('標準調弦的空弦：E2 40 → e4 64', () => {
    expect(openStringMidis()).toEqual([64, 59, 55, 50, 45, 40])
  })

  it('第 6 弦第 5 格與第 5 弦空弦是同一個音高（吉他調音就是這樣調的）', () => {
    expect(fretMidi({ string: 6, fret: 5 })).toBe(fretMidi({ string: 5, fret: 0 }))
    expect(fretMidi({ string: 3, fret: 4 })).toBe(fretMidi({ string: 2, fret: 0 }))
  })

  it('八度取「離標準第 6 弦最近的那一個」：drop D 落在 D2 不是 D3', () => {
    expect(openStringMidis(['E', 'B', 'G', 'D', 'A', 'D'])[5]).toBe(38)
  })

  it('音高與 mapToFretboard 的 pitch class 一致（同一格不會一個 C 一個 D）', () => {
    for (const cell of mapToFretboard(spell('C', SCALE_FORMULAS.ionian))) {
      expect(mod12(fretMidi(cell)), `${cell.string}/${cell.fret}`).toBe(cell.note.pc)
    }
  })

  it('弦號超出調弦範圍時回退而不丟例外（發聲跑在排程回呼裡）', () => {
    expect(Number.isFinite(fretMidi({ string: 9, fret: 3 }))).toBe(true)
  })
})
