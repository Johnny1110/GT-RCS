/**
 * 把當前練習頁的「可切換清單」交給鍵盤層（PRD F5-4.1 的 ←→）。
 *
 * 每個模組的「preset」不是同一種東西——音階線是音階、節奏線是 pattern、
 * 和弦線是進行——所以清單由頁面提供，鍵盤層只認識「上一個／下一個」。
 * 註冊隨組件生命週期解除，←→ 不會打到已經離開的頁面。
 */
import { onUnmounted } from 'vue'
import { useShortcutsStore, type PresetNavigation } from '@/stores/shortcuts'

export function usePresetNavigation(nav: PresetNavigation): void {
  onUnmounted(useShortcutsStore().registerPresetNav(nav))
}
