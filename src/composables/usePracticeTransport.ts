/**
 * 練習模組的 Transport 接線（每個練習都有 click，這是共用流程）：
 * 1. 進入練習時把該模組持久化的 BPM／拍號／細分推進 Transport
 * 2. 使用者在 TransportBar 上的調整回寫模組設定
 * 3. 離開練習自動停止播放（避免帶著上一個練習的設定繼續響）
 *
 * 損毀或過期的持久化值由 resolveTimeSignature / isTicksPerBeat 回退為預設。
 */
import { onMounted, onUnmounted, watch } from 'vue'
import {
  DEFAULT_TIME_SIGNATURE_KEY, isTicksPerBeat, resolveTimeSignature, timeSignatureKey,
  type TicksPerBeat, type TimeSignatureKey,
} from '@/core/audio'
import { useTransportStore } from '@/stores/transport'

/** 每個練習模組的設定都應包含這三個 click 欄位 */
export interface PracticeTransportSettings extends Record<string, unknown> {
  bpm: number
  timeSig: TimeSignatureKey
  ticksPerBeat: TicksPerBeat
}

export function usePracticeTransport(state: PracticeTransportSettings): void {
  const transport = useTransportStore()

  onMounted(() => {
    if (!isTicksPerBeat(state.ticksPerBeat)) state.ticksPerBeat = 1
    state.timeSig = timeSignatureKey(resolveTimeSignature(state.timeSig))
    transport.setBpm(state.bpm)
    transport.setTimeSignature(resolveTimeSignature(state.timeSig))
    transport.setTicksPerBeat(state.ticksPerBeat)
  })

  watch(() => transport.bpm, (value) => { state.bpm = value })
  watch(() => transport.ticksPerBeat, (value) => { state.ticksPerBeat = value })
  watch(
    () => transport.timeSig,
    (value) => { state.timeSig = value ? timeSignatureKey(value) : DEFAULT_TIME_SIGNATURE_KEY },
    { deep: true },
  )

  onUnmounted(() => transport.stop())
}
