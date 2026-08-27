// @vitest-environment happy-dom
/**
 * 掛載煙霧測試：驗證 App shell、路由生成、兩個練習模組實際可掛載且不丟例外。
 * 建置只檢查模板語法，這裡檢查的是「跑起來不會炸」。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory } from 'vue-router'
import { chromaticBoard } from './modules/scales/recall/quiz'
import { KEYS } from './modules/scales/shared'
import { mapToFretboard, parseNoteName, spellDegree, type NoteName } from './core/theory'
import App from './App.vue'
import { createAppRouter } from './router'
import { LEGAL_DOCS, KNOWLEDGE_BASE_PATH, legalPath } from './config/routes'
import { useSettingsStore } from './stores/settings'
import knowledgeZh from './content/knowledge/zh-TW.json'
import legalEn from './content/legal/en.json'
import { listModules } from './modules/registry'
import './modules'
import zhTW from './locales/zh-TW.json'
import en from './locales/en.json'

function createTestApp() {
  const pinia = createPinia()
  setActivePinia(pinia)
  // 收集查不到的 key：vue-i18n 找不到就把 key 本身印在畫面上，建置與 typecheck 都抓不到
  const missingKeys: string[] = []
  const i18n = createI18n({
    legacy: false,
    locale: 'zh-TW',
    fallbackLocale: 'en',
    messages: { 'zh-TW': zhTW, en },
    missing: (_locale, key) => { missingKeys.push(key) },
  })
  // 用**正式的**路由表，不自己抄一份：抄的那份漏掉新路由時，測試會全綠地騙人
  const router = createAppRouter(createMemoryHistory())
  return { pinia, i18n, router, missingKeys }
}

/** 從畫面上讀出「找位置」這一題要找的音；隨機出題，測試不預設是哪一個 */
function readTarget(text: string): NoteName {
  const match = /找出全指板所有的 ([A-G][#b]?)/.exec(text)
  if (!match?.[1]) throw new Error(`讀不出題目：${text.slice(0, 120)}`)
  return match[1] as NoteName
}

/** 所有實際會被使用者打開的路由：模組由 registry 生成，加上首頁、統計與內容頁 */
const ALL_ROUTES = [
  '/',
  '/stats',
  KNOWLEDGE_BASE_PATH,
  '/knowledge/scale-ionian',
  ...LEGAL_DOCS.map(legalPath),
  ...listModules().map((m) => m.route),
  // 英文版路由是獨立的路由記錄，會走到不同的 meta 分支，值得各抽一條驗
  '/en',
  '/en/knowledge',
  '/en/knowledge/scale-ionian',
  '/en/about',
]

describe('App 掛載', () => {
  beforeEach(() => localStorage.clear())

  it('首頁列出所有已註冊模組，且無 i18n 缺字（不出現 raw key）', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    const text = wrapper.text()
    for (const m of listModules()) {
      expect(text).toContain(i18n.global.t(m.titleKey))
    }
    expect(text).not.toContain('modules.')
    expect(text).not.toContain('category.')
  })

  it('首頁不顯示 TransportBar；練習頁顯示', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()
    // 以 BPM 滑桿（TransportBar 專有）判斷，不用文字（首頁列有模組說明也含 BPM 字樣）
    expect(wrapper.find('input.rcs-range').exists()).toBe(false)

    await router.push('/rhythm/metronome')
    await flushPromises()
    expect(wrapper.find('input.rcs-range').exists()).toBe(true)
  })

  // 路由清單取自 registry：新增模組自動納入煙霧測試，不會有人忘了補一行
  it.each(ALL_ROUTES)('%s 可掛載且渲染內容', async (route) => {
    const { pinia, i18n, router } = createTestApp()
    router.push(route)
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()
    expect(wrapper.text().length).toBeGreaterThan(40)
    expect(wrapper.text()).not.toContain('undefined')
  })

  /**
   * 缺 i18n key 時 vue-i18n 會把 key 本身印在畫面上，建置與 typecheck 都抓不到。
   * 用 missing hook 逐條路由檢查——比事後掃畫面文字可靠（掃描表跟語系檔是同一份，
   * 兩邊一起漏掉就掃不出來）。fallback 也會觸發，因此只存在於 en 的 key 同樣會被抓到，
   * 這正好落實「兩個語系必須同步」。
   */
  it.each(ALL_ROUTES)('%s 沒有漏翻的 i18n key', async (route) => {
    const { pinia, i18n, router, missingKeys } = createTestApp()
    router.push(route)
    await router.isReady()
    mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()
    expect([...new Set(missingKeys)], `${route} 有查不到的 key`).toEqual([])
  })

  it('切分專項渲染節奏譜格子，且停止時沒有游標', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/rhythm/subdivision')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    const cells = wrapper.findAll('[role=group] button[data-cursor]')
    expect(cells.length).toBeGreaterThan(0)
    expect(wrapper.find('[data-cursor="true"]').exists()).toBe(false)
  })

  it('律動風格顯示建議和弦，且和弦符號由公式表組出', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/rhythm/groove')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()
    expect(wrapper.text()).toContain('E9')
  })

  it('音階總覽顯示指板音點與組成音列', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/scales/explorer')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.findAll('svg > g').length).toBeGreaterThan(50)
  })

  it('音階跟練承接 Explorer 帶入的 ?root=&scale=', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/scales/practice?root=F%23&scale=dorian')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('F# Dorian'.split(' ')[1])
    const parsed = JSON.parse(localStorage.getItem('rcs.settings')!) as {
      data: { moduleSettings: Record<string, { root: string; scale: string }> }
    }
    expect(parsed.data.moduleSettings['scales.practice']).toMatchObject({ root: 'F#', scale: 'dorian' })
  })

  it('非法 query 值不覆寫設定（localStorage 與網址皆不可信）', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/scales/practice?root=H&scale=bogus')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()
    expect(wrapper.text()).not.toContain('bogus')
    const parsed = JSON.parse(localStorage.getItem('rcs.settings') ?? '{"data":{"moduleSettings":{}}}') as {
      data: { moduleSettings: Record<string, { root?: string }> }
    }
    expect(parsed.data.moduleSettings['scales.practice']?.root ?? 'A').toBe('A')
  })

  it('五度圈進行：未播放時先顯示第一個和弦與預告', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/chords/circle-progressions')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    const chords = wrapper.findAll('ol li').map((li) => li.text())
    expect(chords[0]).toContain('Dm7')
    expect(chords[1]).toContain('G7')
    // 指板同步顯示當前和弦組成音
    expect(wrapper.findAll('svg > g > circle[r="11"]').length).toBeGreaterThan(20)
  })

  it('五度圈進行：點五度圈外圈強制切換到那個調', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/chords/circle-progressions')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    expect(wrapper.findAll('ol li').map((li) => li.text())[0]).toContain('Dm7')

    // 圈上的扇形以調名為無障礙名稱；Eb 在 C 起算的循環裡是第 4 個調
    const sector = wrapper.find('path[aria-label="Eb"]')
    expect(sector.exists()).toBe(true)
    await sector.trigger('click')
    await flushPromises()

    // 時間軸、指板與圓心同時換到 Eb 調的 2516
    const tiles = wrapper.findAll('ol li').map((li) => li.text())
    expect(tiles[0]).toContain('Fm7')
    expect(tiles[1]).toContain('Bb7')
    expect(wrapper.text()).toContain('4/12')
  })

  it('五度圈進行：內圈（關係小調）不可點——這些進行一律以大調為基準', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/chords/circle-progressions')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    expect(wrapper.find('path[aria-label="Cm"]').exists()).toBe(false)
    expect(wrapper.findAll('path[role="button"]')).toHaveLength(12)
  })

  it('固定調練習：點五度圈換調，換算成選單用的拼寫後寫進設定', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/chords/key-practice')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    // 圈上寫 F#，模組的調選單只收 Gb——寫進設定的必須是 Gb，否則選單會變成沒有任何一格選中
    await wrapper.find('path[aria-label="F#"]').trigger('click')
    await flushPromises()

    const parsed = JSON.parse(localStorage.getItem('rcs.settings')!) as {
      data: { moduleSettings: Record<string, { key: string }> }
    }
    expect(parsed.data.moduleSettings['chords.key-practice']?.key).toBe('Gb')
    expect(wrapper.findAll('ol li').map((li) => li.text())[0]).toContain('Gb')
  })

  it('固定調練習：點時間軸的和弦就強制切換過去', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/chords/key-practice')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    // 預設 C 調的 I IV V I：整段進行都在時間軸上，每一格都可點
    const tiles = () => wrapper.findAll('ol li button')
    expect(tiles().map((b) => b.text().replace(/\s+/g, ' '))).toHaveLength(4)
    expect(tiles()[0]?.attributes('aria-current')).toBe('true')

    await tiles()[2]!.trigger('click')
    await flushPromises()

    const current = tiles().filter((b) => b.attributes('aria-current') === 'true')
    expect(current).toHaveLength(1)
    expect(current[0]!.text()).toContain('G')
    // 指板的組成音標題跟著換（視覺與資料同一個游標）
    expect(wrapper.text()).toContain('組成音（全指板）')
  })

  it('固定調練習：換級別時進行自動落到該級別的第一個', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/chords/key-practice')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    const level5 = wrapper.findAll('button').find((b) => b.text().includes('Fusion'))
    expect(level5).toBeDefined()
    await level5!.trigger('click')
    await flushPromises()

    // 第五級的第一個進行是「四級小和弦」：C 調應出現 Fm7
    expect(wrapper.text()).toContain('Fm7')
    const parsed = JSON.parse(localStorage.getItem('rcs.settings')!) as {
      data: { moduleSettings: Record<string, { levelId: string; presetId: string }> }
    }
    expect(parsed.data.moduleSettings['chords.key-practice']).toMatchObject({
      levelId: 'level5', presetId: 'l5-borrowed',
    })
  })

  it('七和弦琶音：未播放時就看得見這個調的整份課表與琶音音序', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/chords/arpeggio')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    // 預設是 C 調的順階七和弦：四種實用七和弦一次走完，時間軸整段可見
    const tiles = wrapper.findAll(`ol[aria-label="${i18n.global.t('chords.jumpChordHint')}"] li button`)
    expect(tiles.map((b) => b.text().replace(/\s+/g, ' ')))
      .toEqual(expect.arrayContaining([expect.stringContaining('Cmaj7'), expect.stringContaining('Bm7b5')]))
    expect(tiles).toHaveLength(7)

    // 音序＝要彈的順序（上行），音名與度數都由公式表推導
    // 每一格是「音名 + 度數」，兩者都由公式表推導（畫面零 hardcode 音名）
    const notes = wrapper.findAll(`ol[aria-label="${i18n.global.t('arpeggio.sequence')}"] li`)
    expect(notes.map((li) => li.text().replace(/\s+/g, ''))).toEqual(['C1', 'E3', 'G5', 'B7'])
  })

  it('七和弦琶音：點五度圈外圈跳到那個調，音序跟著換', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/chords/arpeggio')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    await wrapper.find('path[aria-label="Eb"]').trigger('click')
    await flushPromises()

    const notes = wrapper.findAll(`ol[aria-label="${i18n.global.t('arpeggio.sequence')}"] li`)
    expect(notes.map((li) => li.text().replace(/\s+/g, ''))).toEqual(['Eb1', 'G3', 'Bb5', 'D7'])
    expect(wrapper.text()).toContain('Ebmaj7')
  })

  it('七和弦琶音：單一品質的課表，時間軸小字換成調名（換的是調不是級數）', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/chords/arpeggio')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    const halfDim = wrapper.findAll('button').find((b) => b.text() === 'm7b5')
    expect(halfDim).toBeDefined()
    await halfDim!.trigger('click')
    await flushPromises()

    // 一個調只有一個和弦，所以時間軸預告接下來的三個調（五度下行）
    // 小字：當前與下一個用譯文，之後的格子用調名——後者寫十二次 I7 等於什麼都沒說
    const tiles = wrapper.findAll(`ol[aria-label="${i18n.global.t('chords.jumpChordHint')}"] li button`)
    expect(tiles.map((b) => b.text().replace(/\s+/g, ''))).toEqual([
      `${i18n.global.t('chords.now')}Cm7b5`,
      `${i18n.global.t('chords.next')}Fm7b5`,
      'BbBbm7b5',
      'EbEbm7b5',
    ])
  })

  it('七和弦琶音：上下行的音序會折返，除不盡小節格數時畫面說出來', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/chords/arpeggio')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    const upDown = wrapper.findAll('button').find((b) => b.text() === i18n.global.t('arpeggio.upDown'))
    expect(upDown).toBeDefined()
    await upDown!.trigger('click')
    await flushPromises()

    const notes = wrapper.findAll(`ol[aria-label="${i18n.global.t('arpeggio.sequence')}"] li`)
    expect(notes.map((li) => li.text().replace(/\s+/g, ''))).toEqual(['C1', 'E3', 'G5', 'B7', 'G5', 'E3'])
    // 6 個音塞不進 4/4 正拍的 4 格：提示必須出現，否則使用者以為壞了
    expect(wrapper.text()).toContain(i18n.global.t('arpeggio.fitHint', { notes: 6, slots: 4 }))
  })

  it('音階模進：未播放時就看得見指型與第一組（預設 A 小調五聲第一盒、四個一組）', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/scales/sequence')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    // 一組的音名與度數都由公式表推導（畫面零 hardcode 音名）
    const dots = wrapper.findAll(`ol[aria-label="${i18n.global.t('sequence.strip')}"] li`)
    expect(dots.map((li) => li.text().replace(/\s+/g, ''))).toEqual(['A1', 'Cb3', 'D4', 'E5'])
    // 指板畫的是這個指型本身：五聲盒型每弦兩音、六條弦共 12 個音點
    expect(wrapper.findAll('svg > g')).toHaveLength(12)
    expect(wrapper.text()).toContain(i18n.global.t('sequence.shapeInfo', { notes: 2, degree: '1' }))
  })

  it('音階模進：換模進型就換一組音（三個一組＝三個音，第二組往上搬一個音）', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/scales/sequence')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    const threes = wrapper.findAll('button').find((b) => b.text() === i18n.global.t('seqPattern.threes'))
    expect(threes).toBeDefined()
    await threes!.trigger('click')
    await flushPromises()

    const dots = wrapper.findAll(`ol[aria-label="${i18n.global.t('sequence.strip')}"] li`)
    expect(dots.map((li) => li.text().replace(/\s+/g, ''))).toEqual(['A1', 'Cb3', 'D4'])
  })

  it('音階模進：把位選單記的是度數，沒有「全部」——沒有指型就沒有順序', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/scales/sequence')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    expect(wrapper.findAll('button').some((b) => b.text() === i18n.global.t('fretboard.allPositions')))
      .toBe(false)

    // 五個盒型以錨定音的度數標示；換到 b3 的盒型，序列跟著從 b3 起算
    const box = wrapper.findAll('button').find((b) => b.text() === 'b3')
    expect(box).toBeDefined()
    await box!.trigger('click')
    await flushPromises()

    const dots = wrapper.findAll(`ol[aria-label="${i18n.global.t('sequence.strip')}"] li`)
    expect(dots.map((li) => li.text().replace(/\s+/g, ''))).toEqual(['Cb3', 'D4', 'E5', 'Gb7'])
    const parsed = JSON.parse(localStorage.getItem('rcs.settings')!) as {
      data: { moduleSettings: Record<string, { shapeDegree: string }> }
    }
    expect(parsed.data.moduleSettings['scales.sequence']?.shapeDegree).toBe('b3')
  })

  it('音階模進：七音音階換成一弦三音（六條弦共 18 個音）', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/scales/sequence')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    const ionian = wrapper.findAll('button').find((b) => b.text() === i18n.global.t('scale.ionian'))
    expect(ionian).toBeDefined()
    await ionian!.trigger('click')
    await flushPromises()

    expect(wrapper.findAll('svg > g')).toHaveLength(18)
    expect(wrapper.text()).toContain(i18n.global.t('sequence.shapeInfo', { notes: 3, degree: '1' }))
  })

  it('音階模進：藍調走五聲骨架，畫面說出 b5 不在這條路徑上（限制要說出來）', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/scales/sequence')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    const blues = wrapper.findAll('button').find((b) => b.text() === i18n.global.t('scale.blues'))
    expect(blues).toBeDefined()
    await blues!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain(i18n.global.t('sequence.passingHint', { degrees: 'b5' }))
    // 骨架是五聲：指型仍是每弦兩音
    expect(wrapper.findAll('svg > g')).toHaveLength(12)
  })

  it('指板回想（找位置）：一開始全空，點對才亮、點錯說得出你點的是什麼', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/scales/recall')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    // 題目是隨機抽的，所以測試從畫面上讀出這一題要找什麼，再自己用 core 算出答案。
    // 用 regex 而不是 includes：'D' 會誤中 'Db' 的題目
    const target = readTarget(wrapper.text())
    const answers = mapToFretboard([spellDegree(target, '1')])
    // 指板一開始沒有任何音點——這就是「把答案藏起來」
    expect(wrapper.findAll('svg circle[r="11"]')).toHaveLength(0)

    const first = answers[0]!
    await wrapper.find(`circle[data-hit-string="${first.string}"][data-hit-fret="${first.fret}"]`).trigger('click')
    await flushPromises()
    expect(wrapper.findAll('svg circle[r="11"]')).toHaveLength(1)

    // 點一個不是答案的格：不亮，而且回饋要說出那一格是什麼音
    const board = chromaticBoard('C')
    const wrong = board.find((cell) => cell.note.pc !== first.note.pc)!
    await wrapper.find(`circle[data-hit-string="${wrong.string}"][data-hit-fret="${wrong.fret}"]`).trigger('click')
    await flushPromises()
    expect(wrapper.findAll('svg circle[r="11"]')).toHaveLength(1)
    expect(wrapper.text()).toContain(`那是 ${wrong.note.name}`)
  })

  it('指板回想（說名字）：白圈標出題目，答對以 pitch class 比對', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/scales/recall')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    const toName = wrapper.findAll('button').find((b) => b.text() === '說名字')
    expect(toName).toBeDefined()
    await toName!.trigger('click')
    await flushPromises()

    const mark = wrapper.find('circle[data-mark-string]')
    expect(mark.exists(), '說名字方向要在指板上圈出題目').toBe(true)
    const asked = {
      string: Number(mark.attributes('data-mark-string')),
      fret: Number(mark.attributes('data-mark-fret')),
    }

    // 答案自己算：白圈那一格的音高
    const cell = chromaticBoard('C').find((c) => c.string === asked.string && c.fret === asked.fret)!
    const answer = KEYS.find((key) => parseNoteName(key).pc === cell.note.pc)!
    const button = wrapper.findAll('button').find((b) => b.text() === answer)
    expect(button, `選項裡找不到 ${answer}`).toBeDefined()
    await button!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('答對了')
    // 答對後白圈填上正確答案
    expect(wrapper.findAll('svg circle[r="11"]')).toHaveLength(1)
  })

  it('指板回想：換方向或換語言就重新計分（換了一整副牌）', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/scales/recall')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    const first = mapToFretboard([spellDegree(readTarget(wrapper.text()), '1')])[0]!
    await wrapper.find(`circle[data-hit-string="${first.string}"][data-hit-fret="${first.fret}"]`).trigger('click')
    await flushPromises()

    const toDegree = wrapper.findAll('button').find((b) => b.text() === '度數')
    await toDegree!.trigger('click')
    await flushPromises()

    // 命中歸零，指板重新變空
    expect(wrapper.findAll('svg circle[r="11"]')).toHaveLength(0)
    expect(wrapper.text()).toContain('在 C')
  })

  it('知識卡展開後載入對應語系內容', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/scales/explorer')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    const toggle = wrapper.findAll('button').find((b) => b.text().includes('知識卡'))
    expect(toggle).toBeDefined()
    await toggle!.trigger('click')
    // 內容是動態 import 的獨立 chunk，解析需要時間 → 用輪詢而非固定等待
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Ionian：大調本身')
      expect(wrapper.text()).toContain('avoid note')
    })
  })

  it('模組設定寫入 localStorage（以模組 id 為 key）', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/scales/explorer')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    const buttons = wrapper.findAll('button')
    const gButton = buttons.find((b) => b.text() === 'G')
    expect(gButton).toBeDefined()
    await gButton!.trigger('click')
    await flushPromises()

    const raw = localStorage.getItem('rcs.settings')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!) as { version: number; data: { moduleSettings: Record<string, { root: string }> } }
    expect(parsed.version).toBe(3)
    expect(parsed.data.moduleSettings['scales.explorer']?.root).toBe('G')
  })

  /**
   * 持久化資料損毀（手動改過、被別的分頁寫壞、版本超前）不該讓使用者開不了 app。
   * VersionedStore 的規則是「壞掉就回退預設，不丟例外」——這裡驗證整條路徑真的接得起來。
   */
  it.each(['rcs.settings', 'rcs.practiceLog', 'rcs.customProgressions'])(
    '%s 損毀時仍然開得起來（回退預設值）',
    async (key) => {
      localStorage.setItem(key, 'not-json{{')
      const { pinia, i18n, router } = createTestApp()
      router.push('/chords/custom')
      await router.isReady()
      const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
      await flushPromises()
      expect(wrapper.text()).toContain(i18n.global.t('modules.chords.custom.title'))
    },
  )

  it('版本超前的持久化資料也回退，不是白畫面', async () => {
    localStorage.setItem('rcs.settings', JSON.stringify({ version: 999, data: { locale: 'kl' } }))
    const { pinia, i18n, router } = createTestApp()
    router.push('/')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()
    expect(wrapper.text()).toContain('RCS')
  })
})

describe('內容頁與語系網址（Phase 6）', () => {
  beforeEach(() => localStorage.clear())

  it('知識索引列出全部條目，且每一條都連得到自己的頁面', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push(KNOWLEDGE_BASE_PATH)
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    const hrefs = wrapper.findAll('a').map((a) => a.attributes('href') ?? '')
    const entryLinks = hrefs.filter((h) => h.startsWith('/knowledge/'))
    expect(entryLinks.length).toBe(Object.keys(knowledgeZh).length)
    expect(new Set(entryLinks).size).toBe(entryLinks.length)
  })

  it('知識條目頁渲染標題與內文', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/knowledge/scale-ionian')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    expect(wrapper.text()).toContain(knowledgeZh['scale.ionian'].title)
    expect(wrapper.find('h1').text()).toBe(knowledgeZh['scale.ionian'].title)
  })

  it('網址不存在的條目顯示「找不到」，不是空白頁', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/knowledge/scale-nope')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()
    expect(wrapper.text()).toContain(i18n.global.t('knowledge.missing'))
  })

  it('catch-all 顯示 404 頁而不是一片空白', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/no-such-page')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()
    expect(wrapper.text()).toContain(i18n.global.t('notFound.title'))
  })

  it('/en 前綴的路由用英文渲染，頁尾連結也帶前綴', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/en/about')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    expect(wrapper.text()).toContain(legalEn['about'].title)
    const hrefs = wrapper.findAll('footer a').map((a) => a.attributes('href') ?? '')
    expect(hrefs.every((h) => h.startsWith('/en/'))).toBe(true)
  })

  /**
   * 語系與網址同步：使用者的語言是英文、網址卻沒有前綴時，導到有前綴的那一個。
   *
   * 相關的 race（掛載時初始導航尚未 commit，route 還是 START_LOCATION，
   * 導頁會蓋掉使用者真正要去的網址）在 main.ts 以 `await router.isReady()` 根除，
   * App.vue 的 matched 長度檢查是第二道防線。這裡的 memory history 掛載時序
   * 與瀏覽器不同，重現不了那個 race——它是在瀏覽器上抓到也在瀏覽器上驗證的。
   */
  it('語言是英文時開 /stats，會導到 /en/stats', async () => {
    const { pinia, i18n, router } = createTestApp()
    useSettingsStore(pinia).state.locale = 'en'
    router.push('/stats')
    await router.isReady()
    mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/en/stats')
  })

  it('中文使用者開 /en/stats 會切成英文並留在原網址', async () => {
    const { pinia, i18n, router } = createTestApp()
    router.push('/en/stats')
    await router.isReady()
    mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/en/stats')
    expect(useSettingsStore(pinia).state.locale).toBe('en')
  })
})

describe('全域錯誤邊界', () => {
  beforeEach(() => localStorage.clear())

  /** 練習頁炸掉時最糟的失敗是整片白畫面——使用者不知道自己的紀錄還在不在 */
  function createCrashingApp() {
    const pinia = createPinia()
    setActivePinia(pinia)
    const i18n = createI18n({ legacy: false, locale: 'zh-TW', fallbackLocale: 'en', messages: { 'zh-TW': zhTW, en } })
    // 同樣用正式路由表：首頁與頁尾會替每條路由畫 RouterLink，缺一條就噴 warning
    const router = createAppRouter(createMemoryHistory())
    router.addRoute({
      path: '/boom',
      name: 'boom',
      component: { setup: () => { throw new Error('模組爆了') } },
    })
    return { pinia, i18n, router }
  }

  it('渲染錯誤換成說明畫面，而不是整片白', async () => {
    const { pinia, i18n, router } = createCrashingApp()
    router.push('/boom')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()

    expect(wrapper.text()).toContain(i18n.global.t('error.title'))
    // 明確告訴使用者紀錄沒事，並給得出下一步
    expect(wrapper.text()).toContain(i18n.global.t('error.body'))
    expect(wrapper.text()).toContain('模組爆了')
    expect(wrapper.findAll('a').length).toBeGreaterThan(0)
  })

  it('換頁就恢復（壞的是某一頁，不是整個 app）', async () => {
    const { pinia, i18n, router } = createCrashingApp()
    router.push('/boom')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()
    expect(wrapper.text()).toContain(i18n.global.t('error.title'))

    await router.push('/')
    await flushPromises()
    expect(wrapper.text()).not.toContain(i18n.global.t('error.title'))
    expect(wrapper.text()).toContain(i18n.global.t('app.tagline'))
  })
})

