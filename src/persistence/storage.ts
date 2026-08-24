/**
 * 持久化層 — Adapter + 版本化 migration（PRD F1-5）。
 *
 * 架構規則：
 * - 應用層（stores）只認識 VersionedStore，不直接碰 localStorage。
 * - 每個 store 一個 key、一個 version；schema 變更必須附 migration，
 *   禁止「清掉重來」（會毀掉使用者的練習紀錄）。
 * - 損毀資料（JSON 壞掉、版本超前）→ 回退預設值，不丟例外。
 */

export interface KVStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** 測試 / SSR fallback */
export class MemoryStorage implements KVStorage {
  private map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
}

export interface Migration {
  /** 從此版本升到 from+1 */
  from: number
  migrate(data: unknown): unknown
}

interface Envelope {
  version: number
  data: unknown
}

function defaultStorage(): KVStorage {
  return typeof localStorage !== 'undefined' ? localStorage : new MemoryStorage()
}

export class VersionedStore<T> {
  constructor(
    private readonly key: string,
    private readonly version: number,
    private readonly defaults: () => T,
    private readonly migrations: readonly Migration[] = [],
    private readonly storage: KVStorage = defaultStorage(),
  ) {}

  load(): T {
    const raw = this.storage.getItem(this.key)
    if (raw === null) return this.defaults()
    try {
      const envelope = JSON.parse(raw) as Envelope
      if (typeof envelope.version !== 'number') return this.defaults()
      let { version, data } = envelope
      while (version < this.version) {
        const step = this.migrations.find((m) => m.from === version)
        if (!step) return this.defaults()
        data = step.migrate(data)
        version += 1
      }
      if (version !== this.version) return this.defaults()
      return data as T
    } catch {
      return this.defaults()
    }
  }

  save(data: T): void {
    const envelope: Envelope = { version: this.version, data }
    this.storage.setItem(this.key, JSON.stringify(envelope))
  }

  clear(): void {
    this.storage.removeItem(this.key)
  }
}
