/**
 * 練習日誌（持久化）— Phase 2 F2-2 起累積、Phase 5 F5-2 統計消費。
 */
import { defineStore } from 'pinia'
import { reactive } from 'vue'
import { VersionedStore } from '@/persistence/storage'
import { MIN_LOGGED_SESSION_SEC } from '@/modules/types'

export interface PracticeLogEntry {
  /** ISO 8601（記錄當下時刻） */
  date: string
  moduleId: string
  durationSec: number
  bpm: number
  /** 練習參數快照（調、音階、pattern id…），供 F5-2 BPM 進步線分組 */
  params?: Record<string, unknown>
}

const LOG_VERSION = 1

export const usePracticeLogStore = defineStore('practiceLog', () => {
  const persisted = new VersionedStore<PracticeLogEntry[]>('rcs.practiceLog', LOG_VERSION, () => [])
  const entries = reactive<PracticeLogEntry[]>(persisted.load())

  /** 過短 session 不記（回傳是否已記錄） */
  function addEntry(entry: PracticeLogEntry): boolean {
    if (entry.durationSec < MIN_LOGGED_SESSION_SEC) return false
    entries.push(entry)
    persisted.save([...entries])
    return true
  }

  function clearAll(): void {
    entries.splice(0)
    persisted.save([])
  }

  return { entries, addEntry, clearAll }
})
