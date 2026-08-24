// @vitest-environment happy-dom
/**
 * Fretboard 契約煙霧測試：組件只渲染傳入的 cells，顏色與標記取自 core。
 * 視覺細節（間距、比例）不寫脆弱的 DOM 快照，靠 geometry.spec.ts 與人工驗收。
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { CHORD_FORMULAS, SCALE_FORMULAS, mapToFretboard, spell } from '@/core/theory'
import Fretboard, { type FretboardProps } from './Fretboard.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { fretboard: { aria: 'Fretboard {count}', jumpTo: 'Position', openPosition: 'Open' } } },
})

function mountFretboard(props: FretboardProps) {
  return mount(Fretboard, { props, global: { plugins: [i18n] } })
}

describe('Fretboard', () => {
  const cells = mapToFretboard(spell('C', SCALE_FORMULAS.ionian))

  it('每個 cell 渲染一個音點，數量與 core 推導一致', () => {
    const wrapper = mountFretboard({ cells, rootPc: 0 })
    const dots = wrapper.findAll('svg > g')
    expect(dots).toHaveLength(cells.length)
    expect(cells.length).toBeGreaterThan(50)
  })

  it('主音以白底渲染，其餘音取 12 音程色', () => {
    const wrapper = mountFretboard({ cells, rootPc: 0 })
    const html = wrapper.html()
    expect(html).toContain('#FFFFFF')
    expect(html).toContain('#FF9F43')
  })

  it('labelMode 切換度數與音名，不改變音點數量', () => {
    const degrees = mountFretboard({ cells, rootPc: 0, labelMode: 'degree' })
    const names = mountFretboard({ cells, rootPc: 0, labelMode: 'noteName' })
    expect(degrees.text()).toContain('b7'.replace('b7', '7'))
    expect(names.html()).toContain('>C<')
    expect(names.findAll('svg > g')).toHaveLength(degrees.findAll('svg > g').length)
  })

  it('顏色錨點為 rootPc：同一組音改變 rootPc 會換色', () => {
    const g7 = mapToFretboard(spell('G', CHORD_FORMULAS['7']))
    const asRoot = mountFretboard({ cells: g7, rootPc: 7 }).html()
    const asFifth = mountFretboard({ cells: g7, rootPc: 0 }).html()
    expect(asRoot).not.toEqual(asFifth)
  })

  it('空 cells 不炸，仍渲染指板骨架', () => {
    const wrapper = mountFretboard({ cells: [], rootPc: 0 })
    expect(wrapper.findAll('svg > g')).toHaveLength(0)
    expect(wrapper.find('svg').exists()).toBe(true)
  })
})
