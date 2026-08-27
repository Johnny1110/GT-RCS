/**
 * 一格一音的示範音接線（七和弦琶音、音階模進共用）。
 *
 * 與 useChordDemo 的差別只有一件事，但那件事就是這兩個練習的定義：
 * **一格一個音**，而不是小節線上一整個和弦。因此訂閱的是每一個 tick
 * （含細分格），每次只送一個音高進 ChordVoice。
 *
 * 為什麼仍走 subscribeSchedule：要發聲的東西一律用排程訂閱（提前約 100ms，
 * 事件帶著未來的 audioTime）。用視覺 tick 排程等於每個音都遲到半幀，
 * 在十六分細分下那是聽得出來的。
 *
 * 「這一格該彈哪個音」不在這一層——那是練習設計
 * （modules/chords/arpeggio/sequence.ts、modules/scales/sequence/patterns.ts）。
 * 本層只負責把音高變成聲音，與 core/audio/chordVoice.ts 的分工一致。
 */
import { onUnmounted } from 'vue'
import type { TickEvent } from '@/core/audio'
import { useTransportStore } from '@/stores/transport'

/**
 * @param pitchAt 這個 tick 該響的 MIDI 音高；undefined = 這一格不發聲。
 */
export function useNoteDemo(pitchAt: (e: TickEvent) => number | undefined): void {
  const transport = useTransportStore()

  const unsubscribe = transport.subscribeSchedule((e) => {
    if (transport.chordDemo === 'off') return
    // 靜默小節（示範／靜默循環）連單音也不發：那一段就是要你自己撐住
    if (e.role === 'rest') return
    const midi = pitchAt(e)
    if (midi === undefined) return
    // 一個音響一格；太短的話 ChordVoice 會自己撐到起音＋放音的長度
    const slots = Math.max(1, transport.timeSig.beats * transport.ticksPerBeat)
    transport.playChord([midi], e.audioTime, transport.barSeconds / slots)
  })

  onUnmounted(unsubscribe)
}
