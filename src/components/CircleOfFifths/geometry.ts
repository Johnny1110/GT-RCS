/**
 * 五度圈幾何與調性資料（純函式，可測）。
 *
 * 外圈 12 大調，C 在頂端順時針加升號；內圈為各自的關係小調。
 * 逆時針＝五度下行（C→F→Bb…），這是和弦進行練習走的方向。
 */
import { mod12, parseNoteName } from '@/core/theory'
import type { NoteName } from '@/core/theory'

/** 順時針方向的 12 個大調（升號方向） */
export const CIRCLE_MAJOR: readonly NoteName[] = [
  'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F',
]

/** 對應的關係小調（同調號） */
export const CIRCLE_MINOR: readonly NoteName[] = [
  'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'Bb', 'F', 'C', 'G', 'D',
]

/** 逆時針＝五度下行的順序，12 調循環練習用 */
export const DESCENDING_FIFTHS: readonly NoteName[] = [
  'C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'B', 'E', 'A', 'D', 'G',
]

export interface CircleSector {
  index: number
  major: NoteName
  minor: NoteName
  /** 扇形中心角（弧度，0 = 正上方，順時針為正） */
  angle: number
  majorLabel: { x: number; y: number }
  minorLabel: { x: number; y: number }
  /** 外圈扇形路徑 */
  majorPath: string
  /** 內圈扇形路徑 */
  minorPath: string
}

export interface CircleLayout {
  size: number
  center: number
  sectors: CircleSector[]
  /** 內圈中央的留白半徑（顯示當前調資訊） */
  holeRadius: number
}

const SIZE = 320
const OUTER_R = 152
const MID_R = 100
const INNER_R = 56

function polar(center: number, radius: number, angle: number): { x: number; y: number } {
  return { x: center + radius * Math.sin(angle), y: center - radius * Math.cos(angle) }
}

function sectorPath(center: number, a0: number, a1: number, rInner: number, rOuter: number): string {
  const p0 = polar(center, rOuter, a0)
  const p1 = polar(center, rOuter, a1)
  const p2 = polar(center, rInner, a1)
  const p3 = polar(center, rInner, a0)
  return [
    `M${p0.x.toFixed(2)} ${p0.y.toFixed(2)}`,
    `A${rOuter} ${rOuter} 0 0 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `L${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `A${rInner} ${rInner} 0 0 0 ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    'Z',
  ].join(' ')
}

export function circleLayout(): CircleLayout {
  const center = SIZE / 2
  const step = (Math.PI * 2) / 12
  const sectors: CircleSector[] = CIRCLE_MAJOR.map((major, index) => {
    const angle = index * step
    const a0 = angle - step / 2
    const a1 = angle + step / 2
    const minor = CIRCLE_MINOR[index]
    if (minor === undefined) throw new Error('Unreachable: circle tables out of sync')
    return {
      index,
      major,
      minor,
      angle,
      majorLabel: polar(center, (OUTER_R + MID_R) / 2, angle),
      minorLabel: polar(center, (MID_R + INNER_R) / 2, angle),
      majorPath: sectorPath(center, a0, a1, MID_R, OUTER_R),
      minorPath: sectorPath(center, a0, a1, INNER_R, MID_R),
    }
  })
  return { size: SIZE, center, sectors, holeRadius: INNER_R }
}

/**
 * 某個大調的 diatonic 和弦落在圈上的哪些位置。
 *
 * 外圈：IV（逆時針一格）、I（本位）、V（順時針一格）
 * 內圈：ii（逆時針一格）、vi（本位）、iii（順時針一格）
 *
 * 內外圈是對齊的——每個 diatonic 小三和弦正好位於它的關係大調正下方
 * （ii 在 IV 下、vi 在 I 下、iii 在 V 下）。這正是五度圈這樣畫的理由，
 * 也讓「調內 7 個和弦」在圖上是一個連續區塊。
 * vii° 不在圈上（減和弦），以徽章另外標示。
 */
export interface DiatonicPlacement {
  /** sector index → 級數（'1' | '4' | '5'） */
  outer: Record<number, string>
  /** sector index → 級數（'6' | '2' | '3'） */
  inner: Record<number, string>
  tonicIndex: number
}

export function diatonicPlacement(key: NoteName): DiatonicPlacement {
  const keyPc = parseNoteName(key).pc
  const tonicIndex = CIRCLE_MAJOR.findIndex((name) => parseNoteName(name).pc === keyPc)
  if (tonicIndex < 0) throw new Error(`Key not on the circle: ${key}`)
  const at = (offset: number): number => (tonicIndex + offset + 12) % 12
  return {
    tonicIndex,
    outer: { [at(-1)]: '4', [at(0)]: '1', [at(1)]: '5' },
    inner: { [at(-1)]: '2', [at(0)]: '6', [at(1)]: '3' },
  }
}

/** 某個音落在圈上的扇形索引（用於標記當前和弦），不在圈上回傳 -1 */
export function sectorIndexForPitch(pc: number): number {
  return CIRCLE_MAJOR.findIndex((name) => parseNoteName(name).pc === mod12(pc))
}
