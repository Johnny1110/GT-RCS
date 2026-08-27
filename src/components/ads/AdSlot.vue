<script setup lang="ts">
/**
 * 廣告版位（純顯示組件）— PRD Phase 6 / F6-3.1、F6-3.2。
 *
 * 三個硬性行為：
 * 1. **沒設定就不存在**：adUnitFor() 回 null（本機、預覽頻道、缺 slot id）時整個組件不渲染，
 *    連保留高度都沒有。零廣告的站不該被廣告版位的空盒子撐開。
 * 2. **保留高度**：容器在 script 回來前就先佔好位（PLACEMENT_HEIGHT），載入前後同高 → CLS = 0。
 * 3. **優雅收合**：被攔截器擋掉、或 AdSense 回報 unfilled，就把整塊移除——
 *    不留白、不出「請關閉廣告攔截器」的提示。使用者擋廣告是他的自由，我們不吵。
 *
 * 本組件不認識路由：能不能放這個版位是 config/ads.ts 的白名單決定的，
 * 呼叫端只在白名單頁面掛它（ads.spec.ts 鎖定白名單不含任何練習模組路由）。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { PLACEMENT_HEIGHT, adUnitFor, type AdPlacement } from '@/config/ads'
import { ensureAdsenseLoaded, pushAdUnit } from '@/thirdParty'

const props = defineProps<{ placement: AdPlacement }>()

const { t } = useI18n()

/** 版位設定在建置期就固定了，不會變動——算一次即可 */
const unit = adUnitFor(props.placement)
const height = PLACEMENT_HEIGHT[props.placement]

/** AdSense 決定不投放時會在 <ins> 上寫這個值 */
const UNFILLED = 'unfilled'
/** 等不到任何 data-ad-status 就當作被擋掉了 */
const BLOCKED_TIMEOUT_MS = 4000

const collapsed = ref(false)
const insEl = ref<HTMLElement | null>(null)

let observer: MutationObserver | null = null
let timer = 0

function collapse(): void {
  collapsed.value = true
}

function cleanup(): void {
  observer?.disconnect()
  observer = null
  if (timer) window.clearTimeout(timer)
  timer = 0
}

onMounted(async () => {
  if (!unit) return
  const el = insEl.value
  if (!el) return

  // AdSense 用屬性回報結果，沒有 callback 可以掛
  observer = new MutationObserver(() => {
    const status = el.getAttribute('data-ad-status')
    if (!status) return
    cleanup()
    if (status === UNFILLED) collapse()
  })
  observer.observe(el, { attributes: true, attributeFilter: ['data-ad-status'] })
  timer = window.setTimeout(() => {
    if (!el.getAttribute('data-ad-status')) {
      cleanup()
      collapse()
    }
  }, BLOCKED_TIMEOUT_MS)

  try {
    await ensureAdsenseLoaded(unit.client)
    pushAdUnit()
  } catch {
    // script 載不到就是攔截器：這是常態，不是錯誤
    cleanup()
    collapse()
  }
})

onBeforeUnmount(cleanup)
</script>

<template>
  <aside
    v-if="unit && !collapsed"
    class="flex w-full flex-col gap-1"
    :aria-label="t('ads.label')"
  >
    <span class="rcs-micro">
      {{ t('ads.label') }}
    </span>
    <div
      class="rcs-ad w-full overflow-hidden"
      :style="{ '--ad-h-mobile': `${height.mobile}px`, '--ad-h-desktop': `${height.desktop}px` }"
    >
      <ins
        ref="insEl"
        class="adsbygoogle block w-full"
        :data-ad-client="unit.client"
        :data-ad-slot="unit.slot"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  </aside>
</template>
