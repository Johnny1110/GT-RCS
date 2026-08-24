/**
 * 載入器：動態 import + 快取。內容正確性由 knowledge.spec.ts 負責。
 */
import { describe, it, expect } from 'vitest'
import { loadKnowledge, scaleKnowledgeId } from './index'

describe('loadKnowledge', () => {
  it('載入 zh-TW 與 en 兩個語系', async () => {
    const zh = await loadKnowledge('zh-TW')
    const en = await loadKnowledge('en')
    expect(zh['scale.ionian']?.title).toContain('大調')
    expect(en['scale.ionian']?.title).toContain('major')
  })

  it('第二次載入回傳同一個快取物件（不重複 import）', async () => {
    const first = await loadKnowledge('zh-TW')
    const second = await loadKnowledge('zh-TW')
    expect(second).toBe(first)
  })

  it('scaleKnowledgeId 對應到實際存在的條目', async () => {
    const bundle = await loadKnowledge('zh-TW')
    expect(bundle[scaleKnowledgeId('dorian')]).toBeDefined()
    expect(bundle[scaleKnowledgeId('harmonicMinor')]).toBeDefined()
  })
})
