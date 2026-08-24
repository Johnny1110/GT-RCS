/**
 * 音階線共用的選項資料（模組內共用，非跨類別）。
 */
import { SCALE_FORMULAS, type NoteName, type ScaleType } from '@/core/theory'

/** 12 個常用調的標準拼寫（升降記號依調號慣例） */
export const KEYS: readonly NoteName[] = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F']

export const SCALE_TYPES = Object.keys(SCALE_FORMULAS) as ScaleType[]

export function isKey(value: unknown): value is NoteName {
  return typeof value === 'string' && KEYS.includes(value as NoteName)
}

export function isScaleType(value: unknown): value is ScaleType {
  return typeof value === 'string' && SCALE_TYPES.includes(value as ScaleType)
}
