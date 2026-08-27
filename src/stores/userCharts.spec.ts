// @vitest-environment happy-dom
/**
 * 使用者的曲譜是他自己輸入的資產——弄丟或弄壞比沒有更糟。
 * 這個 store 只存原始文字（單一真相），所以測試重點是：壞資料進不來、好資料出得去。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { parseChartText } from '@/core/theory'
import { chartTemplate, nextId, titleFromText, useUserChartsStore, type UserChart } from './userCharts'

const KEY = 'rcs.userCharts'

function seed(items: unknown[]): void {
  localStorage.setItem(KEY, JSON.stringify({ version: 1, data: items }))
}

describe('nextId', () => {
  it('取現有數字後綴的最大值 +1（不依賴時鐘或亂數）', () => {
    const of = (id: string): UserChart => ({ id, title: 'x', text: 'key: C\nA: | I |' })
    expect(nextId([])).toBe('chart-1')
    expect(nextId([of('chart-1'), of('chart-9')])).toBe('chart-10')
    expect(nextId([of('legacy')])).toBe('chart-1')
  })
})

describe('titleFromText', () => {
  it('讀 title: 那一行；沒有就回退', () => {
    expect(titleFromText('title: Blue Bossa Style\nkey: C', 'x')).toBe('Blue Bossa Style')
    expect(titleFromText('key: C\nA: | I |', 'fallback')).toBe('fallback')
  })
})

describe('chartTemplate', () => {
  it('起手範本本身就是一份合法曲譜（打開就能播）', () => {
    const draft = parseChartText(chartTemplate('My Tune'))
    expect(draft.title).toBe('My Tune')
    expect(draft.form).toEqual(['A', 'A2', 'B', 'A3'])
    expect(draft.sections).toHaveLength(4)
  })
})

describe('useUserChartsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('新增 → 存檔 → 重新載入還在', () => {
    const store = useUserChartsStore()
    const item = store.create('My Tune')
    expect(store.items).toHaveLength(1)

    setActivePinia(createPinia())
    const reloaded = useUserChartsStore()
    expect(reloaded.find(item.id)?.title).toBe('My Tune')
  })

  it('存檔時由 text 重算 title，選單與譜面不會不一致', () => {
    const store = useUserChartsStore()
    const item = store.create('Old')
    store.update(item.id, 'title: New\nkey: C\nA: | I |')
    expect(store.find(item.id)?.title).toBe('New')
  })

  it('匯入純文字', () => {
    const store = useUserChartsStore()
    const item = store.importText('title: Imported\nkey: F\nA: | I7 | IV7 |', 'fallback')
    expect(item.title).toBe('Imported')
    expect(store.items).toHaveLength(1)
  })

  it('刪除', () => {
    const store = useUserChartsStore()
    const item = store.create('x')
    store.remove(item.id)
    expect(store.items).toHaveLength(0)
    expect(store.find(item.id)).toBeUndefined()
  })

  it('壞掉的持久化資料整筆丟掉，不炸掉整頁', () => {
    seed([
      null,
      { id: '', text: 'key: C' },
      { id: 'chart-1' },
      { id: 'chart-2', text: 'key: C\nA: | I |' },
      { id: 'chart-3', text: 'key: C\nA: | I |', title: '   ' },
    ])
    const store = useUserChartsStore()
    expect(store.items.map((i) => i.id)).toEqual(['chart-2', 'chart-3'])
    // title 空白 → 回退成 id，選單不會出現一格空的
    expect(store.find('chart-3')?.title).toBe('chart-3')
  })

  it('不合法的曲譜文字照樣存得起來（解析錯誤是編輯器的事，不是 store 的事）', () => {
    const store = useUserChartsStore()
    const item = store.create('x')
    store.update(item.id, 'this is not a chart')
    expect(store.find(item.id)?.text).toBe('this is not a chart')
  })
})
