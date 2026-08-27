/**
 * 和弦與音階公式表（const、單一真相來源）。
 *
 * 架構規則：全站任何地方需要「某和弦/音階有哪些音」，一律
 * spell(root, CHORD_FORMULAS[q] / SCALE_FORMULAS[s]) 取得，禁止另行 hardcode。
 * 新增公式：只在此檔案加一行；UI 與指板顯示自動生效。
 */
import type { DegreeLabel } from './types'

export const CHORD_FORMULAS = {
  maj: ['1', '3', '5'],
  m: ['1', 'b3', '5'],
  dim: ['1', 'b3', 'b5'],
  aug: ['1', '3', '#5'],
  sus2: ['1', '2', '5'],
  sus4: ['1', '4', '5'],
  '6': ['1', '3', '5', '6'],
  m6: ['1', 'b3', '5', '6'],
  maj7: ['1', '3', '5', '7'],
  m7: ['1', 'b3', '5', 'b7'],
  '7': ['1', '3', '5', 'b7'],
  m7b5: ['1', 'b3', 'b5', 'b7'],
  dim7: ['1', 'b3', 'b5', 'bb7'],
  mMaj7: ['1', 'b3', '5', '7'],
  add9: ['1', '3', '5', '9'],
  '9': ['1', '3', '5', 'b7', '9'],
  m9: ['1', 'b3', '5', 'b7', '9'],
  maj9: ['1', '3', '5', '7', '9'],
  '13': ['1', '3', '5', 'b7', '9', '13'],
  // 爵士曲式需要的品質（Phase 8 / F8-9）。標準曲的和弦記號一半以上落在這一區，
  // 缺一個就是整首譜解析不了——公式表是唯一真相，所以補在這裡而不是模組層。
  '7sus4': ['1', '4', '5', 'b7'],
  '7b9': ['1', '3', '5', 'b7', 'b9'],
  '7#9': ['1', '3', '5', 'b7', '#9'],
  '7#5': ['1', '3', '#5', 'b7'],
  '7b5': ['1', '3', 'b5', 'b7'],
  // 屬十一省 3 音：11 與 3 差半音，同時出現只會糊掉（樂理慣例，不是偷懶）
  '11': ['1', '5', 'b7', '9', '11'],
  m11: ['1', 'b3', '5', 'b7', '9', '11'],
  'maj7#11': ['1', '3', '5', '7', '#11'],
  '69': ['1', '3', '5', '6', '9'],
} as const satisfies Record<string, readonly DegreeLabel[]>

export type ChordQuality = keyof typeof CHORD_FORMULAS

export const SCALE_FORMULAS = {
  ionian: ['1', '2', '3', '4', '5', '6', '7'],
  dorian: ['1', '2', 'b3', '4', '5', '6', 'b7'],
  phrygian: ['1', 'b2', 'b3', '4', '5', 'b6', 'b7'],
  lydian: ['1', '2', '3', '#4', '5', '6', '7'],
  mixolydian: ['1', '2', '3', '4', '5', '6', 'b7'],
  aeolian: ['1', '2', 'b3', '4', '5', 'b6', 'b7'],
  locrian: ['1', 'b2', 'b3', '4', 'b5', 'b6', 'b7'],
  majorPentatonic: ['1', '2', '3', '5', '6'],
  minorPentatonic: ['1', 'b3', '4', '5', 'b7'],
  blues: ['1', 'b3', '4', 'b5', '5', 'b7'],
  harmonicMinor: ['1', '2', 'b3', '4', '5', 'b6', '7'],
  melodicMinor: ['1', '2', 'b3', '4', '5', '6', '7'],
} as const satisfies Record<string, readonly DegreeLabel[]>

export type ScaleType = keyof typeof SCALE_FORMULAS

/** 各音階的特徵音（signature note），資訊面板與教學強調用 */
export const SCALE_SIGNATURE_DEGREE: Partial<Record<ScaleType, DegreeLabel>> = {
  dorian: '6',
  phrygian: 'b2',
  lydian: '#4',
  mixolydian: 'b7',
  locrian: 'b5',
  blues: 'b5',
  harmonicMinor: '7',
  melodicMinor: '6',
}

/**
 * 和弦符號後綴（root.name + suffix）。
 * dim 用 'dim' 而非 '°'：小尺寸下度數符號容易誤讀，'dim' 無歧義。
 */
export const QUALITY_SUFFIX: Readonly<Record<ChordQuality, string>> = {
  maj: '', m: 'm', dim: 'dim', aug: 'aug', sus2: 'sus2', sus4: 'sus4',
  '6': '6', m6: 'm6', maj7: 'maj7', m7: 'm7', '7': '7', m7b5: 'm7b5',
  dim7: 'dim7', mMaj7: 'mMaj7', add9: 'add9', '9': '9', m9: 'm9',
  maj9: 'maj9', '13': '13',
  '7sus4': '7sus4', '7b9': '7b9', '7#9': '7#9', '7#5': '7#5', '7b5': '7b5',
  '11': '11', m11: 'm11', 'maj7#11': 'maj7#11', '69': '6/9',
}
