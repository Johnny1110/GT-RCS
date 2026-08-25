/**
 * 第三方全域物件的型別宣告。集中在一處，其餘檔案不得再開 `any` 的洞。
 */
export {}

declare global {
  interface Window {
    dataLayer?: unknown[]
    /** gtag 是 dataLayer.push(arguments) 的薄包裝，簽章刻意保持寬鬆 */
    gtag?: (...args: unknown[]) => void
    /** AdSense 的待處理版位佇列 */
    adsbygoogle?: unknown[]
    /** Google 認證 CMP（Privacy & messaging）；使用者所在地不需同意時不會存在 */
    googlefc?: {
      callbackQueue?: unknown[]
      showRevocationMessage?: () => void
    }
  }
}
