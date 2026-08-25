/**
 * 需要事前同意才能使用廣告／分析 cookie 的地區（PRD Phase 6 / F6-4）。
 *
 * 用途：Consent Mode v2 的 region-specific default。這份清單只影響「預設值」，
 * 實際的同意徵求由 Google 認證 CMP 依訪客所在地決定要不要跳。
 * 寧可涵蓋過多也不要漏：多列一個國家的代價是那裡的使用者預設沒有個人化廣告，
 * 漏列一個國家的代價是違反 GDPR。
 *
 * ISO 3166-1 alpha-2。EU 27 + EEA（IS/LI/NO）+ UK + CH。
 */
export const CONSENT_REQUIRED_REGIONS: readonly string[] = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO',
  'GB', 'CH',
]
