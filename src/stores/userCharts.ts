/**
 * 使用者自己的曲譜（持久化，Phase 8 / F8-8）。
 *
 * 這是本模組法律設計的落點：內建曲庫只收形式練習與公版曲，使用者手上那本書裡的曲子
 * 由他自己輸入——**只存在他的瀏覽器**，不上傳、我方沒有伺服器可存放
 * （隱私權政策已如此宣告，這裡只是把它變成程式碼）。
 *
 * 資料模型只存**原始文字**：曲譜文字就是單一真相，解析結果隨用隨算
 * （文法見 core/theory/progressions/chartText.ts）。存展開後的結構會有兩份真相，
 * 而使用者改的永遠是文字那一份。title 是為了選單而做的去正規化副本，存檔時重算。
 *
 * 與 customProgressions 平行而不共用：那是「一段進行」，這是「一首曲子的曲式」，
 * schema 不同，硬要共用只會讓兩邊都長出對方用不到的欄位。
 */
import { defineStore } from 'pinia'
import { reactive } from 'vue'
import { VersionedStore } from '@/persistence/storage'

export interface UserChart {
  id: string
  /** 選單用的顯示名（存檔時由 text 的 `title:` 重算） */
  title: string
  /** 曲譜原文，含 key / feel / form 標頭 */
  text: string
}

const VERSION = 1
const STORAGE_KEY = 'rcs.userCharts'

/** 新曲譜的起手範本：直接可播，使用者照著改比從空白開始容易得多 */
export function chartTemplate(title: string): string {
  return [
    `title: ${title}`,
    'key: C',
    'feel: mediumSwing',
    'form: A A2 B A3',
    'A:  | Imaj7 | vim7 | iim7 | V7 | iiim7 | V/ii | iim7 | V7 |',
    'A2: | Imaj7 | vim7 | iim7 | V7 | iiim7 V/ii | iim7 V7 | Imaj7 | I7 |',
    'B:  | IVmaj7 | % | ivm7 bVII7 | Imaj7 | iiim7 | V/ii | iim7 | V7 |',
    'A3: | Imaj7 | vim7 | iim7 | V7 | iiim7 V/ii | iim7 V7 | Imaj7 | % |',
  ].join('\n')
}

/** 下一個 id：現有數字後綴的最大值 +1（可預期、可測，不依賴時鐘或亂數） */
export function nextId(items: readonly UserChart[]): string {
  const max = items.reduce((best, item) => {
    const match = /^chart-(\d+)$/.exec(item.id)
    return match ? Math.max(best, Number(match[1])) : best
  }, 0)
  return `chart-${max + 1}`
}

/** 持久化資料不可信：缺欄位或型別錯的一律丟掉，不讓壞資料炸掉整頁 */
function sanitize(raw: unknown): UserChart | null {
  if (typeof raw !== 'object' || raw === null) return null
  const item = raw as Partial<UserChart>
  if (typeof item.id !== 'string' || item.id === '') return null
  if (typeof item.text !== 'string' || item.text === '') return null
  return {
    id: item.id,
    title: typeof item.title === 'string' && item.title.trim() !== '' ? item.title : item.id,
    text: item.text,
  }
}

/** 由曲譜原文取出 `title:`；沒有就回退給定的預設 */
export function titleFromText(text: string, fallback: string): string {
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*title\s*:\s*(.+?)\s*$/.exec(line)
    if (match) return match[1]!
  }
  return fallback
}

export const useUserChartsStore = defineStore('userCharts', () => {
  const persisted = new VersionedStore<UserChart[]>(STORAGE_KEY, VERSION, () => [])
  const loaded = persisted.load()
  const items = reactive<UserChart[]>(
    (Array.isArray(loaded) ? loaded : []).map(sanitize).filter((x): x is UserChart => x !== null),
  )

  function save(): void {
    persisted.save(items.map((item) => ({ ...item })))
  }

  function find(id: string | null | undefined): UserChart | undefined {
    return id ? items.find((item) => item.id === id) : undefined
  }

  function create(name: string): UserChart {
    const id = nextId(items)
    const item: UserChart = { id, title: name, text: chartTemplate(name) }
    items.push(item)
    save()
    return item
  }

  /** 存檔：title 一律由 text 重算，選單與譜面不會不一致 */
  function update(id: string, text: string): void {
    const item = find(id)
    if (!item) return
    item.text = text
    item.title = titleFromText(text, item.id)
    save()
  }

  function importText(text: string, fallbackName: string): UserChart {
    const id = nextId(items)
    const item: UserChart = { id, title: titleFromText(text, fallbackName), text }
    items.push(item)
    save()
    return item
  }

  function remove(id: string): void {
    const index = items.findIndex((item) => item.id === id)
    if (index >= 0) {
      items.splice(index, 1)
      save()
    }
  }

  return { items, find, create, update, importText, remove }
})
