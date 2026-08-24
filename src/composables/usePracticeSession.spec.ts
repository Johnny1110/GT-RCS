// @vitest-environment happy-dom
/**
 * 練習計時規則：累計時長、過短不記、停止與離開頁面結算。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { usePracticeSession, type PracticeSession } from './usePracticeSession'
import { usePracticeLogStore } from '@/stores/practiceLog'
import { useTransportStore } from '@/stores/transport'
import { stubAudioContext } from '@/test/audioContextStub'
import { withSetup } from '@/test/withSetup'

describe('usePracticeSession', () => {
  let clock = 0
  const now = () => clock

  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    clock = 1_700_000_000_000
    stubAudioContext()
  })

  afterEach(() => {
    useTransportStore().stop()
    vi.unstubAllGlobals()
  })

  function mountSession() {
    const log = usePracticeLogStore()
    const transport = useTransportStore()
    const { result, unmount } = withSetup<PracticeSession>(() =>
      usePracticeSession({
        moduleId: 'scales.practice',
        params: () => ({ root: 'C', scale: 'dorian' }),
        now,
      }),
    )
    return { log, transport, session: result, unmount }
  }

  it('播放後結算寫入日誌，含參數與 BPM', async () => {
    const { log, transport, session } = mountSession()
    transport.setBpm(120)
    await transport.play()
    await nextTick()
    clock += 90_000
    expect(session.flush()).toBe(true)
    expect(log.entries).toHaveLength(1)
    expect(log.entries[0]).toMatchObject({
      moduleId: 'scales.practice',
      durationSec: 90,
      bpm: 120,
      params: { root: 'C', scale: 'dorian' },
    })
  })

  it('停止播放即自動結算（不需手動 flush）', async () => {
    const { log, transport } = mountSession()
    await transport.play()
    await nextTick()
    clock += 45_000
    transport.stop()
    await nextTick()
    expect(log.entries).toHaveLength(1)
    expect(log.entries[0]?.durationSec).toBe(45)
  })

  it('離開頁面（卸載）結算未停止的 session', async () => {
    const { log, transport, unmount } = mountSession()
    await transport.play()
    await nextTick()
    clock += 120_000
    unmount()
    expect(log.entries).toHaveLength(1)
    expect(log.entries[0]?.durationSec).toBe(120)
  })

  it('短於 30 秒不寫入', async () => {
    const { log, transport, session } = mountSession()
    await transport.play()
    await nextTick()
    clock += 12_000
    expect(session.flush()).toBe(false)
    expect(log.entries).toHaveLength(0)
  })

  it('未開始播放時結算不產生紀錄', () => {
    const { log, session } = mountSession()
    expect(session.flush()).toBe(false)
    expect(log.entries).toHaveLength(0)
  })

  it('重複結算只記一次（stop 與卸載不會各寫一筆）', async () => {
    const { log, transport, session, unmount } = mountSession()
    await transport.play()
    await nextTick()
    clock += 60_000
    transport.stop()
    await nextTick()
    expect(session.flush()).toBe(false)
    unmount()
    expect(log.entries).toHaveLength(1)
  })
})
