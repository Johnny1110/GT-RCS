import type { PracticeModuleManifest } from '@/modules/types'
import { METRONOME_DEFAULTS } from './settings'

export const rhythmMetronomeManifest: PracticeModuleManifest = {
  id: 'rhythm.metronome',
  category: 'rhythm',
  titleKey: 'modules.rhythm.metronome.title',
  descriptionKey: 'modules.rhythm.metronome.description',
  route: '/rhythm/metronome',
  loadComponent: () => import('./MetronomeView.vue'),
  defaultSettings: { ...METRONOME_DEFAULTS },
}
