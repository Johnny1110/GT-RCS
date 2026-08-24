import type { PracticeTransportSettings } from '@/composables/usePracticeTransport'

export type MetronomeSettings = PracticeTransportSettings

export const METRONOME_DEFAULTS: MetronomeSettings = {
  bpm: 90,
  timeSig: '4/4',
  ticksPerBeat: 1,
}
