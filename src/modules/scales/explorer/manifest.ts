import type { PracticeModuleManifest } from '@/modules/types'
import { EXPLORER_DEFAULTS } from './settings'

export const scalesExplorerManifest: PracticeModuleManifest = {
  id: 'scales.explorer',
  category: 'scales',
  titleKey: 'modules.scales.explorer.title',
  descriptionKey: 'modules.scales.explorer.description',
  route: '/scales/explorer',
  loadComponent: () => import('./ExplorerView.vue'),
  defaultSettings: { ...EXPLORER_DEFAULTS },
  // 依當前選擇動態顯示 scale.<type>；此處列出與模組本身相關的固定條目
  knowledgeIds: ['scale.practice-tips'],
}
