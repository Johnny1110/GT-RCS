/**
 * Feel 表（Phase 8 / F8-3）：譜上那行標記 → 可跟練的設定。
 *
 * 這是本模組最容易被誤解的一層，所以說清楚：**書上印的不是 BPM，是 feel 標記**
 * （Medium Swing、Bossa Nova、Ballad…）。速度區間與律動圖形是我們對那個標記的詮釋，
 * 不是抄來的資料——因此它是預設值不是規定，使用者調過的一律以使用者為準。
 *
 * ## click 與 comp 是兩張格子，這是刻意的
 *
 * 節奏線的模組只有一張 pattern：畫面上畫什麼，click 就響什麼。這裡不行——
 * comp 圖形（例如 Charleston 只敲 1 與 2 的反拍）拿來當節拍器會讓人整個失去拍子。
 * 所以：
 * - `click`：穩定的計時格子，掛進 Transport（決定拍號與細分）
 * - `comp`：和弦敲點的格子，只給 useCompDemo 用，與 click 同一個網格對齊
 *
 * 兩張格子共用 `timeSig` 與 `ticksPerBeat`，所以格號可以直接互換。
 */
import {
  SWING_SHUFFLE, SWING_STRAIGHT, parseCells,
  type CellRole, type RhythmPattern, type TicksPerBeat, type TimeSignature,
} from '@/core/audio'

export type FeelId =
  | 'ballad' | 'mediumSwing' | 'mediumUpSwing' | 'upTempo' | 'jazzWaltz'
  | 'bossa' | 'samba' | 'afroCuban' | 'shuffleBlues' | 'evenEighths'

export interface Feel {
  id: FeelId
  /** 譜上印的標記字樣，不翻譯（與和弦符號同一條規則） */
  marking: string
  descriptionKey: string
  timeSig: TimeSignature
  ticksPerBeat: TicksPerBeat
  swing: number
  /** 速度區間：min/max 只用來提示，不阻擋使用者 */
  bpm: { min: number; default: number; max: number }
  /** 計時用的 click 格子（掛進 Transport） */
  click: RhythmPattern
  /** 和弦敲點；每小節一列，長度可與 click 不同（2 小節的圖形就寫兩列） */
  comp: readonly (readonly CellRole[])[]
}

const FOUR_FOUR: TimeSignature = { beats: 4, unit: 4 }
const THREE_FOUR: TimeSignature = { beats: 3, unit: 4 }

interface FeelSpec {
  id: FeelId
  marking: string
  timeSig?: TimeSignature
  ticksPerBeat?: TicksPerBeat
  swing?: number
  bpm: { min: number; default: number; max: number }
  click: string
  comp: readonly string[]
}

function feel(spec: FeelSpec): Feel {
  const {
    timeSig = FOUR_FOUR, ticksPerBeat = 2, swing = SWING_SHUFFLE,
  } = spec
  return {
    id: spec.id,
    marking: spec.marking,
    descriptionKey: `feel.${spec.id}.description`,
    timeSig,
    ticksPerBeat,
    swing,
    bpm: spec.bpm,
    click: {
      id: `feel-${spec.id}`,
      titleKey: `feel.${spec.id}.title`,
      timeSig,
      ticksPerBeat,
      swing,
      bars: [parseCells(spec.click)],
      defaultBpm: spec.bpm.default,
    },
    comp: spec.comp.map(parseCells),
  }
}

/**
 * 十種 feel。click 一律維持得住拍子（四分為主、swing 系加 2、4 重音），
 * comp 才是各風格的性格所在。
 */
export const FEELS: readonly Feel[] = [
  feel({
    id: 'ballad', marking: 'Ballad',
    bpm: { min: 50, default: 62, max: 80 },
    click: 'X.|o.|o.|o.',
    // 民謠式的抒情曲：和弦落在 1 與 3，剩下的留給旋律
    comp: ['X.|..|o.|..'],
  }),
  feel({
    id: 'mediumSwing', marking: 'Medium Swing',
    bpm: { min: 110, default: 140, max: 170 },
    click: 'o.|X.|o.|X.',
    // Freddie Green：四分音符一路走到底，是搖擺樂團吉他的定義
    comp: ['o.|o.|o.|o.'],
  }),
  feel({
    id: 'mediumUpSwing', marking: 'Medium Up Swing',
    bpm: { min: 170, default: 190, max: 220 },
    click: 'o.|X.|o.|X.',
    // Charleston：1 與 2 的反拍，bebop comping 的基本句
    comp: ['X.|.o|..|..'],
  }),
  feel({
    id: 'upTempo', marking: 'Up Tempo',
    bpm: { min: 200, default: 240, max: 300 },
    click: 'o.|X.|o.|X.',
    // two-feel：240 以上還四分音符 comping 只會變成噪音
    comp: ['X.|..|o.|..'],
  }),
  feel({
    id: 'jazzWaltz', marking: 'Jazz Waltz', timeSig: THREE_FOUR,
    bpm: { min: 120, default: 160, max: 200 },
    click: 'X.|o.|o.',
    comp: ['X.|.o|o.'],
  }),
  feel({
    id: 'bossa', marking: 'Bossa Nova', swing: SWING_STRAIGHT,
    bpm: { min: 110, default: 132, max: 160 },
    click: 'X.|o.|o.|o.',
    // 兩小節一循環：1、2 的反拍、4 ／ 2、3 的反拍
    comp: ['X.|.o|..|o.', '..|o.|.o|..'],
  }),
  feel({
    id: 'samba', marking: 'Samba', swing: SWING_STRAIGHT, ticksPerBeat: 4,
    bpm: { min: 170, default: 200, max: 240 },
    click: 'X...|o...|o...|o...',
    comp: ['X..o|..o.|X..o|..o.'],
  }),
  feel({
    id: 'afroCuban', marking: 'Afro-Cuban', swing: SWING_STRAIGHT,
    bpm: { min: 150, default: 176, max: 200 },
    click: 'X.|o.|o.|o.',
    // 2-3 son clave：先兩下再三下
    comp: ['..|o.|o.|..', 'X.|.o|..|o.'],
  }),
  feel({
    id: 'shuffleBlues', marking: 'Medium Blues Shuffle',
    bpm: { min: 90, default: 112, max: 130 },
    click: 'o.|X.|o.|X.',
    comp: ['X.|o.|o.|o.'],
  }),
  feel({
    id: 'evenEighths', marking: 'Even Eighths', swing: SWING_STRAIGHT,
    bpm: { min: 120, default: 144, max: 180 },
    click: 'X.|o.|o.|o.',
    comp: ['X.|..|.o|..'],
  }),
]

export function findFeel(id: string | undefined): Feel | undefined {
  return FEELS.find((f) => f.id === id)
}

/** 持久化與曲譜都是不可信輸入：不認得的 feel 一律回退 Medium Swing */
export function resolveFeel(id: unknown): Feel {
  return (typeof id === 'string' ? findFeel(id) : undefined) ?? FEELS[1]!
}

export function isFeelId(value: unknown): value is FeelId {
  return typeof value === 'string' && FEELS.some((f) => f.id === value)
}
