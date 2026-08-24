// @vitest-environment happy-dom
/**
 * RhythmSheet 契約測試：格數、計數列、游標定位、編輯循環。
 * 視覺細節（格寬、gap）不寫脆弱的 DOM 快照，靠 design-system 與瀏覽器驗收。
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import type { CellRole, TicksPerBeat, TimeSignature } from '@/core/audio'
import RhythmSheet from './RhythmSheet.vue'
import zhTW from '@/locales/zh-TW.json'
import en from '@/locales/en.json'

const FOUR_FOUR: TimeSignature = { beats: 4, unit: 4 }

type SheetProps = InstanceType<typeof RhythmSheet>['$props']

function mountSheet(props: Partial<SheetProps> & { bars: CellRole[][] }, locale = 'en') {
  const i18n = createI18n({ legacy: false, locale, fallbackLocale: 'en', messages: { 'zh-TW': zhTW, en } })
  return mount(RhythmSheet, {
    props: { timeSig: FOUR_FOUR, ticksPerBeat: 4 as TicksPerBeat, ...props },
    global: { plugins: [i18n] },
  })
}

/** DOMWrapper 每次查詢都是新物件，比對要走 element 或屬性，不能用 indexOf */
function cursorIndex(wrapper: ReturnType<typeof mountSheet>): number {
  return wrapper.findAll('button').findIndex((b) => b.attributes('data-cursor') === 'true')
}

const bar16 = (): CellRole[] => [
  'accent', 'rest', 'ghost', 'rest', 'normal', 'rest', 'ghost', 'ghost',
  'accent', 'rest', 'ghost', 'rest', 'normal', 'ghost', 'rest', 'ghost',
]

describe('RhythmSheet', () => {
  it('每小節渲染 拍數 × 細分 個格子', () => {
    const wrapper = mountSheet({ bars: [bar16(), bar16()] })
    expect(wrapper.findAll('button')).toHaveLength(32)
  })

  it('缺少的格子補成休止，不會少畫格（損毀資料仍畫得出譜）', () => {
    const wrapper = mountSheet({ bars: [['accent', 'normal']], ticksPerBeat: 1 })
    expect(wrapper.findAll('button')).toHaveLength(4)
  })

  it('計數列：16 分為 1 e & a，拍首印拍數', () => {
    const labels = mountSheet({ bars: [bar16()] })
      .findAll('button')
      .map((b) => b.findAll('span').at(-1)?.text())
    expect(labels.slice(0, 8)).toEqual(['1', 'e', '&', 'a', '2', 'e', '&', 'a'])
  })

  it('中文口訣計數法把拍首念成「答」', () => {
    const labels = mountSheet({ bars: [bar16()], countStyle: 'mnemonic' }, 'zh-TW')
      .findAll('button')
      .map((b) => b.findAll('span').at(-1)?.text())
    expect(labels.slice(0, 4)).toEqual(['答', '的', '嗒', '的'])
  })

  it('各角色以不同灰階渲染，且完全不使用音程色（節奏無音高）', () => {
    const html = mountSheet({ bars: [bar16()] }).html()
    expect(html).toContain('bg-ink-50')    // accent
    expect(html).toContain('bg-ink-500')   // normal
    expect(html).toContain('border-dashed') // ghost
    expect(html).toContain('bg-ink-950')   // rest（比面板 ink-900 更暗，才看得出是「不出聲的格」）
    expect(html).not.toMatch(/#[0-9A-Fa-f]{6}/)
  })

  it('游標只在播放中出現，且落在 activeBar 對 pattern 長度取模後的位置', () => {
    const props = { bars: [bar16(), bar16()], activeCell: 5 }
    expect(mountSheet({ ...props, activeBar: 3, playing: false }).find('[data-cursor="true"]').exists()).toBe(false)

    const wrapper = mountSheet({ ...props, activeBar: 3, playing: true })
    expect(wrapper.findAll('[data-cursor="true"]')).toHaveLength(1)
    // 第 3 小節 → 2 小節循環的第 1 列（索引 0）第 6 格
    expect(cursorIndex(wrapper)).toBe(5)

    // 第 4 小節 → 第 2 列，格號不變 → 第 16+6 個按鈕
    expect(cursorIndex(mountSheet({ ...props, activeBar: 4, playing: true }))).toBe(21)
  })

  it('editable 時點格子發出 cycle 事件（帶小節與格號）；否則不可點', async () => {
    const editable = mountSheet({ bars: [bar16(), bar16()], editable: true })
    await editable.findAll('button')[22]!.trigger('click')
    expect(editable.emitted('cycle')).toEqual([[1, 6]])

    const readonly = mountSheet({ bars: [bar16()] })
    expect(readonly.findAll('button')[6]!.attributes('disabled')).toBeDefined()
  })
})
