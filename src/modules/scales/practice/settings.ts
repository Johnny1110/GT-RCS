import type { PracticeTransportSettings } from '@/composables/usePracticeTransport'
import type { NoteName, ScaleType } from '@/core/theory'

export interface ScalePracticeSettings extends PracticeTransportSettings {
  root: NoteName
  scale: ScaleType
}

export const SCALE_PRACTICE_DEFAULTS: ScalePracticeSettings = {
  root: 'A',
  scale: 'minorPentatonic',
  bpm: 80,
  timeSig: '4/4',
  ticksPerBeat: 1,
}
