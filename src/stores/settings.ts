/**
 * 全域與各模組設定（持久化）。
 * 架構規則：模組設定一律經 moduleSettings() 存取（以模組 id 為 key），
 * 模組之間不得讀寫彼此的設定。
 */
import { defineStore } from 'pinia'
import { reactive, watch } from 'vue'
import { VersionedStore, type Migration } from '@/persistence/storage'
import { isChordDemoMode, type ChordDemoMode, type SoundingRole } from '@/core/audio'

export interface SettingsState {
  locale: 'zh-TW' | 'en'
  /** 各 click 角色音量 0–1 */
  voiceVolumes: Record<SoundingRole, number>
  /** 各 click 角色靜音狀態 */
  voiceMuted: Record<SoundingRole, boolean>
  /** 和弦示範音模式（PRD F5-1）；預設 off——click 才是主角 */
  chordDemo: ChordDemoMode
  /** 和弦示範音音量 0–1，獨立於 click */
  chordVolume: number
  /** key = 模組 id */
  moduleSettings: Record<string, Record<string, unknown>>
}

const SETTINGS_VERSION = 3

/**
 * v1 → v2：補 voiceMuted。v2 → v3：補和弦示範音設定。
 * 一律「補欄位、保留既有值」——使用者調過的音量與模組設定不能因為版本升級消失。
 */
const MIGRATIONS: readonly Migration[] = [
  {
    from: 1,
    migrate: (data) => ({
      ...(data as Record<string, unknown>),
      voiceMuted: { accent: false, normal: false, ghost: false },
    }),
  },
  {
    from: 2,
    migrate: (data) => ({
      ...(data as Record<string, unknown>),
      chordDemo: 'off',
      chordVolume: DEFAULT_CHORD_VOLUME,
    }),
  },
]

/** 示範音預設音量：聽得見，但不會蓋過 click */
export const DEFAULT_CHORD_VOLUME = 0.5

function defaultSettings(): SettingsState {
  return {
    locale: 'zh-TW',
    voiceVolumes: { accent: 1, normal: 0.8, ghost: 0.5 },
    voiceMuted: { accent: false, normal: false, ghost: false },
    chordDemo: 'off',
    chordVolume: DEFAULT_CHORD_VOLUME,
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

  // 持久化資料可被竄改：模式若不合法就回到 off（寧可沒聲音也不要壞掉的狀態）
  if (!isChordDemoMode(state.chordDemo)) state.chordDemo = 'off'
  if (!Number.isFinite(state.chordVolume)) state.chordVolume = DEFAULT_CHORD_VOLUME

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
