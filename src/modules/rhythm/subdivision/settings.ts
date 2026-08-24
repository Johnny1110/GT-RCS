import type { CountStyle } from '@/components/RhythmSheet/counting'
import type { PracticeTransportSettings } from '@/composables/usePracticeTransport'

export interface SubdivisionSettings extends PracticeTransportSettings {
  stageId: string
  patternId: string
  countStyle: CountStyle
  /** 示範／靜默組合的 key（見 shared.ts demoSilenceKey）；'off' = 全程示範 */
  demoSilence: string
}

export const SUBDIVISION_DEFAULTS: SubdivisionSettings = {
  stageId: 'quarter',
  patternId: 'quarterDown',
  countStyle: 'numeric',
  demoSilence: 'off',
  bpm: 70,
  timeSig: '4/4',
  ticksPerBeat: 1,
}
