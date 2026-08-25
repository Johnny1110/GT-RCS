<script setup lang="ts">
/**
 * App shell：頁首導覽 + 路由出口 + 常駐 TransportBar。
 *
 * 全域錯誤邊界（PRD F5-4.4）：練習頁炸了就整片白畫面是最糟的失敗方式——
 * 使用者不知道發生什麼事，也不知道自己的練習紀錄還在不在。
 * onErrorCaptured 攔下來換成一個說明畫面，明確告訴使用者紀錄沒受影響
 * （紀錄在 localStorage，渲染錯誤動不到它），再給一條回首頁與備份的路。
 */
import { onErrorCaptured, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import ShortcutHelp from '@/components/ui/ShortcutHelp.vue'
import TransportBar from '@/components/TransportBar/TransportBar.vue'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const route = useRoute()
const { locale, t } = useI18n()

watch(
  () => settings.state.locale,
  (value) => {
    locale.value = value
    document.documentElement.lang = value
  },
  { immediate: true },
)

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
    <header class="flex items-center gap-6 border-b border-ink-800 px-6 py-3">
      <RouterLink to="/" class="font-mono text-base font-bold tracking-[0.06em] text-ink-50">RCS</RouterLink>
      <RouterLink
        to="/stats"
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
            to="/stats"
            class="rounded border border-ink-700 px-3 py-1.5 text-sm text-ink-400 hover:bg-ink-800 hover:text-ink-100"
          >
            {{ t('error.backup') }}
          </RouterLink>
        </div>
      </section>

      <RouterView v-else />
    </main>

    <TransportBar v-if="route.meta.moduleId && !crash" class="sticky bottom-0 z-10" />

    <ShortcutHelp />
  </div>
</template>
