<script setup lang="ts">
/**
 * 全站頁尾（PRD Phase 6 / F6-4.3）。
 *
 * 法遵頁必須「footer 可達」——所以這個組件出現在每一頁，包含練習頁。
 * 它在版面最下方，捲動才看得到，不會跟 sticky 的 TransportBar 搶位置。
 *
 * 「Cookie 設定」只在 CMP 真的提供撤回入口時才出現：非 EEA 訪客不會載到那個入口，
 * 顯示一顆按下去沒反應的按鈕比沒有按鈕更糟。CMP 是非同步載入的，所以要輪詢幾次再放棄。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { LEGAL_DOCS, KNOWLEDGE_BASE_PATH, legalPath } from '@/config/routes'
import { canRevokeConsent, showConsentRevocation } from '@/thirdParty'
import { pathForLocale, routeLocaleOf } from '@/router/pageMeta'

/** CMP 載入是非同步的；這幾個時間點都沒出現就當它不存在 */
const CMP_PROBE_DELAYS_MS = [0, 1000, 3000, 6000]

const { t } = useI18n()
const route = useRoute()
const canRevoke = ref(false)
const timers: number[] = []

function localized(path: string): string {
  return pathForLocale(path, routeLocaleOf(route.meta))
}

onMounted(() => {
  for (const delay of CMP_PROBE_DELAYS_MS) {
    timers.push(
      window.setTimeout(() => {
        if (canRevokeConsent()) canRevoke.value = true
      }, delay),
    )
  }
})

onBeforeUnmount(() => {
  for (const id of timers) window.clearTimeout(id)
})
</script>

<template>
  <footer class="mt-auto border-t border-ink-800 px-6 py-6">
    <nav class="mx-auto flex max-w-4xl flex-wrap items-center gap-x-5 gap-y-2">
      <RouterLink :to="localized(KNOWLEDGE_BASE_PATH)" class="text-xs text-ink-400 hover:text-ink-100">
        {{ t('knowledgeIndex.title') }}
      </RouterLink>
      <RouterLink
        v-for="doc in LEGAL_DOCS"
        :key="doc"
        :to="localized(legalPath(doc))"
        class="text-xs text-ink-400 hover:text-ink-100"
      >
        {{ t(`legal.${doc}.title`) }}
      </RouterLink>
      <button
        v-if="canRevoke"
        type="button"
        class="rounded text-xs text-ink-400 hover:text-ink-100"
        @click="showConsentRevocation()"
      >
        {{ t('legal.cookieSettings') }}
      </button>
      <span class="ml-auto font-mono text-[11px] text-ink-400">{{ t('legal.footerNote') }}</span>
    </nav>
  </footer>
</template>
