import { describe, it, expect, beforeEach } from 'vitest'
import { clearRegistry, getModule, listModules, modulesByCategory, registerModule } from './registry'
import type { PracticeModuleManifest } from './types'

const mk = (id: string, category: PracticeModuleManifest['category']): PracticeModuleManifest => ({
  id,
  category,
  titleKey: `modules.${id}.title`,
  descriptionKey: `modules.${id}.description`,
  route: `/${id.replace('.', '/')}`,
  loadComponent: () => Promise.reject(new Error('test stub')),
  defaultSettings: {},
})

describe('module registry', () => {
  beforeEach(() => clearRegistry())

  it('註冊、查詢、分類', () => {
    registerModule(mk('scales.explorer', 'scales'))
    registerModule(mk('chords.key-practice', 'chords'))
    expect(listModules()).toHaveLength(2)
    expect(modulesByCategory('scales').map((m) => m.id)).toEqual(['scales.explorer'])
    expect(getModule('chords.key-practice')?.route).toBe('/chords/key-practice')
  })

  it('重複 id 直接丟錯（fail fast）', () => {
    registerModule(mk('scales.explorer', 'scales'))
    expect(() => registerModule(mk('scales.explorer', 'scales'))).toThrow(/Duplicate/)
  })
})
