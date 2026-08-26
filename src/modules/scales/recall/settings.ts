import type { PracticeTransportSettings } from '@/composables/usePracticeTransport'
import type { NoteName, ScaleType } from '@/core/theory'
import type { RecallDirection, RecallLanguage } from './quiz'

export interface RecallSettings extends PracticeTransportSettings {
  /** 你點位置，還是你說名字 */
  direction: RecallDirection
  /** 絕對音名，還是相對某個調的度數 */
  language: RecallLanguage
  root: NoteName
  scale: ScaleType
  /** 每題幾小節；0 = 不限時（答完才換題） */
  barsPerQuestion: number
}

/** 0 放第一個：預設不限時——第一次打開就被 click 追著跑不是好的第一印象 */
export const BARS_PER_QUESTION_OPTIONS = [0, 2, 4, 8] as const

export const RECALL_DEFAULTS: RecallSettings = {
  direction: 'find',
  language: 'note',
  root: 'C',
  scale: 'ionian',
  barsPerQuestion: 0,
  bpm: 80,
  timeSig: '4/4',
  ticksPerBeat: 1,
}
