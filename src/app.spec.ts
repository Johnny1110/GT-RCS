// @vitest-environment happy-dom
/**
 * 掛載煙霧測試：驗證 App shell、路由生成、兩個練習模組實際可掛載且不丟例外。
 * 建置只檢查模板語法，這裡檢查的是「跑起來不會炸」。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import App from './App.vue'
import { listModules } from './modules/registry'
import './modules'
import zhTW from './locales/zh-TW.json'
import en from './locales/en.json'

function createTestApp() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const i18n = createI18n({ legacy: false, locale: 'zh-TW', fallbackLocale: 'en', messages: { 'zh-TW': zhTW, en } })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: () => import('./views/HomeView.vue') },
      ...listModules().map((m) => ({
        path: m.route,
        name: m.id,
        component: m.loadComponent,
        meta: { moduleId: m.id, category: m.category },
      })),
    ],
  })
  return { pinia, i18n, router }
}

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
  it.each(listModules().map((m) => m.route))('%s 可掛載且渲染內容', async (route) => {
    const { pinia, i18n, router } = createTestApp()
    router.push(route)
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()
    expect(wrapper.text().length).toBeGreaterThan(40)
    expect(wrapper.text()).not.toContain('undefined')
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
})
