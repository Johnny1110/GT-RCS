<script setup lang="ts">
/**
 * 速度控制（純顯示組件：狀態由 TransportBar 這個 container 傳進來）。
 *
 * 這一組是整個 app 被碰最多次的控制項，所以它給了四條抵達同一個數字的路，
 * 每一條對應吉他手真的會有的念頭：
 *
 * | 念頭 | 控制 |
 * |---|---|
 * | 「這首歌聽起來像這樣」 | **TAP**——耳朵直接變成數字，不必先猜再逼近 |
 * | 「太快了，慢一點」 | **− / +**——一次 1 BPM，這是練習真正的解析度 |
 * | 「這禮拜練 84」 | **點數字直接輸入**——精確值不該用滑桿逼近 |
 * | 「大概快一點」 | **滑桿**——粗調 |
 *
 * 原本只有滑桿。30–300 攤在 112px 上，一個像素約 2.4 BPM——
 * 「調到 84」這件事在滑桿上做不到，而那是練琴最常說的一句話。
 *
 * 數字輸入採草稿模式（draft）而不是即時寫入：打「105」的過程會經過 1 與 10，
 * 即時寫入會讓速度先掉到下限再彈回來，播放中聽得一清二楚。
 * 因此只在 Enter 與 blur 時提交，Esc 放棄。
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { BPM_MAX, BPM_MIN, TAP_MIN_TAPS } from '@/core/audio'

const props = defineProps<{
  bpm: number
  /** 本次敲擊測量已敲幾下；0 = 沒有正在進行的測量 */
  taps: number
}>()

const emit = defineEmits<{
  (e: 'update:bpm', value: number): void
  (e: 'tap'): void
}>()

const { t } = useI18n()

/** 非 null＝正在編輯，此時畫面顯示草稿而不是 store 的值 */
const draft = ref<string | null>(null)
const display = computed(() => draft.value ?? String(props.bpm))

function nudge(delta: number): void {
  emit('update:bpm', props.bpm + delta)
}

function commit(): void {
  const value = Number(draft.value)
  // 空字串會被 Number() 變成 0，那不是使用者的意思——放棄比夾到下限誠實
  if (draft.value !== null && draft.value.trim() !== '' && Number.isFinite(value)) {
    emit('update:bpm', value)
  }
  draft.value = null
}

function onFocus(event: FocusEvent): void {
  draft.value = String(props.bpm)
  // 全選：接手一個已經有值的欄位時，使用者要的幾乎都是「換掉它」而不是「接在後面打」
  ;(event.target as HTMLInputElement).select()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    commit()
    ;(event.target as HTMLInputElement).blur()
  } else if (event.key === 'Escape') {
    draft.value = null
    ;(event.target as HTMLInputElement).blur()
  }
}

/** 還沒敲夠次數時提示還差幾下；夠了就顯示目前的敲擊數 */
const tapLabel = computed(() => {
  if (props.taps === 0) return t('transport.tap')
  if (props.taps < TAP_MIN_TAPS) return t('transport.tapMore', { n: TAP_MIN_TAPS - props.taps })
  return `${t('transport.tap')} · ${props.taps}`
})
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <span class="rcs-micro">{{ t('transport.bpm') }}</span>

    <div class="flex items-center gap-2">
      <button
        type="button"
        class="rcs-step"
        :disabled="bpm <= BPM_MIN"
        :aria-label="t('transport.bpmDown')"
        @click="nudge(-1)"
      >−</button>

      <!-- 讀數本身就是輸入框：hover／focus 才浮出邊框，靜止時它是一個儀表數字 -->
      <input
        class="rcs-tempo"
        type="number"
        inputmode="numeric"
        :min="BPM_MIN"
        :max="BPM_MAX"
        :value="display"
        :aria-label="t('transport.bpm')"
        :title="t('transport.bpmEditHint')"
        @focus="onFocus"
        @input="draft = ($event.target as HTMLInputElement).value"
        @blur="commit"
        @keydown="onKeydown"
      >

      <button
        type="button"
        class="rcs-step"
        :disabled="bpm >= BPM_MAX"
        :aria-label="t('transport.bpmUp')"
        @click="nudge(1)"
      >+</button>

      <input
        class="rcs-range w-24"
        type="range"
        :min="BPM_MIN"
        :max="BPM_MAX"
        :value="bpm"
        :aria-label="t('transport.bpmCoarse')"
        @input="emit('update:bpm', Number(($event.target as HTMLInputElement).value))"
      >

      <!--
        測量進行中反白：選取即反白是全站規則，而「正在敲」就是這顆鈕的選取狀態。
        寬度固定，'TAP' 與 'TAP · 4' 之間切換時整條控制列不會位移。
      -->
      <button
        type="button"
        class="h-8 w-[5.5rem] shrink-0 rounded border font-mono text-xs tabular-nums transition-colors motion-reduce:transition-none"
        :class="taps > 0
          ? 'border-ink-50 bg-ink-50 font-bold text-ink-950'
          : 'border-ink-700 bg-ink-800 text-ink-300 hover:bg-ink-700 hover:text-ink-50'"
        :title="t('transport.tapHint')"
        @click="emit('tap')"
      >{{ tapLabel }}</button>
    </div>
  </div>
</template>
