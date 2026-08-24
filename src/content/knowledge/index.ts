/**
 * 知識內容載入器：依語系 lazy 載入，載過即快取。
 * 內容與模組解耦——模組只引用 entry id，不知道內容存在哪裡。
 */
import type { KnowledgeBundle } from './types'

export type KnowledgeLocale = 'zh-TW' | 'en'

const LOADERS: Record<KnowledgeLocale, () => Promise<{ default: unknown }>> = {
  'zh-TW': () => import('./zh-TW.json'),
  en: () => import('./en.json'),
}

const cache = new Map<KnowledgeLocale, KnowledgeBundle>()

export async function loadKnowledge(locale: KnowledgeLocale): Promise<KnowledgeBundle> {
  const cached = cache.get(locale)
  if (cached) return cached
  const module = await LOADERS[locale]()
  const bundle = module.default as KnowledgeBundle
  cache.set(locale, bundle)
  return bundle
}

/** 音階類型 → 知識 entry id 的慣例 */
export function scaleKnowledgeId(scale: string): string {
  return `scale.${scale}`
}

export * from './types'
