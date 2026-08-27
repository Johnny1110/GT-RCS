/**
 * 敲擊測速的 Vue 接線（core TapTempo ↔ transport store）。
 *
 * 分工：算術在 core（純函式、可窮舉測試），這一層只做三件 Vue 才做得到的事——
 * 取得時間戳、把結果寫進 store、在停手之後把畫面上的計數收乾淨。
 *
 * **時間來源用 performance.now()**：它是單調遞增的，不受系統校時與時區影響
 * （Date.now() 兩者都會受影響，一次 NTP 校正就能讓間隔變成負的）。
 * 這不違反「時間一律經 IClock」——那條規則管的是排程，敲擊測速不參與排程，
 * 不會讓 click 飄拍；理由詳見 core/audio/tapTempo.ts 的契約註解。
 *
 * **停手之後要清掉計數**：畫面上留著「3 下」而使用者早就不敲了，
 * 下一次來敲的人會以為自己接在別人的測量後面。清掉的時機與 core 的
 * 重新起算門檻是同一個常數，畫面與演算法才不會各說各話。
 */
import { onUnmounted, ref, type Ref } from 'vue'
import { TAP_TIMEOUT_SECONDS, TapTempo } from '@/core/audio'
import { useTransportStore } from '@/stores/transport'

export interface UseTapTempo {
  /** 本次測量已敲幾下；0 = 沒有正在進行的測量 */
  taps: Ref<number>
  /** 記一次敲擊，算得出 BPM 就直接套用 */
  tap: () => void
}

export function useTapTempo(): UseTapTempo {
  const transport = useTransportStore()
  const tempo = new TapTempo()
  const taps = ref(0)
  let idleTimer = 0

  function clearIdleTimer(): void {
    if (idleTimer) window.clearTimeout(idleTimer)
    idleTimer = 0
  }

  function tap(): void {
    const result = tempo.tap(performance.now() / 1000)
    taps.value = result.taps
    if (result.bpm !== null) transport.setBpm(result.bpm)

    clearIdleTimer()
    idleTimer = window.setTimeout(() => {
      tempo.reset()
      taps.value = 0
    }, TAP_TIMEOUT_SECONDS * 1000)
  }

  onUnmounted(clearIdleTimer)

  return { taps, tap }
}
