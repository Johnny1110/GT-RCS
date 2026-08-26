import type { PracticeTransportSettings } from '@/composables/usePracticeTransport'
import type { NoteName } from '@/core/theory'
import type { ArpeggioDirection } from './sequence'

export interface ArpeggioSettings extends PracticeTransportSettings {
  drillId: string
  /** 從哪個調開始，之後逆時針（五度下行）走完 12 調 */
  startKey: NoteName
  direction: ArpeggioDirection
  /** 每個調把課表走幾遍（單一品質的課表＝那個和弦停幾小節） */
  repeats: number
}

/**
 * 每調遍數。1 是「一路不停地換調」，4 給還在找指型的人多幾小節想。
 * 沒有 8 以上：停太久就變成單一調練習了，那是另一個模組的事。
 */
export const REPEAT_OPTIONS = [1, 2, 4] as const

export function isRepeatCount(value: unknown): value is number {
  return REPEAT_OPTIONS.some((count) => count === value)
}

/**
 * 預設值：順階七和弦 + 上行 + 4/4 正拍。
 * 這組值下一小節四格正好是一個七和弦的四個音，換和弦永遠落在小節線上——
 * 第一次打開就聽得懂發生什麼事，比任何說明都有效。
 */
export const ARPEGGIO_DEFAULTS: ArpeggioSettings = {
  drillId: 'diatonic7',
  startKey: 'C',
  direction: 'up',
  repeats: 1,
  bpm: 76,
  timeSig: '4/4',
  ticksPerBeat: 1,
}
