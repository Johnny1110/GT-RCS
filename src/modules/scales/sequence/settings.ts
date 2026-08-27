import type { PracticeTransportSettings } from '@/composables/usePracticeTransport'
import type { NoteName, ScaleType } from '@/core/theory'
import type { SequenceDirection } from './patterns'

export interface ScaleSequenceSettings extends PracticeTransportSettings {
  root: NoteName
  scale: ScaleType
  /**
   * 指型記的是「從第幾度音起」而不是把位 id——id 綁在格號上（`6-5`），換個調就指向別的東西，
   * 但「根音起的那個指型」跨 12 調都是同一件事，而那正是這個練習要練的。
   * 型別是 string 而不是 DegreeLabel：它同時是持久化值，來源不可信。
   */
  shapeDegree: string
  patternId: string
  direction: SequenceDirection
}

/**
 * 預設值：A 小調五聲第一盒 + 四個一組 + 八分音符。
 *
 * 這是最多人已經會按的指型配上最多人聽過的模進，一組剛好兩拍——第一次打開按下播放，
 * 不必讀任何說明就聽得懂「往上搬一個音」是什麼意思。
 */
export const SCALE_SEQUENCE_DEFAULTS: ScaleSequenceSettings = {
  root: 'A',
  scale: 'minorPentatonic',
  shapeDegree: '1',
  patternId: 'fours',
  direction: 'up',
  bpm: 70,
  timeSig: '4/4',
  ticksPerBeat: 2,
}
