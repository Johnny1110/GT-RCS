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

