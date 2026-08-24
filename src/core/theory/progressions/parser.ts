/**
 * 進行記法 parser + 展開器 — TODO(opus): Phase 3 / F3-2 實作
 *
 * ## 文法（白名單制，超出文法一律丟 ProgressionSyntaxError，不猜）
 *
 * 輸入為空白分隔的 token 序列，或純數字簡寫（'2516' 逐字元展開為級數）。
 *
 * token 文法：
 *   token      := [accidental] numeral [quality] | 'V' '/' numeral   (副屬)
 *   accidental := 'b' | '#'                    (借用記號：bVII、bIII、bVI)
 *   numeral    := 大寫或小寫羅馬數字 I..VII      (大寫=大、 小寫=小，作為品質推導預設)
 *   quality    := CHORD_FORMULAS 的 key（顯式品質優先，如 'Imaj7'、'V7'、'iim7b5'）
 *
 * 品質推導規則（無顯式品質時）：
 *   - 依 RealizeOptions.harmonyLevel 於大調 diatonic 推導：
 *     triad:   I ii iii IV V vi vii°
 *     seventh: Imaj7 iim7 iiim7 IVmaj7 V7 vim7 viim7b5
 *   - 純數字簡寫（'2516'）視為 seventh 層級的 diatonic 推導
 *   - 借用和弦（iv、bVII…）品質依其記法本身（小寫=m，大寫=maj），
 *     常用借用（iv、bVII、bVI、bIII）需有測試鎖定
 *   - 副屬 V/x 一律為屬七（quality='7'），根音 = x 級的完全五度上方
 *
 * 展開（realize）規則：
 *   - root = spellDegree(key, token.degree)，副屬另計
 *   - symbol 命名慣例：root.name + QUALITY_SUFFIX（m7→'m7'、maj→''、maj7→'maj7'）
 *   - tones = spell(root, CHORD_FORMULAS[quality])，但 degree 需重定位為
 *     「相對進行主調 key」的度數（指板顏色以調為錨或以和弦根音為錨，
 *     由呼叫端決定——參數 degreeReference: 'key' | 'chordRoot'，預設 'chordRoot'）
 *
 * 驗收測試規格見 parser.spec.ts（test.todo 列表）。
 */
import type { ProgressionPreset, ProgressionToken, RealizedBar, RealizeOptions } from './types'

export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`Not implemented yet: ${what}`)
    this.name = 'NotImplementedError'
  }
}

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

export function parseProgression(_input: string): ProgressionToken[] {
  throw new NotImplementedError('parseProgression — TODO(opus) Phase 3 / F3-2，文法見本檔案開頭')
}

export function realizeProgression(
  _preset: ProgressionPreset,
  _options: RealizeOptions,
): RealizedBar[] {
  throw new NotImplementedError('realizeProgression — TODO(opus) Phase 3 / F3-2')
}
