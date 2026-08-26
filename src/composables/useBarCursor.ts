/**
 * 練習中的「目前小節」游標——讓使用者能直接點一個和弦強制切換過去。
 *
 * 為什麼是位移而不是改時鐘：Transport 的小節數必須單調遞增（節拍不能因為換和弦而斷），
 * 所以跳轉一律記成一個**位移**，畫面與示範音看的都是
 *
 *     游標小節 = transport 小節 + offset
 *
 * 架構規則：視覺與發聲必須經同一個 barFor()。只改視覺會出現「畫面換了、聲音沒換」。
 * 因為示範音提前約一小節排程，點下去的那一刻已排好的和弦會響完當前小節，
 * 聲音在下一個小節線才跟上——這是排程的物理限制，不是可以修的延遲。
 *
 * 停止播放＝回到開頭（transport 的 position 也歸零），跳轉不跨過一次停止留下來。
 */
import { computed, ref, watch, type ComputedRef } from 'vue'
import { useTransportTick } from './useTransportTick'

export interface BarCursor {
  /** 目前該顯示的絕對小節（1-based）；未播放時停在第 1 小節加上位移 */
  bar: ComputedRef<number>
  /** transport 的原始小節 → 游標小節（示範音排程用） */
  barFor: (transportBar: number) => number
  /** 往後跳幾小節（負數＝往前）；時間軸上點第 n 格就是 jumpBy(n) */
  jumpBy: (bars: number) => void
  /** 跳到指定的絕對小節 */
  jumpTo: (bar: number) => void
  /** 回到不偏移的狀態（換 preset／換調時呼叫，否則會帶著上一個進行的跳轉） */
  reset: () => void
}

export function useBarCursor(): BarCursor {
  const { position, playing } = useTransportTick()
  const offset = ref(0)

  /** 未播放時畫面停在第 1 小節，與各練習畫面原本的行為一致 */
  const base = computed(() => (playing.value ? position.bar : 1))

  watch(playing, (value) => { if (!value) offset.value = 0 })

  return {
    bar: computed(() => base.value + offset.value),
    barFor: (transportBar) => transportBar + offset.value,
    jumpBy: (bars) => { offset.value += bars },
    jumpTo: (bar) => { offset.value = bar - base.value },
    reset: () => { offset.value = 0 },
  }
}
