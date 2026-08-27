// @vitest-environment happy-dom
/**
 * TempoControl 行為鎖定。
 *
 * 重點在**草稿模式**：數字輸入若即時寫入，打「105」的過程會經過 1 與 10，
 * 速度會先掉到下限再彈回來——播放中聽得一清二楚。這是聽得見的回歸，所以要鎖住。
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { BPM_MAX, BPM_MIN } from '@/core/audio'
import TempoControl from './TempoControl.vue'
import en from '@/locales/en.json'

// 用真的語系檔：少一個 key 會在這裡就爆，不必等到畫面上看到 raw key
const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

function mountControl(props: { bpm?: number; taps?: number } = {}) {
  return mount(TempoControl, {
    props: { bpm: 120, taps: 0, ...props },
    global: { plugins: [i18n] },
  })
}

const readout = 'input.rcs-tempo'
const tapButton = 'button[title]'

describe('TempoControl', () => {
  it('讀數顯示目前的 BPM', () => {
    expect(mountControl({ bpm: 84 }).find<HTMLInputElement>(readout).element.value).toBe('84')
  })

  it('± 各送出 1 BPM 的步進——練習真正的解析度', async () => {
    const wrapper = mountControl({ bpm: 120 })
    const [minus, plus] = wrapper.findAll('button.rcs-step')
    await minus!.trigger('click')
    await plus!.trigger('click')
    expect(wrapper.emitted('update:bpm')).toEqual([[119], [121]])
  })

  it('到達上下限時停用對應的步進鈕', () => {
    const [minAtFloor] = mountControl({ bpm: BPM_MIN }).findAll('button.rcs-step')
    expect(minAtFloor!.attributes('disabled')).toBeDefined()

    const atCeiling = mountControl({ bpm: BPM_MAX }).findAll('button.rcs-step')
    expect(atCeiling[1]!.attributes('disabled')).toBeDefined()
  })

  it('打字過程不提交：輸入 1 → 10 → 105 只在最後送出一次', async () => {
    const wrapper = mountControl({ bpm: 120 })
    const input = wrapper.find<HTMLInputElement>(readout)
    await input.trigger('focus')
    for (const value of ['1', '10', '105']) {
      input.element.value = value
      await input.trigger('input')
    }
    expect(wrapper.emitted('update:bpm')).toBeUndefined()

    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:bpm')).toEqual([[105]])
  })

  it('blur 也提交（點到畫面別處就是輸入完了）', async () => {
    const wrapper = mountControl({ bpm: 120 })
    const input = wrapper.find<HTMLInputElement>(readout)
    await input.trigger('focus')
    input.element.value = '84'
    await input.trigger('input')
    await input.trigger('blur')
    expect(wrapper.emitted('update:bpm')).toEqual([[84]])
  })

  it('Esc 放棄草稿，讀數回到原本的 BPM', async () => {
    const wrapper = mountControl({ bpm: 120 })
    const input = wrapper.find<HTMLInputElement>(readout)
    await input.trigger('focus')
    input.element.value = '200'
    await input.trigger('input')
    await input.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('update:bpm')).toBeUndefined()
    expect(wrapper.find<HTMLInputElement>(readout).element.value).toBe('120')
  })

  it('清空欄位後 blur 不提交——空字串不是「0」，放棄比夾到下限誠實', async () => {
    const wrapper = mountControl({ bpm: 120 })
    const input = wrapper.find<HTMLInputElement>(readout)
    await input.trigger('focus')
    input.element.value = ''
    await input.trigger('input')
    await input.trigger('blur')
    expect(wrapper.emitted('update:bpm')).toBeUndefined()
  })

  it('TAP 鈕送出 tap 事件', async () => {
    const wrapper = mountControl()
    await wrapper.find(tapButton).trigger('click')
    expect(wrapper.emitted('tap')).toHaveLength(1)
  })

  it('TAP 標籤：沒在測量顯示 TAP，敲不夠顯示還差幾下，夠了顯示敲擊數', () => {
    expect(mountControl({ taps: 0 }).find(tapButton).text()).toBe('TAP')
    expect(mountControl({ taps: 1 }).find(tapButton).text()).toBe('1 more')
    expect(mountControl({ taps: 4 }).find(tapButton).text()).toBe('TAP · 4')
  })

  it('測量中的 TAP 鈕反白（選取即反白）', () => {
    expect(mountControl({ taps: 0 }).find(tapButton).classes()).toContain('bg-ink-800')
    expect(mountControl({ taps: 3 }).find(tapButton).classes()).toContain('bg-ink-50')
  })
})
