/**
 * 曲庫（Phase 8 / F8-4）——模組層資料，非引擎。
 *
 * ## 三層曲庫與它們為什麼長這樣（決策見 docs/PRD/phase-08.md §0）
 *
 * - **形式練習（drill）**：從曲目群裡抽出來的**和聲形式**——爵士藍調、Rhythm Changes、
 *   大三度循環、各種 turnaround。通用和聲模板不是特定樂曲，這也是它們在教材裡的存在方式，
 *   而且真正在練的就是這些：把 Rhythm Changes 練熟，幾百首曲子同時解鎖。
 * - **公版曲（public-domain）**：出版年已過保護期的標準曲。和弦一律**依原曲和聲自行編寫**，
 *   不轉錄任何出版品的編排；每首帶作者與出版年，讓這份清單本身可以被查核。
 * - **使用者曲譜（user）**：不在本檔——它們只存在使用者的 localStorage（stores/userCharts.ts）。
 *
 * ## 資料規則
 *
 * 曲譜只存**級數**不存音名（architecture §8 反模式 1），所以移調是免費的，
 * 而「同一首在 12 個調」正是標準曲練習的重點。小節線記法的文法見
 * core/theory/progressions/chartText.ts。
 */
import type { ChartForm, HarmonyLevel } from '@/core/theory'
import type { FeelId } from './feels'

export type ChartOrigin =
  | { kind: 'drill' }
  | { kind: 'public-domain'; composer: string; firstPublished: number }
  /** 使用者自己輸入的譜；資料不在本檔，只在 stores/userCharts.ts 的 localStorage */
  | { kind: 'user' }

export interface Chart extends ChartForm {
  id: string
  /**
   * 曲名／形式名。**不翻譯**——`Rhythm Changes`、`Bird Blues`、`Sweet Georgia Brown`
   * 是專有名詞，全世界的樂手用同一個字串溝通，與和弦符號同一條規則。
   * 翻成「節奏變化」只會讓使用者找不到自己要的那一首。
   */
  title: string
  descriptionKey: string
  feel: FeelId
  harmonyLevel: HarmonyLevel
  /** 覆寫 feel 的預設速度；省略時用 feel 的預設 */
  bpm?: number
  origin: ChartOrigin
  knowledgeIds?: readonly string[]
}

const DRILL: ChartOrigin = { kind: 'drill' }

/** ── A 層：形式練習 ──────────────────────────────────────────────── */
export const DRILL_CHARTS: readonly Chart[] = [
  {
    id: 'jazz-blues',
    title: 'Jazz Blues',
    descriptionKey: 'jazzBook.chart.jazzBlues',
    homeKey: 'F', feel: 'mediumSwing', harmonyLevel: 'seventh', origin: DRILL,
    knowledgeIds: ['progression.blues12', 'chord.secondary-dominant'],
    form: ['A'],
    sections: [{
      label: 'A',
      bars: '| I7 | IV7 | I7 | vm7 I7 | IV7 | #ivdim7 | I7 | V/ii | ii | V7 | I7 V/ii | ii V7 |',
    }],
  },
  {
    id: 'bird-blues',
    title: 'Bird Blues',
    descriptionKey: 'jazzBook.chart.birdBlues',
    homeKey: 'F', feel: 'mediumUpSwing', harmonyLevel: 'seventh', origin: DRILL,
    knowledgeIds: ['chord.secondary-dominant'],
    form: ['A'],
    sections: [{
      label: 'A',
      bars: '| Imaj7 | viim7b5 V/vi | vim7 V/V | vm7 I7 | IVmaj7 | ivm7 bVII7 '
        + '| iiim7 V/ii | biiim7 bVI7 | iim7 | V7 | iiim7 V/ii | iim7 V7 |',
    }],
  },
  {
    id: 'rhythm-a',
    title: 'Rhythm Changes A',
    descriptionKey: 'jazzBook.chart.rhythmA',
    homeKey: 'Bb', feel: 'mediumSwing', harmonyLevel: 'seventh', origin: DRILL,
    knowledgeIds: ['form.rhythmChanges'],
    form: ['A'],
    sections: [{
      label: 'A',
      bars: '| I6 vim7 | iim7 V7 | iiim7 V/ii | iim7 V7 | IVmaj7 | ivm6 | I6 V/ii | iim7 V7 |',
    }],
  },
  {
    id: 'rhythm-bridge',
    title: 'Rhythm Bridge',
    descriptionKey: 'jazzBook.chart.rhythmBridge',
    homeKey: 'Bb', feel: 'mediumSwing', harmonyLevel: 'seventh', origin: DRILL,
    knowledgeIds: ['form.rhythmChanges', 'chord.secondary-dominant'],
    form: ['B'],
    sections: [{ label: 'B', bars: '| V/vi | % | V/ii | % | V/V | % | V7 | % |' }],
  },
  {
    id: 'rhythm-full',
    title: 'Rhythm Changes',
    descriptionKey: 'jazzBook.chart.rhythmFull',
    homeKey: 'Bb', feel: 'mediumUpSwing', harmonyLevel: 'seventh', origin: DRILL,
    knowledgeIds: ['form.rhythmChanges', 'form.aaba'],
    form: ['A', 'A2', 'B', 'A3'],
    sections: [
      { label: 'A', bars: '| I6 vim7 | iim7 V7 | iiim7 V/ii | iim7 V7 | IVmaj7 | ivm6 | I6 V/ii | iim7 V7 |' },
      { label: 'A2', bars: '| I6 vim7 | iim7 V7 | iiim7 V/ii | iim7 V7 | IVmaj7 | ivm6 | I6 | I7 |' },
      { label: 'B', bars: '| V/vi | % | V/ii | % | V/V | % | V7 | % |' },
      { label: 'A3', bars: '| I6 vim7 | iim7 V7 | iiim7 V/ii | iim7 V7 | IVmaj7 | ivm6 | I6 V/ii | iim7 V7 |' },
    ],
  },
  {
    id: 'aaba-32',
    title: 'Typical AABA',
    descriptionKey: 'jazzBook.chart.aaba',
    homeKey: 'C', feel: 'mediumSwing', harmonyLevel: 'seventh', origin: DRILL,
    knowledgeIds: ['form.aaba'],
    form: ['A', 'A2', 'B', 'A3'],
    sections: [
      { label: 'A', bars: '| Imaj7 | vim7 | iim7 | V7 | iiim7 | V/ii | iim7 | V7 |' },
      { label: 'A2', bars: '| Imaj7 | vim7 | iim7 | V7 | iiim7 V/ii | iim7 V7 | Imaj7 | I7 |' },
      { label: 'B', bars: '| IVmaj7 | % | ivm7 bVII7 | Imaj7 | iiim7 | V/ii | iim7 | V7 |' },
      { label: 'A3', bars: '| Imaj7 | vim7 | iim7 | V7 | iiim7 V/ii | iim7 V7 | Imaj7 | % |' },
    ],
  },
  {
    id: 'turnarounds',
    title: 'Turnaround Set',
    descriptionKey: 'jazzBook.chart.turnarounds',
    homeKey: 'C', feel: 'mediumSwing', harmonyLevel: 'seventh', origin: DRILL,
    knowledgeIds: ['chord.turnaround'],
    form: ['T1', 'T2', 'T3', 'T4'],
    sections: [
      { label: 'T1', bars: '| I6 vim7 | iim7 V7 | I6 | % |' },
      { label: 'T2', bars: '| iiim7 V/ii | iim7 V7 | I6 | % |' },
      { label: 'T3', bars: '| I6 bIII7 | bVImaj7 V7 | I6 | % |' },
      { label: 'T4', bars: '| I6 V/ii | iim7 bII7 | I6 | % |' },
    ],
  },
  {
    id: 'minor-251',
    title: 'Minor ii-V-i',
    descriptionKey: 'jazzBook.chart.minor251',
    homeKey: 'A', feel: 'mediumSwing', harmonyLevel: 'seventh', origin: DRILL,
    form: ['A'],
    sections: [{ label: 'A', bars: '| iim7b5 | V7b9 | imMaj7 | % |' }],
  },
  {
    id: 'minor-blues',
    title: 'Minor Blues',
    descriptionKey: 'jazzBook.chart.minorBlues',
    homeKey: 'C', feel: 'mediumSwing', harmonyLevel: 'seventh', origin: DRILL,
    knowledgeIds: ['progression.blues12'],
    form: ['A'],
    sections: [{
      label: 'A',
      bars: '| im7 | % | % | % | ivm7 | % | im7 | % | bVImaj7 | V7b9 | im7 | V7b9 |',
    }],
  },
  {
    id: 'major-thirds',
    title: 'Major-Thirds Cycle',
    descriptionKey: 'jazzBook.chart.majorThirds',
    homeKey: 'C', feel: 'mediumUpSwing', harmonyLevel: 'seventh', origin: DRILL,
    form: ['A'],
    sections: [{ label: 'A', bars: '| Imaj7 bIII7 | bVImaj7 VII7 | IIImaj7 V7 | Imaj7 |' }],
  },
  {
    id: 'coltrane-cadence',
    title: 'Coltrane Cadence',
    descriptionKey: 'jazzBook.chart.coltraneCadence',
    homeKey: 'C', feel: 'mediumSwing', harmonyLevel: 'seventh', origin: DRILL,
    form: ['A'],
    sections: [{ label: 'A', bars: '| iim7 bIII7 | bVImaj7 VII7 | IIImaj7 V7 | Imaj7 |' }],
  },
  {
    id: 'tritone-subs',
    title: 'Tritone Substitution',
    descriptionKey: 'jazzBook.chart.tritoneSubs',
    homeKey: 'C', feel: 'mediumSwing', harmonyLevel: 'seventh', origin: DRILL,
    knowledgeIds: ['chord.turnaround'],
    form: ['A', 'B'],
    sections: [
      { label: 'A', bars: '| iim7 V7 | Imaj7 | % | % |' },
      { label: 'B', bars: '| iim7 bII7 | Imaj7 | % | % |' },
    ],
  },
  {
    id: 'descending-25s',
    title: 'Descending ii-V Chain',
    descriptionKey: 'jazzBook.chart.descending25s',
    homeKey: 'C', feel: 'mediumSwing', harmonyLevel: 'seventh', origin: DRILL,
    form: ['A'],
    sections: [{
      label: 'A',
      bars: '| iim7 V7 | Imaj7 | im7 IV7 | bVIImaj7 '
        + '| bviim7 bIII7 | bVImaj7 | bvim7 bII7 | bVmaj7 |',
    }],
  },
  {
    id: 'modal-vamp',
    title: 'Modal Vamp',
    descriptionKey: 'jazzBook.chart.modalVamp',
    homeKey: 'D', feel: 'evenEighths', harmonyLevel: 'seventh', origin: DRILL,
    knowledgeIds: ['scale.dorian'],
    form: ['A', 'B'],
    sections: [
      { label: 'A', bars: '| im7 | % | % | % | % | % | % | % |' },
      { label: 'B', bars: '| bIIm7 | % | % | % | % | % | % | % |' },
    ],
  },
]

/**
 * ── B 層：公版曲 ──────────────────────────────────────────────────
 *
 * 收錄門檻：出版年已過保護期（以最保守的屬地為準）。和弦依原曲和聲自行編寫，
 * 有疑義的一律不進這份清單，留給使用者自己輸入（那是他的書、他的瀏覽器）。
 */
export const STANDARD_CHARTS: readonly Chart[] = [
  {
    id: 'st-louis-blues',
    title: 'St. Louis Blues',
    descriptionKey: 'jazzBook.chart.stLouisBlues',
    homeKey: 'G', feel: 'shuffleBlues', harmonyLevel: 'seventh',
    origin: { kind: 'public-domain', composer: 'W. C. Handy', firstPublished: 1914 },
    knowledgeIds: ['progression.blues12'],
    form: ['A', 'B', 'A'],
    sections: [
      { label: 'A', bars: '| I7 | % | % | % | IV7 | % | I7 | % | V7 | IV7 | I7 | V7 |' },
      // 著名的小調「探戈」段：同主音小調上的 i–V7 來回
      { label: 'B', bars: '| im | % | V7 | % | im | % | V7 | im |' },
    ],
  },
  {
    id: 'sweet-georgia-brown',
    title: 'Sweet Georgia Brown',
    descriptionKey: 'jazzBook.chart.sweetGeorgiaBrown',
    homeKey: 'F', feel: 'mediumSwing', harmonyLevel: 'seventh',
    origin: {
      kind: 'public-domain',
      composer: 'Ben Bernie / Maceo Pinkard / Kenneth Casey',
      firstPublished: 1925,
    },
    knowledgeIds: ['chord.secondary-dominant'],
    form: ['A', 'B'],
    sections: [
      // 整首就是一條五度圈：VI7 → II7 → V7 → I，每個和弦四小節
      { label: 'A', bars: '| V/ii | % | % | % | V/V | % | % | % | V7 | % | % | % | I6 | % | % | % |' },
      { label: 'B', bars: '| I6 | % | I7 | % | IVmaj7 | % | ivm6 | % | I6 | % | V/ii | % | V/V | V7 | I6 | % |' },
    ],
  },
  {
    id: 'saints',
    title: 'When the Saints Go Marching In',
    descriptionKey: 'jazzBook.chart.saints',
    homeKey: 'F', feel: 'mediumSwing', harmonyLevel: 'triad',
    origin: { kind: 'public-domain', composer: 'Traditional', firstPublished: 1896 },
    form: ['A'],
    sections: [{
      label: 'A',
      bars: '| I | % | % | % | I | % | V7 | % | V7 | % | % | % | I | I7 IV | I V7 | I |',
    }],
  },
  {
    id: 'careless-love',
    title: 'Careless Love',
    descriptionKey: 'jazzBook.chart.carelessLove',
    homeKey: 'C', feel: 'ballad', harmonyLevel: 'triad',
    origin: { kind: 'public-domain', composer: 'Traditional', firstPublished: 1911 },
    form: ['A'],
    sections: [{
      label: 'A',
      bars: '| I | % | V7 | % | V7 | % | I | % | I | I7 | IV | % | I | V7 | I | % |',
    }],
  },
  {
    id: 'frankie-and-johnny',
    title: 'Frankie and Johnny',
    descriptionKey: 'jazzBook.chart.frankieAndJohnny',
    homeKey: 'C', feel: 'shuffleBlues', harmonyLevel: 'triad',
    origin: { kind: 'public-domain', composer: 'Traditional', firstPublished: 1904 },
    form: ['A'],
    sections: [{ label: 'A', bars: '| I | % | I7 | % | IV | % | I | % | V7 | % | I | % |' }],
  },
]

/** 選單分組：形式練習在前——那才是「練」的東西，公版曲是拿來套用的 */
export interface ChartGroup {
  id: 'drill' | 'standard'
  titleKey: string
  charts: readonly Chart[]
}

export const CHART_GROUPS: readonly ChartGroup[] = [
  { id: 'drill', titleKey: 'jazzBook.group.drill', charts: DRILL_CHARTS },
  { id: 'standard', titleKey: 'jazzBook.group.standard', charts: STANDARD_CHARTS },
]

export const BUILT_IN_CHARTS: readonly Chart[] = [...DRILL_CHARTS, ...STANDARD_CHARTS]

export function findChart(id: string | undefined): Chart | undefined {
  return BUILT_IN_CHARTS.find((c) => c.id === id)
}
