import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import App from './App.vue'
import { router } from './router'
import { useSettingsStore } from './stores/settings'
import zhTW from './locales/zh-TW.json'
import en from './locales/en.json'
import './assets/main.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

const settings = useSettingsStore(pinia)
const i18n = createI18n({
  legacy: false,
  locale: settings.state.locale,
  fallbackLocale: 'en',
  messages: { 'zh-TW': zhTW, en },
})

app.use(i18n)
app.use(router)
app.mount('#app')
