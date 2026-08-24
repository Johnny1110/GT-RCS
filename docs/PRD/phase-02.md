# Phase 2 PRD — 音階練習線（Scales）

> 目標：上線第一條練習線。指板 + 12 色系統的完整體驗證明點。
> 結束狀態：使用者可任選調與音階在指板上查看全覆蓋，並掛上 click 跟練；每次練習寫入練習日誌。
>
> **狀態：Phase 2 已完成**（驗收結果見 §4）。

## 1. 範圍

### In scope
- 模組 `scales.explorer`：音階總覽（Scale Explorer）
- 模組 `scales.practice`：音階跟練（click 驅動）
- 練習日誌（practiceLog store + 寫入機制；統計 UI 留給 Phase 5）
- 知識內容框架（KnowledgeCard 組件 + 雙語內容格式）＋音階線第一批內容

### Out of scope
- 五度圈、和弦進行（Phase 3）；音階發聲、指板動畫指引（未來擴充）

## 2. 功能需求

### F2-1 Scale Explorer（`scales.explorer`）
1. 選擇器：主音（12 個，含異名同音的正確拼寫顯示）× 音階類型：
   - 大調七調式：Ionian／Dorian／Phrygian／Lydian／Mixolydian／Aeolian／Locrian
   - 大調五聲、小調五聲
   - 藍調音階（小調藍調，含 b5 藍調音）
   - 和聲小調、旋律小調
2. 指板全覆蓋顯示：所選音階全部音位，度數文字 + 12 色系統（主音白、五度灰、b3 藍…）。
3. 資訊面板：音階組成音（音名 + 度數）、特徵音標註（如 Dorian 的 6、Mixolydian 的 b7、藍調音 b5）。
4. 顯示切換：度數標記 ↔ 音名標記（顏色不變，仍以度數對應）。
5. 設定持久化：離開再進來記住上次的調與音階。

### F2-2 音階跟練（`scales.practice`）
1. 承接 Explorer 的選擇（調＋音階），常駐 TransportBar：BPM、拍號、細分（4/8/16 分、三連音）。
2. 跟練畫面：指板全覆蓋 + 節拍視覺（當前拍高亮、小節計數）；使用者跟 click 練上下行與換把。
3. 練習計時：play 開始累計，stop / 離開結束並寫入日誌 `{ date, moduleId, durationSec, bpm, params: { root, scale } }`（< 30 秒的 session 不記，避免雜訊）。
4. 練習建議文案（知識卡）：如「先單弦橫向走完整個音階，再練把位直向」。

### F2-3 知識內容框架
1. 內容格式：**結構化區塊**（`paragraph` / `list` + `**粗體**` 行內標記），
   存於 `src/content/knowledge/{locale}.json`，以 entry id 為 key。
   **與原規格的差異**：原訂 Markdown 渲染，改為結構化區塊——Markdown 解析器約 12KB gz
   （首屏預算 200KB），且自由格式會與 design-system 的排版規範打架。結構化格式零依賴、
   型別安全，並讓「兩語系 entry id 必須一致」「粗體標記必須成對」成為可測規則。
2. `KnowledgeCard` 組件：練習頁側欄／抽屜呈現，可折疊。
3. 第一批內容（各調式性格與應用，zh-TW + en）：
   - 七調式各自的性格與代表曲風（Dorian＝小調但明亮的 funk/soul 味、Mixolydian＝屬和弦/藍調搖滾、Lydian＝夢幻電影感…）
   - 五聲音階為何是即興安全網；藍調音 b5 的用法
   - 和聲小調的 b6–7 增二度異國感；旋律小調與現代爵士（jazz minor）
4. 內容檔案與模組解耦：模組 manifest 引用 entry id。

## 3. UI 佈局（桌機）
```
┌────────────────────────────────────────────┐
│ 選擇列：主音 ▾  音階 ▾  [度數/音名]  [知識▸] │
├────────────────────────────────────────────┤
│                Fretboard（全幅）             │
├────────────────────────────────────────────┤
│ 組成音列：C  D  Eb  F  G  Ab  Bb （度數+色）  │
├────────────────────────────────────────────┤
│ TransportBar：▶ ■  BPM 90  4/4  細分 ♪  🔊  │
└────────────────────────────────────────────┘
```
行動版：選擇列收合為抽屜、指板橫向捲動、TransportBar 固定底部。

## 4. 驗收標準（Phase DoD）
- [x] 12 調 × 全部音階類型顯示正確（theory 層窮舉測試背書 + 瀏覽器抽樣驗證 C Dorian）
- [x] 特徵音標註正確：組成音列以白色圓環標記，並附一行說明（C Dorian → A，即 6）
- [x] click 跟練中 BPM 即時可調；拍燈與小節數由 TickBus 驅動，與聲音同步
- [x] 練習日誌正確累計與持久化：停止播放、離開頁面皆結算，< 30 秒不記（6 個測試鎖定）
- [x] 知識內容 zh-TW / en 各 13 條，測試強制兩語系 entry id 一致且涵蓋全部音階類型
- [x] 首頁 → 音階總覽 →「開始跟練」→ 音階跟練 動線完整；選擇經 query 傳遞，模組間不互讀設定

### 本 Phase 的實作決策（補充規格）
1. **內容格式改為結構化區塊**（見 F2-3），理由如上。
2. **模組間傳遞選擇用 query，不共用設定**：`/scales/practice?root=C&scale=dorian`。
   維持「模組不得讀寫彼此設定」的架構規則，且網址可分享。
   query 與 localStorage 同樣被視為不可信輸入，經 `isKey` / `isScaleType` 驗證後才採用。
3. **練習計時用 Date.now()**：這是牆上時鐘（練了多久），與節拍計算無關；
   節拍一律走 IClock / AudioContext。`now` 可注入以利測試。
4. **知識內容獨立分包**：3.3 KB gz，僅在展開知識卡時載入，不影響首屏。
5. **測試輔助**：新增 `src/test/audioContextStub.ts`（happy-dom 無 Web Audio）與
   `withSetup.ts`（在真實組件 setup 中跑 composable，可驗證 onUnmounted 行為）。

## 5. 風險
| 風險 | 對策 |
|---|---|
| 全指板覆蓋音點過密、資訊過載 | 音點大小/間距在 22 格全幅下調校；提供把位聚焦（未來擴充：3-notes-per-string 分把顯示） |
| 調式知識文案雙語工作量 | 內容框架先行，文案分批；每條 entry 獨立檔案可增量補 |
