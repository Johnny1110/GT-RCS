/**
 * 建置期環境變數的唯一讀取點（PRD Phase 6）。
 *
 * 設計原則：**什麼都沒設定時，一個第三方 script 都不載**。
 * 本機開發與 CI 不需要任何機密，就跑得起完整的 App；廣告與分析是 production 才注入的東西。
 */
import { siteConfig, DEFAULT_ORIGIN } from './site'
import type { SiteConfig } from '@/core/seo'

export const SITE_ORIGIN: string = import.meta.env.VITE_SITE_ORIGIN ?? DEFAULT_ORIGIN

export const SITE: SiteConfig = siteConfig(SITE_ORIGIN)

/** 'production' | 'preview' | undefined（本機） */
export const DEPLOY_ENV: string = import.meta.env.VITE_DEPLOY_ENV ?? 'local'

/** 只有正式站載真廣告、送分析、允許索引 */
export const IS_PRODUCTION_SITE: boolean = DEPLOY_ENV === 'production'

/** ca-pub-…；未設定 = 全站零廣告（開發與預覽頻道就是這個狀態） */
export const ADSENSE_CLIENT: string = import.meta.env.VITE_ADSENSE_CLIENT ?? ''

/** `slotName:slotId` 逗號分隔，見 config/ads.ts */
export const ADSENSE_SLOTS_RAW: string = import.meta.env.VITE_ADSENSE_SLOTS ?? ''

/** G-XXXXXXXXXX；未設定 = 不載入分析 */
export const GA_MEASUREMENT_ID: string = import.meta.env.VITE_GA_ID ?? ''
