import type { PracticeModuleManifest } from '@/modules/types'
import { JAZZ_BOOK_DEFAULTS } from './settings'

export const chordsJazzBookManifest: PracticeModuleManifest = {
  id: 'chords.jazz-book',
  category: 'chords',
  titleKey: 'modules.chords.jazzBook.title',
  descriptionKey: 'modules.chords.jazzBook.description',
  route: '/chords/jazz-book',
  loadComponent: () => import('./JazzBookView.vue'),
  defaultSettings: { ...JAZZ_BOOK_DEFAULTS },
  knowledgeIds: ['form.aaba', 'form.rhythmChanges'],
}
