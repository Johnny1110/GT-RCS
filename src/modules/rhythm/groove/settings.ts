import type { CountStyle } from '@/components/RhythmSheet/counting'
import type { PracticeTransportSettings } from '@/composables/usePracticeTransport'
import { SWING_STRAIGHT, type CellRole } from '@/core/audio'

export interface GrooveSettings extends PracticeTransportSettings {
  styleId: string
  patternId: string
  countStyle: CountStyle
  swing: number
  /**
   * 自訂 pattern（PRD F4-4.4）：key = preset id，value = 各小節的格子。
   * 存在即覆蓋 preset；「回復預設」就是刪掉這一筆。
   * 讀取時一律經 normalizeBars 修尺寸——localStorage 是不可信輸入。
   */
  overrides: Record<string, CellRole[][]>
}

export const GROOVE_DEFAULTS: GrooveSettings = {
  styleId: 'funk',
  patternId: 'funkOne',
  countStyle: 'numeric',
  swing: SWING_STRAIGHT,
  overrides: {},
  bpm: 96,
  timeSig: '4/4',
  ticksPerBeat: 4,
}
