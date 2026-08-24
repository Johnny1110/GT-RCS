/**
 * 全域與各模組設定（持久化）。
 * 架構規則：模組設定一律經 moduleSettings() 存取（以模組 id 為 key），
 * 模組之間不得讀寫彼此的設定。
 */
import { defineStore } from 'pinia'
import { reactive, watch } from 'vue'
import { VersionedStore, type Migration } from '@/persistence/storage'
import type { SoundingRole } from '@/core/audio'

export interface SettingsState {
  locale: 'zh-TW' | 'en'
  /** 各 click 角色音量 0–1 */
  voiceVolumes: Record<SoundingRole, number>
  /** 各 click 角色靜音狀態 */
  voiceMuted: Record<SoundingRole, boolean>
  /** key = 模組 id */
  moduleSettings: Record<string, Record<string, unknown>>
}

const SETTINGS_VERSION = 2

/** v1 沒有 voiceMuted；補上預設值，保留使用者既有音量與模組設定 */
const MIGRATIONS: readonly Migration[] = [
  {
    from: 1,
    migrate: (data) => ({
      ...(data as Record<string, unknown>),
      voiceMuted: { accent: false, normal: false, ghost: false },
    }),
  },
]

function defaultSettings(): SettingsState {
  return {
    locale: 'zh-TW',
    voiceVolumes: { accent: 1, normal: 0.8, ghost: 0.5 },
    voiceMuted: { accent: false, normal: false, ghost: false },
    moduleSettings: {},
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const persisted = new VersionedStore<SettingsState>(
    'rcs.settings',
    SETTINGS_VERSION,
    defaultSettings,
    MIGRATIONS,
  )
  const state = reactive<SettingsState>(persisted.load())

  watch(state, () => persisted.save({ ...state }), { deep: true })

  /** 取得模組設定（與 manifest.defaultSettings 合併） */
  function moduleSettings<T extends Record<string, unknown>>(moduleId: string, defaults: T): T {
    const saved = state.moduleSettings[moduleId] ?? {}
    return { ...defaults, ...saved }
  }

  function saveModuleSettings(moduleId: string, settings: Record<string, unknown>): void {
    state.moduleSettings[moduleId] = { ...state.moduleSettings[moduleId], ...settings }
  }

  return { state, moduleSettings, saveModuleSettings }
})
