/**
 * pattern 編譯層的行為鎖定測試（PRD F4-1）。
 * 「swing 的反拍到底落在哪一刻」就是這條練習線的規格，所以鎖在這裡。
 */
import { describe, it, expect } from 'vitest'
import {
  CELL_ROLE_CYCLE, SWING_MAX, SWING_MIN, SWING_SHUFFLE, SWING_STRAIGHT,
  cellsPerBar, clampSwing, compileBar, isCellRole, isConsistentPattern, isSilentBar,
  metronomeBar, nextCellRole, normalizeBars, parseCells, silenceSlots, swingOffsetBeats,
} from './pattern'
import { subdivisionLabel, type CellRole, type RhythmPattern, type TimeSignature } from './types'

const FOUR_FOUR: TimeSignature = { beats: 4, unit: 4 }
const SIX_EIGHT: TimeSignature = { beats: 6, unit: 8 }

describe('swingOffsetBeats', () => {
  it('直拍（50%）：8 分反拍落在正中間', () => {
    expect(swingOffsetBeats(0, 2, SWING_STRAIGHT)).toBe(0)
    expect(swingOffsetBeats(1, 2, SWING_STRAIGHT)).toBeCloseTo(0.5, 12)
  })

  it('全 shuffle：8 分反拍落在三連音第 3 格（2/3 拍）', () => {
    expect(swingOffsetBeats(1, 2, SWING_SHUFFLE)).toBeCloseTo(2 / 3, 12)
    // 三連音第 3 格 = 直接用三連音細分排到 index 2 的位置
    expect(swingOffsetBeats(1, 2, SWING_SHUFFLE)).toBeCloseTo(swingOffsetBeats(2, 3, SWING_STRAIGHT), 12)
  })

  it('慣稱的 66% 與精確三連音只差 0.7%（UI 顯示 67，排程用精確值）', () => {
    expect(swingOffsetBeats(1, 2, 66)).toBeCloseTo(0.66, 12)
    expect(Math.abs(swingOffsetBeats(1, 2, 66) - 2 / 3)).toBeLessThan(0.01)
    expect(Math.round(SWING_SHUFFLE)).toBe(67)
  })

  it('16 分 swing：作用於 1-e 與 &-a 兩對，正拍與反拍（&）不動', () => {
    const straight = [0, 1, 2, 3].map((i) => swingOffsetBeats(i, 4, SWING_STRAIGHT))
    expect(straight).toEqual([0, 0.25, 0.5, 0.75])

    const swung = [0, 1, 2, 3].map((i) => swingOffsetBeats(i, 4, SWING_SHUFFLE))
    expect(swung[0]).toBe(0)
    expect(swung[1]).toBeCloseTo(1 / 3, 12)
    expect(swung[2]).toBeCloseTo(0.5, 12)
    expect(swung[3]).toBeCloseTo(0.5 + 1 / 3, 12)
  })

  it('三連音與正拍細分不受 swing 影響（本身就是 swing 的目的地）', () => {
    for (const swing of [SWING_STRAIGHT, 60, SWING_SHUFFLE, SWING_MAX]) {
      expect([0, 1, 2].map((i) => swingOffsetBeats(i, 3, swing))).toEqual([0, 1 / 3, 2 / 3])
      expect(swingOffsetBeats(0, 1, swing)).toBe(0)
    }
  })

  it('任何 swing 值下偏移都遞增（排程時間不可倒退）', () => {
    for (const tpb of [1, 2, 3, 4] as const) {
      for (const swing of [SWING_MIN, 55, 62, SWING_SHUFFLE, SWING_MAX]) {
        for (let i = 1; i < tpb; i++) {
          expect(swingOffsetBeats(i, tpb, swing)).toBeGreaterThan(swingOffsetBeats(i - 1, tpb, swing))
        }
      }
    }
  })

  it('clampSwing 夾在 50–75，非數值回退直拍', () => {
    expect(clampSwing(10)).toBe(SWING_MIN)
    expect(clampSwing(99)).toBe(SWING_MAX)
    expect(clampSwing(Number.NaN)).toBe(SWING_STRAIGHT)
  })
})

describe('compileBar', () => {
  it('格子數 = 拍數 × 細分；beat/tick 為 1-based', () => {
    const slots = compileBar(Array<CellRole>(16).fill('normal'), FOUR_FOUR, 4)
    expect(slots).toHaveLength(cellsPerBar(FOUR_FOUR, 4))
    expect(slots[0]).toMatchObject({ index: 0, beat: 1, tick: 1, offsetBeats: 0 })
    expect(slots[5]).toMatchObject({ index: 5, beat: 2, tick: 2, offsetBeats: 1.25 })
    expect(slots[15]).toMatchObject({ index: 15, beat: 4, tick: 4, offsetBeats: 3.75 })
  })

  it('角色照 cells 帶入；長度不足補 rest、過長忽略（持久化資料視為不可信）', () => {
    const slots = compileBar(['accent', 'ghost'], FOUR_FOUR, 1)
    expect(slots.map((s) => s.role)).toEqual(['accent', 'ghost', 'rest', 'rest'])
    expect(compileBar(Array<CellRole>(99).fill('accent'), FOUR_FOUR, 1)).toHaveLength(4)
  })

  it('6/8：一小節 6 格，偏移 0..5（BPM 的一拍＝八分音符）', () => {
    const slots = compileBar(metronomeBar(SIX_EIGHT, 1), SIX_EIGHT, 1)
    expect(slots.map((s) => s.offsetBeats)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('swing 只動反拍，正拍偏移不變', () => {
    const cells = Array<CellRole>(8).fill('normal')
    const straight = compileBar(cells, FOUR_FOUR, 2, SWING_STRAIGHT)
    const swung = compileBar(cells, FOUR_FOUR, 2, SWING_SHUFFLE)
    expect(swung.filter((s) => s.tick === 1).map((s) => s.offsetBeats))
      .toEqual(straight.filter((s) => s.tick === 1).map((s) => s.offsetBeats))
    expect(swung[1]?.offsetBeats).toBeCloseTo(2 / 3, 12)
    expect(swung[3]?.offsetBeats).toBeCloseTo(1 + 2 / 3, 12)
  })
})

describe('metronomeBar（無 pattern 時的預設）', () => {
  it('首拍 accent、其餘拍 normal、拍內細分 ghost', () => {
    expect(metronomeBar(FOUR_FOUR, 1)).toEqual(['accent', 'normal', 'normal', 'normal'])
    expect(metronomeBar(FOUR_FOUR, 2)).toEqual([
      'accent', 'ghost', 'normal', 'ghost', 'normal', 'ghost', 'normal', 'ghost',
    ])
  })
})

describe('示範 → 靜默模式', () => {
  it('demo 4 + silent 4：1–4 示範、5–8 靜默，第 9 小節回到示範', () => {
    const mode = { demoBars: 4, silentBars: 4 }
    expect([1, 2, 3, 4].map((b) => isSilentBar(b, mode))).toEqual([false, false, false, false])
    expect([5, 6, 7, 8].map((b) => isSilentBar(b, mode))).toEqual([true, true, true, true])
    expect(isSilentBar(9, mode)).toBe(false)
  })

  it('未設定或任一邊為 0 時全程示範', () => {
    expect(isSilentBar(7, null)).toBe(false)
    expect(isSilentBar(7, { demoBars: 4, silentBars: 0 })).toBe(false)
    expect(isSilentBar(7, { demoBars: 0, silentBars: 4 })).toBe(false)
  })

  it('靜默小節只留第一格 accent，其餘轉 rest（tick 照發，游標繼續走）', () => {
    const slots = silenceSlots(compileBar(Array<CellRole>(8).fill('normal'), FOUR_FOUR, 2))
    expect(slots).toHaveLength(8)
    expect(slots[0]?.role).toBe('accent')
    expect(slots.slice(1).every((s) => s.role === 'rest')).toBe(true)
    // 時間格線不變——靜默只是不出聲，不是停拍
    expect(slots.map((s) => s.offsetBeats)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5])
  })
})

describe('編輯模式的角色循環', () => {
  it('rest → normal → accent → ghost → rest', () => {
    expect(CELL_ROLE_CYCLE).toEqual(['rest', 'normal', 'accent', 'ghost'])
    let role: CellRole = 'rest'
    const seen: CellRole[] = []
    for (let i = 0; i < 4; i++) {
      role = nextCellRole(role)
      seen.push(role)
    }
    expect(seen).toEqual(['normal', 'accent', 'ghost', 'rest'])
  })

  it('isCellRole 擋掉非法值', () => {
    expect(['accent', 'normal', 'ghost', 'rest'].every(isCellRole)).toBe(true)
    expect(['', 'ACCENT', null, 0, undefined].some(isCellRole)).toBe(false)
  })
})

describe('normalizeBars（自訂 pattern 的防線）', () => {
  it('補足缺少的小節與格子，非法格子變 rest', () => {
    const bars = normalizeBars([['accent', 'x', 'ghost']], FOUR_FOUR, 1, 2)
    expect(bars).toEqual([
      ['accent', 'rest', 'ghost', 'rest'],
      ['rest', 'rest', 'rest', 'rest'],
    ])
  })

  it('非陣列輸入（損毀的 localStorage）回傳全 rest 而不是丟例外', () => {
    expect(normalizeBars('boom', FOUR_FOUR, 1, 1)).toEqual([['rest', 'rest', 'rest', 'rest']])
    expect(normalizeBars(null, SIX_EIGHT, 2, 1)[0]).toHaveLength(12)
  })
})

describe('isConsistentPattern（preset 庫的測試防線）', () => {
  const base: RhythmPattern = {
    id: 'x', titleKey: 'x', timeSig: FOUR_FOUR, ticksPerBeat: 4,
    bars: [Array<CellRole>(16).fill('rest')], defaultBpm: 90,
  }
  it('格子數與拍號／細分相符才算合法', () => {
    expect(isConsistentPattern(base)).toBe(true)
    expect(isConsistentPattern({ ...base, ticksPerBeat: 2 })).toBe(false)
    expect(isConsistentPattern({ ...base, bars: [] })).toBe(false)
  })
})

describe('parseCells（preset 速記法）', () => {
  it('X/o/g/. 對應四種角色，空白與 | 只是分組', () => {
    expect(parseCells('Xog. | .goX')).toEqual([
      'accent', 'normal', 'ghost', 'rest', 'rest', 'ghost', 'normal', 'accent',
    ])
  })

  it('未知字元直接丟例外（preset 打錯字要在測試就爆）', () => {
    expect(() => parseCells('Xoz.')).toThrow(/z/)
  })
})

describe('subdivisionLabel（細分的音符名稱）', () => {
  it('4/4：1→4、2→8、3→8T、4→16', () => {
    expect([1, 2, 3, 4].map((t) => subdivisionLabel(4, t as 1 | 2 | 3 | 4))).toEqual(['4', '8', '8T', '16'])
  })

  it('6/8：同樣「一拍兩格」是十六分，不是八分（寫死表格會標錯的地方）', () => {
    expect([1, 2, 3, 4].map((t) => subdivisionLabel(8, t as 1 | 2 | 3 | 4))).toEqual(['8', '16', '16T', '32'])
  })
})
