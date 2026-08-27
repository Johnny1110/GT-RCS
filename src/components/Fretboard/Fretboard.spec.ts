// @vitest-environment happy-dom
/**
 * Fretboard 契約煙霧測試：組件只渲染傳入的 cells，顏色與標記取自 core。
 * 視覺細節（間距、比例）不寫脆弱的 DOM 快照，靠 geometry.spec.ts 與人工驗收。
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { CHORD_FORMULAS, SCALE_FORMULAS, chordPositions, mapToFretboard, scalePositions, spell } from '@/core/theory'
import Fretboard, { type FretboardProps } from './Fretboard.vue'
import en from '@/locales/en.json'

// 用真的語系檔而不是假訊息：少一個 key 會在這裡就爆，不必等到畫面上看到 raw key
const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

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

  /** design-system.md §5：金色只給指位記號圓點，其餘一律灰階 */
  it('指位記號用金色 token，格數與把位標籤維持灰階', () => {
    const wrapper = mountFretboard({ cells, rootPc: 0 })
    const inlays = wrapper.findAll('svg > circle')
    expect(inlays.length).toBeGreaterThan(0)
    for (const inlay of inlays) expect(inlay.attributes('fill')).toBe('var(--color-inlay)')
    for (const label of wrapper.findAll('svg > text')) {
      expect(label.attributes('fill')).toMatch(/var\(--color-ink-\d+\)/)
    }
  })

  it('空 cells 不炸，仍渲染指板骨架', () => {
    const wrapper = mountFretboard({ cells: [], rootPc: 0 })
    expect(wrapper.findAll('svg > g')).toHaveLength(0)
    expect(wrapper.find('svg').exists()).toBe(true)
  })
})

describe('Fretboard 把位框', () => {
  const cMaj7 = mapToFretboard(spell('C', CHORD_FORMULAS.maj7))
  const positions = chordPositions(0)

  it('不給 positions 時完全不畫框，音點全亮（音階線維持原樣）', () => {
    const wrapper = mountFretboard({ cells: cMaj7, rootPc: 0 })
    expect(wrapper.findAll('svg > rect')).toHaveLength(0)
    expect(wrapper.findAll('svg > g[opacity="1"]')).toHaveLength(cMaj7.length)
  })

  it('每個把位畫一個框，且框是灰階的（節奏與結構不用音程色）', () => {
    const wrapper = mountFretboard({ cells: cMaj7, rootPc: 0, positions })
    const rects = wrapper.findAll('svg > rect')
    expect(rects).toHaveLength(positions.length)
    for (const rect of rects) {
      expect(rect.attributes('stroke')).toMatch(/var\(--color-ink-\d+\)/)
    }
  })

  it('框外的音點淡出但仍然渲染（框是分組，不是過濾）', () => {
    const wrapper = mountFretboard({ cells: cMaj7, rootPc: 0, positions })
    const dots = wrapper.findAll('svg > g')
    expect(dots).toHaveLength(cMaj7.length)
    const dimmed = dots.filter((d) => Number(d.attributes('opacity')) < 1)
    expect(dimmed.length).toBeGreaterThan(0)
    expect(dimmed.length).toBeLessThan(dots.length)
  })

  it('聚焦某把位：只有該把位的音點全亮，其餘一律淡出', () => {
    const focus = positions[1]!
    const wrapper = mountFretboard({ cells: cMaj7, rootPc: 0, positions, focusedPositionId: focus.id })
    const inside = cMaj7.filter((c) => c.fret >= focus.fromFret && c.fret <= focus.toFret).length
    expect(wrapper.findAll('svg > g[opacity="1"]')).toHaveLength(inside)
    expect(inside).toBeGreaterThan(0)
  })

  it('把位標籤：開放把位標「Open」，其餘標錨定格號', () => {
    const wrapper = mountFretboard({ cells: cMaj7, rootPc: 0, positions })
    const labels = wrapper.findAll('svg > text.pointer-events-none').map((n) => n.text())
    expect(labels[0]).toBe('Open') // C 的最低把位錨在 5 弦第 3 格 → 含空弦
    expect(labels.slice(1)).toEqual(['8', '15', '20'])
  })

  it('選單列出全部把位；點選發出 update:focusedPositionId，再點一次取消', async () => {
    const wrapper = mountFretboard({ cells: cMaj7, rootPc: 0, positions })
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(positions.length + 1) // 「全部」+ 每個把位
    await buttons[2]!.trigger('click')
    expect(wrapper.emitted('update:focusedPositionId')?.[0]).toEqual([positions[1]!.id])

    const focused = mountFretboard({ cells: cMaj7, rootPc: 0, positions, focusedPositionId: positions[1]!.id })
    await focused.findAll('button')[2]!.trigger('click')
    expect(focused.emitted('update:focusedPositionId')?.[0]).toEqual([null])
  })

  it('點框本身等同點選單（直接操作也要能切換把位）', async () => {
    const wrapper = mountFretboard({ cells: cMaj7, rootPc: 0, positions })
    await wrapper.findAll('svg > rect')[0]!.trigger('click')
    expect(wrapper.emitted('update:focusedPositionId')?.[0]).toEqual([positions[0]!.id])
  })
})

describe('Fretboard 音階把位（focus 模式）', () => {
  const aMinorPenta = mapToFretboard(spell('A', SCALE_FORMULAS.minorPentatonic))
  const positions = scalePositions('A', 'minorPentatonic')
  const base = { cells: aMinorPenta, rootPc: 9, positions, positionMode: 'focus' } as const

  it('沒選把位時不畫框、音點全亮（框是輔助，不是濾鏡）', () => {
    const wrapper = mountFretboard({ ...base })
    expect(wrapper.findAll('svg > rect')).toHaveLength(0)
    expect(wrapper.findAll('svg > g[opacity="1"]')).toHaveLength(aMinorPenta.length)
  })

  it('選了把位只畫那一個框——音階把位彼此重疊，全畫會糊成一團', () => {
    const focus = positions.find((p) => p.anchorDegree === '1')!
    const wrapper = mountFretboard({ ...base, focusedPositionId: focus.id })
    const rects = wrapper.findAll('svg > rect')
    expect(rects).toHaveLength(1)
    expect(rects[0]!.attributes('stroke')).toMatch(/var\(--color-ink-\d+\)/)
    const inside = aMinorPenta.filter((c) => c.fret >= focus.fromFret && c.fret <= focus.toFret)
    expect(wrapper.findAll('svg > g[opacity="1"]')).toHaveLength(inside.length)
  })

  it('標籤是錨定音的度數，不是格號（\'1\' 的框就是根音起的盒型）', () => {
    const wrapper = mountFretboard({ ...base })
    const labels = wrapper.findAll('button').slice(1).map((b) => b.text())
    expect(labels).toEqual(['5', 'b7', '1', 'b3', '4'])
    const focused = mountFretboard({ ...base, focusedPositionId: positions[2]!.id })
    expect(focused.findAll('svg > text.pointer-events-none').map((n) => n.text())).toEqual(['1'])
  })

  it('選單仍列出全部把位（框只畫一個，但每個把位都選得到）', () => {
    const wrapper = mountFretboard({ ...base })
    expect(wrapper.findAll('button')).toHaveLength(positions.length + 1)
  })

  /** 音階模進：沒有指型就沒有順序，所以「全部」不是一個合法狀態 */
  it('requireFocus：不提供「全部」，再點一次已選的把位也不取消', async () => {
    const focus = positions[2]!
    const wrapper = mountFretboard({ ...base, focusedPositionId: focus.id, requireFocus: true })
    expect(wrapper.findAll('button')).toHaveLength(positions.length)

    await wrapper.findAll('button')[2]!.trigger('click')
    expect(wrapper.emitted('update:focusedPositionId')?.[0]).toEqual([focus.id])
  })
})
