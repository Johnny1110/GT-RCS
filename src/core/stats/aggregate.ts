/**
 * 練習統計的聚合（PRD F5-2）—— 純函式，吃 practiceLog 的條目，吐圖表要的數字。
 *
 * 時間的處理是這一層唯一需要小心的事：
 * - **「今天」一律由外部注入**（`now: Date`），本層不讀時鐘。測試才寫得出「連續 5 天」。
 * - **以使用者的日曆天分組，不是 UTC 天**。跨時區時 UTC 會把晚上 9 點的練習算到隔天，
 *   使用者看到的連續天數就斷了。這與「節拍不得用 Date.now()」不衝突：那是排程，這是牆上時鐘。
 *
 * 分組方式（哪個模組屬於哪一條線）由呼叫端注入：core 不認識模組註冊表。
 */

/** 只需要這幾個欄位——不綁 practiceLog 的完整型別，core 不認識 store */
export interface StatEntry {
  /** ISO 8601 */
  date: string
  moduleId: string
  durationSec: number
  bpm: number
  params?: Record<string, unknown>
}

/** 本地日曆天的鍵（YYYY-MM-DD）。用它當 Map key，圖表 x 軸也用它 */
export function localDayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 從某天往前／往後推 n 天（保留本地時間，避免夏令時間讓天數算錯） */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** 條目落在哪一個本地日曆天；日期壞掉的條目回 null（持久化資料不可信） */
export function entryDay(entry: StatEntry): string | null {
  const parsed = new Date(entry.date)
  return Number.isNaN(parsed.getTime()) ? null : localDayKey(parsed)
}

export function totalSeconds(entries: readonly StatEntry[]): number {
  return entries.reduce((sum, entry) => sum + Math.max(0, entry.durationSec), 0)
}

/** 最近 days 天（含今天）的總時長 */
export function secondsInLastDays(entries: readonly StatEntry[], days: number, now: Date): number {
  const from = localDayKey(addDays(now, -(days - 1)))
  const to = localDayKey(now)
  return totalSeconds(
    entries.filter((entry) => {
      const day = entryDay(entry)
      return day !== null && day >= from && day <= to
    }),
  )
}

/**
 * 連續練習天數。
 *
 * 「今天還沒練」不算斷：連續紀錄從今天或昨天起算，往回數到第一個沒練的日子為止。
 * 今天過完之前就把 streak 歸零，只會讓人覺得被懲罰——那不是這個數字的用途。
 */
export function currentStreak(entries: readonly StatEntry[], now: Date): number {
  const days = new Set<string>()
  for (const entry of entries) {
    const day = entryDay(entry)
    if (day !== null) days.add(day)
  }
  if (days.size === 0) return 0

  let cursor = days.has(localDayKey(now)) ? new Date(now) : addDays(now, -1)
  if (!days.has(localDayKey(cursor))) return 0

  let streak = 0
  while (days.has(localDayKey(cursor))) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

export interface DayTotal<G extends string> {
  day: string
  /** 每個分組的秒數（沒練的分組是 0，不是 undefined——圖表要疊得起來） */
  byGroup: Record<G, number>
  total: number
}

export interface DailyTotalsOptions<G extends string> {
  days: number
  now: Date
  groups: readonly G[]
  /** 條目屬於哪一組；回 null 代表不計入（例如模組已被移除） */
  groupOf: (entry: StatEntry) => G | null
}

/**
 * 最近 days 天、逐日、依組分開的時長。**沒練的日子也會有一列**（值為 0）——
 * 長條圖需要連續的 x 軸，否則「這週只練兩天」會被畫成「這週天天都練」。
 */
export function dailyTotals<G extends string>(
  entries: readonly StatEntry[],
  options: DailyTotalsOptions<G>,
): DayTotal<G>[] {
  const { days, now, groups, groupOf } = options
  const empty = (): Record<G, number> =>
    Object.fromEntries(groups.map((g) => [g, 0])) as Record<G, number>

  const buckets = new Map<string, DayTotal<G>>()
  for (let offset = days - 1; offset >= 0; offset--) {
    const day = localDayKey(addDays(now, -offset))
    buckets.set(day, { day, byGroup: empty(), total: 0 })
  }

  for (const entry of entries) {
    const day = entryDay(entry)
    if (day === null) continue
    const bucket = buckets.get(day)
    if (!bucket) continue
    const group = groupOf(entry)
    if (group === null) continue
    const seconds = Math.max(0, entry.durationSec)
    bucket.byGroup[group] += seconds
    bucket.total += seconds
  }
  return [...buckets.values()]
}

export interface ModuleShare {
  moduleId: string
  seconds: number
  /** 佔總時長的比例 0–1；總時長為 0 時全為 0 */
  ratio: number
}

/** 各模組時長佔比，由多到少排序 */
export function moduleShares(entries: readonly StatEntry[]): ModuleShare[] {
  const byModule = new Map<string, number>()
  for (const entry of entries) {
    byModule.set(entry.moduleId, (byModule.get(entry.moduleId) ?? 0) + Math.max(0, entry.durationSec))
  }
  const total = totalSeconds(entries)
  return [...byModule.entries()]
    .map(([moduleId, seconds]) => ({ moduleId, seconds, ratio: total === 0 ? 0 : seconds / total }))
    .sort((a, b) => b.seconds - a.seconds || a.moduleId.localeCompare(b.moduleId))
}

/**
 * 練習參數的正規化鍵：同一個模組底下，參數一樣才算「同一件事」。
 * key 排序後序列化，才不會因為物件屬性順序不同而分成兩組。
 */
export function paramsKey(params: Record<string, unknown> | undefined): string {
  if (!params) return ''
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${String(params[key])}`)
    .join('&')
}

export interface BpmPoint {
  day: string
  bpm: number
}

/**
 * 同一個模組＋同一組參數的 BPM 進步軌跡。
 *
 * **一天取當天最高的 BPM**：同一天練三輪不該畫成三個點，而「那天撐到多快」才是進步。
 * 中間沒練的日子不補點——折線圖的 x 軸是練習日，不是日曆。
 */
export function bpmProgress(
  entries: readonly StatEntry[],
  moduleId: string,
  key: string,
): BpmPoint[] {
  const best = new Map<string, number>()
  for (const entry of entries) {
    if (entry.moduleId !== moduleId || paramsKey(entry.params) !== key) continue
    const day = entryDay(entry)
    if (day === null || !Number.isFinite(entry.bpm)) continue
    best.set(day, Math.max(best.get(day) ?? 0, entry.bpm))
  }
  return [...best.entries()]
    .map(([day, bpm]) => ({ day, bpm }))
    .sort((a, b) => a.day.localeCompare(b.day))
}

export interface BpmSeries {
  moduleId: string
  key: string
  points: BpmPoint[]
}

/** 有哪些「模組＋參數」組合可以畫 BPM 折線（至少兩個練習日才看得出軌跡） */
export function bpmSeries(entries: readonly StatEntry[]): BpmSeries[] {
  const seen = new Set<string>()
  const series: BpmSeries[] = []
  for (const entry of entries) {
    const key = paramsKey(entry.params)
    const id = `${entry.moduleId} ${key}`
    if (seen.has(id)) continue
    seen.add(id)
    const points = bpmProgress(entries, entry.moduleId, key)
    if (points.length >= 2) series.push({ moduleId: entry.moduleId, key, points })
  }
  return series.sort((a, b) => b.points.length - a.points.length)
}
