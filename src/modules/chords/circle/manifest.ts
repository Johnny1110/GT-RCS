import type { PracticeModuleManifest } from '@/modules/types'
import { CIRCLE_DEFAULTS } from '../settings'

export const chordsCircleManifest: PracticeModuleManifest = {
  id: 'chords.circle-progressions',
  category: 'chords',
  titleKey: 'modules.chords.circle.title',
  descriptionKey: 'modules.chords.circle.description',
  route: '/chords/circle-progressions',
  loadComponent: () => import('./CircleProgressionsView.vue'),
  defaultSettings: { ...CIRCLE_DEFAULTS },
}
