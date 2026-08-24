/**
 * Transport store：core Transport 的 UI façade（全站單例、一顆時鐘）。
 *
 * 架構規則：
 * - AudioContext 只在此建立，且必須在第一次使用者手勢（play）時 lazy 建立
 *   （iOS/Safari 自動播放限制，PRD F1-3）。
 * - 練習模組一律用本 store 控制播放；禁止自行 new Transport / AudioContext。
 * - **TickBus 是單一消費者佇列**：唯一的 rAF 迴圈由本 store 持有，
 *   drain 後更新 position 並廣播給訂閱者。組件不得自行 drain，
 *   一律經 useTransportTick()（多個組件各自 drain 會互相搶走事件）。
 */
import { defineStore } from 'pinia'
import { computed, reactive, readonly, ref, shallowRef, watch } from 'vue'
import {
  LookaheadScheduler, SOUNDING_ROLES, SWING_STRAIGHT, SynthClickVoice, TickBus, Transport, WebAudioClock,
  clampSwing, isTicksPerBeat,
  type CellRole, type ClickVoice, type DemoSilenceMode, type RhythmPattern, type SoundingRole,
  type TickEvent, type TicksPerBeat, type TimeSignature,
} from '@/core/audio'
import { useSettingsStore } from './settings'

export interface PlaybackPosition {
  bar: number
  beat: number
  tick: number
  role: CellRole | null
}

export const useTransportStore = defineStore('transport', () => {
  const settings = useSettingsStore()

  let transport: Transport | null = null
  let audioCtx: AudioContext | null = null
  let voice: ClickVoice | null = null
  let rafId = 0

  const tickBus = new TickBus()
  const subscribers = new Set<(e: TickEvent) => void>()

  const playing = ref(false)
  const bpm = ref(90)
  const timeSig = ref<TimeSignature>({ beats: 4, unit: 4 })
  const ticksPerBeat = ref<TicksPerBeat>(1)
  const swing = ref(SWING_STRAIGHT)
  // shallowRef：pattern 是不可變的資料快照，換 pattern 一律換整顆物件，不做深度追蹤
  const pattern = shallowRef<RhythmPattern | null>(null)
  const demoSilence = shallowRef<DemoSilenceMode | null>(null)
  const position = reactive<PlaybackPosition>({ bar: 0, beat: 0, tick: 0, role: null })

  /** 掛著節奏 pattern 時，拍號與細分由 pattern 決定，UI 不再讓使用者直接改 */
  const patternDriven = computed(() => pattern.value !== null)

  function applyVoiceSettings(): void {
    if (!voice) return
    for (const role of SOUNDING_ROLES) {
      voice.setVolume(role, settings.state.voiceVolumes[role])
      voice.setMuted(role, settings.state.voiceMuted[role])
    }
  }

  watch(
    () => [settings.state.voiceVolumes, settings.state.voiceMuted],
    applyVoiceSettings,
    { deep: true },
  )

  function ensureTransport(): Transport {
    if (transport) return transport
    audioCtx = new AudioContext()
    const clock = new WebAudioClock(audioCtx)
    const created = new Transport(clock, new LookaheadScheduler(clock))
    transport = created
    voice = new SynthClickVoice(audioCtx)
    applyVoiceSettings()
    created.addTickListener((e: TickEvent) => {
      if (e.role !== 'rest') voice?.trigger(e.role, e.audioTime)
    })
    created.addTickListener(tickBus.push)
    // Transport 是第一次 play 才建立的（iOS 自動播放限制），因此要把
    // 使用者在那之前調過的設定整份補推進去，而不是只推 play() 當下那幾項
    created.setBpm(bpm.value)
    created.setPattern(pattern.value)
    if (!patternDriven.value) {
      created.setTimeSignature(timeSig.value)
      created.setTicksPerBeat(ticksPerBeat.value)
    }
    created.setSwing(swing.value)
    created.setDemoSilence(demoSilence.value)
    return created
  }

  /** 唯一的視覺迴圈：只消費 audioTime 已到的 tick，視覺永不超前聲音 */
  function startVisualLoop(): void {
    if (rafId !== 0) return
    const loop = (): void => {
      if (audioCtx) {
        for (const e of tickBus.drainUpTo(audioCtx.currentTime)) {
          position.bar = e.bar
          position.beat = e.beat
          position.tick = e.tick
          position.role = e.role
          for (const fn of subscribers) fn(e)
        }
      }
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
  }

  function stopVisualLoop(): void {
    if (rafId !== 0) cancelAnimationFrame(rafId)
    rafId = 0
  }

  async function play(): Promise<void> {
    const t = ensureTransport()
    if (audioCtx && audioCtx.state !== 'running') await audioCtx.resume()
    tickBus.clear()
    t.play()
    playing.value = true
    startVisualLoop()
  }

  function stop(): void {
    transport?.stop()
    tickBus.clear()
    stopVisualLoop()
    playing.value = false
    position.bar = 0
    position.beat = 0
    position.tick = 0
    position.role = null
  }

  function toggle(): void {
    if (playing.value) stop()
    else void play()
  }

  function setBpm(value: number): void {
    if (!Number.isFinite(value)) return
    bpm.value = Math.round(value)
    transport?.setBpm(value)
    // core 會夾在 30–300，回讀確保 UI 與實際排程一致
    const state = transport?.getState()
    if (state) bpm.value = state.bpm
  }

  /**
   * 拍號與細分：播放中改由 core 排到下一個小節線生效（不會留殘拍），
   * 因此 UI 不再 disable。掛著 pattern 時則由 pattern 作主，這裡直接擋掉。
   */
  function setTimeSignature(sig: TimeSignature): void {
    if (patternDriven.value) return
    timeSig.value = { ...sig }
    transport?.setTimeSignature(sig)
  }

  function setTicksPerBeat(value: unknown): void {
    if (patternDriven.value || !isTicksPerBeat(value)) return
    ticksPerBeat.value = value
    transport?.setTicksPerBeat(value)
  }

  /**
   * 掛上節奏 pattern（PRD F4-1）：拍號與細分隨之改由 pattern 決定。
   * 播放中換 pattern 由 core 對齊小節線 —— 編輯模式改格會在下一小節聽見。
   */
  function setPattern(value: RhythmPattern | null): void {
    pattern.value = value
    if (value) {
      timeSig.value = { ...value.timeSig }
      ticksPerBeat.value = value.ticksPerBeat
    }
    transport?.setPattern(value)
  }

  function setSwing(percent: number): void {
    swing.value = clampSwing(percent)
    transport?.setSwing(swing.value)
  }

  function setDemoSilence(mode: DemoSilenceMode | null): void {
    demoSilence.value = mode ? { ...mode } : null
    transport?.setDemoSilence(demoSilence.value)
  }

  function setVoiceVolume(role: SoundingRole, volume: number): void {
    settings.state.voiceVolumes[role] = Math.min(1, Math.max(0, volume))
  }

  function toggleVoiceMute(role: SoundingRole): void {
    settings.state.voiceMuted[role] = !settings.state.voiceMuted[role]
  }

  /** 訂閱已到時的 tick；回傳取消訂閱函式。組件請用 useTransportTick() 自動管理生命週期。 */
  function subscribeTick(fn: (e: TickEvent) => void): () => void {
    subscribers.add(fn)
    return () => subscribers.delete(fn)
  }

  return {
    playing: readonly(playing),
    bpm: readonly(bpm),
    timeSig: readonly(timeSig),
    ticksPerBeat: readonly(ticksPerBeat),
    swing: readonly(swing),
    patternDriven,
    position: readonly(position),
    voiceVolumes: settings.state.voiceVolumes,
    voiceMuted: settings.state.voiceMuted,
    play, stop, toggle,
    setBpm, setTimeSignature, setTicksPerBeat,
    setPattern, setSwing, setDemoSilence,
    setVoiceVolume, toggleVoiceMute,
    subscribeTick,
  }
})
