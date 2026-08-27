<script setup lang="ts">
/**
 * 拍燈：當前拍亮白，其餘暗。資料來自 Transport 的 tick（不自走時鐘）。
 *
 * 兩個設計決定，都是為了「眼睛只掃一眼」：
 *
 * **1. 第一拍的暗態比較亮（ink-600 vs ink-700）。**
 * 原本每顆燈長得一樣，於是掃一眼只知道「有一顆亮著」，不知道那是第 2 拍還是第 4 拍
 * ——要知道就得從頭數，而練琴的時候眼睛沒有空數。用亮度標出小節的起點，
 * 位置就變成一眼可讀的。用亮度而不是加白圈，是因為白圈在全站是「就是這個」的意思
 * （指板題目標記、五度圈當前和弦、琶音當前音），拿來標小節起點會和那套語言打架；
 * 而「重拍比較亮／比較重」已經是節奏譜在用的語言（重音＝實白、一般＝實灰）。
 *
 * **2. 亮起是瞬間，暗下有餘韻（attack 0ms / decay 220ms）。**
 * 兩個方向都用同一個時長的話，燈會「淡入」——視覺就晚於聲音，看起來像拖拍。
 * 亮起必須是零延遲才對得上 click；而暗下如果也瞬間，快速的拍子看起來會像頻閃。
 * 留一段衰減，整排燈就有了包絡，跟撥弦的餘韻是同一個形狀。
 * 做法是把 transition 掛在暗態、亮態把時長改成 0——類別加上去的瞬間不過渡，
 * 拿掉的時候才走衰減。
 */
withDefaults(
  defineProps<{
    beats: number
    current: number
    active: boolean
    size?: number
    gap?: number
  }>(),
  { size: 10, gap: 8 },
)
</script>

<template>
  <div class="flex items-center" :style="{ gap: `${gap}px` }" role="presentation">
    <span
      v-for="n in beats"
      :key="n"
      class="rcs-lamp"
      :class="[
        active && current === n ? 'rcs-lamp--on' : '',
        n === 1 ? 'rcs-lamp--downbeat' : '',
      ]"
      :style="{ width: `${size}px`, height: `${size}px` }"
    />
  </div>
</template>
