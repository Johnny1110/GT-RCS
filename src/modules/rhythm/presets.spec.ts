/**
 * preset 庫的資料契約。preset 是寫死的資料，錯了只有測試會發現——
 * 格子數對不上拍號的 pattern 會在播放時安靜地補成休止，聽起來只是「怪怪的」。
 */
import { describe, it, expect } from 'vitest'
import { SWING_STRAIGHT, cellsPerBar, isConsistentPattern, type RhythmPattern } from '@/core/audio'
import { QUALITY_SUFFIX } from '@/core/theory'
import zhTW from '@/locales/zh-TW.json'
import en from '@/locales/en.json'
import { GROOVE_STYLES, SUBDIVISION_STAGES, findPattern, findStage, findStyle } from './presets'
import { chordHintSymbol, demoSilenceFromKey, demoSilenceKey, resolvePatternId, resolveStageId, resolveStyleId } from './shared'

const ALL_PATTERNS: RhythmPattern[] = [
  ...SUBDIVISION_STAGES.flatMap((s) => s.patterns),
  ...GROOVE_STYLES.flatMap((s) => s.patterns),
]

const locales: Record<string, Record<string, unknown>> = { 'zh-TW': zhTW, en }

function lookup(bundle: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    bundle,
  )
}

describe('節奏 preset 庫', () => {
  it('每個 pattern 的格子數 = 拍數 × 細分', () => {
    for (const p of ALL_PATTERNS) {
      expect(isConsistentPattern(p), `${p.id} 格子數不符`).toBe(true)
      expect(p.bars[0]).toHaveLength(cellsPerBar(p.timeSig, p.ticksPerBeat))
    }
  })

  it('pattern id 全域唯一（設定以 id 記住選擇，重複會選錯）', () => {
    const ids = ALL_PATTERNS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThanOrEqual(24)
  })

  it('每個 pattern 至少有一格會出聲（全休止的譜等於沒有練習）', () => {
    for (const p of ALL_PATTERNS) {
      const sounding = p.bars.flat().filter((c) => c !== 'rest')
      expect(sounding.length, `${p.id} 全是休止`).toBeGreaterThan(0)
    }
  })

  it('BPM 落在合理範圍；6/8 與 12/8 因為 BPM 指八分音符所以偏快', () => {
    for (const p of ALL_PATTERNS) {
      expect(p.defaultBpm, p.id).toBeGreaterThanOrEqual(60)
      expect(p.defaultBpm, p.id).toBeLessThanOrEqual(160)
      if (p.timeSig.unit === 8) expect(p.defaultBpm, p.id).toBeGreaterThan(100)
    }
  })

  it('shuffle 風格的 pattern 自帶 swing 建議值，直拍風格不帶', () => {
    const shuffle = findStyle('shuffle')!
    expect(shuffle.defaultSwing).toBeGreaterThan(SWING_STRAIGHT)
    expect(shuffle.patterns.every((p) => (p.swing ?? SWING_STRAIGHT) > SWING_STRAIGHT)).toBe(true)
    expect(findStyle('funk')!.defaultSwing).toBe(SWING_STRAIGHT)
  })

  it('每個 titleKey 在兩個語系都有字（不會在 UI 印出 raw key）', () => {
    const keys = [
      ...ALL_PATTERNS.map((p) => p.titleKey),
      ...SUBDIVISION_STAGES.flatMap((s) => [s.titleKey, s.descriptionKey]),
      ...GROOVE_STYLES.flatMap((s) => [s.titleKey, s.descriptionKey]),
    ]
    for (const key of keys) {
      for (const [locale, bundle] of Object.entries(locales)) {
        expect(typeof lookup(bundle, key), `${locale} 缺少 ${key}`).toBe('string')
      }
    }
  })

  it('建議和弦由公式表組出符號，不 hardcode 音名（architecture §8 反模式 1）', () => {
    for (const style of GROOVE_STYLES) {
      const symbol = chordHintSymbol(style.chordHint)
      expect(symbol.startsWith(style.chordHint.root)).toBe(true)
      expect(symbol.endsWith(QUALITY_SUFFIX[style.chordHint.quality])).toBe(true)
    }
    expect(chordHintSymbol({ root: 'E', quality: '9' })).toBe('E9')
  })

  it('6/8 風格同時提供兩大拍與六小拍 feel（PRD F4-4.1）', () => {
    const six = findStyle('sixEight')!
    const two = findPattern(six.patterns, 'sixEightTwo')!
    const sixFeel = findPattern(six.patterns, 'sixEightSix')!
    // 兩大拍：只有第 1、4 格是實音，其餘為鬼音
    expect(two.bars[0]).toEqual(['accent', 'ghost', 'ghost', 'normal', 'ghost', 'ghost'])
    expect(sixFeel.bars[0]?.filter((c) => c === 'normal')).toHaveLength(5)
  })

  it('課表由淺入深：細分數隨階段遞增', () => {
    const depth = SUBDIVISION_STAGES.map((s) => Math.max(...s.patterns.map((p) => p.ticksPerBeat)))
    expect(depth).toEqual([...depth].sort((a, b) => a - b))
    expect(depth[0]).toBe(1)
    expect(depth.at(-1)).toBe(4)
  })
})

describe('節奏模組的輸入驗證（持久化資料的防線）', () => {
  it('未知的課表／風格 id 回退預設', () => {
    expect(resolveStageId('quarter', 'eighth')).toBe('quarter')
    expect(resolveStageId('nope', 'eighth')).toBe('eighth')
    expect(resolveStyleId(null, 'funk')).toBe('funk')
    expect(findStage('nope')).toBeUndefined()
  })

  it('pattern id 不屬於當前課表時落到第一個', () => {
    const stage = findStage('eighth')!
    expect(resolvePatternId(stage.patterns, 'eighthOff')).toBe('eighthOff')
    expect(resolvePatternId(stage.patterns, 'funkOne')).toBe(stage.patterns[0]!.id)
  })

  it('示範／靜默的 key 與模式互為往返；未知 key 視為全程示範', () => {
    for (const mode of [null, { demoBars: 2, silentBars: 2 }, { demoBars: 4, silentBars: 4 }]) {
      expect(demoSilenceFromKey(demoSilenceKey(mode))).toEqual(mode)
    }
    expect(demoSilenceFromKey('9-9')).toBeNull()
  })
})
