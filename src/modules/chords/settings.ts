import type { PracticeTransportSettings } from '@/composables/usePracticeTransport'
import type { NoteName } from '@/core/theory'

export interface CircleProgressionSettings extends PracticeTransportSettings {
  presetId: string
  barsPerKey: number
  startKey: NoteName
}

export const CIRCLE_DEFAULTS: CircleProgressionSettings = {
  presetId: '2516',
  barsPerKey: 8,
  startKey: 'C',
  bpm: 80,
  timeSig: '4/4',
  ticksPerBeat: 1,
}

export interface KeyPracticeSettings extends PracticeTransportSettings {
  key: NoteName
  levelId: string
  presetId: string
}

export const KEY_PRACTICE_DEFAULTS: KeyPracticeSettings = {
  key: 'C',
  levelId: 'level1',
  presetId: 'l1-1451',
  bpm: 80,
  timeSig: '4/4',
  ticksPerBeat: 1,
}

export const BARS_PER_KEY_OPTIONS = [4, 8, 16] as const
