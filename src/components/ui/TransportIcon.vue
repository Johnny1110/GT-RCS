<script setup lang="ts">
/**
 * 播放／停止圖示（純顯示）。
 *
 * 為什麼不用 ▶ ■ 這兩個字元：它們在 iOS、Android 與部分 Windows 字型上會被
 * 當成 emoji 算繪，變成彩色、尺寸失控、基線也對不齊——一顆黑白面板上的播放鍵
 * 突然出現一個彩色三角形，而且我們無法用 CSS 修正它。畫成 SVG 就沒有這個變數。
 *
 * 兩個形狀都做過光學修正，這是「看起來對」與「量起來對」的差別：
 * - **三角形右移**：幾何置中的三角形看起來偏左（質量集中在左邊的底），
 *   所以把重心放到中線上，而不是把外框放到中線上。
 * - **方形縮小**：等寬的方形面積遠大於三角形，並排看會覺得停止鍵比播放鍵重。
 *   邊長取 9（面積 81）去逼近三角形的 77，兩個狀態切換時份量才不會跳動。
 */
withDefaults(defineProps<{ playing: boolean; size?: number }>(), { size: 18 })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <!-- 停止：圓角 1（24 格上的 1 ≈ 面板控制元件的 4px 圓角等比縮放） -->
    <rect v-if="playing" x="7.5" y="7.5" width="9" height="9" rx="1" />
    <!-- 播放：重心 x = (8.5+19.5+8.5)/3 = 12.17，略右於中線 -->
    <path
      v-else
      d="M8.5 5 L19.5 12 L8.5 19 Z"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linejoin="round"
    />
  </svg>
</template>
