/**
 * 練習模組框架 — 契約（overview §4.7）。
 * 一個練習 = 一個資料夾 = 一份 manifest。新增練習不改核心。
 */
import type { Component } from 'vue'

export type PracticeCategory = 'scales' | 'chords' | 'rhythm'

export interface PracticeModuleManifest {
  /** 慣例：'<category>.<name>'，如 'scales.explorer' */
  id: string
  category: PracticeCategory
  /** i18n keys：modules.<category>.<name>.title / .description */
  titleKey: string
  descriptionKey: string
  /** 路由路徑，慣例 '/<category>/<name>' */
  route: string
  /** lazy import（保持首屏 bundle 小，PRD F5-4） */
  loadComponent: () => Promise<Component>
  /** 模組設定預設值；由 settings store 以模組 id 為 key 持久化 */
  defaultSettings: Record<string, unknown>
  /**
   * 與模組本身相關的知識條目 id（內容在 src/content/knowledge/，模組不需知道存放細節）。
   * 隨使用者選擇變動的條目（如當前音階）由 view 自行查表，不列於此。
   */
  knowledgeIds?: readonly string[]
}

/** 短於此秒數的練習 session 不寫入練習日誌（PRD F2-2） */
export const MIN_LOGGED_SESSION_SEC = 30
