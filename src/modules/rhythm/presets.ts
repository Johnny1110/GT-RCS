/**
 * 節奏 pattern preset 庫（模組層資料，非引擎）。
 * 新增練習只需在此加一筆——節奏譜、示範 click、練習日誌自動支援。
 *
 * 速記法（core/audio/pattern.ts parseCells）：`X` 重音、`o` 一般、`g` 鬼音、`.` 休止；
 * `|` 只是把每一拍隔開的視覺輔助，方便一眼看出重音落在拍上的哪一格。
 */
import { SWING_SHUFFLE, SWING_STRAIGHT, parseCells, type RhythmPattern, type TimeSignature } from '@/core/audio'
import type { ChordQuality, NoteName } from '@/core/theory'

const FOUR_FOUR: TimeSignature = { beats: 4, unit: 4 }
const SIX_EIGHT: TimeSignature = { beats: 6, unit: 8 }
const TWELVE_EIGHT: TimeSignature = { beats: 12, unit: 8 }

interface PatternSpec {
  id: string
  bars: readonly string[]
  timeSig?: TimeSignature
  ticksPerBeat?: RhythmPattern['ticksPerBeat']
  swing?: number
  defaultBpm?: number
}

function pattern(spec: PatternSpec): RhythmPattern {
  const { id, bars, timeSig = FOUR_FOUR, ticksPerBeat = 4, swing, defaultBpm = 90 } = spec
  return {
    id,
    titleKey: `pattern.${id}`,
    timeSig,
    ticksPerBeat,
    ...(swing === undefined ? {} : { swing }),
    bars: bars.map(parseCells),
    defaultBpm,
  }
}

/** 課表的一級：由淺入深的一組 pattern（PRD F4-3.1） */
export interface RhythmStage {
  id: string
  titleKey: string
  descriptionKey: string
  patterns: readonly RhythmPattern[]
  knowledgeIds?: readonly string[]
}

export const SUBDIVISION_STAGES: readonly RhythmStage[] = [
  {
    id: 'quarter',
    titleKey: 'rhythmStage.quarter.title',
    descriptionKey: 'rhythmStage.quarter.description',
    knowledgeIds: ['rhythm.subdivisionGrid'],
    patterns: [
      pattern({ id: 'quarterDown', ticksPerBeat: 1, bars: ['X|o|o|o'], defaultBpm: 70 }),
      pattern({ id: 'quarterHalf', ticksPerBeat: 1, bars: ['X|.|o|.'], defaultBpm: 70 }),
    ],
  },
  {
    id: 'eighth',
    titleKey: 'rhythmStage.eighth.title',
    descriptionKey: 'rhythmStage.eighth.description',
    knowledgeIds: ['rhythm.offbeat'],
    patterns: [
      pattern({ id: 'eighthAll', ticksPerBeat: 2, bars: ['Xo|oo|oo|oo'], defaultBpm: 76 }),
      pattern({ id: 'eighthOff', ticksPerBeat: 2, bars: ['.X|.o|.o|.o'], defaultBpm: 72 }),
      pattern({ id: 'eighthBackbeat', ticksPerBeat: 2, bars: ['og|Xg|og|Xg'], defaultBpm: 80 }),
    ],
  },
  {
    id: 'sixteenth',
    titleKey: 'rhythmStage.sixteenth.title',
    descriptionKey: 'rhythmStage.sixteenth.description',
    knowledgeIds: ['rhythm.sixteenthPositions'],
    patterns: [
      pattern({ id: 'sixteenthAll', bars: ['Xggg|oggg|oggg|oggg'], defaultBpm: 68 }),
      pattern({ id: 'sixteenthE', bars: ['Xo..|oo..|oo..|oo..'], defaultBpm: 66 }),
      pattern({ id: 'sixteenthA', bars: ['X..o|o..o|o..o|o..o'], defaultBpm: 66 }),
      pattern({ id: 'sixteenthMix', bars: ['X..o|.o..|o..o|.o..'], defaultBpm: 72 }),
    ],
  },
  {
    id: 'syncopation',
    titleKey: 'rhythmStage.syncopation.title',
    descriptionKey: 'rhythmStage.syncopation.description',
    knowledgeIds: ['rhythm.syncopation'],
    patterns: [
      pattern({ id: 'dottedEighth', bars: ['X..o|..o.|.o..|o...'], defaultBpm: 66 }),
      pattern({ id: 'tresillo', bars: ['X..o|..o.|X..o|..o.'], defaultBpm: 74 }),
      pattern({ id: 'tiedAcross', bars: ['X.o.|...o|..o.|o...', 'X.o.|..o.|.o..|....'], defaultBpm: 70 }),
    ],
  },
]

/** 律動風格（PRD F4-4.1）：每個風格一組經典 pattern + 一個建議和弦 vamp */
export interface GrooveStyle {
  id: string
  titleKey: string
  descriptionKey: string
  /** 建議和弦：只存根音與和弦性質，符號一律由 theory 層組出（不 hardcode 音名） */
  chordHint: { root: NoteName; quality: ChordQuality }
  /** 進入此風格時套用的 swing 預設；使用者調過之後以滑桿為準 */
  defaultSwing: number
  patterns: readonly RhythmPattern[]
  knowledgeIds?: readonly string[]
}

export const GROOVE_STYLES: readonly GrooveStyle[] = [
  {
    id: 'funk',
    titleKey: 'rhythmStyle.funk.title',
    descriptionKey: 'rhythmStyle.funk.description',
    chordHint: { root: 'E', quality: '9' },
    defaultSwing: SWING_STRAIGHT,
    knowledgeIds: ['rhythm.ghostNote', 'rhythm.funkGrid'],
    patterns: [
      pattern({ id: 'funkOne', bars: ['Xggg|gggo|ggog|gggg'], defaultBpm: 96 }),
      pattern({ id: 'funkChuck', bars: ['ggXg|ggXg|ggXg|ggXg'], defaultBpm: 100 }),
      pattern({ id: 'funkSixteenth', bars: ['Xggo|ggog|gggo|ggog'], defaultBpm: 92 }),
      pattern({ id: 'funkClav', bars: ['X..g|..o.|.go.|..o.'], defaultBpm: 104 }),
    ],
  },
  {
    id: 'soul',
    titleKey: 'rhythmStyle.soul.title',
    descriptionKey: 'rhythmStyle.soul.description',
    chordHint: { root: 'A', quality: 'm9' },
    defaultSwing: SWING_STRAIGHT,
    knowledgeIds: ['rhythm.backbeat'],
    patterns: [
      pattern({ id: 'soulBackbeat', ticksPerBeat: 2, bars: ['og|Xg|og|Xg'], defaultBpm: 84 }),
      pattern({ id: 'soulPush', ticksPerBeat: 2, bars: ['.o|gX|.o|gX'], defaultBpm: 80 }),
      pattern({ id: 'soulTight', ticksPerBeat: 2, bars: ['Xg|og|gX|og'], defaultBpm: 88 }),
    ],
  },
  {
    id: 'shuffle',
    titleKey: 'rhythmStyle.shuffle.title',
    descriptionKey: 'rhythmStyle.shuffle.description',
    chordHint: { root: 'A', quality: '7' },
    defaultSwing: SWING_SHUFFLE,
    knowledgeIds: ['rhythm.shuffleVsSwing'],
    patterns: [
      pattern({ id: 'shuffleBasic', ticksPerBeat: 2, bars: ['Xg|og|Xg|og'], swing: SWING_SHUFFLE, defaultBpm: 84 }),
      pattern({ id: 'shuffleTexas', ticksPerBeat: 2, bars: ['Xo|go|Xo|go'], swing: SWING_SHUFFLE, defaultBpm: 92 }),
      pattern({ id: 'shuffleStops', ticksPerBeat: 2, bars: ['X.|.o|X.|.o'], swing: SWING_SHUFFLE, defaultBpm: 76 }),
    ],
  },
  {
    id: 'sixEight',
    titleKey: 'rhythmStyle.sixEight.title',
    descriptionKey: 'rhythmStyle.sixEight.description',
    chordHint: { root: 'E', quality: 'm' },
    defaultSwing: SWING_STRAIGHT,
    knowledgeIds: ['rhythm.sixEight'],
    patterns: [
      pattern({ id: 'sixEightTwo', timeSig: SIX_EIGHT, ticksPerBeat: 1, bars: ['Xgg|ogg'], defaultBpm: 132 }),
      pattern({ id: 'sixEightSix', timeSig: SIX_EIGHT, ticksPerBeat: 1, bars: ['Xoo|ooo'], defaultBpm: 120 }),
      pattern({ id: 'sixEightGospel', timeSig: SIX_EIGHT, ticksPerBeat: 1, bars: ['X.g|o.g'], defaultBpm: 116 }),
      pattern({ id: 'twelveEightBlues', timeSig: TWELVE_EIGHT, ticksPerBeat: 1, bars: ['Xgg|ogg|Xgg|ogg'], defaultBpm: 144 }),
    ],
  },
]

export function findStage(id: string): RhythmStage | undefined {
  return SUBDIVISION_STAGES.find((s) => s.id === id)
}

export function findStyle(id: string): GrooveStyle | undefined {
  return GROOVE_STYLES.find((s) => s.id === id)
}

export function findPattern(patterns: readonly RhythmPattern[], id: string): RhythmPattern | undefined {
  return patterns.find((p) => p.id === id)
}
