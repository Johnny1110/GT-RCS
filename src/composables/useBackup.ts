/**
 * 備份的下載與還原（PRD F5-2.5 / F5-3.4）。
 *
 * 純粹的組裝與驗證在 persistence/backup.ts；這裡只做兩件 DOM 的事：
 * 把 JSON 變成一個下載、把使用者選的檔案讀成字串。
 *
 * 還原後**重新載入頁面**：store 裡的 reactive 狀態是在載入時從 localStorage 讀進來的，
 * 寫回去不會讓它們自己更新。與其到處補「重讀」的路徑，不如老實重載一次——
 * 這也符合使用者對「還原備份」的心理預期。
 */
import { ref, type Ref } from 'vue'
import {
  BackupFormatError, backupFilename, exportBackup, importBackup, parseBackup,
} from '@/persistence/backup'

export interface BackupController {
  /** 最近一次匯入失敗的原因代碼（i18n key 的後綴）；成功或未操作時為 null */
  error: Ref<string | null>
  download: () => void
  /** 回傳是否成功；成功時會重新載入頁面 */
  restore: (file: File) => Promise<boolean>
}

export function useBackup(): BackupController {
  const error = ref<string | null>(null)

  function download(): void {
    const exportedAt = new Date().toISOString()
    const blob = new Blob([JSON.stringify(exportBackup(exportedAt), null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = backupFilename(exportedAt)
    link.click()
    URL.revokeObjectURL(url)
  }

  async function restore(file: File): Promise<boolean> {
    error.value = null
    try {
      importBackup(parseBackup(await file.text()))
    } catch (e) {
      error.value = e instanceof BackupFormatError ? e.message : 'unknown'
      return false
    }
    location.reload()
    return true
  }

  return { error, download, restore }
}
