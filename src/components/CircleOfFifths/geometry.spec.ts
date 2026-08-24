import { describe, it, expect } from 'vitest'
import { parseNoteName, spell, SCALE_FORMULAS } from '@/core/theory'
import {
  CIRCLE_MAJOR, CIRCLE_MINOR, DESCENDING_FIFTHS, circleLayout, diatonicPlacement, sectorIndexForPitch,
} from './geometry'

describe('circle tables', () => {
  it('順時針每一步都是上行完全五度', () => {
    for (let i = 0; i < 12; i++) {
      const from = parseNoteName(CIRCLE_MAJOR[i]!).pc
      const to = parseNoteName(CIRCLE_MAJOR[(i + 1) % 12]!).pc
      expect((to - from + 12) % 12, `${CIRCLE_MAJOR[i]} → ${CIRCLE_MAJOR[(i + 1) % 12]}`).toBe(7)
    }
  })

  it('內圈是外圈的關係小調（低小三度）', () => {
    CIRCLE_MAJOR.forEach((major, i) => {
      const diff = (parseNoteName(CIRCLE_MINOR[i]!).pc - parseNoteName(major).pc + 12) % 12
      expect(diff, `${major} / ${CIRCLE_MINOR[i]}`).toBe(9)
    })
  })

  it('逆時針序列每一步都是下行完全五度，且涵蓋 12 個不同的調', () => {
    for (let i = 0; i < 12; i++) {
      const from = parseNoteName(DESCENDING_FIFTHS[i]!).pc
      const to = parseNoteName(DESCENDING_FIFTHS[(i + 1) % 12]!).pc
      expect((from - to + 12) % 12, `${DESCENDING_FIFTHS[i]} → ${DESCENDING_FIFTHS[(i + 1) % 12]}`).toBe(7)
    }
    expect(new Set(DESCENDING_FIFTHS.map((k) => parseNoteName(k).pc)).size).toBe(12)
  })
})

describe('diatonicPlacement', () => {
  it('C 大調：外圈 F C G = 4 1 5，內圈 Dm Am Em = 2 6 3（每個小和弦在其關係大調正下方）', () => {
    const placement = diatonicPlacement('C')
    expect(placement.tonicIndex).toBe(0)
    expect(placement.outer[11]).toBe('4') // F
    expect(placement.outer[0]).toBe('1') // C
    expect(placement.outer[1]).toBe('5') // G
    expect(placement.inner[11]).toBe('2') // Dm，在 F 下方
    expect(placement.inner[0]).toBe('6') // Am，在 C 下方
    expect(placement.inner[1]).toBe('3') // Em，在 G 下方
  })

  it('調內 7 個和弦在圈上是連續的三格區塊', () => {
    const placement = diatonicPlacement('Eb')
    const outerIndices = Object.keys(placement.outer).map(Number).sort((a, b) => a - b)
    const innerIndices = Object.keys(placement.inner).map(Number).sort((a, b) => a - b)
    expect(innerIndices).toEqual(outerIndices)
  })

  it('圈上標出的音，正好是該調 I/IV/V 與 ii/iii/vi 的根音', () => {
    for (const key of CIRCLE_MAJOR) {
      const scale = spell(key, SCALE_FORMULAS.ionian)
      const placement = diatonicPlacement(key)
      const expected: Record<string, number> = {}
      scale.forEach((note) => { expected[note.degree] = note.pc })

      for (const [index, degree] of Object.entries(placement.outer)) {
        expect(parseNoteName(CIRCLE_MAJOR[Number(index)]!).pc, `${key} outer ${degree}`)
          .toBe(expected[degree])
      }
      for (const [index, degree] of Object.entries(placement.inner)) {
        expect(parseNoteName(CIRCLE_MINOR[Number(index)]!).pc, `${key} inner ${degree}`)
          .toBe(expected[degree])
      }
    }
  })

  it('異名同音的調也能定位（Gb 對到 F# 的扇形）', () => {
    expect(diatonicPlacement('Gb').tonicIndex).toBe(diatonicPlacement('F#').tonicIndex)
  })
})

describe('circleLayout', () => {
  const layout = circleLayout()

  it('12 個扇形，C 在正上方', () => {
    expect(layout.sectors).toHaveLength(12)
    const c = layout.sectors[0]!
    expect(c.major).toBe('C')
    expect(c.majorLabel.x).toBeCloseTo(layout.center, 6)
    expect(c.majorLabel.y).toBeLessThan(layout.center)
  })

  it('內圈標籤比外圈靠近圓心', () => {
    for (const sector of layout.sectors) {
      const outerDist = Math.hypot(sector.majorLabel.x - layout.center, sector.majorLabel.y - layout.center)
      const innerDist = Math.hypot(sector.minorLabel.x - layout.center, sector.minorLabel.y - layout.center)
      expect(innerDist).toBeLessThan(outerDist)
      expect(innerDist).toBeGreaterThan(layout.holeRadius)
    }
  })

  it('第 3 個扇形（D）位於右側', () => {
    const d = layout.sectors[3]!
    expect(d.major).toBe('A')
    expect(d.majorLabel.x).toBeGreaterThan(layout.center)
  })

  it('sectorIndexForPitch 找得到圈上的音，找不到回傳 -1', () => {
    expect(sectorIndexForPitch(parseNoteName('G').pc)).toBe(1)
    expect(sectorIndexForPitch(parseNoteName('Gb').pc)).toBe(6)
  })
})
