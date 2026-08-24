<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import TransportBar from '@/components/TransportBar/TransportBar.vue'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const route = useRoute()
const { locale } = useI18n()

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
</script>

<template>
  <div class="flex min-h-screen flex-col bg-ink-950 text-ink-100">
    <header class="flex items-center gap-6 border-b border-ink-800 px-6 py-3">
      <RouterLink to="/" class="font-mono text-base font-bold tracking-[0.06em] text-ink-50">RCS</RouterLink>
      <button
        type="button"
        class="ml-auto rounded px-2 py-1 font-mono text-xs text-ink-500 hover:bg-ink-800 hover:text-ink-100"
        @click="toggleLocale"
      >
        {{ settings.state.locale === 'zh-TW' ? 'EN' : '中文' }}
      </button>
    </header>

    <main class="flex flex-1 flex-col">
      <RouterView />
    </main>

    <TransportBar v-if="route.meta.moduleId" class="sticky bottom-0 z-10" />
  </div>
</template>
