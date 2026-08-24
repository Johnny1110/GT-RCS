import type { PracticeModuleManifest } from '@/modules/types'
import { GROOVE_DEFAULTS } from './settings'

export const rhythmGrooveManifest: PracticeModuleManifest = {
  id: 'rhythm.groove',
  category: 'rhythm',
  titleKey: 'modules.rhythm.groove.title',
  descriptionKey: 'modules.rhythm.groove.description',
  route: '/rhythm/groove',
  loadComponent: () => import('./GrooveView.vue'),
  defaultSettings: { ...GROOVE_DEFAULTS },
  knowledgeIds: ['rhythm.ghostNote'],
}
