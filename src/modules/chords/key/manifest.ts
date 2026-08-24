import type { PracticeModuleManifest } from '@/modules/types'
import { KEY_PRACTICE_DEFAULTS } from '../settings'

export const chordsKeyPracticeManifest: PracticeModuleManifest = {
  id: 'chords.key-practice',
  category: 'chords',
  titleKey: 'modules.chords.keyPractice.title',
  descriptionKey: 'modules.chords.keyPractice.description',
  route: '/chords/key-practice',
  loadComponent: () => import('./KeyPracticeView.vue'),
  defaultSettings: { ...KEY_PRACTICE_DEFAULTS },
}
