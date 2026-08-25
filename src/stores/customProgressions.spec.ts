// @vitest-environment happy-dom
/**
 * 自訂進行是使用者自己造的教材——弄丟或弄壞比沒有更糟，所以持久化與壞資料都要測。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { parseProgression, realizeProgression } from '@/core/theory'
import {
  defaultProgression, nextId, toPreset, useCustomProgressionsStore, type CustomProgression,
} from './customProgressions'

const KEY = 'rcs.customProgressions'

function seed(items: unknown[]): void {
  localStorage.setItem(KEY, JSON.stringify({ version: 1, data: items }))
}

describe('nextId', () => {
  it('取現有數字後綴的最大值 +1（不依賴時鐘或亂數）', () => {
    const of = (id: string): CustomProgression => defaultProgression(id, 'x')
    expect(nextId([])).toBe('custom-1')
    expect(nextId([of('custom-1'), of('custom-7')])).toBe('custom-8')
    expect(nextId([of('legacy')])).toBe('custom-1')
  })
})

describe('toPreset', () => {
  it('barsPerChord 展開成與 token 數等長的陣列（core 的契約要求等長）', () => {
    const item = { ...defaultProgression('custom-1', 'x'), tokens: 'ii V I', barsPerChord: 2 }
    const preset = toPreset(item, parseProgression(item.tokens).length)
    expect(preset.barsPerChord).toEqual([2, 2, 2])
    expect(realizeProgression(preset, { key: 'C', harmonyLevel: 'seventh' })).toHaveLength(3)
  })

  it('展開後真的可以跟練（進行引擎吃得下）', () => {
    const item = { ...defaultProgression('custom-1', 'x'), tokens: 'I vi ii V' }
    const bars = realizeProgression(toPreset(item, 4), { key: 'C', harmonyLevel: 'seventh' })
    expect(bars.flatMap((b) => b.chords.map((c) => c.symbol))).toEqual(['Cmaj7', 'Am7', 'Dm7', 'G7'])
  })

  it('token 數為 0 時仍給得出至少一格（不產生空陣列讓 core 丟例外）', () => {
    expect(toPreset(defaultProgression('custom-1', 'x'), 0).barsPerChord).toHaveLength(1)
  })
})

describe('useCustomProgressionsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('新建、更新、複製、刪除都會寫進 localStorage', () => {
    const store = useCustomProgressionsStore()
    const created = store.create('我的 2-5-1')
    expect(store.items).toHaveLength(1)

    store.update(created.id, { tokens: 'I IV V', defaultBpm: 120 })
    expect(store.find(created.id)).toMatchObject({ tokens: 'I IV V', defaultBpm: 120 })

    const copy = store.duplicate(created.id, '(複製)')!
    expect(copy.name).toBe('我的 2-5-1 (複製)')
    expect(copy.tokens).toBe('I IV V')
    expect(store.items.map((i) => i.id)).toEqual([created.id, copy.id])

    store.remove(created.id)
    expect(store.items.map((i) => i.id)).toEqual([copy.id])

    const raw = JSON.parse(localStorage.getItem(KEY)!) as { data: CustomProgression[] }
    expect(raw.data).toHaveLength(1)
    expect(raw.data[0]!.id).toBe(copy.id)
  })

  it('複製插在原項目後面（不是丟到列表最後面找不到）', () => {
    const store = useCustomProgressionsStore()
    const a = store.create('a')
    store.create('b')
    const copy = store.duplicate(a.id, '2')!
    expect(store.items.map((i) => i.name)).toEqual(['a', 'a 2', 'b'])
    expect(copy.id).not.toBe(a.id)
  })

  it('update 不讓 id 被改掉（改了會讓所有指向它的設定失效）', () => {
    const store = useCustomProgressionsStore()
    const item = store.create('x')
    store.update(item.id, { id: 'hacked', name: 'y' } as Partial<CustomProgression>)
    expect(store.find(item.id)?.name).toBe('y')
    expect(store.find('hacked')).toBeUndefined()
  })

  it('操作不存在的 id 不炸', () => {
    const store = useCustomProgressionsStore()
    expect(() => store.update('nope', { name: 'x' })).not.toThrow()
    expect(store.duplicate('nope', '2')).toBeUndefined()
    expect(() => store.remove('nope')).not.toThrow()
    expect(store.find(null)).toBeUndefined()
  })

  it('壞掉的持久化資料逐項回退，不整份丟掉', () => {
    seed([
      { id: 'custom-1', name: '好的', tokens: 'I V', barsPerChord: 2, defaultBpm: 100, harmonyLevel: 'triad', key: 'G', cycleKeys: true, barsPerKey: 4 },
      { id: 'custom-2', barsPerChord: 99, defaultBpm: 'fast', harmonyLevel: 'quantum' },
      { name: '沒有 id' },
      'not an object',
    ])
    const store = useCustomProgressionsStore()
    expect(store.items).toHaveLength(2)
    expect(store.items[0]).toMatchObject({ name: '好的', barsPerChord: 2, harmonyLevel: 'triad', cycleKeys: true })
    // 壞欄位回退預設，但這一筆本身還在
    expect(store.items[1]).toMatchObject({ id: 'custom-2', barsPerChord: 1, defaultBpm: 80, harmonyLevel: 'seventh' })
  })

  it('整份資料不是陣列時當作空的（不炸）', () => {
    seed([])
    localStorage.setItem(KEY, JSON.stringify({ version: 1, data: { nope: true } }))
    expect(useCustomProgressionsStore().items).toEqual([])
  })
})
