// @vitest-environment happy-dom
/**
 * 設定的 schema 演進：**升版不能弄丟使用者調過的東西**。
 * 每次 SETTINGS_VERSION 往上跳都應該在這裡補一條「舊版資料還原得回來」的測試。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { DEFAULT_CHORD_VOLUME, useSettingsStore } from './settings'

const KEY = 'rcs.settings'

function seed(version: number, data: unknown): void {
  localStorage.setItem(KEY, JSON.stringify({ version, data }))
}

describe('settings store migration', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('v1 → v3：補上 voiceMuted 與和弦示範音，使用者調過的音量與模組設定原封不動', () => {
    seed(1, {
      locale: 'en',
      voiceVolumes: { accent: 0.3, normal: 0.2, ghost: 0.1 },
      moduleSettings: { 'scales.explorer': { root: 'F#' } },
    })
    const settings = useSettingsStore()
    expect(settings.state.locale).toBe('en')
    expect(settings.state.voiceVolumes.accent).toBe(0.3)
    expect(settings.state.moduleSettings['scales.explorer']).toEqual({ root: 'F#' })
    expect(settings.state.voiceMuted).toEqual({ accent: false, normal: false, ghost: false })
    expect(settings.state.chordDemo).toBe('off')
    expect(settings.state.chordVolume).toBe(DEFAULT_CHORD_VOLUME)
  })

  it('v2 → v3：只補和弦示範音欄位', () => {
    seed(2, {
      locale: 'zh-TW',
      voiceVolumes: { accent: 1, normal: 0.8, ghost: 0.5 },
      voiceMuted: { accent: false, normal: true, ghost: false },
      moduleSettings: {},
    })
    const settings = useSettingsStore()
    expect(settings.state.voiceMuted.normal).toBe(true)
    expect(settings.state.chordDemo).toBe('off')
  })

  it('示範音預設 off：升級舊使用者不會突然多出聲音', () => {
    const settings = useSettingsStore()
    expect(settings.state.chordDemo).toBe('off')
  })

  it('被竄改的示範音設定回退到 off（寧可沒聲音也不要壞掉的狀態）', () => {
    seed(3, {
      locale: 'zh-TW',
      voiceVolumes: { accent: 1, normal: 0.8, ghost: 0.5 },
      voiceMuted: { accent: false, normal: false, ghost: false },
      chordDemo: 'JAZZ_MODE',
      chordVolume: 'loud',
      moduleSettings: {},
    })
    const settings = useSettingsStore()
    expect(settings.state.chordDemo).toBe('off')
    expect(settings.state.chordVolume).toBe(DEFAULT_CHORD_VOLUME)
  })
})
