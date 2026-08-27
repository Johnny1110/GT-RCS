// @vitest-environment happy-dom
/**
 * 快捷鍵的行為鎖定測試。
 *
 * 最重要的一條是「在輸入框裡不攔」：自訂進行編輯器要打得出 'ii V I'，
 * 空白鍵若被當成播放鍵，那個功能就廢了。這不是體貼，是正確性。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { BPM_MAX, BPM_MIN } from '@/core/audio'
import { stubAudioContext } from '@/test/audioContextStub'
import { withSetup } from '@/test/withSetup'
import { useShortcutsStore } from '@/stores/shortcuts'
import { useTransportStore } from '@/stores/transport'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { usePresetNavigation } from './usePresetNavigation'

function press(key: string, options: KeyboardEventInit & { target?: Element } = {}): KeyboardEvent {
  const { target, ...init } = options
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  ;(target ?? window).dispatchEvent(event)
  return event
}

function typeInto(tag: 'input' | 'textarea', type?: string): HTMLElement {
  const el = document.createElement(tag)
  if (type && el instanceof HTMLInputElement) el.type = type
  document.body.append(el)
  return el
}

describe('useKeyboardShortcuts', () => {
  let mounted: { unmount: () => void } | null = null

  beforeEach(() => {
    setActivePinia(createPinia())
    stubAudioContext()
    document.body.innerHTML = ''
    mounted = withSetup(() => useKeyboardShortcuts())
  })

  afterEach(() => {
    mounted?.unmount()
    vi.unstubAllGlobals()
  })

  it('space 切換播放，且擋掉瀏覽器捲一頁的預設行為', () => {
    const transport = useTransportStore()
    const toggle = vi.spyOn(transport, 'toggle')
    const event = press(' ')
    expect(toggle).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)
  })

  it('↑↓ 調 BPM ±1，按住 shift 走 ±10', () => {
    const transport = useTransportStore()
    transport.setBpm(100)
    press('ArrowUp')
    expect(transport.bpm).toBe(101)
    press('ArrowDown')
    expect(transport.bpm).toBe(100)
    press('ArrowUp', { shiftKey: true })
    expect(transport.bpm).toBe(110)
    press('ArrowDown', { shiftKey: true })
    expect(transport.bpm).toBe(100)
  })

  it('BPM 夾在合法範圍內（連按不會跑出去）', () => {
    const transport = useTransportStore()
    transport.setBpm(BPM_MAX)
    press('ArrowUp', { shiftKey: true })
    expect(transport.bpm).toBe(BPM_MAX)
    transport.setBpm(BPM_MIN)
    press('ArrowDown', { shiftKey: true })
    expect(transport.bpm).toBe(BPM_MIN)
  })

  it('在文字輸入框裡完全不攔（打得出 ii V I）', () => {
    const transport = useTransportStore()
    const toggle = vi.spyOn(transport, 'toggle')
    transport.setBpm(100)

    for (const target of [typeInto('input'), typeInto('input', 'text'), typeInto('textarea')]) {
      press(' ', { target })
      press('ArrowUp', { target })
    }
    expect(toggle).not.toHaveBeenCalled()
    expect(transport.bpm).toBe(100)
  })

  it('滑桿與核取方塊上照樣吃快捷鍵（那不是在打字）', () => {
    const transport = useTransportStore()
    const toggle = vi.spyOn(transport, 'toggle')
    press(' ', { target: typeInto('input', 'range') })
    press(' ', { target: typeInto('input', 'checkbox') })
    expect(toggle).toHaveBeenCalledTimes(2)
  })

  it('contenteditable 也視為打字', () => {
    const transport = useTransportStore()
    const toggle = vi.spyOn(transport, 'toggle')
    const el = document.createElement('div')
    el.contentEditable = 'true'
    Object.defineProperty(el, 'isContentEditable', { value: true })
    document.body.append(el)
    press(' ', { target: el })
    expect(toggle).not.toHaveBeenCalled()
  })

  it('帶 meta／ctrl／alt 的組合鍵一律放行（那是瀏覽器的快捷鍵）', () => {
    const transport = useTransportStore()
    const toggle = vi.spyOn(transport, 'toggle')
    press(' ', { metaKey: true })
    press(' ', { ctrlKey: true })
    press(' ', { altKey: true })
    expect(toggle).not.toHaveBeenCalled()
  })

  it('沒註冊 preset 清單時 ←→ 不攔（保留瀏覽器原本的捲動）', () => {
    expect(press('ArrowLeft').defaultPrevented).toBe(false)
    expect(press('ArrowRight').defaultPrevented).toBe(false)
  })

  it('? 開關說明面板；Esc 只在開著時處理', () => {
    const shortcuts = useShortcutsStore()
    expect(press('Escape').defaultPrevented).toBe(false)

    press('?')
    expect(shortcuts.helpOpen).toBe(true)
    expect(press('Escape').defaultPrevented).toBe(true)
    expect(shortcuts.helpOpen).toBe(false)
  })

  it('沒認識的鍵不攔（不要吃掉 Tab 之類的鍵）', () => {
    expect(press('Tab').defaultPrevented).toBe(false)
    expect(press('a').defaultPrevented).toBe(false)
  })

  it('卸載後不再攔鍵（離開練習頁快捷鍵就該消失）', () => {
    const transport = useTransportStore()
    const toggle = vi.spyOn(transport, 'toggle')
    mounted?.unmount()
    mounted = null
    press(' ')
    expect(toggle).not.toHaveBeenCalled()
  })
})

describe('←→ 換 preset', () => {
  let keyboard: { unmount: () => void }
  let page: { unmount: () => void }
  let selected: string

  beforeEach(() => {
    setActivePinia(createPinia())
    stubAudioContext()
    selected = 'b'
    keyboard = withSetup(() => useKeyboardShortcuts())
    page = withSetup(() =>
      usePresetNavigation({
        items: () => ['a', 'b', 'c'],
        current: () => selected,
        select: (id) => { selected = id },
      }),
    )
  })

  afterEach(() => {
    page.unmount()
    keyboard.unmount()
    vi.unstubAllGlobals()
  })

  it('→ 下一個、← 上一個', () => {
    press('ArrowRight')
    expect(selected).toBe('c')
    press('ArrowLeft')
    expect(selected).toBe('b')
  })

  it('到頭尾環回去（練到最後一個按 → 回到第一個）', () => {
    selected = 'c'
    press('ArrowRight')
    expect(selected).toBe('a')
    press('ArrowLeft')
    expect(selected).toBe('c')
  })

  it('離開頁面後解除註冊（←→ 不會打到已卸載的模組）', () => {
    page.unmount()
    const before = selected
    expect(press('ArrowRight').defaultPrevented).toBe(false)
    expect(selected).toBe(before)
  })

  it('只有一個項目時不攔（沒得換就把鍵還給瀏覽器）', () => {
    const shortcuts = useShortcutsStore()
    shortcuts.registerPresetNav({ items: () => ['only'], current: () => 'only', select: () => {} })
    expect(press('ArrowRight').defaultPrevented).toBe(false)
  })

  it('current 不在清單裡時從頭走（設定指向已刪除的 preset）', () => {
    selected = 'gone'
    press('ArrowRight')
    expect(selected).toBe('b')
  })
})

describe('useKeyboardShortcuts — T 敲擊測速', () => {
  let mounted: { unmount: () => void } | null = null

  beforeEach(() => {
    setActivePinia(createPinia())
    stubAudioContext()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    mounted?.unmount()
    vi.unstubAllGlobals()
  })

  it('T（大小寫皆可）觸發 onTap，並擋掉預設行為', () => {
    const onTap = vi.fn()
    mounted = withSetup(() => useKeyboardShortcuts({ onTap }))
    expect(press('t').defaultPrevented).toBe(true)
    expect(press('T').defaultPrevented).toBe(true)
    expect(onTap).toHaveBeenCalledTimes(2)
  })

  it('沒有註冊 onTap 時不攔 T——把鍵還給瀏覽器，而不是安靜地什麼都不做', () => {
    mounted = withSetup(() => useKeyboardShortcuts())
    expect(press('t').defaultPrevented).toBe(false)
  })

  it('在文字輸入框裡打字時不觸發（進行編輯器要打得出含 t 的和弦名）', () => {
    const onTap = vi.fn()
    mounted = withSetup(() => useKeyboardShortcuts({ onTap }))
    const field = typeInto('input', 'text')
    press('t', { target: field })
    expect(onTap).not.toHaveBeenCalled()
  })
})
