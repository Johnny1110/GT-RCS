/**
 * 節奏譜的計數列（PRD F4-2.2）——純邏輯，與語系解耦。
 *
 * 這裡只算「這一格該念哪個音節」，回傳的是 token；實際字面由 i18n 決定，
 * 因為兩套計數法的字面本來就不同語系：
 * - numeric：吉他手通用的 `1 e & a`（beat token 直接印拍數）
 * - mnemonic：中文口訣，正拍「答」、半拍「嗒」、16 分的 e/a 位「的」
 *   （PRD 指定的「答-嗒」；e/a 另給一個音節，念起來才分得出落在哪一格）
 */
import type { TicksPerBeat } from '@/core/audio'

export type CountStyle = 'numeric' | 'mnemonic'
export const COUNT_STYLES = ['numeric', 'mnemonic'] as const

/** beat = 該拍的拍數（numeric 印數字、mnemonic 印「答」） */
export type CountToken = 'beat' | 'e' | 'and' | 'a' | 'trip' | 'let'

const TOKENS: Record<TicksPerBeat, readonly CountToken[]> = {
  1: ['beat'],
  2: ['beat', 'and'],
  3: ['beat', 'trip', 'let'],
  4: ['beat', 'e', 'and', 'a'],
}

/** tick 為 1-based 拍內細分序號 */
export function countToken(tick: number, ticksPerBeat: TicksPerBeat): CountToken {
  return TOKENS[ticksPerBeat][tick - 1] ?? 'beat'
}

export function isCountStyle(value: unknown): value is CountStyle {
  return value === 'numeric' || value === 'mnemonic'
}
