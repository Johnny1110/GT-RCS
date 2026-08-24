import { describe, it, expect } from 'vitest'
import { fretboardLayout, positionRect, scrollLeftForFret } from './geometry'

describe('fretboardLayout', () => {
  const layout = fretboardLayout(22, 6)

  it('空弦音點落在琴枕左側，第一格音點落在第 0、1 琴衍之間', () => {
    const nut = layout.fretLines[0]
    const first = layout.fretLines[1]
    expect(nut?.x).toBeDefined()
    expect(layout.cellX(0)).toBeLessThan(nut!.x)
    expect(layout.cellX(1)).toBeGreaterThan(nut!.x)
    expect(layout.cellX(1)).toBeLessThan(first!.x)
  })

  it('琴枕較粗且標記為 nut，其餘琴衍等寬', () => {
    expect(layout.fretLines[0]).toMatchObject({ fret: 0, nut: true, width: 4 })
    expect(layout.fretLines[1]).toMatchObject({ fret: 1, nut: false, width: 1.5 })
    expect(layout.fretLines).toHaveLength(23)
  })

  it('string 1（高音 e）在最上方，低音弦較粗', () => {
    expect(layout.cellY(1)).toBeLessThan(layout.cellY(6))
    expect(layout.strings[0]!.width).toBeLessThan(layout.strings[5]!.width)
    expect(layout.strings).toHaveLength(6)
  })

  it('22 格：單點記號 8 個 + 12 格雙點，共 10 個指位記號', () => {
    expect(layout.inlays).toHaveLength(10)
  })

  it('24 格時 24 格也有雙點', () => {
    expect(fretboardLayout(24, 6).inlays).toHaveLength(12)
  })

  it('12 格雙點上下對稱於指板中線', () => {
    const twelfth = layout.inlays.filter((d) => Math.abs(d.cx - layout.cellX(12)) < 0.01)
    expect(twelfth).toHaveLength(2)
    const mid = (layout.cellY(1) + layout.cellY(6)) / 2
    expect(twelfth[0]!.cy + twelfth[1]!.cy).toBeCloseTo(mid * 2, 6)
  })

  it('格數標記涵蓋 1..22，指位記號格標為 marker', () => {
    expect(layout.fretNumbers).toHaveLength(22)
    expect(layout.fretNumbers.find((n) => n.fret === 12)?.marker).toBe(true)
    expect(layout.fretNumbers.find((n) => n.fret === 4)?.marker).toBe(false)
  })

  it('尺寸隨格數成長，音點不超出畫布', () => {
    expect(fretboardLayout(22, 6).width).toBeGreaterThan(fretboardLayout(12, 6).width)
    expect(layout.cellX(22) + layout.dotR).toBeLessThanOrEqual(layout.width)
    expect(layout.cellY(6) + layout.dotR).toBeLessThanOrEqual(layout.height)
    expect(layout.cellX(0) - layout.dotR).toBeGreaterThanOrEqual(0)
  })

  it('把位跳轉不會捲到負值', () => {
    expect(scrollLeftForFret(layout, 0)).toBe(0)
    expect(scrollLeftForFret(layout, 12)).toBeGreaterThan(0)
  })
})

describe('positionRect（把位框）', () => {
  const layout = fretboardLayout(22, 6, true)

  it('框的左右邊界貼齊琴衍：第 8–12 格框在第 7 與第 12 琴衍之間', () => {
    const rect = positionRect(layout, 8, 12, 6)
    // 貼齊琴衍但各內縮數 px（相鄰把位才留得出縫），因此比對容差而非等值
    expect(Math.abs(rect.x - layout.fretLines[7]!.x)).toBeLessThan(4)
    expect(Math.abs(rect.x + rect.width - layout.fretLines[12]!.x)).toBeLessThan(4)
    // 框內確實包住第 8 與第 12 格的音點中心
    expect(layout.cellX(8)).toBeGreaterThan(rect.x)
    expect(layout.cellX(12)).toBeLessThan(rect.x + rect.width)
  })

  it('相鄰把位的框之間留得出縫（否則兩個框會共用同一條線，看起來像一塊）', () => {
    const left = positionRect(layout, 0, 7, 6)
    const right = positionRect(layout, 8, 12, 6)
    expect(right.x).toBeGreaterThan(left.x + left.width)
  })

  it('把位框的下緣不壓到格數標記', () => {
    const rect = positionRect(layout, 3, 7, 6)
    const numberTop = (layout.fretNumbers[0]?.y ?? 0) - 10
    expect(rect.y + rect.height).toBeLessThanOrEqual(numberTop)
    expect(layout.fretNumbers[0]!.y).toBeLessThanOrEqual(layout.height)
  })

  it('fromFret 0 的框由畫布左緣起算，包住空弦欄', () => {
    const rect = positionRect(layout, 0, 7, 6)
    expect(rect.x).toBeLessThan(layout.cellX(0) - layout.dotR)
    expect(rect.x).toBeGreaterThanOrEqual(0)
  })

  it('框比音點大一圈，且不超出畫布', () => {
    const rect = positionRect(layout, 0, 22, 6)
    expect(rect.y).toBeLessThan(layout.cellY(1) - layout.dotR)
    expect(rect.y + rect.height).toBeGreaterThan(layout.cellY(6) + layout.dotR)
    expect(rect.y).toBeGreaterThan(0)
    expect(rect.y + rect.height).toBeLessThanOrEqual(layout.height)
  })

  it('positionRow 為頂端標籤留白，標籤不會壓到第 1 弦的音點', () => {
    const plain = fretboardLayout(22, 6)
    expect(layout.cellY(1)).toBeGreaterThan(plain.cellY(1))
    expect(positionRect(layout, 3, 7, 6).labelY).toBeGreaterThan(0)
    expect(layout.positionRow).toBe(true)
    expect(plain.positionRow).toBe(false)
  })
})
