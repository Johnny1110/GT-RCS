/**
 * 和弦示範音的接線（PRD F5-1）：每個和弦練習都是「小節線換和弦」，這是共用流程。
 *
 * 為什麼訂 subscribeSchedule 而不是 subscribeTick：示範音要**發聲**。
 * 視覺 tick 是在 audioTime 已經到達時才觸發的，那時才排程等於已經遲到半幀；
 * 排程 tick 提前約 100ms 觸發，事件帶著未來的 audioTime，排進去才準。
 *
 * 聲部連接由 core/theory 的 voiceChord() 負責——這裡只記住上一個和弦的聲位傳回去，
 * 讓它挑移動距離最小的轉位。停止播放就忘掉，下次從原位重新開始。
 */
import { onUnmounted, watch } from 'vue'
import { voiceChord } from '@/core/theory'
import type { Note } from '@/core/theory'
import { useTransportStore } from '@/stores/transport'

/** 只需要「這個和弦有哪些音」，不在乎它是進行裡的第幾個 */
export interface DemoChord {
  tones: readonly Note[]
}

/**
 * @param chordAt 第 bar 小節（1-based，播放中的絕對小節數）該響的和弦；
 *                回傳 undefined 代表這個小節不發聲。
 */
export function useChordDemo(chordAt: (bar: number) => DemoChord | undefined): void {
  const transport = useTransportStore()
  let previous: number[] = []

  const unsubscribe = transport.subscribeSchedule((e) => {
    // 一個小節響一次：只認每小節的第一個細分
    if (e.beat !== 1 || e.tick !== 1) return
    if (transport.chordDemo === 'off') return
    const chord = chordAt(e.bar)
    if (!chord || chord.tones.length === 0) return
    previous = voiceChord(chord.tones, previous.length ? { previous } : {})
    transport.playChord(previous, e.audioTime, transport.barSeconds)
  })

  // 停止播放＝這一輪結束，聲部連接的記憶跟著清掉
  watch(() => transport.playing, (playing) => { if (!playing) previous = [] })

  onUnmounted(unsubscribe)
}
