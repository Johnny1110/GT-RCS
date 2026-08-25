/**
 * 建置期注入的環境變數（PRD Phase 6）。
 * 全部 optional：本機開發一個都不設也要能跑，而且**不能**載入任何第三方 script。
 */
interface ImportMetaEnv {
  /** 正式網域，如 https://rcs.guitar；決定 canonical / hreflang / sitemap */
  readonly VITE_SITE_ORIGIN?: string
  /** 'production' | 'preview'；只有 production 載真廣告並允許索引 */
  readonly VITE_DEPLOY_ENV?: string
  /** AdSense 發布商 ID，如 ca-pub-0000000000000000；未設定 = 全站零廣告 */
  readonly VITE_ADSENSE_CLIENT?: string
  /** 廣告單元 slot id，逗號分隔 `位置:slotId`，見 config/ads.ts */
  readonly VITE_ADSENSE_SLOTS?: string
  /** GA4 評估 ID，如 G-XXXXXXXXXX；未設定 = 不載入分析 */
  readonly VITE_GA_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
