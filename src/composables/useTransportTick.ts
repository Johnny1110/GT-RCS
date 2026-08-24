/**
 * 節拍視覺同步的唯一入口（PRD F1-3）。
 *
 * Transport 提前約 100ms 排程 tick；本 composable 讀取的 position 由 store 的
 * rAF 迴圈在「tick 的 audioTime 實際到達」時才更新 —— 視覺永不超前聲音。
 *
 * 架構規則：組件禁止自行 setInterval/rAF 驅動節拍視覺，一律用本 composable。
 *
 * 回傳值的形態是契約的一部分：
 * - position 是 reactive 物件，解構物件本身安全（屬性存取仍受追蹤）
 * - playing 必須是 computed ref —— 直接回傳 store 的布林值會在呼叫端解構時
 *   變成當下的靜態值，視覺永遠停在停止狀態（已被 useTransportTick.spec.ts 鎖定）
 */
import { computed, onUnmounted, type ComputedRef } from 'vue'
import type { TickEvent } from '@/core/audio'
import { useTransportStore, type PlaybackPosition } from '@/stores/transport'

export interface TransportTick {
  position: Readonly<PlaybackPosition>
  playing: ComputedRef<boolean>
}

export function useTransportTick(handler?: (e: TickEvent) => void): TransportTick {
  const transport = useTransportStore()
  if (handler) onUnmounted(transport.subscribeTick(handler))
  return {
    position: transport.position,
    playing: computed(() => transport.playing),
  }
}
