import type { PracticeModuleManifest } from '@/modules/types'
import { SCALE_PRACTICE_DEFAULTS } from './settings'

export const scalesPracticeManifest: PracticeModuleManifest = {
  id: 'scales.practice',
  category: 'scales',
  titleKey: 'modules.scales.practice.title',
  descriptionKey: 'modules.scales.practice.description',
  route: '/scales/practice',
  loadComponent: () => import('./PracticeView.vue'),
  defaultSettings: { ...SCALE_PRACTICE_DEFAULTS },
  knowledgeIds: ['scale.practice-tips'],
}
