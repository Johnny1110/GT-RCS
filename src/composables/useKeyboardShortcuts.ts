/**
 * 全域鍵盤快捷鍵（PRD F5-4.1）。掛在 TransportBar 上——它只在練習頁存在，
 * 快捷鍵的作用範圍剛好就是「有 click 的頁面」。
 *
 * 兩條規則，兩者都是**正確性**而不是體貼：
 * 1. **在輸入元件裡一律不攔**：自訂進行編輯器有文字框，打 'ii V I' 的空白鍵
 *    如果被當成播放鍵，那個功能就沒法用了。
 * 2. **只攔真的處理掉的鍵**：沒註冊 preset 清單的頁面按 ←→ 應該保持瀏覽器原本行為
 *    （捲動），不是安靜地什麼都不做。
 */
import { onMounted, onUnmounted } from 'vue'
import { BPM_MAX, BPM_MIN } from '@/core/audio'
import { useShortcutsStore } from '@/stores/shortcuts'
import { useTransportStore } from '@/stores/transport'

/** ↑↓ 的步進；按住 shift 走大步 */
const BPM_STEP = 1
const BPM_STEP_LARGE = 10

/** 正在打字時不攔鍵盤 */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag !== 'INPUT') return false
  // range／checkbox 這種不是打字的輸入照樣吃快捷鍵（滑桿上按 space 播放是合理的）
  const type = (target as HTMLInputElement).type
  return type !== 'range' && type !== 'checkbox' && type !== 'radio' && type !== 'button'
}

export interface KeyboardShortcutOptions {
  /**
   * `T` 敲擊測速。由呼叫端傳進來而不是在這裡 useTapTempo()：
   * 敲擊測量是有狀態的，鍵盤與畫面上的 TAP 鈕必須共用同一次測量，
   * 各自持有一份的話，交替使用兩者會得到兩串互不相干的間隔。
   */
  onTap?: () => void
}

export function useKeyboardShortcuts(options: KeyboardShortcutOptions = {}): void {
  const transport = useTransportStore()
  const shortcuts = useShortcutsStore()

  function nudgeBpm(direction: number, large: boolean): void {
    const step = (large ? BPM_STEP_LARGE : BPM_STEP) * direction
    transport.setBpm(Math.min(BPM_MAX, Math.max(BPM_MIN, transport.bpm + step)))
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
    if (isTextEntry(event.target)) return

    // Esc 只在說明面板開著時處理，其餘交還給瀏覽器
    if (event.key === 'Escape') {
      if (!shortcuts.helpOpen) return
      shortcuts.closeHelp()
      event.preventDefault()
      return
    }

    switch (event.key) {
      case ' ':
      case 'Spacebar':
        transport.toggle()
        break
      case 'ArrowUp':
        nudgeBpm(1, event.shiftKey)
        break
      case 'ArrowDown':
        nudgeBpm(-1, event.shiftKey)
        break
      case 'ArrowLeft':
        if (!shortcuts.movePreset(-1)) return
        break
      case 'ArrowRight':
        if (!shortcuts.movePreset(1)) return
        break
      case 't':
      case 'T':
        if (!options.onTap) return
        options.onTap()
        break
      case '?':
        shortcuts.toggleHelp()
        break
      default:
        return
    }
    // 走到這裡代表真的處理掉了：擋掉捲動與「space 捲一頁」的預設行為
    event.preventDefault()
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
}
