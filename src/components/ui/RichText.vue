<script setup lang="ts">
/**
 * 知識內容區塊渲染（純顯示）。行內僅支援 **粗體**，見 content/knowledge/types.ts。
 */
import { parseInline, type ContentBlock } from '@/content/knowledge'

defineProps<{ blocks: readonly ContentBlock[] }>()
</script>

<template>
  <div class="flex max-w-[65ch] flex-col gap-3">
    <template v-for="(block, i) in blocks" :key="i">
      <p v-if="block.type === 'paragraph'" class="rcs-body text-ink-300">
        <template v-for="(span, j) in parseInline(block.text)" :key="j">
          <strong v-if="span.strong" class="font-semibold text-ink-50">{{ span.text }}</strong>
          <template v-else>{{ span.text }}</template>
        </template>
      </p>
      <ul v-else class="flex flex-col gap-2">
        <li v-for="(item, j) in block.items" :key="j"
            class="rcs-body border-l border-ink-700 pl-3 text-ink-300">
          <template v-for="(span, k) in parseInline(item)" :key="k">
            <strong v-if="span.strong" class="font-semibold text-ink-50">{{ span.text }}</strong>
            <template v-else>{{ span.text }}</template>
          </template>
        </li>
      </ul>
    </template>
  </div>
</template>
