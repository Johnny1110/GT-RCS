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
import { reactive, readonly, ref, watch } from 'vue'
import {
  LookaheadScheduler, SOUNDING_ROLES, SynthClickVoice, TickBus, Transport, WebAudioClock,
  isTicksPerBeat,
  type CellRole, type ClickVoice, type SoundingRole, type TickEvent, type TicksPerBeat, type TimeSignature,
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
  const position = reactive<PlaybackPosition>({ bar: 0, beat: 0, tick: 0, role: null })

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
    transport = new Transport(clock, new LookaheadScheduler(clock))
    voice = new SynthClickVoice(audioCtx)
    applyVoiceSettings()
    transport.addTickListener((e: TickEvent) => {
      if (e.role !== 'rest') voice?.trigger(e.role, e.audioTime)
    })
    transport.addTickListener(tickBus.push)
    return transport
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
    t.setBpm(bpm.value)
    t.setTimeSignature(timeSig.value)
    t.setTicksPerBeat(ticksPerBeat.value)
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

  /** 拍號與細分僅停止中可切換（core Transport 契約），UI 需同步 disable */
  function setTimeSignature(sig: TimeSignature): void {
    if (playing.value) return
    timeSig.value = { ...sig }
    transport?.setTimeSignature(sig)
  }

  function setTicksPerBeat(value: unknown): void {
    if (playing.value || !isTicksPerBeat(value)) return
    ticksPerBeat.value = value
    transport?.setTicksPerBeat(value)
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
    position: readonly(position),
    voiceVolumes: settings.state.voiceVolumes,
    voiceMuted: settings.state.voiceMuted,
    play, stop, toggle,
    setBpm, setTimeSignature, setTicksPerBeat,
    setVoiceVolume, toggleVoiceMute,
    subscribeTick,
  }
})
