import { describe, it, expect } from 'vitest'
import { MemoryStorage, VersionedStore, type Migration } from './storage'

interface V2 {
  bpm: number
  volume: number
}

describe('VersionedStore', () => {
  it('無資料回傳預設值；save/load roundtrip', () => {
    const storage = new MemoryStorage()
    const store = new VersionedStore<V2>('k', 2, () => ({ bpm: 90, volume: 1 }), [], storage)
    expect(store.load()).toEqual({ bpm: 90, volume: 1 })
    store.save({ bpm: 120, volume: 0.5 })
    expect(store.load()).toEqual({ bpm: 120, volume: 0.5 })
  })

  it('migration 鏈逐版執行', () => {
    const storage = new MemoryStorage()
    storage.setItem('k', JSON.stringify({ version: 1, data: { bpm: 100 } }))
    const migrations: Migration[] = [
      { from: 1, migrate: (d) => ({ ...(d as object), volume: 1 }) },
    ]
    const store = new VersionedStore<V2>('k', 2, () => ({ bpm: 90, volume: 1 }), migrations, storage)
    expect(store.load()).toEqual({ bpm: 100, volume: 1 })
  })

  it('損毀 JSON / 未知版本 / 缺 migration → 回退預設值', () => {
    const storage = new MemoryStorage()
    const defaults = () => ({ bpm: 90, volume: 1 })
    storage.setItem('k', 'not-json{{')
    expect(new VersionedStore<V2>('k', 2, defaults, [], storage).load()).toEqual(defaults())
    storage.setItem('k', JSON.stringify({ version: 99, data: {} }))
    expect(new VersionedStore<V2>('k', 2, defaults, [], storage).load()).toEqual(defaults())
    storage.setItem('k', JSON.stringify({ version: 1, data: {} }))
    expect(new VersionedStore<V2>('k', 2, defaults, [], storage).load()).toEqual(defaults())
  })
})
