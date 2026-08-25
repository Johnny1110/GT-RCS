/**
 * 進行記法 parser + 展開器（Phase 3 / F3-2）
 *
 * ## 文法（白名單制，超出文法一律丟 ProgressionSyntaxError，不猜）
 *
 * 輸入為空白分隔的 token 序列，或純數字簡寫（'2516' 逐字元展開為級數）。
 *
 * token 文法：
 *   token      := [accidental] numeral [quality] | 'V' '/' numeral   (副屬)
 *   accidental := 'b' | '#'                    (借用記號：bVII、bIII、bVI)
 *   numeral    := 大寫或小寫羅馬數字 I..VII      (大寫=大、小寫=小)
 *   quality    := CHORD_FORMULAS 的 key（顯式品質優先，如 'Imaj7'、'V7'、'iim7b5'）
 *
 * 品質推導（無顯式品質時）：
 *   - **純 diatonic**（無升降、大小寫與該級數的自然品質一致）→ 依 harmonyLevel 查級數表，
 *     保留 V7 與 viim7b5 的功能差異（單看大小寫分不出 Imaj7 與 V7）。
 *   - **借用**（有升降記號，或大小寫與自然品質相反，如大調的 iv）→ 依大小寫給基本品質：
 *     大寫 maj/maj7、小寫 m/m7。
 *   - **純數字簡寫**無大小寫資訊 → 一律查級數表（預設 harmonyLevel 為 seventh）。
 *   - **副屬 V/x** 一律屬七，根音為 x 級上方純五度。
 *
 * ## 契約補充（實作時發現的規格缺口）
 * ProgressionToken.quality 是「已解析」的，但品質推導需要 harmonyLevel，
 * 而 harmonyLevel 原本只存在於 RealizeOptions。因此 parseProgression 增加
 * harmonyLevel 參數（預設 'seventh'，符合純數字簡寫的規格）。
 */
import { CHORD_FORMULAS, QUALITY_SUFFIX, type ChordQuality } from '../formulas'
import { chromaticDegree, mod12, parseDegree } from '../intervals'
import { spell, spellDegree } from '../spelling'
import type { DegreeLabel, Note } from '../types'
import type {
  HarmonyLevel, ProgressionPreset, ProgressionToken, RealizeOptions, RealizedBar, RealizedChord,
} from './types'

export class ProgressionSyntaxError extends Error {
  constructor(
    message: string,
    /** 錯誤發生的 token 索引（編輯器即時提示用，Phase 5 / F5-3） */
    readonly tokenIndex: number,
  ) {
    super(message)
    this.name = 'ProgressionSyntaxError'
  }
}

/** 羅馬數字（長的先比對：IV 必須早於 I，VII 早於 VI 早於 V） */
const NUMERALS: readonly (readonly [string, number])[] = [
  ['VII', 7], ['III', 3], ['IV', 4], ['VI', 6], ['II', 2], ['V', 5], ['I', 1],
]

/** 大調各級的自然大小寫：true = 大寫（大調性格） */
const DIATONIC_UPPER: Readonly<Record<number, boolean>> = {
  1: true, 2: false, 3: false, 4: true, 5: true, 6: false, 7: false,
}

const DIATONIC_QUALITY: Readonly<Record<HarmonyLevel, Readonly<Record<number, ChordQuality>>>> = {
  triad: { 1: 'maj', 2: 'm', 3: 'm', 4: 'maj', 5: 'maj', 6: 'm', 7: 'dim' },
  seventh: { 1: 'maj7', 2: 'm7', 3: 'm7', 4: 'maj7', 5: '7', 6: 'm7', 7: 'm7b5' },
}

/** 進行記法允許的度數標記（型別 DegreeLabel 的子集；#2、b4 等不在其中，直接報錯不猜） */
const ALLOWED_DEGREES = new Set<string>(['1', 'b2', '2', 'b3', '3', '4', '#4', 'b5', '5', '#5', 'b6', '6', 'b7', '7'])

interface NumeralMatch {
  degreeNumber: number
  upper: boolean
  rest: string
}

function matchNumeral(text: string): NumeralMatch | null {
  for (const [numeral, degreeNumber] of NUMERALS) {
    if (text.startsWith(numeral)) {
      return { degreeNumber, upper: true, rest: text.slice(numeral.length) }
    }
    const lower = numeral.toLowerCase()
    if (text.startsWith(lower)) {
      return { degreeNumber, upper: false, rest: text.slice(lower.length) }
    }
  }
  return null
}

function buildDegree(degreeNumber: number, accidental: number, index: number, raw: string): DegreeLabel {
  const prefix = accidental === 0 ? '' : accidental > 0 ? '#' : 'b'
  const label = `${prefix}${degreeNumber}`
  if (!ALLOWED_DEGREES.has(label)) {
    throw new ProgressionSyntaxError(`Unsupported degree "${label}" in token "${raw}"`, index)
  }
  return label as DegreeLabel
}

function isChordQuality(value: string): value is ChordQuality {
  return Object.hasOwn(CHORD_FORMULAS, value)
}

function deriveQuality(
  degreeNumber: number,
  accidental: number,
  upper: boolean | null,
  level: HarmonyLevel,
): ChordQuality {
  const table = DIATONIC_QUALITY[level]
  // 純數字簡寫沒有大小寫資訊 → 一律查級數表
  if (upper === null) return table[degreeNumber] ?? 'maj'
  const isDiatonic = accidental === 0 && DIATONIC_UPPER[degreeNumber] === upper
  if (isDiatonic) return table[degreeNumber] ?? 'maj'
  if (level === 'triad') return upper ? 'maj' : 'm'
  return upper ? 'maj7' : 'm7'
}

/** 副屬和弦：x 級上方純五度，仍以主調度數表示（C 調 V/ii → A → '6'） */
function secondaryDominantDegree(target: DegreeLabel, index: number, raw: string): DegreeLabel {
  const parsed = parseDegree(target)
  const degreeNumber = ((parsed.number - 1 + 4) % 7) + 1
  const semitones = mod12(parsed.semitones + 7)
  const natural = parseDegree(String(degreeNumber) as DegreeLabel).semitones
  let accidental = semitones - natural
  if (accidental > 6) accidental -= 12
  if (accidental < -6) accidental += 12
  return buildDegree(degreeNumber, accidental, index, raw)
}

function parseToken(raw: string, index: number, level: HarmonyLevel): ProgressionToken {
  // 副屬：V/x
  const slash = raw.indexOf('/')
  if (slash >= 0) {
    const head = raw.slice(0, slash)
    const tail = raw.slice(slash + 1)
    if (head !== 'V') {
      throw new ProgressionSyntaxError(`Only "V/x" secondary dominants are supported, got "${raw}"`, index)
    }
    const targetToken = parseToken(tail, index, level)
    const degree = secondaryDominantDegree(targetToken.degree, index, raw)
    return { raw, degree, quality: '7', secondaryOf: targetToken.degree }
  }

  let body = raw
  let accidental = 0
  if (body.startsWith('b')) {
    accidental = -1
    body = body.slice(1)
  } else if (body.startsWith('#')) {
    accidental = 1
    body = body.slice(1)
  }

  const matched = matchNumeral(body)
  if (!matched) {
    throw new ProgressionSyntaxError(`Unrecognised roman numeral in token "${raw}"`, index)
  }

  const degree = buildDegree(matched.degreeNumber, accidental, index, raw)
  if (matched.rest === '') {
    return { raw, degree, quality: deriveQuality(matched.degreeNumber, accidental, matched.upper, level) }
  }
  if (!isChordQuality(matched.rest)) {
    throw new ProgressionSyntaxError(`Unknown chord quality "${matched.rest}" in token "${raw}"`, index)
  }
  return { raw, degree, quality: matched.rest }
}

function parseDigits(input: string, level: HarmonyLevel): ProgressionToken[] {
  return [...input].map((char, index) => {
    const degreeNumber = Number(char)
    if (degreeNumber < 1 || degreeNumber > 7) {
      throw new ProgressionSyntaxError(`Digit shorthand accepts 1-7 only, got "${char}"`, index)
    }
    return {
      raw: char,
      degree: buildDegree(degreeNumber, 0, index, char),
      quality: deriveQuality(degreeNumber, 0, null, level),
    }
  })
}

/**
 * 解析進行記法。harmonyLevel 只影響「無顯式品質」的 token。
 */
export function parseProgression(input: string, harmonyLevel: HarmonyLevel = 'seventh'): ProgressionToken[] {
  const trimmed = input.trim()
  if (trimmed === '') throw new ProgressionSyntaxError('Progression is empty', 0)
  if (/^\d+$/.test(trimmed)) return parseDigits(trimmed, harmonyLevel)
  return trimmed.split(/\s+/).map((raw, index) => parseToken(raw, index, harmonyLevel))
}

/** 羅馬數字（大寫），index 0 未用 */
const NUMERAL_BY_NUMBER: readonly string[] = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

/**
 * 級數 → 記法字串，parseProgression 的反向（自訂進行編輯器用，PRD F5-3.1）。
 *
 * 大小寫依大調的自然品質（ii、iii、vi、vii 小寫）；帶升降記號的一律大寫，
 * 與 parser 的借用規則對稱（bVII、bIII、bVI 就是慣用寫法）。
 * 保證 parseProgression(degreeToNumeral(d))[0].degree === d。
 */
export function degreeToNumeral(degree: DegreeLabel): string {
  const parsed = parseDegree(degree)
  const numeral = NUMERAL_BY_NUMBER[parsed.number]
  if (numeral === undefined) throw new Error(`Unsupported degree for numeral: ${degree}`)
  if (parsed.accidentalOffset === 0) {
    return DIATONIC_UPPER[parsed.number] === true ? numeral : numeral.toLowerCase()
  }
  const accidental = parsed.accidentalOffset < 0 ? 'b'.repeat(-parsed.accidentalOffset) : '#'.repeat(parsed.accidentalOffset)
  return `${accidental}${numeral}`
}

/** 把一個 token 帶入調，算出根音、顯示名與內音 */
export function realizeChord(token: ProgressionToken, options: RealizeOptions): RealizedChord {
  const root = spellDegree(options.key, token.degree)
  const tones = spell(root.name, CHORD_FORMULAS[token.quality])
  const reference = options.degreeReference ?? 'chordRoot'
  const keyPc = spellDegree(options.key, '1').pc
  const referenced: Note[] =
    reference === 'chordRoot'
      ? tones
      : tones.map((tone) => ({ ...tone, degree: chromaticDegree(tone.pc - keyPc) }))
  return {
    token,
    root,
    symbol: `${root.name}${QUALITY_SUFFIX[token.quality]}`,
    tones: referenced,
  }
}

/**
 * 展開為小節序列。barsPerChord 支援 0.5（一小節兩個和弦）；
 * 和弦歸屬於它「開始的那一小節」。
 */
export function realizeProgression(preset: ProgressionPreset, options: RealizeOptions): RealizedBar[] {
  const tokens = parseProgression(preset.tokens, options.harmonyLevel)
  if (tokens.length !== preset.barsPerChord.length) {
    throw new ProgressionSyntaxError(
      `Preset "${preset.id}": ${tokens.length} chords but ${preset.barsPerChord.length} bar lengths`,
      0,
    )
  }

  const bars = new Map<number, RealizedChord[]>()
  let position = 0
  tokens.forEach((token, index) => {
    const bar = Math.floor(position) + 1
    const list = bars.get(bar) ?? []
    list.push(realizeChord(token, options))
    bars.set(bar, list)
    position += preset.barsPerChord[index] ?? 1
  })

  return [...bars.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bar, chords]) => ({ bar, chords }))
}

/** 進行總長（小節數，無條件進位） */
export function progressionBarCount(preset: ProgressionPreset): number {
  return Math.ceil(preset.barsPerChord.reduce((sum, bars) => sum + bars, 0))
}
