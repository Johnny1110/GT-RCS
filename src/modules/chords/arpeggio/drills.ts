/**
 * 七和弦琶音課表（模組層資料，非引擎）。
 *
 * 為什麼用級數記法而不是列出和弦：一份記法帶進 12 個調就是 12 份練習，
 * 和弦名與內音全部由 `realizeProgression` 推導——新增一條課表只要加一行 tokens，
 * 12 調的拼寫（含 Gb 調的重降記號）不必手寫，也就不會寫錯。
 *
 * 兩種課表形狀，對應兩種練法：
 * - **多個和弦**（順階七和弦、2-5-1）：在同一個調裡走完幾個和弦，練的是「功能」——
 *   同樣是 m7，ii 與 vi 在調裡的角色不同。
 * - **單一和弦**（maj7、7、m7、m7b5、dim7）：一個調只有一個和弦，沿五度圈走 12 調，
 *   練的是「指型」——同一個手型移到 12 個位置。
 *
 * 每個 token 都寫死顯式品質（`Imaj7` 而不是 `I`），因此結果不受 harmonyLevel 推導影響：
 * 琶音練的是那個和弦本身，不是它在某個和聲層級下的樣子。
 */
import type { ProgressionPreset } from '@/core/theory'

export const ARPEGGIO_DRILLS: readonly ProgressionPreset[] = [
  {
    id: 'diatonic7',
    titleKey: 'arpeggioDrill.diatonic7',
    tokens: 'Imaj7 iim7 iiim7 IVmaj7 V7 vim7 viim7b5',
    barsPerChord: [1, 1, 1, 1, 1, 1, 1],
    defaultBpm: 76,
    harmonyLevel: 'seventh',
    knowledgeIds: ['chord.seventh-arpeggios'],
  },
  {
    id: 'major251',
    titleKey: 'arpeggioDrill.major251',
    tokens: 'iim7 V7 Imaj7',
    barsPerChord: [1, 1, 1],
    defaultBpm: 80,
    harmonyLevel: 'seventh',
    knowledgeIds: ['progression.2516'],
  },
  {
    id: 'minor251',
    titleKey: 'arpeggioDrill.minor251',
    tokens: 'iim7b5 V7 im7',
    barsPerChord: [1, 1, 1],
    defaultBpm: 76,
    harmonyLevel: 'seventh',
    knowledgeIds: ['chord.seventh-arpeggios'],
  },
  {
    id: 'maj7',
    titleKey: 'arpeggioDrill.maj7',
    tokens: 'Imaj7',
    barsPerChord: [1],
    defaultBpm: 72,
    harmonyLevel: 'seventh',
    knowledgeIds: ['chord.seventh-arpeggios'],
  },
  {
    id: 'dom7',
    titleKey: 'arpeggioDrill.dom7',
    tokens: 'I7',
    barsPerChord: [1],
    defaultBpm: 72,
    harmonyLevel: 'seventh',
    knowledgeIds: ['chord.blues-dominants'],
  },
  {
    id: 'min7',
    titleKey: 'arpeggioDrill.min7',
    tokens: 'im7',
    barsPerChord: [1],
    defaultBpm: 72,
    harmonyLevel: 'seventh',
    knowledgeIds: ['chord.seventh-arpeggios'],
  },
  {
    id: 'halfDim7',
    titleKey: 'arpeggioDrill.halfDim7',
    tokens: 'im7b5',
    barsPerChord: [1],
    defaultBpm: 68,
    harmonyLevel: 'seventh',
    knowledgeIds: ['chord.seventh-arpeggios'],
  },
  {
    id: 'dim7',
    titleKey: 'arpeggioDrill.dim7',
    tokens: 'idim7',
    barsPerChord: [1],
    defaultBpm: 68,
    harmonyLevel: 'seventh',
    knowledgeIds: ['chord.seventh-arpeggios'],
  },
]

export function findArpeggioDrill(id: string): ProgressionPreset | undefined {
  return ARPEGGIO_DRILLS.find((drill) => drill.id === id)
}

/** 這份課表在一個調裡有幾個和弦（＝走一遍要幾小節，每個琶音一小節） */
export function drillChordCount(drill: ProgressionPreset): number {
  return drill.barsPerChord.length
}
