<script setup lang="ts">
/**
 * 快捷鍵說明（PRD F5-4.1 的 `?` 面板）。
 * 純顯示：開關狀態在 shortcuts store，鍵盤處理在 useKeyboardShortcuts。
 *
 * 無障礙：role=dialog + aria-modal，開啟時把焦點移到關閉鈕，Esc 關閉（由鍵盤層處理）。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useShortcutsStore } from '@/stores/shortcuts'

const { t } = useI18n()
const shortcuts = useShortcutsStore()
const closeButton = ref<HTMLElement | null>(null)

const rows = computed(() => [
  { keys: ['Space'], label: t('shortcuts.play') },
  { keys: ['↑', '↓'], label: t('shortcuts.bpm') },
  { keys: ['Shift', '↑', '↓'], label: t('shortcuts.bpmLarge') },
  { keys: ['←', '→'], label: t('shortcuts.preset') },
  { keys: ['?'], label: t('shortcuts.help') },
  { keys: ['Esc'], label: t('shortcuts.close') },
])

watch(() => shortcuts.helpOpen, async (open) => {
  if (!open) return
  await nextTick()
  closeButton.value?.focus()
})
</script>

<template>
  <div
    v-if="shortcuts.helpOpen"
    class="fixed inset-0 z-50 grid place-items-center bg-ink-950/80 p-6"
    @click.self="shortcuts.closeHelp()"
  >
    <div
      class="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-ink-700 bg-ink-900 p-6"
      role="dialog"
      aria-modal="true"
      :aria-label="t('shortcuts.title')"
    >
      <div class="flex items-baseline gap-3">
        <h2 class="text-lg font-semibold text-ink-50">{{ t('shortcuts.title') }}</h2>
        <button
          ref="closeButton"
          type="button"
          class="ml-auto rounded px-2 py-1 font-mono text-xs text-ink-400 hover:bg-ink-800 hover:text-ink-100"
          @click="shortcuts.closeHelp()"
        >
          {{ t('shortcuts.dismiss') }}
        </button>
      </div>

      <dl class="flex flex-col gap-2.5">
        <div v-for="row in rows" :key="row.label" class="flex items-baseline gap-3">
          <dt class="flex shrink-0 items-center gap-1">
            <kbd
              v-for="key in row.keys"
              :key="key"
              class="rounded border border-ink-700 bg-ink-800 px-1.5 py-0.5 font-mono text-[11px] text-ink-100"
            >{{ key }}</kbd>
          </dt>
          <dd class="text-sm text-ink-400">{{ row.label }}</dd>
        </div>
      </dl>

      <p class="text-xs text-ink-400">{{ t('shortcuts.typingHint') }}</p>
    </div>
  </div>
</template>
