/**
 * 進站點。順序是規格：
 * 1. Consent Mode 預設值必須先於任何 Google tag（PRD F6-4.2）——initThirdParty 內部保證。
 * 2. 分析的 page_view 由 router.afterEach 明確送出：SPA 換頁不會重新載入，
 *    交給 gtag 自動送只會記到第一頁。
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import App from './App.vue'
import { router } from './router'
import { useSettingsStore } from './stores/settings'
import { localeFromPath } from './router/pageMeta'
import { initThirdParty, trackPageView } from './thirdParty'
import zhTW from './locales/zh-TW.json'
import en from './locales/en.json'
import './assets/main.css'

initThirdParty()

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

const settings = useSettingsStore(pinia)

// 網址帶語系前綴時，網址說了算——而且必須在 createI18n 之前決定。
// 晚一步的話，內容頁會先用舊語系載一次再用新語系載一次（畫面閃動 + 載入競態）
const urlLocale = localeFromPath(window.location.pathname)
if (urlLocale) settings.state.locale = urlLocale

const i18n = createI18n({
  legacy: false,
  locale: settings.state.locale,
  fallbackLocale: 'en',
  messages: { 'zh-TW': zhTW, en },
})

app.use(i18n)
app.use(router)

router.afterEach((to) => {
  trackPageView(to.fullPath, document.title)
})

/**
 * 等初始導航 commit 完再掛載。
 * 不等的話，App 第一次執行 watcher 時 route 還是 START_LOCATION（path='/'），
 * 語系同步會把使用者真正要去的網址換成 /en——直接輸入 /stats 會落到首頁。
 */
void router.isReady().then(() => app.mount('#app'))
