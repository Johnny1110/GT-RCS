/**
 * 語系檔的結構契約（CLAUDE.md：zh-TW 與 en 同步）。
 *
 * app.spec.ts 的 missing hook 只看得到「有被畫出來」的 key；藏在條件分支後面的
 * （錯誤訊息、空狀態、確認對話）要靠這裡把關。兩層一起才蓋得滿。
 */
import { describe, it, expect } from 'vitest'
import zhTW from './zh-TW.json'
import en from './en.json'

type Bundle = Record<string, unknown>

/** 所有 leaf key path，如 'custom.harmony.triad' */
function leafKeys(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([key, value]) =>
    leafKeys(value, prefix === '' ? key : `${prefix}.${key}`),
  )
}

/** 訊息裡的具名插值，如 '{count}' */
function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort()
}

function valueAt(bundle: Bundle, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (node, key) => (typeof node === 'object' && node !== null ? (node as Bundle)[key] : undefined),
    bundle,
  )
}

const zhKeys = leafKeys(zhTW).sort()
const enKeys = leafKeys(en).sort()

describe('語系檔', () => {
  it('掃描表本身沒壞（否則以下測試會空轉）', () => {
    expect(zhKeys.length).toBeGreaterThan(150)
  })

  it('兩個語系的 key 完全一致', () => {
    expect(zhKeys.filter((k) => !enKeys.includes(k)), 'en 缺少').toEqual([])
    expect(enKeys.filter((k) => !zhKeys.includes(k)), 'zh-TW 缺少').toEqual([])
  })

  it('每個訊息都是非空字串（空字串等於畫面上開天窗）', () => {
    for (const [locale, bundle] of Object.entries({ 'zh-TW': zhTW, en })) {
      for (const key of zhKeys) {
        const value = valueAt(bundle as Bundle, key)
        expect(typeof value, `${locale}/${key}`).toBe('string')
        expect(String(value).trim(), `${locale}/${key} 是空的`).not.toBe('')
      }
    }
  })

  it('兩個語系的插值變數一致（少一個 {count} 就會漏掉數字）', () => {
    for (const key of zhKeys) {
      const zhVars = placeholders(String(valueAt(zhTW as Bundle, key)))
      const enVars = placeholders(String(valueAt(en as Bundle, key)))
      expect(enVars, `${key} 的插值變數不一致`).toEqual(zhVars)
    }
  })
})
