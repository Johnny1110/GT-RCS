/**
 * 自訂和弦進行（持久化，PRD F5-3）。
 *
 * 資料模型刻意比內建 preset 窄一點：`barsPerChord` 是**一個數字**而不是每個和弦一個值。
 * 內建 preset 需要不等長（12 小節藍調的最後兩小節就是 2-1）；使用者手打時要維護一個
 * 與 token 數等長的陣列只會出錯，而「每個和弦幾小節」一致才是絕大多數自訂進行的樣子。
 *
 * 展開成 core 認得的 ProgressionPreset 由 toPreset() 負責——core 不需要知道
 * 這份資料是使用者打的還是內建的。
 */
import { defineStore } from 'pinia'
import { reactive } from 'vue'
import type { HarmonyLevel, NoteName, ProgressionPreset } from '@/core/theory'
import { VersionedStore } from '@/persistence/storage'

export interface CustomProgression {
  id: string
  /** 使用者取的名字（不是 i18n key——它不會被翻譯） */
  name: string
  /** 級數記法，文法見 core/theory/progressions/parser.ts */
  tokens: string
  /** 每個和弦幾小節（0.5 = 一小節兩個和弦） */
  barsPerChord: number
  defaultBpm: number
  harmonyLevel: HarmonyLevel
  /** 單一調練習時用哪個調 */
  key: NoteName
  /** 開啟後沿五度圈走完 12 調 */
  cycleKeys: boolean
  barsPerKey: number
}

const VERSION = 1
const STORAGE_KEY = 'rcs.customProgressions'

export const BARS_PER_CHORD_OPTIONS = [0.5, 1, 2, 4] as const
export const HARMONY_LEVELS: readonly HarmonyLevel[] = ['triad', 'seventh']

export function defaultProgression(id: string, name: string): CustomProgression {
  return {
    id,
    name,
    tokens: 'ii V I',
    barsPerChord: 1,
    defaultBpm: 80,
    harmonyLevel: 'seventh',
    key: 'C',
    cycleKeys: false,
    barsPerKey: 8,
  }
}

/**
 * 展開成 core 的 ProgressionPreset。
 * titleKey 給空字串：自訂進行的名字是使用者打的，不走 i18n，畫面直接用 name。
 */
export function toPreset(item: CustomProgression, tokenCount: number): ProgressionPreset {
  return {
    id: item.id,
    titleKey: '',
    tokens: item.tokens,
    barsPerChord: Array<number>(Math.max(1, tokenCount)).fill(item.barsPerChord),
    defaultBpm: item.defaultBpm,
    harmonyLevel: item.harmonyLevel,
  }
}

/** 下一個 id：取現有數字後綴的最大值 +1。可預期、可測，不依賴時鐘或亂數 */
export function nextId(items: readonly CustomProgression[]): string {
  const max = items.reduce((best, item) => {
    const match = /^custom-(\d+)$/.exec(item.id)
    return match ? Math.max(best, Number(match[1])) : best
  }, 0)
  return `custom-${max + 1}`
}

/** 持久化資料不可信：缺欄位或型別錯的一律回退預設，不讓壞資料炸掉整頁 */
function sanitize(raw: unknown, index: number): CustomProgression | null {
  if (typeof raw !== 'object' || raw === null) return null
  const item = raw as Partial<CustomProgression>
  if (typeof item.id !== 'string' || item.id === '') return null
  const fallback = defaultProgression(item.id, `#${index + 1}`)
  return {
    id: item.id,
    name: typeof item.name === 'string' && item.name.trim() !== '' ? item.name : fallback.name,
    tokens: typeof item.tokens === 'string' ? item.tokens : fallback.tokens,
    barsPerChord: BARS_PER_CHORD_OPTIONS.includes(item.barsPerChord as never)
      ? (item.barsPerChord as number)
      : fallback.barsPerChord,
    defaultBpm: Number.isFinite(item.defaultBpm) ? Number(item.defaultBpm) : fallback.defaultBpm,
    harmonyLevel: item.harmonyLevel === 'triad' ? 'triad' : 'seventh',
    key: typeof item.key === 'string' ? (item.key as NoteName) : fallback.key,
    cycleKeys: item.cycleKeys === true,
    barsPerKey: Number.isFinite(item.barsPerKey) ? Number(item.barsPerKey) : fallback.barsPerKey,
  }
}

export const useCustomProgressionsStore = defineStore('customProgressions', () => {
  const persisted = new VersionedStore<CustomProgression[]>(STORAGE_KEY, VERSION, () => [])
  const loaded = persisted.load()
  const items = reactive<CustomProgression[]>(
    (Array.isArray(loaded) ? loaded : []).map(sanitize).filter((x): x is CustomProgression => x !== null),
  )

  function save(): void {
    persisted.save(items.map((item) => ({ ...item })))
  }

  function find(id: string | null | undefined): CustomProgression | undefined {
    return id ? items.find((item) => item.id === id) : undefined
  }

  function create(name: string): CustomProgression {
    const item = defaultProgression(nextId(items), name)
    items.push(item)
    save()
    return item
  }

  function update(id: string, patch: Partial<CustomProgression>): void {
    const item = find(id)
    if (!item) return
    Object.assign(item, patch, { id })
    save()
  }

  function duplicate(id: string, nameSuffix: string): CustomProgression | undefined {
    const source = find(id)
    if (!source) return undefined
    const copy: CustomProgression = { ...source, id: nextId(items), name: `${source.name} ${nameSuffix}` }
    items.splice(items.indexOf(source) + 1, 0, copy)
    save()
    return copy
  }

  function remove(id: string): void {
    const index = items.findIndex((item) => item.id === id)
    if (index >= 0) {
      items.splice(index, 1)
      save()
    }
  }

  return { items, find, create, update, duplicate, remove }
})
