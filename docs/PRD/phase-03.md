# Phase 3 PRD — 和弦練習線（Chords）

> **狀態：Phase 3 已完成**（驗收結果見 §4）。
>
> 目標：交付五度圈通用組件與和弦進行引擎，上線兩個核心練習模組。
> 結束狀態：使用者可沿五度圈 12 調跟練經典進行（五度圈 highlight + 指板同步 + click），或在固定調內做分級和弦練習，並閱讀每個進行的知識內容。

## 1. 範圍

### In scope
- `CircleOfFifths` 通用組件（雙層環 + 互動 + 跟練同步）
- `core/theory` 進行引擎（羅馬數字/級數 → 任意調實際和弦）
- 模組 `chords.circle-progressions`：五度圈經典進行跟練（12 調循環）
- 模組 `chords.key-practice`：固定調分級練習
- 和弦知識內容（每個進行的歷史/應用；調式互換等樂理卡）

### Out of scope
- 和弦發聲（Phase 5）、自訂進行編輯器（Phase 5）、把位指型圖（非目標，見 overview）

## 2. 功能需求

### F3-1 五度圈組件 `CircleOfFifths`
1. SVG 雙層環：外圈 12 大調（C 頂端、順時針 G→D→A…），內圈關係小調（Am 對齊 C）；vii° 以外圈上的小徽章標註（如 C 調的 B°）。
2. **互動模式**：點外圈或內圈任一音為主音 → highlight 調內 7 和弦：外圈 I/IV/V + 內圈 ii/iii/vi + vii° 徽章；再點一次取消。大調/小調主音皆可（點內圈 Am = A 小調視角，highlight 同一組 7 和弦但級數重排）。
3. **跟練模式（受控）**：props 傳入 `currentKey` 與 `currentChord` → 組件不處理互動，僅渲染：當前調的 7 和弦常亮、當前和弦強調（脈衝與 click 拍點同步，吃 `useTransportTick`）。
4. 通用性：純 props/events（`select`、`v-model:tonic`），不依賴任何練習模組；尺寸自適應容器。
5. 每個扇形顯示調號提示（外圈可切換顯示 #/b 數量）。

### F3-2 進行引擎（`core/theory/progressions`）
1. 記法解析：接受數字簡寫（`2516`、`4536251`、`1645`）與完整級數記號（`ii V7 Imaj7 vi`、`I bVII IV I`、`V/ii`）。
2. 品質推導：純數字時依大調 diatonic 推導預設品質（2→ii=m7、5→V7、1→Imaj7…，三和弦/七和弦層級可設定）；完整記號時尊重顯式品質。
3. 支援調外：調式互換（`iv`、`bVII`、`bVI`、`bIII`）、副屬和弦（`V/x`）。
4. 展開：`(progression, key, bars) → Bar[]`，每小節一或多個和弦（支援一小節兩和弦，如 2516 常見的 | ii V | I | 排法由 preset 定義）。

```ts
interface ProgressionPreset {
  id: string; titleKey: string
  tokens: string            // 'ii V7 Imaj7 vi'
  barsPerChord: number[]    // 每和弦小節配置
  knowledge: KnowledgeEntry[]
  defaultBpm: number
}
```

### F3-3 五度圈經典進行跟練（`chords.circle-progressions`）
1. **預設進行庫（v1）**，每個附 BPM 預設與知識內容：
   - `2516`（ii–V–I–vi）：爵士標準 turnaround，Autumn Leaves 到 bossa 都在用
   - `4536251`：J-pop/C-pop 王道進行（丸之內進行變體）
   - `1645`（I–vi–IV–V）：50 年代 doo-wop／Stand by Me
   - `6415`（vi–IV–I–V）：四和弦流行進行（Axis of Awesome 梗的本尊）
   - 卡農進行（I–V–vi–iii–IV–I–IV–V）
   - 12 小節藍調（I7 IV7 V7，quick change 變體開關）
2. **12 調循環**：沿五度圈**逆時針**（C→F→Bb…，即實際的五度下行）走完 12 調；每調 8 小節（可調 4/8/16），調與調之間可設 1 小節空拍緩衝。
3. **跟練畫面**：
   - 五度圈（跟練模式）：當前調常亮、當前和弦脈衝
   - 和弦時間軸：當前小節 + 下一個和弦預告（提前一小節提示，換把來得及）
   - **指板同步**：顯示當前和弦組成音全指板覆蓋（根音白、其他依度數色）——每次和弦切換即時更新
   - TransportBar：BPM、起始調、循環開關
4. 進度：完成 12 調一輪顯示總結（總時長、BPM），寫入練習日誌。
5. 知識卡：進行的歷史、應用場景、聆聽建議曲目。

### F3-4 固定調分級練習（`chords.key-practice`）
1. 選定一個調（12 大調），選擇級別課表：
   - **Level 1 入門三和弦**：I–IV–V–vi 基本循環
   - **Level 2 全 diatonic**：加入 ii、iii、vii°，多種排列進行
   - **Level 3 七和弦**：diatonic 七和弦（Imaj7、ii m7、V7…）
   - **Level 4 藍調屬七**：12 小節藍調、全屬七（I7/IV7/V7）、shuffle 拍建議
   - **Level 5 Fusion / Neo-soul**：延伸音（9、11、13）、借用 iv、bVII、副屬 V/ii V/V、2-5 連鎖
2. 每級數個進行 preset，跟練畫面同 F3-3（無 12 調循環，固定調、AB 循環）。
3. 知識卡（本 Phase 重點內容）：
   - 「為什麼 C 大調可以接 Fm」：調式互換／自平行小調借用 iv，b6（Ab）下行到 5 的哀愁半音進行
   - 副屬和弦是什麼、bVII 的 Mixolydian 借用、藍調為何全用屬七不算「錯」
   - Neo-soul 常用手法（m9/maj9 色彩、平行移動）
4. 指板同步顯示當前和弦組成音（同 F3-3）。

## 3. UI 佈局（跟練畫面，桌機）
```
┌───────────────────────┬────────────────────┐
│                       │  當前: Dm7  下一個: G7 │
│    CircleOfFifths     │  小節 3/8   調 2/12   │
│    (highlight 同步)    │  ┌───────────────┐  │
│                       │  │ 知識卡（折疊）    │  │
├───────────────────────┴──┴───────────────┴──┤
│         Fretboard：當前和弦組成音全覆蓋         │
├─────────────────────────────────────────────┤
│ TransportBar：▶ ■  BPM 80  4/4  循環  🔊      │
└─────────────────────────────────────────────┘
```
行動版：五度圈與指板上下堆疊，五度圈可收合為當前調徽章。

## 4. 驗收標準（Phase DoD）
- [x] 五度圈：12 調的 diatonic 位置以樂理引擎交叉驗證（圈上標出的音必須等於該調 I/IV/V 與 ii/iii/vi 的根音）
- [x] 進行引擎：2516 在 12 個調的展開為手寫快照；所有 preset × 12 調皆能展開且無未解析記號
- [x] 跟練：和弦切換、五度圈當前和弦圈選、指板組成音三者同吃 transport 小節數；「下一個和弦」提前一小節
- [x] 12 調循環：瀏覽器實測依五度下行推進（C → F → Bb → Eb），並寫入練習日誌
- [x] 6 個預設進行 + 5 級課表（共 16 個進行）+ 11 條雙語知識內容上線
- [x] 指板同步更新：和弦切換即重算 cells，無可感知延遲

### 本 Phase 的實作決策（補充規格）
1. **parseProgression 增加 harmonyLevel 參數**：ProgressionToken.quality 是已解析的，
   但品質推導需要 harmonyLevel，而它原本只存在於 RealizeOptions——契約缺口，於實作時補上
   （預設 'seventh'，符合純數字簡寫的原規格）。
2. **品質推導分兩條路**：純 diatonic 查級數表（保留 V7 與 Imaj7 的功能差異），
   借用或大小寫與自然品質相反（如大調的 iv）則依大小寫給 maj/m。單看大小寫分不出 Imaj7 與 V7。
3. **五度圈內外圈對齊**：ii 在 IV 正下方、vi 在 I 下、iii 在 V 下（每個小三和弦位於其關係大調下方），
   使「調內 7 個和弦」在圖上是連續三格區塊。初版寫錯（ii/iii 對調），由交叉驗證測試抓出。
4. **dim 以 'dim' 而非 '°' 顯示**：小尺寸下度數符號容易誤讀。
5. **和弦符號不得套用 uppercase**：Cmaj7 被 CSS 轉成 CMAJ7 是錯誤記法，
   micro 標籤與和弦名拆成兩個 span。
6. **指板置於知識卡之前**：練習中要看的是指板，知識卡是練前練後才讀。

## 5. 風險
| 風險 | 對策 |
|---|---|
| 五度圈 SVG 幾何 + 三層資訊擁擠 | 先做靜態視覺 spike 校 layout，再接互動；vii° 用徽章而非第三環全環 |
| 級數記法 parser 範圍膨脹 | v1 鎖定文法白名單（diatonic + 指定借用 + V/x），其餘報錯不猜 |
| 換和弦視覺提示太晚使用者跟不上 | 「下一個和弦」預告固定提前一小節；緩衝空拍小節可開關 |
