/**
 * 模組註冊表 — Registry pattern。
 * 路由與首頁導覽由此生成；模組之間互不 import（禁止橫向依賴）。
 */
import type { PracticeCategory, PracticeModuleManifest } from './types'

const modules = new Map<string, PracticeModuleManifest>()

export function registerModule(manifest: PracticeModuleManifest): void {
  if (modules.has(manifest.id)) {
    throw new Error(`Duplicate practice module id: ${manifest.id}`)
  }
  modules.set(manifest.id, manifest)
}

export function listModules(): PracticeModuleManifest[] {
  return [...modules.values()]
}

export function modulesByCategory(category: PracticeCategory): PracticeModuleManifest[] {
  return listModules().filter((m) => m.category === category)
}

export function getModule(id: string): PracticeModuleManifest | undefined {
  return modules.get(id)
}

/** 測試用 */
export function clearRegistry(): void {
  modules.clear()
}
