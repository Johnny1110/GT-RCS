<script setup lang="ts">
/**
 * 首頁：三大類導覽（由模組註冊表生成，新增模組自動出現）。
 */
import { useI18n } from 'vue-i18n'
import { modulesByCategory } from '@/modules/registry'
import type { PracticeCategory } from '@/modules/types'

const { t } = useI18n()
const categories: PracticeCategory[] = ['rhythm', 'chords', 'scales']
</script>

<template>
  <div class="mx-auto flex max-w-4xl flex-col gap-12 p-6 pt-12">
    <header class="flex flex-col gap-3">
      <h1 class="font-mono text-3xl font-bold tracking-[0.04em] text-ink-50">RCS</h1>
      <p class="max-w-xl text-ink-300">{{ t('app.tagline') }}</p>
    </header>

    <section v-for="category in categories" :key="category" class="flex flex-col gap-3">
      <div class="flex items-baseline gap-3">
        <h2 class="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">
          {{ t(`category.${category}`) }}
        </h2>
        <span class="font-mono text-[11px] tabular-nums text-ink-400">
          {{ modulesByCategory(category).length }}
        </span>
      </div>

      <p v-if="modulesByCategory(category).length === 0" class="text-sm text-ink-400">
        {{ t('app.comingSoon') }}
      </p>

      <div v-else class="grid gap-3 sm:grid-cols-2">
        <RouterLink
          v-for="m in modulesByCategory(category)"
          :key="m.id"
          :to="m.route"
          class="flex flex-col gap-1 rounded-lg border border-ink-700 bg-ink-900 p-4 transition-colors hover:border-ink-500 hover:bg-ink-800 motion-reduce:transition-none"
        >
          <span class="font-medium text-ink-50">{{ t(m.titleKey) }}</span>
          <span class="text-sm text-ink-400">{{ t(m.descriptionKey) }}</span>
        </RouterLink>
      </div>
    </section>
  </div>
</template>
