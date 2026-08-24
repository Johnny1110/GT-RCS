import type { PracticeTransportSettings } from '@/composables/usePracticeTransport'
import type { ScaleType, NoteName } from '@/core/theory'

export interface ExplorerSettings extends PracticeTransportSettings {
  root: NoteName
  scale: ScaleType
  labelMode: 'degree' | 'noteName'
}

export const EXPLORER_DEFAULTS: ExplorerSettings = {
  root: 'C',
  scale: 'ionian',
  labelMode: 'degree',
  bpm: 90,
  timeSig: '4/4',
  ticksPerBeat: 1,
}
