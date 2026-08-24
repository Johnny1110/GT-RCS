# Phase 1 PRD — 基礎建設（Foundation）

> 目標：蓋好全站共用的地基——樂理引擎、色彩系統、Click 引擎、指板組件、模組框架。
> 結束狀態：可部署的 App shell，內含「指板遊樂場 + 節拍器」demo 頁，證明三大核心（樂理計算、顏色、click 精準度）都成立。

## 1. 範圍

### In scope
- 專案骨架：Vite + Vue 3 + TS(strict) + Pinia + Vue Router + Tailwind + vue-i18n + Vitest
- `core/theory` 樂理引擎（純 TS、完整單元測試）
- `core/colors` 12 音程色彩 token
- `core/audio` Click／Transport 引擎 v1
- `Fretboard` 指板組件 v1
- `TransportBar` 播放控制列（BPM／拍號／播放停止／音量）
- 練習模組框架（registry → 路由 → 首頁導覽）
- localStorage 持久化層（settings，含版本 migration 骨架）
- App shell：深色主題、響應式 layout、語言切換
- Demo 頁：指板遊樂場（選調＋音階即時顯示）、獨立節拍器頁

### Out of scope
- 五度圈組件（Phase 3）、節奏譜組件（Phase 4）、練習日誌 UI（Phase 2）、和弦發聲（Phase 5）

## 2. 功能需求

### F1-1 樂理引擎 `core/theory`
1. **Pitch class 運算**：音 = 0–11；移調、音程差計算。
2. **音名拼寫**：給定調性與 pitch class，輸出正確音名（F# 大調 → E#；Db 大調 → Db 不是 C#）。實作採五度線（line of fifths）拼寫，升降記號調各自正確。
3. **和弦公式表（const）**：`maj, min, dim, aug, sus2, sus4, 6, m6, maj7, m7, 7, m7b5, dim7, mMaj7, add9, 9, m9, maj9, 13` — 以度數集合定義，如 `{ '7': ['1','3','5','b7'] }`。
4. **音階公式表（const）**：Ionian、Dorian、Phrygian、Lydian、Mixolydian、Aeolian、Locrian、大調五聲、小調五聲、藍調（小調藍調六音）、和聲小調、旋律小調。
5. **展開 API**：`spell(root, formula) → Note[]`（含正確音名與度數標記）。
6. **指板推導**：`mapToFretboard(tuning, fretCount, notes) → FretCell[]`，`tuning` 參數化（預設 EADGBE、22 格）。

```ts
type Degree = '1'|'b2'|'2'|'b3'|'3'|'4'|'#4'|'5'|'b6'|'6'|'b7'|'7'
interface Note { pc: number; name: string; degree: Degree }
interface FretCell { string: number; fret: number; note: Note }
```

**驗收**：Vitest 覆蓋所有公式與拼寫邊界（F#/Gb、E#/Cb、enharmonic），12 調 × 全部音階/和弦快照測試。

### F1-2 色彩系統 `core/colors`
1. 12 度數 → 色票 mapping（見 overview §4.2），輸出為 Tailwind theme token 與 TS const 雙形式。
2. 每色附亮色底＋深色字的配對，深色背景（zinc-900）下對比度 ≥ WCAG AA（4.5:1，以音點上的度數文字為準）；不足者於此 Phase 調校定稿。

### F1-3 Click／Transport 引擎 `core/audio`
1. **Lookahead scheduler**：timer 每 25ms 醒來，把未來 100ms 內的拍點以 `AudioContext` clock 排程；UI 卡頓不影響出聲時刻。
2. **Transport**：play/stop、BPM 30–300（播放中可調，下一拍生效）、拍號（4/4、3/4、2/4、6/8、12/8）、細分（1/4、1/8、1/16、三連音）、小節/拍計數、AB 循環（供「每調 8 小節」使用）。
3. **三音色合成**（OscillatorNode + envelope，零外部資源）：`accent`（亮高頻）、`normal`、`ghost`（低通弱音）；各自音量 0–100%、可靜音。
4. **Tick 事件**：排程同時 push `{ audioTime, bar, beat, subdivision, role }` 到佇列；提供 `useTransportTick()` composable，UI 以 rAF 對 `audioContext.currentTime` 消費 → 保證視覺與聲音同步。
5. iOS/Safari 相容：首次手勢解鎖 AudioContext。

**驗收**：連續播放 10 分鐘無漂移（以排程 log 驗證拍距誤差 < 1ms）；BPM/拍號切換不炸拍；背景分頁回來不亂序。

### F1-4 指板組件 `Fretboard`
1. SVG 橫式、空弦 + 22 格、高音 e 在上；3/5/7/9/15/17/19/21 單點、12 雙點指位記號。
2. Props：`cells: FretCell[]`（要亮的音）、每個音點渲染度數文字 + 對應色。純顯示組件、無樂理邏輯。
3. 響應式：桌機全幅等比縮放；< 768px 橫向捲動並提供把位跳轉（0/5/12 快捷）。

### F1-5 模組框架 + App shell
1. `PracticeModule` interface + registry（見 overview §4.7）；registry 自動生成路由與首頁分類導覽卡（節奏／和弦／音階三區）。
2. 深色主題 layout：頂欄（logo、語言切換）、內容區、TransportBar（練習頁常駐底部）。
3. i18n：vue-i18n 就緒，zh-TW 預設 + en，介面字串全部走 key。
4. 持久化：`settings` store ↔ localStorage 同步，schema 帶 `version` 欄位與 migration 入口。

### F1-6 Demo 頁（驗證用，日後演化為正式功能）
1. **指板遊樂場**：選主音 + 音階 → 指板即時顯示（吃 F1-1＋F1-2＋F1-4）。
2. **節拍器**：TransportBar 完整操作 + 拍點視覺閃爍（吃 F1-3）。

## 3. 技術設計要點

> **規範性文件**：本 Phase 起，分層依賴規則、設計模式、反模式清單以 [docs/architecture.md](../architecture.md) 為準；PRD 描述「做什麼」，architecture.md 約束「怎麼做」。
>
> **狀態：Phase 1 已完成**（詳見本文件 §4 驗收結果與 `docs/architecture.md` §9 基線）。
- `core/**` 不 import Vue —— 純 TS，可測可攜。
- Transport 為單例 store（Pinia），全站練習共用一顆時鐘。
- 色彩 token 同時輸出 CSS variables，SVG 內 `fill: var(--degree-b3)` 直接引用。

## 4. 驗收標準（Phase DoD）
- [x] `npm run test` 綠燈：65 個測試（56 通過 + 9 個 Phase 3 規格 todo），theory 全公式與拼寫邊界鎖定
- [x] `npm run build` 成功：首屏 61.6 KB gz（預算 200 KB），練習模組各自分包 lazy load
- [x] 節拍器穩定性：以 ManualClock 模擬 240 BPM×10 分鐘，累積漂移 < 1ms 且拍距處處一致（`audio.spec.ts`）
- [x] 指板橫向捲動 + 把位跳轉（空弦/5/12）；22 格 SVG 於窄螢幕以 min-width 捲動
- [x] 介面無 hardcode 字串，zh-TW / en 皆完整（`app.spec.ts` 斷言不出現 raw i18n key）
- [x] 瀏覽器實測：播放／停止、拍燈與小節計數同步、設定持久化、無 console 錯誤
- [ ] Lighthouse 桌機 perf ≥ 90（留待 Phase 6 部署後於正式環境量測）

### 本 Phase 的實作決策（補充規格）
1. **rAF 迴圈唯一化**：TickBus 是單一消費者佇列，多組件各自 drain 會互搶事件，
   因此 rAF 迴圈收歸 transport store，組件經 `useTransportTick()` 讀取。
2. **拍號／細分僅停止中可切換**：符合 core Transport 契約，UI 於播放中 disable；
   「播放中換拍號的小節對齊」列為 Phase 4。
3. **三音色以頻段區分**（accent 2.4kHz→1.4kHz、normal 1.4kHz→900Hz、ghost 520Hz→300Hz + 低通）：
   手機外放低頻響應差，只靠音量差在外放時分不出來。
4. **設定 schema 升至 v2**（新增 voiceMuted）並附 v1→v2 migration，示範 schema 演進的標準作法。
5. **測試工具提前導入**：@vue/test-utils + happy-dom 原訂 Phase 2，提前至本 Phase 以驗證
   組件確實可掛載——建置只檢查模板語法，掛載期錯誤需要真的 mount 才會現形。

## 5. 風險
| 風險 | 對策 |
|---|---|
| 行動裝置省電策略節流 timer 造成排程斷炊 | lookahead 加大 + `visibilitychange` 時重建排程；必要時 AudioWorklet 供時鐘 |
| 音名拼寫 edge case（重升重降） | 限定調性集合為常用 15 個大調記號系統；測試鎖住行為 |
| 12 色在小音點上辨識度不足 | 文字度數永遠顯示；音點尺寸下限 + 對比檢核在本 Phase 定稿 |
