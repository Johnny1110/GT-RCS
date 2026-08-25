import type { PracticeTransportSettings } from '@/composables/usePracticeTransport'

export interface CustomProgressionSettings extends PracticeTransportSettings {
  /** 目前選中的自訂進行 id；進行本身存在 customProgressions store（可能已被刪除） */
  selectedId: string
}

export const CUSTOM_DEFAULTS: CustomProgressionSettings = {
  selectedId: '',
  bpm: 80,
  timeSig: '4/4',
  ticksPerBeat: 1,
}
