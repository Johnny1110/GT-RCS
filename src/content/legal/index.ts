/**
 * 法遵頁內容載入器（PRD Phase 6 / F6-4.3）。
 * 與知識內容同一套做法：依語系 lazy 載入、載過即快取，內容不進首屏 bundle。
 */
import type { ContentBlock } from '../blocks'
import type { LegalDoc } from '@/config/routes'

export interface LegalDocContent {
  title: string
  /** 最後更新日（YYYY-MM-DD）——法遵頁沒有日期等於沒有效力 */
  updated: string
  blocks: ContentBlock[]
}

export type LegalBundle = Record<LegalDoc, LegalDocContent>

export type LegalLocale = 'zh-TW' | 'en'

const LOADERS: Record<LegalLocale, () => Promise<{ default: unknown }>> = {
  'zh-TW': () => import('./zh-TW.json'),
  en: () => import('./en.json'),
}

const cache = new Map<LegalLocale, LegalBundle>()

export async function loadLegal(locale: LegalLocale): Promise<LegalBundle> {
  const cached = cache.get(locale)
  if (cached) return cached
  const module = await LOADERS[locale]()
  const bundle = module.default as LegalBundle
  cache.set(locale, bundle)
  return bundle
}
