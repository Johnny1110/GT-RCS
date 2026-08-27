/**
 * comping 示範音的接線（Phase 8 / F8-7）。
 *
 * ## 與 useChordDemo 的差別，以及為什麼需要第三個
 *
 * useChordDemo 一小節只在第一格響一次——那是「小節線換和弦」的練習模型。
 * 標準曲要的是兩件它做不到的事：小節內換和弦（半小節一個是爵士常態），
 * 以及**和弦跟著 comping 圖形敲**（Freddie Green 四分、Charleston 的反拍）。
 *
 * ## 為什麼不像 useNoteDemo 那樣過濾 role === 'rest'
 *
 * useNoteDemo 的音符格子就是 Transport 的 pattern 格子，所以 rest 等於「這格不彈」。
 * 這裡不是：comp 圖形與 click 圖形是兩張格子（見 modules/chords/jazzBook/feels.ts），
 * Charleston 的敲點正好落在 click 休止的那一格。拿 click 的 role 當閘門會把
 * comping 最重要的反拍全部吃掉。所以敲不敲一律由呼叫端的 hitAt 決定——
 * 包含示範／靜默循環的靜默小節（模組自己持有那個設定，判斷得起來）。
 *
 * 仍走 subscribeSchedule：要發聲的東西一律用排程訂閱（提前約 100ms，事件帶未來的
 * audioTime）。用視覺 tick 排程等於每一擊遲到半幀。
 */
import { onUnmounted, watch } from 'vue'
import { voiceChord } from '@/core/theory'
import type { Note } from '@/core/theory'
import type { TickEvent } from '@/core/audio'
import { useTransportStore } from '@/stores/transport'

export interface CompChord {
  /**
   * 同一個和弦的穩定識別（通常就是和弦符號）。
   * **和弦沒換就不重新配置聲位**：每一擊都跑一次 voiceChord()，同一個 Dm7 連敲四下
   * 會跳四個轉位——聽起來像有人在亂彈，而且因為音都是對的，極難查。
   */
  key: string
  tones: readonly Note[]
  /** 這一擊響幾拍（到下一個敲點的距離） */
  beats: number
}

export function useCompDemo(hitAt: (e: TickEvent) => CompChord | undefined): void {
  const transport = useTransportStore()
  let previous: number[] = []
  let previousKey = ''

  const unsubscribe = transport.subscribeSchedule((e) => {
    if (transport.chordDemo === 'off') return
    const hit = hitAt(e)
    if (!hit || hit.tones.length === 0) return
    if (hit.key !== previousKey) {
      previous = voiceChord(hit.tones, previous.length ? { previous } : {})
      previousKey = hit.key
    }
    const secondsPerBeat = transport.barSeconds / Math.max(1, transport.timeSig.beats)
    transport.playChord(previous, e.audioTime, hit.beats * secondsPerBeat)
  })

  // 停止播放＝這一輪結束，聲部連接的記憶跟著清掉（與 useChordDemo 一致）
  watch(() => transport.playing, (playing) => {
    if (!playing) {
      previous = []
      previousKey = ''
    }
  })

  onUnmounted(unsubscribe)
}
