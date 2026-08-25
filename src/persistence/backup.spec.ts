/**
 * 匯入是這個 app 裡唯一真正不可逆的操作（會蓋掉練習紀錄），
 * 所以「什麼檔案該被拒絕」是規格，測試比實作重要。
 */
import { describe, it, expect } from 'vitest'
import {
  BACKUP_FORMAT, BACKUP_KEYS, BackupFormatError, backupFilename,
  exportBackup, importBackup, parseBackup,
} from './backup'
import { MemoryStorage } from './storage'

const AT = '2026-08-25T13:00:00.000Z'

function seeded(): MemoryStorage {
  const storage = new MemoryStorage()
  storage.setItem('rcs.settings', JSON.stringify({ version: 3, data: { locale: 'en' } }))
  storage.setItem('rcs.practiceLog', JSON.stringify({ version: 1, data: [{ moduleId: 'a' }] }))
  return storage
}

describe('exportBackup', () => {
  it('原封不動搬 envelope（含各 store 自己的 version）', () => {
    const file = exportBackup(AT, seeded())
    expect(file).toMatchObject({ app: 'rcs', format: BACKUP_FORMAT, exportedAt: AT })
    expect(file.stores['rcs.settings']).toEqual({ version: 3, data: { locale: 'en' } })
  })

  it('沒有的 key 不出現在備份裡（不寫 null 進去）', () => {
    const file = exportBackup(AT, seeded())
    expect('rcs.customProgressions' in file.stores).toBe(false)
  })

  it('已經壞掉的 key 不放進備份（別把問題複製到下一台機器）', () => {
    const storage = seeded()
    storage.setItem('rcs.customProgressions', 'not-json{{')
    const file = exportBackup(AT, storage)
    expect('rcs.customProgressions' in file.stores).toBe(false)
    expect('rcs.settings' in file.stores).toBe(true)
  })

  it('全空也匯得出檔（新使用者按匯出不該爆炸）', () => {
    expect(exportBackup(AT, new MemoryStorage()).stores).toEqual({})
  })
})

describe('parseBackup', () => {
  it('roundtrip：匯出的檔解析得回來', () => {
    const file = exportBackup(AT, seeded())
    expect(parseBackup(JSON.stringify(file))).toEqual(file)
  })

  it('不是 JSON → notJson', () => {
    expect(() => parseBackup('nope{{')).toThrow(BackupFormatError)
    expect(() => parseBackup('nope{{')).toThrow('notJson')
  })

  it('別的 app 的 JSON → notRcs（不猜，直接拒絕）', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'other', format: 1, stores: {} }))).toThrow('notRcs')
    expect(() => parseBackup('[1,2,3]')).toThrow('notRcs')
    expect(() => parseBackup('null')).toThrow('notJson')
  })

  it('未來版本的備份檔 → futureFormat（不試著讀不認識的格式）', () => {
    const future = JSON.stringify({ app: 'rcs', format: BACKUP_FORMAT + 1, stores: {} })
    expect(() => parseBackup(future)).toThrow('futureFormat')
  })

  it('缺 stores → noStores', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'rcs', format: 1 }))).toThrow('noStores')
  })

  it('缺 exportedAt 不算錯（只影響檔名）', () => {
    expect(parseBackup(JSON.stringify({ app: 'rcs', format: 1, stores: {} })).exportedAt).toBe('')
  })
})

describe('importBackup', () => {
  it('寫回 localStorage 並回報還原了哪些 key', () => {
    const target = new MemoryStorage()
    const restored = importBackup(exportBackup(AT, seeded()), target)
    expect(restored).toEqual(['rcs.settings', 'rcs.practiceLog'])
    expect(JSON.parse(target.getItem('rcs.settings')!)).toEqual({ version: 3, data: { locale: 'en' } })
  })

  it('備份檔裡不認識的 key 一律忽略（別人塞什麼進來都不生效）', () => {
    const target = new MemoryStorage()
    importBackup(
      { app: 'rcs', format: 1, exportedAt: AT, stores: { 'evil.key': { version: 1, data: 'x' } } },
      target,
    )
    expect(target.getItem('evil.key')).toBeNull()
  })

  it('備份檔沒有的 key 不會清掉現有資料', () => {
    const target = seeded()
    importBackup({ app: 'rcs', format: 1, exportedAt: AT, stores: {} }, target)
    expect(target.getItem('rcs.practiceLog')).not.toBeNull()
  })

  it('BACKUP_KEYS 涵蓋全部 rcs.* 持久化 key（新增 store 要記得加進來）', () => {
    expect([...BACKUP_KEYS]).toEqual(['rcs.settings', 'rcs.practiceLog', 'rcs.customProgressions'])
  })
})

describe('backupFilename', () => {
  it('檔名帶日期，分得出哪一份是哪一天的', () => {
    expect(backupFilename(AT)).toBe('rcs-backup-2026-08-25.json')
    expect(backupFilename('')).toBe('rcs-backup-backup.json')
  })
})
