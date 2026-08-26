// @vitest-environment happy-dom
/**
 * 行為鎖定：小節游標的位移語意。
 *
 * 兩件事一旦壞掉，症狀都是「點了和弦畫面換了、聲音沒換」：
 * barFor() 必須與 bar 用同一個位移；停止播放必須把位移歸零
 * （transport 的 position 也歸零，位移留著會讓畫面停在一個對不上小節數的和弦）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useBarCursor, type BarCursor } from './useBarCursor'
import { useTransportStore } from '@/stores/transport'
import { stubAudioContext } from '@/test/audioContextStub'

describe('useBarCursor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    stubAudioContext()
  })

  afterEach(() => {
    useTransportStore().stop()
    vi.unstubAllGlobals()
  })

  const cursor = (): BarCursor => useBarCursor()

  it('未播放時停在第 1 小節', () => {
    expect(cursor().bar.value).toBe(1)
  })

  it('jumpBy 累加位移，jumpTo 直接指定目標小節', () => {
    const c = cursor()
    c.jumpBy(2)
    expect(c.bar.value).toBe(3)
    c.jumpBy(3)
    expect(c.bar.value).toBe(6)
    c.jumpTo(9)
    expect(c.bar.value).toBe(9)
    c.reset()
    expect(c.bar.value).toBe(1)
  })

  it('barFor 與 bar 用同一個位移（示範音才會跟著跳）', () => {
    const c = cursor()
    c.jumpBy(4)
    expect(c.barFor(1)).toBe(5)
    expect(c.barFor(10)).toBe(14)
    // 未播放時 bar 的基準是第 1 小節，等於 barFor(1)
    expect(c.bar.value).toBe(c.barFor(1))
  })

  it('位移可以是負的（點時間軸上已經過去的那一格）', () => {
    const c = cursor()
    c.jumpBy(-2)
    expect(c.barFor(10)).toBe(8)
  })

  it('停止播放時位移歸零（停止＝回到開頭）', async () => {
    const transport = useTransportStore()
    const c = cursor()
    await transport.play()
    await nextTick()

    c.jumpBy(5)
    expect(c.barFor(1)).toBe(6)

    transport.stop()
    await nextTick()
    expect(c.bar.value).toBe(1)
    expect(c.barFor(3)).toBe(3)
  })
})
