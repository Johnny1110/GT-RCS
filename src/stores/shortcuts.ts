/**
 * 全域鍵盤快捷鍵的共享狀態（PRD F5-4.1）。
 *
 * 為什麼需要一個 store：space 與 ↑↓ 只要 transport 就夠了，但 ←→「換 preset」
 * 的語意在每個練習模組都不一樣（換音階／換 pattern／換進行）。
 * 由當前的練習頁註冊自己的清單，鍵盤層只認識「上一個／下一個」。
 * 註冊是有生命週期的：離開頁面就解除，←→ 不會打到已經卸載的模組。
 */
import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

export interface PresetNavigation {
  /** 可切換的項目 id（依畫面上的顯示順序） */
  items: () => readonly string[]
  current: () => string
  select: (id: string) => void
}

export const useShortcutsStore = defineStore('shortcuts', () => {
  const nav = shallowRef<PresetNavigation | null>(null)
  const helpOpen = ref(false)

  /** 註冊當前頁的 preset 清單；回傳解除註冊函式 */
  function registerPresetNav(value: PresetNavigation): () => void {
    nav.value = value
    return () => {
      // 只解除自己註冊的那一份：路由切換時新頁可能已經先註冊好了
      if (nav.value === value) nav.value = null
    }
  }

  /** step = -1（上一個）或 +1（下一個）。到頭尾就環回去 */
  function movePreset(step: number): boolean {
    const value = nav.value
    if (!value) return false
    const items = value.items()
    if (items.length < 2) return false
    const index = items.indexOf(value.current())
    const next = items[(((index < 0 ? 0 : index) + step) % items.length + items.length) % items.length]
    if (next === undefined || next === value.current()) return false
    value.select(next)
    return true
  }

  function toggleHelp(): void {
    helpOpen.value = !helpOpen.value
  }

  function closeHelp(): void {
    helpOpen.value = false
  }

  return { helpOpen, hasPresetNav: nav, registerPresetNav, movePreset, toggleHelp, closeHelp }
})
