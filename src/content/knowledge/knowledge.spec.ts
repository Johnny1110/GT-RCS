/**
 * 內容契約：兩個語系必須同步，且每個音階類型都有對應知識。
 * 這組測試就是「內容不會漏翻、不會漏寫」的防線。
 */
import { describe, it, expect } from 'vitest'
import { SCALE_FORMULAS } from '@/core/theory'
import { CIRCLE_PROGRESSIONS, PRACTICE_LEVELS } from '@/modules/chords/presets'
import { ARPEGGIO_DRILLS } from '@/modules/chords/arpeggio/drills'
import { BUILT_IN_CHARTS } from '@/modules/chords/jazzBook/charts'
import { GROOVE_STYLES, SUBDIVISION_STAGES } from '@/modules/rhythm/presets'
import { parseInline, type KnowledgeBundle } from './types'
import zhTW from './zh-TW.json'
import en from './en.json'

const bundles: Record<string, KnowledgeBundle> = {
  'zh-TW': zhTW as KnowledgeBundle,
  en: en as KnowledgeBundle,
}

describe('知識內容', () => {
  it('兩個語系的 entry id 完全一致', () => {
    expect(Object.keys(zhTW).sort()).toEqual(Object.keys(en).sort())
  })

  it('每個音階類型都有對應的知識條目', () => {
    for (const scale of Object.keys(SCALE_FORMULAS)) {
      for (const [locale, bundle] of Object.entries(bundles)) {
        expect(bundle[`scale.${scale}`], `${locale} 缺少 scale.${scale}`).toBeDefined()
      }
    }
  })

  it('preset 引用的每個 knowledgeId 都真的存在（兩個語系都要有）', () => {
    const referenced = [
      ...CIRCLE_PROGRESSIONS.flatMap((p) => p.knowledgeIds ?? []),
      ...ARPEGGIO_DRILLS.flatMap((drill) => drill.knowledgeIds ?? []),
      ...PRACTICE_LEVELS.flatMap((level) => [
        ...(level.knowledgeIds ?? []),
        ...level.progressions.flatMap((p) => p.knowledgeIds ?? []),
      ]),
      ...BUILT_IN_CHARTS.flatMap((chart) => chart.knowledgeIds ?? []),
      ...SUBDIVISION_STAGES.flatMap((stage) => stage.knowledgeIds ?? []),
      ...GROOVE_STYLES.flatMap((style) => style.knowledgeIds ?? []),
    ]
    expect(referenced.length).toBeGreaterThan(0)
    for (const id of referenced) {
      for (const [locale, bundle] of Object.entries(bundles)) {
        expect(bundle[id], `${locale} 缺少被引用的 ${id}`).toBeDefined()
      }
    }
  })

  it('每個節奏課表與風格都掛著知識條目（節奏線的教學價值一半在文字）', () => {
    for (const group of [...SUBDIVISION_STAGES, ...GROOVE_STYLES]) {
      expect(group.knowledgeIds?.length, `${group.id} 沒有知識條目`).toBeGreaterThan(0)
    }
  })

  it('每個條目都有標題與至少一個內容區塊，且無空白內容', () => {
    for (const [locale, bundle] of Object.entries(bundles)) {
      for (const [id, entry] of Object.entries(bundle)) {
        expect(entry.title.trim(), `${locale}/${id} 標題為空`).not.toBe('')
        expect(entry.blocks.length, `${locale}/${id} 沒有內容`).toBeGreaterThan(0)
        for (const block of entry.blocks) {
          if (block.type === 'paragraph') expect(block.text.trim()).not.toBe('')
          else expect(block.items.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('粗體標記成對（不成對會整段失去強調）', () => {
    for (const [locale, bundle] of Object.entries(bundles)) {
      for (const [id, entry] of Object.entries(bundle)) {
        const texts = entry.blocks.flatMap((b) => (b.type === 'paragraph' ? [b.text] : b.items))
        for (const text of texts) {
          expect(text.split('**').length % 2, `${locale}/${id} 粗體標記不成對：${text}`).toBe(1)
        }
      }
    }
  })
})

describe('parseInline', () => {
  it('切出粗體與純文字片段', () => {
    expect(parseInline('大調的 **avoid note** 問題')).toEqual([
      { text: '大調的 ', strong: false },
      { text: 'avoid note', strong: true },
      { text: ' 問題', strong: false },
    ])
  })

  it('純文字回傳單一片段', () => {
    expect(parseInline('沒有標記')).toEqual([{ text: '沒有標記', strong: false }])
  })

  it('標記不成對時整段視為純文字（寧可不上粗體也不吃掉內容）', () => {
    expect(parseInline('壞掉的 **標記')).toEqual([{ text: '壞掉的 **標記', strong: false }])
  })

  it('略過空片段（開頭即粗體不產生空白節點）', () => {
    expect(parseInline('**開頭粗體**接著')).toEqual([
      { text: '開頭粗體', strong: true },
      { text: '接著', strong: false },
    ])
  })
})
