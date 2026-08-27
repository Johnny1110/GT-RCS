import type { PracticeModuleManifest } from '@/modules/types'
import { SCALE_SEQUENCE_DEFAULTS } from './settings'

export const scalesSequenceManifest: PracticeModuleManifest = {
  id: 'scales.sequence',
  category: 'scales',
  titleKey: 'modules.scales.sequence.title',
  descriptionKey: 'modules.scales.sequence.description',
  route: '/scales/sequence',
  loadComponent: () => import('./SequenceView.vue'),
  defaultSettings: { ...SCALE_SEQUENCE_DEFAULTS },
  knowledgeIds: ['scale.sequences'],
}
