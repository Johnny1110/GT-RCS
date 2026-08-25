/**
 * 統計聚合的行為鎖定測試。
 * 這些數字會被使用者拿來判斷自己有沒有進步，算錯比沒有更糟——所以邊界都要測。
 */
import { describe, it, expect } from 'vitest'
import {
  addDays, bpmProgress, bpmSeries, currentStreak, dailyTotals, entryDay, localDayKey,
  moduleShares, paramsKey, secondsInLastDays, totalSeconds, type StatEntry,
} from './aggregate'

/** 固定「今天」：2026-08-25 21:00 本地時間 */
const NOW = new Date(2026, 7, 25, 21, 0, 0)

/** 以本地時間建條目，避免測試被時區搬走一天 */
function entry(daysAgo: number, over: Partial<StatEntry> = {}): StatEntry {
  const at = addDays(NOW, -daysAgo)
  return {
    date: new Date(at.getFullYear(), at.getMonth(), at.getDate(), 20, 0, 0).toISOString(),
    moduleId: 'scales.practice',
    durationSec: 600,
    bpm: 90,
    ...over,
  }
}

describe('localDayKey / entryDay', () => {
  it('以本地日曆天分組——晚上 9 點的練習算今天，不是 UTC 的明天', () => {
    expect(localDayKey(NOW)).toBe('2026-08-25')
    expect(entryDay(entry(0))).toBe('2026-08-25')
  })

  it('日期壞掉的條目回 null 而不是丟例外（持久化資料不可信）', () => {
    expect(entryDay({ date: 'yesterday-ish', moduleId: 'x', durationSec: 1, bpm: 1 })).toBeNull()
  })

  it('addDays 跨月正確', () => {
    expect(localDayKey(addDays(new Date(2026, 7, 1), -1))).toBe('2026-07-31')
    expect(localDayKey(addDays(new Date(2026, 11, 31), 1))).toBe('2027-01-01')
  })
})

describe('totalSeconds / secondsInLastDays', () => {
  it('累計總時長；負數時長不倒扣（壞資料不該讓總數變小）', () => {
    expect(totalSeconds([entry(0), entry(100)])).toBe(1200)
    expect(totalSeconds([entry(0, { durationSec: -999 })])).toBe(0)
  })

  it('本週＝最近 7 天（含今天）', () => {
    const entries = [entry(0), entry(6), entry(7)]
    expect(secondsInLastDays(entries, 7, NOW)).toBe(1200)
  })

  it('沒有紀錄時是 0，不是 NaN', () => {
    expect(secondsInLastDays([], 7, NOW)).toBe(0)
    expect(totalSeconds([])).toBe(0)
  })
})

describe('currentStreak', () => {
  it('連續練 5 天＝5', () => {
    const entries = [0, 1, 2, 3, 4].map((d) => entry(d))
    expect(currentStreak(entries, NOW)).toBe(5)
  })

  it('今天還沒練不算斷（連續紀錄從昨天起算）', () => {
    const entries = [1, 2, 3].map((d) => entry(d))
    expect(currentStreak(entries, NOW)).toBe(3)
  })

  it('前天練、昨天沒練、今天沒練＝斷了', () => {
    expect(currentStreak([entry(2), entry(3)], NOW)).toBe(0)
  })

  it('同一天練很多輪只算一天', () => {
    expect(currentStreak([entry(0), entry(0), entry(0)], NOW)).toBe(1)
  })

  it('沒有紀錄＝0', () => {
    expect(currentStreak([], NOW)).toBe(0)
  })
})

describe('dailyTotals', () => {
  const groups = ['scales', 'rhythm'] as const
  const groupOf = (e: StatEntry): 'scales' | 'rhythm' | null => {
    const prefix = e.moduleId.split('.')[0]
    return prefix === 'scales' || prefix === 'rhythm' ? prefix : null
  }

  it('沒練的日子也有一列（值 0）——否則長條圖會把空白日子擠掉', () => {
    const rows = dailyTotals([entry(0)], { days: 7, now: NOW, groups, groupOf })
    expect(rows).toHaveLength(7)
    expect(rows.at(-1)).toMatchObject({ day: '2026-08-25', total: 600 })
    expect(rows[0]).toMatchObject({ total: 0, byGroup: { scales: 0, rhythm: 0 } })
  })

  it('由舊到新排序（圖表由左往右就是時間軸）', () => {
    const rows = dailyTotals([], { days: 28, now: NOW, groups, groupOf })
    expect(rows[0]!.day).toBe('2026-07-29')
    expect(rows.at(-1)!.day).toBe('2026-08-25')
    expect([...rows].sort((a, b) => a.day.localeCompare(b.day))).toEqual(rows)
  })

  it('同一天不同線分開堆疊，total 是總和', () => {
    const entries = [entry(1), entry(1, { moduleId: 'rhythm.groove', durationSec: 300 })]
    const row = dailyTotals(entries, { days: 7, now: NOW, groups, groupOf }).at(-2)!
    expect(row.byGroup).toEqual({ scales: 600, rhythm: 300 })
    expect(row.total).toBe(900)
  })

  it('已被移除的模組不計入（groupOf 回 null）', () => {
    const rows = dailyTotals([entry(0, { moduleId: 'ghost.module' })], {
      days: 7, now: NOW, groups, groupOf,
    })
    expect(rows.at(-1)!.total).toBe(0)
  })

  it('視窗外的條目不計入', () => {
    const rows = dailyTotals([entry(30)], { days: 28, now: NOW, groups, groupOf })
    expect(rows.reduce((s, r) => s + r.total, 0)).toBe(0)
  })
})

describe('moduleShares', () => {
  it('依時長由多到少，比例加總為 1', () => {
    const entries = [
      entry(0, { moduleId: 'a', durationSec: 300 }),
      entry(0, { moduleId: 'b', durationSec: 900 }),
      entry(1, { moduleId: 'a', durationSec: 300 }),
    ]
    const shares = moduleShares(entries)
    expect(shares.map((s) => s.moduleId)).toEqual(['b', 'a'])
    expect(shares[0]!.ratio).toBeCloseTo(0.6, 6)
    expect(shares.reduce((s, x) => s + x.ratio, 0)).toBeCloseTo(1, 6)
  })

  it('沒有紀錄時比例是 0 不是 NaN（除以零）', () => {
    expect(moduleShares([])).toEqual([])
    expect(moduleShares([entry(0, { durationSec: 0 })])[0]!.ratio).toBe(0)
  })
})

describe('paramsKey', () => {
  it('屬性順序不影響鍵（否則同一件事會被拆成兩組）', () => {
    expect(paramsKey({ root: 'A', scale: 'blues' })).toBe(paramsKey({ scale: 'blues', root: 'A' }))
  })

  it('沒有參數＝空字串', () => {
    expect(paramsKey(undefined)).toBe('')
  })
})

describe('bpmProgress / bpmSeries', () => {
  const funk = { patternId: 'funkOne', styleId: 'funk' }
  const soul = { patternId: 'soulPush', styleId: 'soul' }
  const of = (daysAgo: number, bpm: number, params: Record<string, unknown>): StatEntry =>
    entry(daysAgo, { moduleId: 'rhythm.groove', bpm, params })

  it('一天取當天最高的 BPM（同一天練三輪不畫成三個點）', () => {
    const points = bpmProgress([of(1, 80, funk), of(1, 92, funk), of(1, 85, funk)], 'rhythm.groove', paramsKey(funk))
    expect(points).toEqual([{ day: '2026-08-24', bpm: 92 }])
  })

  it('依日期由舊到新，只取同模組同參數', () => {
    const entries = [of(2, 80, funk), of(0, 100, funk), of(1, 120, soul)]
    expect(bpmProgress(entries, 'rhythm.groove', paramsKey(funk))).toEqual([
      { day: '2026-08-23', bpm: 80 },
      { day: '2026-08-25', bpm: 100 },
    ])
  })

  it('bpmSeries 只留至少兩個練習日的組合（一個點看不出軌跡）', () => {
    const entries = [of(2, 80, funk), of(0, 100, funk), of(1, 120, soul)]
    const series = bpmSeries(entries)
    expect(series).toHaveLength(1)
    expect(series[0]!.key).toBe(paramsKey(funk))
  })

  it('沒有紀錄不炸', () => {
    expect(bpmProgress([], 'x', '')).toEqual([])
    expect(bpmSeries([])).toEqual([])
  })
})
