# Phase 4 PRD — 節奏練習線（Rhythm）

> 目標：把 click 系統升級為「示範節奏」系統——節奏譜視覺化 + 多音色示範 click，交付切分與律動風格專項練習。
> 結束狀態：使用者可選風格與切分 pattern，看著節奏譜、聽著示範 click（重音=撥弦、悶音=ghost）卡準節拍練習。
>
> **狀態：Phase 4 已完成**（驗收結果見 §4）。

## 1. 範圍

### In scope
- `RhythmSheet` 節奏譜組件
- 節奏 pattern 資料模型 + preset 庫（FUNK、SOUL、shuffle、6/8…）
- 模組 `rhythm.subdivision`：切分專項（4/8/16 分正反拍）
- 模組 `rhythm.groove`：律動風格跟練
- pattern 自訂編輯（點格子改角色）v1

### Out of scope
- 麥克風收音判定使用者是否卡準（未來擴充）；鼓組音色取樣（維持合成 click）

## 2. 功能需求

### F4-1 節奏 pattern 模型（`core/audio` 延伸）
```ts
type CellRole = 'accent' | 'normal' | 'ghost' | 'rest'
interface RhythmPattern {
  id: string; titleKey: string
  timeSig: [number, number]      // [6,8] 等
  subdivision: 4 | 8 | 16 | 'triplet'
  swing?: number                 // 0–100%，shuffle 用（8 分後半拍延後量）
  bars: CellRole[][]             // 每小節一格陣列，長度=細分數
  knowledge?: KnowledgeEntry[]
  defaultBpm: number
}
```
1. Transport 依 pattern 排程：`accent`/`normal`/`ghost` 各用對應音色，`rest` 不出聲但發 tick（游標照走）。
2. **swing/shuffle**：以三連音比例（或可調 %）延後反拍的排程時刻——排程層支援非等距細分。
3. 多小節 pattern（1–4 小節循環）。

### F4-2 節奏譜組件 `RhythmSheet`
1. 細分網格視覺化：一行一小節，每格依角色渲染（accent=實心大點、normal=中點、ghost=空心小點、rest=空白），拍與反拍有視覺分組（每拍一組、拍首加重刻度）。
2. 正反拍標示：拍點下標 `1 e & a / 1 & 2 &` 計數文字（i18n：中文口訣「答-嗒」可切換）。
3. **播放游標**：與 click 嚴格同步掃過網格（吃 `useTransportTick` + rAF）。
4. **編輯模式**：點擊格子循環切換角色（rest→normal→accent→ghost→rest），供自訂練習。
5. 響應式：16 分 × 4/4 一小節 16 格在手機上仍可辨識（橫向優先、可捲動）。

### F4-3 切分專項（`rhythm.subdivision`）
1. 課表式 preset 序列（由淺入深）：
   - 4 分正拍 → 8 分正反拍 → 反拍專練（只響 &）
   - 16 分：正拍組、e 位、a 位、混合切分（16th syncopation 經典 pattern 集）
   - 附點與連結線造成的跨拍切分入門
2. 每個 preset：節奏譜 + 示範 click 循環播放；使用者先聽數小節再跟刷。
3. 「示範 → 靜默」模式：示範 N 小節後 pattern 靜音只留拍首 click N 小節，考驗使用者自持節奏（N 可設 2/4）。
4. 練習日誌記錄（preset id、BPM、時長）。

### F4-4 律動風格跟練（`rhythm.groove`）
1. 風格 preset 庫（每風格 3–5 個經典 pattern + 知識卡）：
   - **FUNK**：16 分底、大量 ghost、one 的強調（James Brown 的「on the one」）
   - **SOUL / R&B**：8 分為主的鬆緊、反拍重音
   - **Shuffle / Blues**：三連音 feel、swing % 可調（50% 直拍 → 66% 全 shuffle）
   - **6/8**：慢板 6/8（blues/gospel 常用）、兩大拍 feel 與六小拍 feel 切換
2. 背景和弦提示（極簡）：畫面顯示建議和弦名（如 E9 vamp），**不做**指板同步與進行引擎——聚焦節奏。
3. 知識卡：ghost note 是什麼、為什麼 funk 要「鎖 16 分格線」、shuffle 與 swing 的差別、6/8 與 3/4 的差別。
4. 自訂：從任一 preset 進編輯模式改格子另存（localStorage）。

## 3. UI 佈局（桌機）
```
┌─────────────────────────────────────────────┐
│ 風格 ▾  Pattern ▾   建議和弦: E9   [知識▸]     │
├─────────────────────────────────────────────┤
│  RhythmSheet                                │
│  ● · ○ ·│● · · ○│● ○ · ·│● · ○ ·   ← 游標    │
│  1 e & a  2 e & a  3 e & a  4 e & a          │
├─────────────────────────────────────────────┤
│ 示範/靜默: [示範4+靜默4]  swing: ──○── 62%     │
├─────────────────────────────────────────────┤
│ TransportBar：▶ ■  BPM 96  4/4  16分  🔊      │
└─────────────────────────────────────────────┘
```

## 4. 驗收標準（Phase DoD）
- [x] 三音色示範 click 依 pattern 正確發聲；`rest` 照發 tick 但不出聲（游標照走）
- [x] swing % 調整即時生效且排程等時性正確（全 shuffle 時反拍落在三連音第 3 格，
      單元測試逐格鎖時刻；中途改 swing 時間仍單調遞增）
- [x] 6/8 與三連音細分的計數、游標、click 全部正確；細分標籤隨拍號分母改變（6/8 的一拍兩格＝16）
- [x] 示範→靜默循環模式運作正確（靜默小節只留小節首 click，畫面反白標示「靜默中」）
- [x] 編輯模式改格於下一個小節線生效；自訂 pattern 存於 localStorage，可「回復預設」
- [x] 切分課表 4 級 12 個 pattern + 4 風格 14 個 pattern + 9 條雙語知識卡上線
- [x] 375px 手機：頁面不橫捲、節奏譜在自己的容器內捲動且游標自動跟捲

### 本 Phase 的實作決策（補充規格）
1. **pattern → 時刻表的編譯層**（`core/audio/pattern.ts`）：swing 的位移邏輯不進 Transport
   的時間推進處，而是先編譯成「每格的角色 + 距小節起點的偏移（單位＝拍）」。
   Transport 只累加相鄰兩格的偏移差 × 每拍秒數，因此換 BPM 不必重編譯、
   加新 feel 不必動排程核心。
2. **swing 的精確值是 200/3（≈66.7%），UI 顯示 67%**。業界慣稱「66%」，但 66 與三連音
   第 3 格差 0.7%，每拍都會差一點；排程一律用精確值，滑桿另提供「全 shuffle」快速鍵。
   16 分細分時 swing 同時作用於 1-e 與 &-a 兩對；三連音與正拍細分不套 swing（本身就是目的地）。
3. **播放中換拍號／細分／pattern 一律對齊小節線**（原契約是「僅停止中可切換」）。
   核心的每小節重編譯讓這件事幾乎免費，而且是唯一musically 正確的語意——
   不對齊小節就會留下一個長度不明的殘拍。TransportBar 的 disabled 因此取消。
4. **pattern 掛上時由它決定拍號與細分**，TransportBar 該區轉為唯讀顯示。
   否則會出現「譜上畫 16 分、click 卻響 8 分」。
5. **換到不同拍值（unit）的 pattern 時採用 preset 的 defaultBpm**。BPM 的「一拍」＝拍號分母，
   4/4 的 90 與 6/8 的 90 是兩種速度，沿用舊值沒有意義；同拍值之間尊重使用者調過的 BPM。
6. **課表 pattern 不可編輯，只有律動風格可以**。「e 位專練」被改成別的東西，分級就失去意義；
   自訂的需求由 F4-4.4 承擔。
7. **計數列以 token 回傳、字面交給 i18n**：`counting.ts` 只算「這格該念哪個音節」，
   numeric（`1 e & a`）與中文口訣（正拍「答」、半拍「嗒」、16 分 e/a 位「的」）各自是一組翻譯。
   口訣給 e/a 另一個音節，念出來才分得出落在哪一格。
8. **節奏譜格寬用 CSS 變數 + 斷點，不用 flex 伸縮**。巢狀 flex 的 min-content 推導在
   「格子有下限、容器又要貼齊內容」這組條件下不可靠（實測會讓拍組比自己的格子還窄、
   格子互相重疊）。斷點決定格寬（38／30／26px）、scroller 負責溢出，行為才可預測。
9. **休止格改用 `ink-950`**（design-system 原訂 `ink-900`）：譜面板本身是 `ink-900`，
   同色會讓休止格整個消失。design-system.md §5 已同步更新。
10. **細分標籤由 `subdivisionLabel(unit, ticksPerBeat)` 算出**，不再寫死 4/8/8T/16 一張表——
    音符值 = 拍值分母 × 細分數，寫死的表在 6/8 底下會標錯（這是 Phase 1 就存在、
    到 Phase 4 才顯形的錯誤）。

## 5. 風險
| 風險 | 對策 |
|---|---|
| 非等距排程（swing）與細分切換的複雜度 | 排程統一走「pattern → 絕對時刻表」編譯步驟，Transport 只吃時刻表；單元測試鎖時刻 |
| 16 格網格在手機過窄 | 一小節一行、格寬下限 + 橫向捲動；游標自動跟捲 |
| 使用者聽不出 ghost 與 normal 差異 | 音色對比在真實裝置（手機外放）上調校；提供每音色音量獨立調整 |
