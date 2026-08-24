/**
 * 和弦進行 preset 庫（模組層資料，非引擎）。
 * 新增進行只需在此加一筆；跟練畫面與 12 調循環自動支援。
 */
import type { ProgressionPreset } from '@/core/theory'

/** 五度圈 12 調循環用的經典進行（PRD F3-3） */
export const CIRCLE_PROGRESSIONS: readonly ProgressionPreset[] = [
  {
    id: '2516',
    titleKey: 'progression.2516',
    tokens: 'ii V7 Imaj7 vi',
    barsPerChord: [1, 1, 1, 1],
    defaultBpm: 80,
    harmonyLevel: 'seventh',
    knowledgeIds: ['progression.2516'],
  },
  {
    id: '4536251',
    titleKey: 'progression.4536251',
    tokens: 'IV V iii vi ii V I',
    barsPerChord: [1, 1, 1, 1, 1, 1, 1],
    defaultBpm: 92,
    harmonyLevel: 'seventh',
    knowledgeIds: ['progression.4536251'],
  },
  {
    id: '1645',
    titleKey: 'progression.1645',
    tokens: 'I vi IV V',
    barsPerChord: [1, 1, 1, 1],
    defaultBpm: 96,
    harmonyLevel: 'triad',
    knowledgeIds: ['progression.1645'],
  },
  {
    id: '6415',
    titleKey: 'progression.6415',
    tokens: 'vi IV I V',
    barsPerChord: [1, 1, 1, 1],
    defaultBpm: 100,
    harmonyLevel: 'triad',
    knowledgeIds: ['progression.6415'],
  },
  {
    id: 'canon',
    titleKey: 'progression.canon',
    tokens: 'I V vi iii IV I IV V',
    barsPerChord: [1, 1, 1, 1, 1, 1, 1, 1],
    defaultBpm: 88,
    harmonyLevel: 'triad',
    knowledgeIds: ['progression.canon'],
  },
  {
    id: 'blues12',
    titleKey: 'progression.blues12',
    tokens: 'I7 IV7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7',
    barsPerChord: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    defaultBpm: 76,
    harmonyLevel: 'seventh',
    knowledgeIds: ['progression.blues12'],
  },
]

/** 固定調分級課表（PRD F3-4） */
export interface PracticeLevel {
  id: string
  titleKey: string
  descriptionKey: string
  progressions: readonly ProgressionPreset[]
  knowledgeIds?: readonly string[]
}

export const PRACTICE_LEVELS: readonly PracticeLevel[] = [
  {
    id: 'level1',
    titleKey: 'level.1.title',
    descriptionKey: 'level.1.description',
    progressions: [
      { id: 'l1-1451', titleKey: 'progression.1451', tokens: 'I IV V I', barsPerChord: [1, 1, 1, 1], defaultBpm: 80, harmonyLevel: 'triad' },
      { id: 'l1-1645', titleKey: 'progression.1645', tokens: 'I vi IV V', barsPerChord: [1, 1, 1, 1], defaultBpm: 88, harmonyLevel: 'triad' },
      { id: 'l1-6415', titleKey: 'progression.6415', tokens: 'vi IV I V', barsPerChord: [1, 1, 1, 1], defaultBpm: 92, harmonyLevel: 'triad' },
    ],
  },
  {
    id: 'level2',
    titleKey: 'level.2.title',
    descriptionKey: 'level.2.description',
    progressions: [
      { id: 'l2-diatonic', titleKey: 'progression.diatonicWalk', tokens: 'I ii iii IV V vi viidim I', barsPerChord: [1, 1, 1, 1, 1, 1, 1, 1], defaultBpm: 76, harmonyLevel: 'triad' },
      { id: 'l2-canon', titleKey: 'progression.canon', tokens: 'I V vi iii IV I IV V', barsPerChord: [1, 1, 1, 1, 1, 1, 1, 1], defaultBpm: 84, harmonyLevel: 'triad' },
      { id: 'l2-3625', titleKey: 'progression.3625', tokens: 'iii vi ii V', barsPerChord: [1, 1, 1, 1], defaultBpm: 88, harmonyLevel: 'triad' },
    ],
  },
  {
    id: 'level3',
    titleKey: 'level.3.title',
    descriptionKey: 'level.3.description',
    progressions: [
      { id: 'l3-2516', titleKey: 'progression.2516', tokens: 'ii V7 Imaj7 vi', barsPerChord: [1, 1, 1, 1], defaultBpm: 80, harmonyLevel: 'seventh', knowledgeIds: ['progression.2516'] },
      { id: 'l3-4536251', titleKey: 'progression.4536251', tokens: 'IV V iii vi ii V I', barsPerChord: [1, 1, 1, 1, 1, 1, 1], defaultBpm: 88, harmonyLevel: 'seventh', knowledgeIds: ['progression.4536251'] },
      { id: 'l3-fast25', titleKey: 'progression.fast25', tokens: 'ii V7 Imaj7 Imaj7', barsPerChord: [0.5, 0.5, 1, 1], defaultBpm: 92, harmonyLevel: 'seventh' },
    ],
  },
  {
    id: 'level4',
    titleKey: 'level.4.title',
    descriptionKey: 'level.4.description',
    progressions: [
      { id: 'l4-blues12', titleKey: 'progression.blues12', tokens: 'I7 IV7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7', barsPerChord: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], defaultBpm: 76, harmonyLevel: 'seventh', knowledgeIds: ['progression.blues12'] },
      { id: 'l4-quickchange', titleKey: 'progression.bluesQuick', tokens: 'I7 IV7 I7 I7 IV7 IV7 I7 I7 ii V7 I7 V7', barsPerChord: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], defaultBpm: 80, harmonyLevel: 'seventh', knowledgeIds: ['chord.blues-dominants'] },
      { id: 'l4-jazzblues', titleKey: 'progression.jazzBlues', tokens: 'I7 IV7 I7 V/ii ii V7', barsPerChord: [1, 1, 1, 1, 1, 1], defaultBpm: 84, harmonyLevel: 'seventh', knowledgeIds: ['chord.secondary-dominant'] },
    ],
  },
  {
    id: 'level5',
    titleKey: 'level.5.title',
    descriptionKey: 'level.5.description',
    progressions: [
      { id: 'l5-borrowed', titleKey: 'progression.borrowedIv', tokens: 'Imaj7 iv Imaj7 Imaj7', barsPerChord: [1, 1, 1, 1], defaultBpm: 72, harmonyLevel: 'seventh', knowledgeIds: ['chord.borrowed-iv'] },
      { id: 'l5-bVII', titleKey: 'progression.bVII', tokens: 'Imaj7 bVII IV I', barsPerChord: [1, 1, 1, 1], defaultBpm: 84, harmonyLevel: 'seventh', knowledgeIds: ['chord.bVII'] },
      { id: 'l5-secondary', titleKey: 'progression.secondaryChain', tokens: 'Imaj7 V/ii ii V7', barsPerChord: [1, 1, 1, 1], defaultBpm: 80, harmonyLevel: 'seventh', knowledgeIds: ['chord.secondary-dominant'] },
      { id: 'l5-neosoul', titleKey: 'progression.neoSoul', tokens: 'Imaj9 vim9 iim9 V7', barsPerChord: [1, 1, 1, 1], defaultBpm: 68, harmonyLevel: 'seventh', knowledgeIds: ['chord.neo-soul'] },
    ],
  },
]

export function findCircleProgression(id: string): ProgressionPreset | undefined {
  return CIRCLE_PROGRESSIONS.find((preset) => preset.id === id)
}

export function findLevel(id: string): PracticeLevel | undefined {
  return PRACTICE_LEVELS.find((level) => level.id === id)
}
