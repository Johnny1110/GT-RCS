/**
 * 進行引擎的可執行規格（executable spec）。
 * TODO(opus): Phase 3 實作 parser.ts 時，把 test.todo 逐一改為真測試並全數通過。
 * 不允許為了通過測試而修改規格；規格疑義回報產品文件（docs/PRD/phase-03.md F3-2）。
 */
import { describe, it, expect } from 'vitest'
import { parseProgression, NotImplementedError } from './parser'

describe('parseProgression', () => {
  it('目前為 stub，丟出 NotImplementedError（實作後刪除此測試）', () => {
    expect(() => parseProgression('ii V I')).toThrow(NotImplementedError)
  })

  it.todo("'2516' 數字簡寫 → ii V I vi（seventh 層級：Dm7 G7 Cmaj7 Am7 in C）")
  it.todo("'ii V7 Imaj7 vi' 顯式品質與推導品質混用")
  it.todo("'4536251' → IV V iii vi ii V I")
  it.todo("大小寫決定三和弦品質：'I vi IV V' → maj m maj maj")
  it.todo("借用：C 大調 'iv' → Fm；'bVII' → Bb；'bVI' → Ab")
  it.todo("副屬：C 大調 'V/ii' → A7（quality 固定屬七）")
  it.todo("非法 token 丟 ProgressionSyntaxError 且 tokenIndex 正確")
  it.todo("realize：12 調全展開快照（每個 preset 的 symbol 序列）")
  it.todo("realize：degreeReference='key' 時 Fm 的 Ab 標為 b6（相對 C 調）")
})
