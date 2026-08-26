import type { PracticeModuleManifest } from '@/modules/types'
import { ARPEGGIO_DEFAULTS } from './settings'

export const chordsArpeggioManifest: PracticeModuleManifest = {
  id: 'chords.arpeggio',
  category: 'chords',
  titleKey: 'modules.chords.arpeggio.title',
  descriptionKey: 'modules.chords.arpeggio.description',
  route: '/chords/arpeggio',
  loadComponent: () => import('./ArpeggioView.vue'),
  defaultSettings: { ...ARPEGGIO_DEFAULTS },
  knowledgeIds: ['chord.seventh-arpeggios'],
}
