/**
 * 和弦聲位（voicing）：把「一組音名」變成「一組實際音高」（MIDI 音高數）。
 *
 * 為什麼需要這一層：`spell()` 給的是 pitch class（C、E、G），沒有八度資訊；
 * 要發聲就得決定「這個 C 是哪一個 C」。決定哪個八度、哪個轉位是**樂理**，
 * 所以放在 core/theory；怎麼發出聲音是 core/audio 的事。
 *
 * 兩條規則（PRD F5-1 §3）：
 * 1. **中音域 close voicing**：取捨時根音 3 音 7 音優先（五音最不帶顏色，先丟），
 *    疊成一個八度內的密集聲位，落在 click 頻段以下的中音域。
 * 2. **聲部連接就近移動**：給了前一個和弦的聲位，就在所有轉位中挑「總移動距離最小」的
 *    那一個——這是自動 voice leading，聽起來才像有人在彈，而不是每個和弦都跳回原位。
 *
 * 純函式：不知道 AudioContext、不知道時間。
 */
import { mod12, parseDegree } from './intervals'
import type { Note } from './types'

/** 聲位的音域中心：MIDI 60 = C4。比 click（1kHz 以上）低，不搶拍點的頻段 */
export const VOICING_CENTER = 60
/** 複音數上限：行動裝置效能（PRD F5-1 §4） */
export const MAX_VOICES = 6
const DEFAULT_VOICES = 4
/** 最低聲部落在中心下方幾個半音——讓整個聲位的重心壓在 center 附近 */
const BOTTOM_OFFSET = 5

/**
 * 取捨優先序（度數的數字部分）：根音 → 三音／四音 → 七音 → 最高延伸音 → 其餘延伸音 → **五音**。
 *
 * 兩個刻意的排序：
 * - **五音排在最後**：C13 只給四個聲部時該彈 1-3-b7-13，不是 1-3-5-b7。
 *   五音幾乎不帶顏色，延伸音卻正是這個和弦之所以叫 13 的原因。
 * - **13 排在 9 之前**：命名和弦的是最高的那個延伸音，它被丟掉和弦就不是那個和弦了。
 * 四音（sus4）與三音同級：它是和弦的身分，不是裝飾。
 */
const DEGREE_PRIORITY: Readonly<Record<number, number>> = {
  1: 0, 3: 1, 4: 1, 7: 2, 13: 3, 11: 4, 9: 5, 6: 5, 2: 5, 5: 6,
}

export interface VoicingOptions {
  /** 音域中心（MIDI）；預設 C4 */
  center?: number
  /** 最多幾個聲部（2–6）；預設 4 */
  maxVoices?: number
  /** 前一個和弦的聲位。給了就挑移動距離最小的轉位（聲部連接） */
  previous?: readonly number[]
}

/** 依優先序取捨聲部，但保留公式原本的由低到高順序（close voicing 要照度數疊） */
function selectTones(tones: readonly Note[], maxVoices: number): Note[] {
  if (tones.length <= maxVoices) return [...tones]
  const ranked = tones
    .map((note, index) => ({ note, index, rank: DEGREE_PRIORITY[parseDegree(note.degree).number] ?? 9 }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, maxVoices)
  return ranked.sort((a, b) => a.index - b.index).map((entry) => entry.note)
}

/** 與 target 同 pitch class 的最近音高（同距離時取低的，聲位偏向不往上飄） */
function nearestPitch(target: number, pc: number): number {
  const below = target - mod12(target - pc)
  return target - below <= 6 ? below : below + 12
}

/** 由低到高疊成密集聲位：每個音都放在前一個音之上的最近位置 */
function closeVoicing(pcs: readonly number[], center: number): number[] {
  const first = pcs[0]
  if (first === undefined) return []
  const voices = [nearestPitch(center - BOTTOM_OFFSET, first)]
  for (let i = 1; i < pcs.length; i++) {
    const previous = voices[i - 1]!
    let pitch = previous + 1
    while (mod12(pitch) !== pcs[i]) pitch++
    voices.push(pitch)
  }
  return voices
}

/** 所有轉位（把最低音換成第 k 個和弦音） */
function rotations<T>(items: readonly T[]): T[][] {
  return items.map((_, k) => [...items.slice(k), ...items.slice(0, k)])
}

/**
 * 聲部移動量：每個新聲部到最近的舊聲部的距離總和。
 * 加一點「離中心太遠」的懲罰，否則同分時聲位會慢慢往一個方向飄走。
 */
function movement(candidate: readonly number[], previous: readonly number[]): number {
  let total = 0
  for (const pitch of candidate) {
    let nearest = Infinity
    for (const old of previous) nearest = Math.min(nearest, Math.abs(pitch - old))
    total += nearest
  }
  const centroid = candidate.reduce((sum, p) => sum + p, 0) / candidate.length
  return total + Math.abs(centroid - VOICING_CENTER) * 0.1
}

/**
 * 把和弦內音排成可發聲的音高。
 * 沒有 previous 時回傳原位（根音在最低）；有 previous 時挑最近的轉位。
 */
export function voiceChord(tones: readonly Note[], options: VoicingOptions = {}): number[] {
  const { center = VOICING_CENTER, previous } = options
  const maxVoices = Math.min(MAX_VOICES, Math.max(2, Math.round(options.maxVoices ?? DEFAULT_VOICES)))
  const chosen = selectTones(tones, maxVoices)
  if (chosen.length === 0) return []

  const pcs = chosen.map((note) => note.pc)
  const rootPosition = closeVoicing(pcs, center)
  if (!previous || previous.length === 0) return rootPosition

  let best = rootPosition
  let bestScore = movement(rootPosition, previous)
  for (const rotated of rotations(pcs).slice(1)) {
    const candidate = closeVoicing(rotated, center)
    const score = movement(candidate, previous)
    if (score < bestScore) {
      best = candidate
      bestScore = score
    }
  }
  return best
}

/** MIDI 音高 → 頻率（A4 = MIDI 69 = 440Hz）。發聲端需要，但這是定義不是音訊實作 */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}
