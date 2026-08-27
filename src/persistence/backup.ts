/**
 * 設定與紀錄的匯出／匯入（PRD F5-2.5、F5-3.4）。
 *
 * 沒有後端，使用者的一切都在這台瀏覽器的 localStorage 裡——清一次快取就全沒了。
 * 匯出一個 JSON 檔是唯一的備份手段，所以它不是加分項，是資料安全的底線。
 *
 * 設計選擇：**原封不動搬 envelope**（含各 store 自己的 version），不在這裡展開資料。
 * 匯入時寫回去，讀取時照樣走 VersionedStore 的 migration 鏈——
 * 舊版備份檔因此自動被升級，這一層完全不需要知道任何 schema。
 */
import { defaultStorage, type KVStorage } from './storage'

/** 備份檔本身的格式版本（與各 store 的 version 無關） */
export const BACKUP_FORMAT = 1

/** 會被備份的 localStorage key。新增持久化 store 時要記得加進來 */
export const BACKUP_KEYS = [
  'rcs.settings',
  'rcs.practiceLog',
  'rcs.customProgressions',
  'rcs.userCharts',
] as const

export interface BackupFile {
  app: 'rcs'
  format: number
  /** ISO 8601，由呼叫端注入（本層不讀時鐘） */
  exportedAt: string
  /** key → 該 key 的 envelope 原文（已 parse 過的物件） */
  stores: Record<string, unknown>
}

export class BackupFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupFormatError'
  }
}

export function exportBackup(exportedAt: string, storage: KVStorage = defaultStorage()): BackupFile {
  const stores: Record<string, unknown> = {}
  for (const key of BACKUP_KEYS) {
    const raw = storage.getItem(key)
    if (raw === null) continue
    try {
      stores[key] = JSON.parse(raw)
    } catch {
      // 已經壞掉的 key 不放進備份：帶著壞資料匯出只會把問題複製到下一台機器
    }
  }
  return { app: 'rcs', format: BACKUP_FORMAT, exportedAt, stores }
}

/**
 * 解析備份檔。**寧可明確報錯，也不猜**——匯入錯的檔案會覆蓋掉使用者的練習紀錄，
 * 是這個 app 裡唯一真正不可逆的操作。
 */
export function parseBackup(text: string): BackupFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new BackupFormatError('notJson')
  }
  if (typeof parsed !== 'object' || parsed === null) throw new BackupFormatError('notJson')

  const file = parsed as Partial<BackupFile>
  if (file.app !== 'rcs') throw new BackupFormatError('notRcs')
  if (typeof file.format !== 'number' || file.format > BACKUP_FORMAT) {
    throw new BackupFormatError('futureFormat')
  }
  if (typeof file.stores !== 'object' || file.stores === null) throw new BackupFormatError('noStores')

  return {
    app: 'rcs',
    format: file.format,
    exportedAt: typeof file.exportedAt === 'string' ? file.exportedAt : '',
    stores: file.stores,
  }
}

/**
 * 把備份寫回 localStorage，回傳實際還原的 key。
 * 只認識 BACKUP_KEYS：備份檔裡多出來的 key 一律忽略（別人塞什麼進來都不會生效）。
 */
export function importBackup(file: BackupFile, storage: KVStorage = defaultStorage()): string[] {
  const restored: string[] = []
  for (const key of BACKUP_KEYS) {
    const value = file.stores[key]
    if (value === undefined) continue
    storage.setItem(key, JSON.stringify(value))
    restored.push(key)
  }
  return restored
}

/** 備份檔名：帶日期，使用者才分得出哪一份是哪一天的 */
export function backupFilename(exportedAt: string): string {
  const day = exportedAt.slice(0, 10) || 'backup'
  return `rcs-backup-${day}.json`
}
