<script setup lang="ts">
/**
 * App shell：頁首導覽 + 路由出口 + 常駐 TransportBar + 頁尾。
 *
 * 全域錯誤邊界（PRD F5-4.4）：練習頁炸了就整片白畫面是最糟的失敗方式——
 * 使用者不知道發生什麼事，也不知道自己的練習紀錄還在不在。
 * onErrorCaptured 攔下來換成一個說明畫面，明確告訴使用者紀錄沒受影響
 * （紀錄在 localStorage，渲染錯誤動不到它），再給一條回首頁與備份的路。
 *
 * SEO（PRD F6-5.2）：全站唯一的 head 套用點在這裡。頁面要自訂標題就用
 * useSeoOverride 登記，不要各自寫 document.head——兩處都寫的結果是換頁殘留舊標籤。
 *
 * 語系與網址（PRD F6-5.2）：`/en/...` 是英文版的正規網址。
 * 進到帶前綴的路由就切成英文；切換語言則連網址一起換，讓網址永遠說得出自己是哪個語系。
 */
import { computed, onErrorCaptured, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import ShortcutHelp from '@/components/ui/ShortcutHelp.vue'
import SiteFooter from '@/components/ui/SiteFooter.vue'
import TransportBar from '@/components/TransportBar/TransportBar.vue'
import { useSeoApplier } from '@/composables/useSeo'
import { KNOWLEDGE_BASE_PATH } from '@/config/routes'
import { defaultPageMeta, pathForLocale, routeLocaleOf } from '@/router/pageMeta'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const route = useRoute()
const router = useRouter()
const { locale, t } = useI18n()

watch(
  () => settings.state.locale,
  (value) => {
    locale.value = value
    document.documentElement.lang = value
  },
  { immediate: true },
)

// 網址帶語系前綴時，網址說了算：分享出去的英文連結不該因為對方存過中文設定而變中文
watch(
  () => route.meta.locale,
  (value) => {
    if (value === 'en' || value === 'zh-TW') settings.state.locale = value
  },
  { immediate: true },
)

/**
 * 反向同步：網址沒有前綴、但使用者的語言是英文時，把網址換成 /en/…。
 *
 * 為什麼不放著不管：不同步的話會出現「網址說自己是中文版、畫面卻是英文」的狀態，
 * lang 屬性、canonical 與實際內容三者互相打架，讀螢幕軟體與搜尋引擎都會被誤導。
 * pathForLocale 是冪等的（pageMeta.spec.ts 鎖定），所以這裡不會來回導頁。
 */
watch(
  [() => route.path, () => settings.state.locale],
  ([path, value]) => {
    // 首次掛載時初始導航可能還沒 commit，route 仍是 START_LOCATION（path='/'、matched 為空）。
    // 這時導頁會蓋掉使用者真正要去的網址——直接輸入 /stats 會被踢到 /en。
    if (route.matched.length === 0) return
    const target = pathForLocale(path, value)
    if (target !== path) void router.replace({ path: target, query: route.query, hash: route.hash })
  },
  { immediate: true },
)

useSeoApplier(() => defaultPageMeta(route.path, route.meta, t))

const knowledgePath = computed(() => pathForLocale(KNOWLEDGE_BASE_PATH, routeLocaleOf(route.meta)))
const statsPath = computed(() => pathForLocale('/stats', routeLocaleOf(route.meta)))

/** 只翻設定；換網址交給上面的同步 watcher，換頁邏輯只留一份 */
function toggleLocale(): void {
  settings.state.locale = settings.state.locale === 'zh-TW' ? 'en' : 'zh-TW'
}

const crash = ref<string | null>(null)

onErrorCaptured((error) => {
  crash.value = error instanceof Error ? error.message : String(error)
  // 回 false 停止往上冒泡：這裡已經是最外層，再往上就是整片白畫面
  return false
})

/** 換頁就清掉錯誤：壞掉的是某一頁，不是整個 app */
watch(() => route.fullPath, () => { crash.value = null })
</script>

<template>
  <div class="flex min-h-screen flex-col bg-ink-950 text-ink-100">
    <header class="flex items-center gap-5 border-b border-ink-800 px-6 py-3">
      <RouterLink to="/" class="font-mono text-base font-bold tracking-[0.06em] text-ink-50">RCS</RouterLink>
      <RouterLink
        :to="knowledgePath"
        class="rounded px-2 py-1 font-mono text-xs text-ink-400 hover:bg-ink-800 hover:text-ink-100"
        active-class="text-ink-100"
      >
        {{ t('knowledgeIndex.title') }}
      </RouterLink>
      <RouterLink
        :to="statsPath"
        class="rounded px-2 py-1 font-mono text-xs text-ink-400 hover:bg-ink-800 hover:text-ink-100"
        active-class="text-ink-100"
      >
        {{ t('stats.title') }}
      </RouterLink>
      <button
        type="button"
        class="ml-auto rounded px-2 py-1 font-mono text-xs text-ink-400 hover:bg-ink-800 hover:text-ink-100"
        @click="toggleLocale"
      >
        {{ settings.state.locale === 'zh-TW' ? 'EN' : '中文' }}
      </button>
    </header>

    <main class="flex flex-1 flex-col">
      <section v-if="crash" class="mx-auto flex w-full max-w-xl flex-col gap-4 p-6 pt-16">
        <h1 class="text-xl font-semibold text-ink-50">{{ t('error.title') }}</h1>
        <p class="text-sm text-ink-400">{{ t('error.body') }}</p>
        <p class="rounded border border-ink-700 bg-ink-900 p-3 font-mono text-xs text-ink-400">{{ crash }}</p>
        <div class="flex flex-wrap gap-2">
          <RouterLink
            to="/"
            class="rounded border border-ink-700 bg-ink-800 px-3 py-1.5 text-sm text-ink-100 hover:bg-ink-700"
          >
            {{ t('error.home') }}
          </RouterLink>
          <RouterLink
            :to="statsPath"
            class="rounded border border-ink-700 px-3 py-1.5 text-sm text-ink-400 hover:bg-ink-800 hover:text-ink-100"
          >
            {{ t('error.backup') }}
          </RouterLink>
        </div>
      </section>

      <RouterView v-else />
    </main>

    <SiteFooter v-if="!crash" />

    <TransportBar v-if="route.meta.moduleId && !crash" class="sticky bottom-0 z-10" />

    <ShortcutHelp />
  </div>
</template>
