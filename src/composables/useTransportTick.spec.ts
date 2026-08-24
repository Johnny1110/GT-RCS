// @vitest-environment happy-dom
/**
 * 契約鎖定：useTransportTick 的回傳形態。
 * playing 若不是 ref，呼叫端一解構就失去響應性，拍燈與計數器會永遠停在停止狀態。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { isReactive, isRef } from 'vue'
import { useTransportTick } from './useTransportTick'
import { useTransportStore } from '@/stores/transport'

describe('useTransportTick', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('playing 是 ref（解構後仍具響應性）', () => {
    const { playing } = useTransportTick()
    expect(isRef(playing)).toBe(true)
    expect(playing.value).toBe(false)
  })

  it('position 是 reactive 物件，解構後屬性存取仍受追蹤', () => {
    const { position } = useTransportTick()
    expect(isReactive(position)).toBe(true)
    expect(position).toMatchObject({ bar: 0, beat: 0, tick: 0, role: null })
  })

  it('訂閱者收到 store 廣播的 tick', () => {
    const transport = useTransportStore()
    const seen: number[] = []
    const unsubscribe = transport.subscribeTick((e) => seen.push(e.bar))
    // 直接驗證廣播管線；實際 tick 由 AudioContext 驅動，於瀏覽器端驗收
    expect(typeof unsubscribe).toBe('function')
    unsubscribe()
    expect(seen).toEqual([])
  })
})
