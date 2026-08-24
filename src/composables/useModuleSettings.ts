/**
 * 模組設定的持久化綁定（架構規則：模組設定一律以模組 id 為 key）。
 * 回傳的物件是響應式的，任何變更自動寫入 localStorage。
 */
import { reactive, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'

export function useModuleSettings<T extends Record<string, unknown>>(moduleId: string, defaults: T): T {
  const settings = useSettingsStore()
  const state = reactive(settings.moduleSettings(moduleId, defaults)) as T
  watch(
    () => state,
    () => settings.saveModuleSettings(moduleId, { ...state }),
    { deep: true },
  )
  return state
}
