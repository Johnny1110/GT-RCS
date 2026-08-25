<script setup lang="ts">
/**
 * 練習統計儀表板（PRD F5-2）：吃 Phase 2 起累積的 practiceLog。
 *
 * 這個頁面不是練習模組——它沒有 click、不寫日誌、不掛 TransportBar，
 * 所以不進模組註冊表，而是 router 裡的一條獨立路由。
 *
 * 全部聚合都在 core/stats（純函式、可測）；這裡只負責挑資料、給顏色、排版。
 * 圖表一律灰階：三條線靠亮度分，色彩只屬於音高（design-system §1.1）。
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  bpmSeries, currentStreak, dailyTotals, moduleShares, secondsInLastDays, totalSeconds,
  type StatEntry,
} from '@/core/stats'
import AdSlot from '@/components/ads/AdSlot.vue'
import LineChart from '@/components/charts/LineChart.vue'
import StackedBarChart, { type BarRow, type ChartSeries } from '@/components/charts/StackedBarChart.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import { shortDay, toMinutes } from '@/components/charts/geometry'
import { useBackup } from '@/composables/useBackup'
import { getModule } from '@/modules/registry'
import type { PracticeCategory } from '@/modules/types'
import { usePracticeLogStore } from '@/stores/practiceLog'

/** 長條圖的視窗：近 4 週（PRD F5-2.2） */
const CHART_DAYS = 28
/** x 軸每 7 天標一次日期——28 根全標會糊成一團 */
const LABEL_EVERY = 7
/** 明細列表一次顯示幾筆 */
const DETAIL_PAGE = 30

const CATEGORIES: readonly PracticeCategory[] = ['rhythm', 'chords', 'scales']

/** 三條線的灰階：靠亮度分辨，不用色相 */
const CATEGORY_COLOR: Readonly<Record<PracticeCategory, string>> = {
  rhythm: 'var(--color-ink-600)',
  chords: 'var(--color-ink-400)',
  scales: 'var(--color-ink-100)',
}

const { t } = useI18n()
const log = usePracticeLogStore()
const backup = useBackup()

const entries = computed<StatEntry[]>(() => [...log.entries])
const now = computed(() => new Date(nowTick.value))
/** 換日或匯入後要重算；用一個可手動撥動的時間戳當依據，不在 computed 裡讀時鐘 */
const nowTick = ref(Date.now())

/** 模組屬於哪一條線。已被移除的模組回 null（舊紀錄仍在，但不歸任何一條線） */
function categoryOf(moduleId: string): PracticeCategory | null {
  return getModule(moduleId)?.category ?? null
}

function moduleTitle(moduleId: string): string {
  const manifest = getModule(moduleId)
  return manifest ? t(manifest.titleKey) : moduleId
}

const weekMinutes = computed(() => toMinutes(secondsInLastDays(entries.value, 7, now.value)))
const totalMinutes = computed(() => toMinutes(totalSeconds(entries.value)))
const streak = computed(() => currentStreak(entries.value, now.value))

const series = computed<ChartSeries[]>(() =>
  CATEGORIES.map((category) => ({
    key: category,
    label: t(`category.${category}`),
    color: CATEGORY_COLOR[category],
  })),
)

const barRows = computed<BarRow[]>(() => {
  const rows = dailyTotals(entries.value, {
    days: CHART_DAYS,
    now: now.value,
    groups: CATEGORIES,
    groupOf: (entry) => categoryOf(entry.moduleId),
  })
  return rows.map((row, index) => ({
    key: row.day,
    // 由右往左每 7 天標一次，最後一根（今天）一定標得到
    label: (rows.length - 1 - index) % LABEL_EVERY === 0 ? shortDay(row.day) : '',
    values: Object.fromEntries(
      CATEGORIES.map((category) => [category, toMinutes(row.byGroup[category])]),
    ),
  }))
})

const shares = computed(() =>
  moduleShares(entries.value).map((share) => ({
    ...share,
    title: moduleTitle(share.moduleId),
    minutes: toMinutes(share.seconds),
    percent: Math.round(share.ratio * 100),
  })),
)

const progress = computed(() =>
  bpmSeries(entries.value)
    .slice(0, 4)
    .map((item) => ({
      id: `${item.moduleId} ${item.key}`,
      title: moduleTitle(item.moduleId),
      params: item.key.replaceAll('&', ' · '),
      values: item.points.map((point) => ({
        key: point.day,
        label: shortDay(point.day),
        value: point.bpm,
      })),
    })),
)

/** 明細篩選：全部或某一條線 */
const filter = ref<'all' | PracticeCategory>('all')
const filterOptions = computed(() => [
  { value: 'all', label: t('stats.allLines') },
  ...CATEGORIES.map((category) => ({ value: category, label: t(`category.${category}`) })),
])

const shown = ref(DETAIL_PAGE)
const filtered = computed(() =>
  [...entries.value]
    .filter((entry) => filter.value === 'all' || categoryOf(entry.moduleId) === filter.value)
    .sort((a, b) => b.date.localeCompare(a.date)),
)
const visible = computed(() => filtered.value.slice(0, shown.value))

/** 日期一律用數字格式：兩個語系讀起來一樣，也對得上 mono + tabular-nums 的排版 */
function formatDate(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return iso
  const time = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
  return `${at.getMonth() + 1}/${at.getDate()} ${time}`
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return minutes >= 1 ? `${minutes}m` : `${Math.round(seconds)}s`
}

const confirmingClear = ref(false)
function clearAll(): void {
  log.clearAll()
  confirmingClear.value = false
  shown.value = DETAIL_PAGE
}

const fileInput = ref<HTMLInputElement | null>(null)
async function onFilePicked(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) await backup.restore(file)
  if (fileInput.value) fileInput.value.value = ''
}
</script>

<template>
  <div class="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-8 p-6">
    <header class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h1 class="text-2xl font-semibold text-ink-50">{{ t('stats.title') }}</h1>
      <p class="text-sm text-ink-400">{{ t('stats.description') }}</p>
    </header>

    <p v-if="entries.length === 0" class="rounded-lg border border-ink-700 bg-ink-900 p-6 text-sm text-ink-400">
      {{ t('stats.empty') }}
    </p>

    <template v-else>
      <!-- 總覽卡 -->
      <section class="grid gap-3 sm:grid-cols-3">
        <div
          v-for="card in [
            { key: 'week', value: weekMinutes, unit: t('stats.minutes') },
            { key: 'streak', value: streak, unit: t('stats.days') },
            { key: 'total', value: totalMinutes, unit: t('stats.minutes') },
          ]"
          :key="card.key"
          class="flex flex-col gap-1 rounded-lg border border-ink-700 bg-ink-900 px-5 py-4"
        >
          <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">
            {{ t(`stats.${card.key}`) }}
          </span>
          <span class="font-mono text-3xl font-bold tabular-nums leading-none text-ink-50">
            {{ card.value }}<span class="ml-1.5 text-sm font-normal text-ink-400">{{ card.unit }}</span>
          </span>
        </div>
      </section>

      <!-- 近 4 週長條圖 -->
      <section class="flex flex-col gap-3">
        <h2 class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">
          {{ t('stats.daily', { days: CHART_DAYS }) }}
        </h2>
        <div class="rounded-lg border border-ink-700 bg-ink-900 p-5">
          <StackedBarChart
            :rows="barRows"
            :series="series"
            :unit="t('stats.minutes')"
            :ariaLabel="t('stats.dailyAria', { days: CHART_DAYS })"
          />
        </div>
      </section>

      <!-- 模組佔比 -->
      <section class="flex flex-col gap-3">
        <h2 class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">{{ t('stats.share') }}</h2>
        <ul class="flex flex-col gap-2 rounded-lg border border-ink-700 bg-ink-900 p-5">
          <li v-for="share in shares" :key="share.moduleId" class="flex items-center gap-3">
            <span class="w-40 shrink-0 truncate text-sm text-ink-100">{{ share.title }}</span>
            <span class="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-ink-800">
              <span
                class="block h-full rounded-full bg-ink-400"
                :style="{ width: `${Math.max(share.percent, 1)}%` }"
              />
            </span>
            <span class="w-24 shrink-0 text-right font-mono text-xs tabular-nums text-ink-400">
              {{ share.minutes }}{{ t('stats.minutes') }} · {{ share.percent }}%
            </span>
          </li>
        </ul>
      </section>

      <!-- BPM 進步線 -->
      <section v-if="progress.length" class="flex flex-col gap-3">
        <h2 class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">{{ t('stats.bpmProgress') }}</h2>
        <p class="max-w-[65ch] text-xs text-ink-400">{{ t('stats.bpmHint') }}</p>
        <div class="grid gap-4 sm:grid-cols-2">
          <div v-for="item in progress" :key="item.id" class="flex flex-col gap-2 rounded-lg border border-ink-700 bg-ink-900 p-4">
            <div class="flex flex-col gap-0.5">
              <span class="text-sm text-ink-100">{{ item.title }}</span>
              <span class="truncate font-mono text-[10px] text-ink-400">{{ item.params }}</span>
            </div>
            <LineChart
              :values="item.values"
              :unit="t('transport.bpm')"
              :ariaLabel="t('stats.bpmAria', { module: item.title })"
            />
          </div>
        </div>
      </section>

      <!-- 明細 -->
      <section class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">{{ t('stats.detail') }}</h2>
          <SegmentedControl v-model="filter" :options="filterOptions" :aria-label="t('stats.detail')" />
          <span class="font-mono text-[11px] tabular-nums text-ink-400">{{ filtered.length }}</span>
        </div>

        <div class="overflow-x-auto rounded-lg border border-ink-700 bg-ink-900">
          <table class="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr class="border-b border-ink-800 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-ink-400">
                <th class="px-4 py-2 font-normal">{{ t('stats.date') }}</th>
                <th class="px-4 py-2 font-normal">{{ t('stats.module') }}</th>
                <th class="px-4 py-2 text-right font-normal">{{ t('stats.duration') }}</th>
                <th class="px-4 py-2 text-right font-normal">{{ t('transport.bpm') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(entry, i) in visible" :key="`${entry.date}-${i}`" class="border-b border-ink-850 last:border-0">
                <td class="whitespace-nowrap px-4 py-2 font-mono text-xs tabular-nums text-ink-400">{{ formatDate(entry.date) }}</td>
                <td class="px-4 py-2 text-ink-100">{{ moduleTitle(entry.moduleId) }}</td>
                <td class="px-4 py-2 text-right font-mono text-xs tabular-nums text-ink-300">{{ formatDuration(entry.durationSec) }}</td>
                <td class="px-4 py-2 text-right font-mono text-xs tabular-nums text-ink-400">{{ entry.bpm }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <button
          v-if="filtered.length > visible.length"
          type="button"
          class="self-start rounded border border-ink-700 px-3 py-1 font-mono text-xs text-ink-400 hover:bg-ink-800 hover:text-ink-100"
          @click="shown += DETAIL_PAGE"
        >
          {{ t('stats.showMore') }}
        </button>
      </section>
    </template>

    <!-- 資料管理：新使用者也看得到（匯入是他們唯一需要的入口） -->
    <section class="flex flex-col gap-3 border-t border-ink-800 pt-6">
      <h2 class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">{{ t('stats.data') }}</h2>
      <p class="max-w-[65ch] text-xs text-ink-400">{{ t('stats.dataHint') }}</p>

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded border border-ink-700 bg-ink-800 px-3 py-1.5 text-xs text-ink-100 hover:bg-ink-700"
          @click="backup.download()"
        >
          {{ t('stats.export') }}
        </button>
        <button
          type="button"
          class="rounded border border-ink-700 bg-ink-800 px-3 py-1.5 text-xs text-ink-100 hover:bg-ink-700"
          @click="fileInput?.click()"
        >
          {{ t('stats.import') }}
        </button>
        <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="onFilePicked">

        <template v-if="entries.length">
          <span class="mx-1 h-4 w-px bg-ink-800" />
          <button
            v-if="!confirmingClear"
            type="button"
            class="rounded border border-ink-700 px-3 py-1.5 text-xs text-ink-400 hover:bg-ink-800 hover:text-ink-100"
            @click="confirmingClear = true"
          >
            {{ t('stats.clear') }}
          </button>
          <template v-else>
            <span class="text-xs text-ink-300">{{ t('stats.clearConfirm', { count: entries.length }) }}</span>
            <button
              type="button"
              class="rounded border border-ink-50 bg-ink-50 px-3 py-1.5 text-xs font-bold text-ink-950"
              @click="clearAll"
            >
              {{ t('stats.clearYes') }}
            </button>
            <button
              type="button"
              class="rounded border border-ink-700 px-3 py-1.5 text-xs text-ink-400 hover:bg-ink-800"
              @click="confirmingClear = false"
            >
              {{ t('stats.cancel') }}
            </button>
          </template>
        </template>
      </div>

      <p v-if="backup.error.value" class="text-xs text-ink-300">
        {{ t(`stats.importError.${backup.error.value}`) }}
      </p>
    </section>

    <AdSlot placement="stats" />
  </div>
</template>
