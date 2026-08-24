/**
 * 12 音程色彩系統（overview §4.2 的程式化定義，全站唯一 mapping）。
 *
 * 架構規則：
 * - 顏色以「相對主音的半音距離 interval 0–11」為 key，不以度數標記為 key
 *   （#9 與 b3 同 interval → 同色，符合聽感記憶）。
 * - UI 一律經 colorForInterval() / CSS token 取色，禁止散落 hex。
 * - 深色主題（背景 zinc-900 系）設計；淺色主題為未來擴充（backlog）。
 */
import { mod12 } from '../theory/intervals'
import type { PitchClass } from '../theory/types'

export interface DegreeColor {
  /** 相對主音的半音距離 0–11 */
  interval: number
  /** CSS token 名（--degree-*） */
  token: string
  /** 音點底色 */
  hex: string
  /** 音點上度數文字的顏色（對比用） */
  textHex: string
  /** 該 interval 的正規度數標記（顯示預設值；公式可覆寫如 #4/b5） */
  labelDefault: string
}

export const INTERVAL_COLORS: readonly DegreeColor[] = [
  { interval: 0,  token: 'degree-1',  hex: '#FFFFFF', textHex: '#18181B', labelDefault: '1'  },
  { interval: 1,  token: 'degree-b2', hex: '#E5484D', textHex: '#FFFFFF', labelDefault: 'b2' },
  { interval: 2,  token: 'degree-2',  hex: '#66BB6A', textHex: '#18181B', labelDefault: '2'  },
  { interval: 3,  token: 'degree-b3', hex: '#5B8DEF', textHex: '#18181B', labelDefault: 'b3' },
  { interval: 4,  token: 'degree-3',  hex: '#FF9F43', textHex: '#18181B', labelDefault: '3'  },
  { interval: 5,  token: 'degree-4',  hex: '#26C6B9', textHex: '#18181B', labelDefault: '4'  },
  { interval: 6,  token: 'degree-s4', hex: '#9C6ADE', textHex: '#18181B', labelDefault: '#4' },
  { interval: 7,  token: 'degree-5',  hex: '#9BA1A6', textHex: '#18181B', labelDefault: '5'  },
  { interval: 8,  token: 'degree-b6', hex: '#B5589F', textHex: '#FFFFFF', labelDefault: 'b6' },
  { interval: 9,  token: 'degree-6',  hex: '#F48FB1', textHex: '#18181B', labelDefault: '6'  },
  { interval: 10, token: 'degree-b7', hex: '#C08B5C', textHex: '#18181B', labelDefault: 'b7' },
  { interval: 11, token: 'degree-7',  hex: '#FFD54F', textHex: '#18181B', labelDefault: '7'  },
]

/** 由主音與目標音的 pc 取得顏色 */
export function colorForInterval(rootPc: PitchClass, pc: PitchClass): DegreeColor {
  const color = INTERVAL_COLORS[mod12(pc - rootPc)]
  if (!color) throw new Error('Unreachable: interval out of range')
  return color
}
