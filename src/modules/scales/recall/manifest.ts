import type { PracticeModuleManifest } from '@/modules/types'
import { RECALL_DEFAULTS } from './settings'

export const scalesRecallManifest: PracticeModuleManifest = {
  id: 'scales.recall',
  category: 'scales',
  titleKey: 'modules.scales.recall.title',
  descriptionKey: 'modules.scales.recall.description',
  route: '/scales/recall',
  loadComponent: () => import('./RecallView.vue'),
  defaultSettings: { ...RECALL_DEFAULTS },
  knowledgeIds: ['scale.practice-tips'],
}
