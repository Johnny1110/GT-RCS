import type { PracticeModuleManifest } from '@/modules/types'
import { SUBDIVISION_DEFAULTS } from './settings'

export const rhythmSubdivisionManifest: PracticeModuleManifest = {
  id: 'rhythm.subdivision',
  category: 'rhythm',
  titleKey: 'modules.rhythm.subdivision.title',
  descriptionKey: 'modules.rhythm.subdivision.description',
  route: '/rhythm/subdivision',
  loadComponent: () => import('./SubdivisionView.vue'),
  defaultSettings: { ...SUBDIVISION_DEFAULTS },
  knowledgeIds: ['rhythm.subdivisionGrid'],
}
