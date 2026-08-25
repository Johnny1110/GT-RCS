import type { PracticeModuleManifest } from '@/modules/types'
import { CUSTOM_DEFAULTS } from './settings'

export const chordsCustomManifest: PracticeModuleManifest = {
  id: 'chords.custom',
  category: 'chords',
  titleKey: 'modules.chords.custom.title',
  descriptionKey: 'modules.chords.custom.description',
  route: '/chords/custom',
  loadComponent: () => import('./CustomProgressionsView.vue'),
  defaultSettings: { ...CUSTOM_DEFAULTS },
}
