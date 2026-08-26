# RCS 架構規範（Architecture Spec）

> **文件地位：規範性（normative）。** 本文件與程式碼中的契約註解構成 RCS 的架構法律。
> 後續實作（任何模型、任何人）不得違反本文件的依賴規則與反模式清單；
> 若認為規則有誤，先修改本文件（說明理由）再改程式，不允許「先違規再說」。

---

## 0. 開工前閱讀順序（交接協議）

1. `CLAUDE.md` — 指令與硬規則摘要
2. 本文件全文
3. `docs/overview.md` — 產品全貌與已確認決策
4. 對應 Phase 的 `docs/PRD/phase-0x.md` — 你要做的功能規格
5. 相關層的 `src/**` 契約註解 — 每個檔案頂部的註解是該檔案的規格

**找工作項的方式**：全域搜尋 `TODO(opus)`。每個標記都指回 PRD 條目編號，
並在其所在檔案附有契約說明。完成一個 TODO 的 DoD 見 §7。

---

## 1. 分層架構與依賴規則

```
┌────────────────────────────────────────────────┐
│ modules/   練習模組（路由頁面、練習流程編排）        │
├────────────────────────────────────────────────┤
│ views/ + components/   共用 UI（純顯示 / 容器）    │
├────────────────────────────────────────────────┤
│ composables/   Vue 生命週期接線（store ↔ 組件）   │
├────────────────────────────────────────────────┤
│ stores/   Pinia（應用狀態、core 的 UI façade）    │
├────────────────────────────────────────────────┤
│ persistence/   VersionedStore（localStorage）    │
├────────────────────────────────────────────────┤
│ core/   純 TS：theory / audio / colors           │
└────────────────────────────────────────────────┘
```

依賴方向：**上層可以 import 下層，下層永遠不知道上層存在。**

| 層 | 允許 import | 絕對禁止 |
|---|---|---|
| `core/**` | 只能 import core 內部 | Vue、Pinia、DOM、localStorage、`Date.now()`（時間一律經 `IClock`） |
| `persistence/` | 無依賴（自帶 MemoryStorage fallback） | Vue、core |
| `stores/` | core、persistence、Vue reactivity | components、modules |
| `composables/` | core、stores、Vue | components、modules |
| `components/**` | core（型別與純函式）、Vue | **stores（純顯示組件）**、modules、直接 new core/audio 類別 |
| `views/`、`modules/**` | 全部下層 | **其他模組**（模組間橫向 import 一律禁止） |
| `config/` | 只能 import `core/` 的型別 | Vue、stores、components（它是最底下的常數層） |
| `thirdParty/` | config、DOM | core、stores、components（它只負責注入 script） |
| `build/`、`deploy/` | `src/**` 的純 TS 與 JSON | Vue SFC、任何帶 `@/` 別名的模組（Node 情境解析不到） |

例外註記：
- `components/` 中的 **container 組件**（目前僅 `TransportBar`）允許使用 stores，
  檔案頂部契約註解必須聲明自己是 container。預設所有組件都是 presentational。
- `core/audio` 內 `WebAudioClock`、`SynthClickVoice` 是唯二允許碰 Web Audio API 的
  adapter；audio 層其餘檔案必須維持純邏輯（ManualClock 可測）。
- `src/thirdParty/**` 是**唯一**允許碰第三方全域物件（`window.gtag`／`adsbygoogle`／
  `googlefc`）與注入 `<script>` 的地方。其他層一律經由它，且注入的網域必須在
  `config/third-party.json` 白名單內——那份白名單同時是 production CSP 的來源。
- `src/config/site.ts`、`src/config/routes.ts`、`src/content/knowledge/slug.ts`
  被 `vite.config.ts` 在 Node 情境 import，**不得**讀 `import.meta.env`、
  不得 import Vue，也不得用 `@/` 別名。環境變數一律走 `config/env.ts`。

---

## 2. 設計模式地圖（哪裡用什麼、為什麼）

| 位置 | 模式 | 目的 |
|---|---|---|
| `core/theory/formulas.ts` | **Single Source of Truth**（公式表 const） | 和弦/音階資料只有公式；所有音位、音名、指板覆蓋皆推導，杜絕手工資料表的維護災難 |
| `core/theory/spelling.ts` | 純函式核心 | 拼寫正確性可被窮舉測試鎖定 |
| `core/theory/positions.ts` | 純函式推導（把位） | 全指板音點看不出指型。和弦以低音弦根音錨定，切出**互不重疊**的把位框；音階以最低弦的每個音階音錨定，走一遍每弦 N 音的指型算出涵蓋範圍，這些框**天生重疊**（UI 一次只畫一個）。框怎麼畫是組件的事，框在哪裡是樂理，所以放 core |
| `core/audio/clock.ts` | **依賴反轉**（IClock） | 排程邏輯不碰真時鐘 → ManualClock 讓「不飄拍」成為可測規格 |
| `core/audio/scheduler.ts` | **Observer** + lookahead | 排程器單一職責：搬運視窗內 tick；不懂 BPM 與 pattern |
| `core/audio/pattern.ts` | **編譯步驟**（pattern → 時刻表） | swing 讓細分不等距。把「一小節 → 每格的角色與偏移（單位＝拍）」先編譯成純資料，Transport 只吃時刻表 —— 之後新增 feel 不必動排程核心，且時刻可被單元測試逐格鎖定 |
| `core/audio/transport.ts` | **Facade** + TickSource | 播放控制的唯一入口；tick 生成邏輯（BPM/拍號/pattern/swing）全部集中於此 |
| `core/audio/voices.ts` | **Strategy**（ClickVoice） | 換音色不動排程；NullClickVoice 供測試 |
| `core/audio/chordVoice.ts` | **Strategy**（ChordVoice） | 和弦示範音與 click 同一套骨架。**彈哪幾個音不在這裡**——那是 core/theory 的 voiceChord()；本層只把 MIDI 音高變成聲音。pad 的低通壓在 click 頻段以下是規格不是調味 |
| `core/theory/voicing.ts` | 純函式推導（聲位） | pitch class 沒有八度資訊，要發聲就得決定「這個 C 是哪一個 C」。中音域 close voicing + 自動聲部連接（挑移動距離最小的轉位），是樂理不是音訊 |
| `core/stats/aggregate.ts` | 純函式聚合（統計） | 「今天」由外部注入，本層不讀時鐘（測試才寫得出「連續 5 天」）；分組方式由呼叫端注入，core 不認識模組註冊表 |
| `components/charts/geometry.ts` | 純函式幾何 | 與 Fretboard／CircleOfFifths 同一套分工：座標算在 .ts、畫在 .vue。不引圖表庫（首屏 bundle 是硬指標） |
| `persistence/backup.ts` | 原樣搬運（envelope 不展開） | 匯出／匯入直接搬各 store 的 envelope（含 version），讀取時照走 migration 鏈 —— 舊備份檔自動升級，這一層不需要認識任何 schema |
| `stores/shortcuts.ts` | 註冊表（有生命週期） | ←→「換 preset」在每個模組語意不同，由當前頁註冊清單，鍵盤層只認識「上一個／下一個」；離開頁面自動解除 |
| `core/audio/tickBus.ts` | Producer/Consumer queue | 聲音視覺同步的唯一橋樑：UI 只消費「已到時」的 tick |
| `core/colors/` | Token 表（interval 為 key） | 12 色全站唯一 mapping；#9 與 b3 同色是刻意設計（同聽感） |
| `modules/registry.ts` | **Registry**（plugin 式模組） | 新增練習 = 新資料夾 + manifest + 一行註冊；路由與首頁自動生成 |
| `persistence/storage.ts` | **Adapter** + 版本化 migration | stores 不碰 localStorage；schema 演進必附 migration，保護練習紀錄 |
| `stores/transport.ts` | Singleton façade + 單一 rAF 消費者 | 全站一顆時鐘一個 AudioContext；lazy 建立（iOS 手勢解鎖）。TickBus 是單一消費者佇列，rAF 迴圈只能有一個 —— 由 store 持有並廣播 |
| `composables/useTransportTick` | 訂閱 + 生命週期綁定 | 組件取得節拍視覺狀態的唯一入口，自動取消訂閱 |
| `composables/usePracticeSession` | 生命週期綁定 | 練習計時與日誌寫入：play 起算、stop 或卸載結算，過短不記 |
| `content/knowledge/` | 內容與程式分離 | 模組只引用 entry id；內容依語系 lazy 載入並快取，獨立分包 |
| `theory/progressions/` | 白名單 parser + 展開器 | 級數記法 → 任意調的實際和弦；文法外一律報錯不猜，錯誤帶 tokenIndex |
| `modules/chords/cycle.ts` | 純函式查表 | 12 調循環先算成小節表，跟練畫面只依當前小節查表，不在畫面裡算樂理 |
| `modules/scales/recall/quiz.ts` | 純函式出題（回想測驗） | 出題是**練習設計**不是樂理：core 回答「A dorian 的 b3 在指板哪幾格」，「該不該考這一題、什麼算對」屬於模組層。亂數由呼叫端注入，洗牌與比對才測得起來 |
| `modules/chords/timeline.ts` | 純函式組裝（時間軸） | 「當前這一段的每個和弦」是和弦線各模組共用的組裝規則。條目位置固定、游標在上面移動（與節奏譜同一種讀法），使用者才點得到看得見的和弦 |
| `modules/chords/arpeggio/sequence.ts` | 純函式（音序 + 格位對應） | 琶音把時間解析度從「小節線換和弦」推進到「格線換音」。哪一格該彈哪個音是**練習設計**不是樂理（與 recall/quiz.ts 同一條界線）；而且畫面與示範音必須共用同一份順序——各自排一次，遲早出現「畫面圈著 3 音、耳朵聽到 b7」，那是最難察覺的一種錯 |
| `composables/useArpeggioDemo` | 訂閱排程 tick（發聲） | 與 useChordDemo 同骨架，差別就是琶音的定義：一格一個音。仍走 subscribeSchedule——用視覺 tick 排程等於每個音遲到半幀，十六分細分下聽得出來 |
| `composables/useBarCursor` | 位移游標（不動時鐘） | 「點和弦強制切換過去」不能改 Transport 的小節數——節拍不能因為換和弦而斷。改成記一個位移，視覺與示範音都經同一個 `barFor()`；只改視覺會出現「畫面換了、聲音沒換」 |
| `modules/rhythm/presets.ts` | 速記法 DSL（`parseCells`） | `X`／`o`／`g`／`.` 一格一字元，preset 在原始碼裡就看得出節奏形狀；未知字元丟例外，打錯字在測試就爆而不是悄悄變成休止 |
| `composables/useModuleSettings` | 響應式持久化綁定 | 模組設定以模組 id 為 key 自動存取，杜絕直接碰 localStorage |
| `composables/usePracticeTransport` | Template Method | 每個練習共通的 click 接線：載入設定 → 回寫調整 → 離開停止播放 |
| `core/seo/` | 純函式（中繼資料） | 同一份 canonical／hreflang／sitemap 算法要服務三個呼叫端：執行期 useSeo、建置期預渲染、sitemap 產生器。三者只要有一個自己拼字串，Google 就會判成重複內容 |
| `config/third-party.json` | **Single Source of Truth**（第三方網域） | 執行期載入清單與 production CSP 讀同一份。漂移的症狀只在正式站出現（廣告靜靜消失），本機與預覽都看不到，所以由 `deploy/firebase.spec.ts` 鎖死 |
| `config/routes.ts` | 目錄 + 漂移守門測試 | sitemap 與預渲染需要一份 Node 讀得到的路由清單，而 manifest 連著 Vue。手寫一份、用 `config.spec.ts` 鎖定它與 registry 一致：漏了新模組會測試失敗，而不是從 sitemap 靜靜消失 |
| `config/ads.ts` | **白名單**（版位 → 路由） | 「練習中零廣告」寫成程式碼：沒列在白名單的路由連廣告容器都不存在。不是播放時隱藏——已投放才隱藏是 AdSense 政策風險 |
| `thirdParty/loader.ts` | Gateway + 去重 | script 注入的單一入口：網域不在白名單就拒絕（production 的 CSP 也會擋，與其上線才發現不如 dev 就爆）、同一 URL 只載一次、一律 async |
| `thirdParty/consentMode.ts` | 前置佇列（gtag stub） | Consent Mode 預設值**必須**排在任何 Google tag 之前。順序反了就會有一次未經同意的請求送出去 |
| `build/prerender.ts` | 建置期產生器 | 內容是結構化 JSON，變成 HTML 只需要純函式，不需要在 Node 裡跑一次 Vue。省下整條 SSR 相依鏈，而首屏 bundle 是硬指標 |
| `build/renderContent.ts` | 與執行期共用實作 | 靜態 HTML 與畫面上的 DOM 必須逐字相同，所以粗體解析與摘要直接用 `content/blocks.ts`，不重寫第二份 |

**新需求選模式的原則**：先找上表已有的模式套用；要引入新模式時，在本表加一列說明理由。

---

## 3. 兩條核心資料流（背下來）

### 樂理 → 畫面（顯示管線）

```
公式表 formulas.ts ──▶ spell(root, formula) ──▶ Note[]（正確拼寫 + 度數）
                                                  │
                       colorForInterval(rootPc) ◀─┤──▶ mapToFretboard() ──▶ FretCell[]
                                                  ▼
                                     UI 組件（純渲染，零樂理計算）
```

任何畫面上的音，都必須能沿這條管線回溯到公式表。UI 內出現 hardcode 音名 = 架構違規。

### Tick → 聲音與視覺（時間管線）

```
Transport.next()（生成 tick，audioTime 在未來 ~100ms）
   │  LookaheadScheduler（timer 週期搬運視窗內 tick）
   ├──▶ ClickVoice.trigger(role, audioTime)   ← 聲音：以 audioTime 精準排程
   └──▶ TickBus.push(e)
           │  transport store 的**唯一** rAF 迴圈：drainUpTo(audioContext.currentTime)
           ├──▶ position（reactive）           ← 拍燈、小節計數
           └──▶ subscribers                    ← useTransportTick(handler)
```

聲音與視覺吃**同一個 tick 流**，同步是結構保證，不是調出來的。
**TickBus 是單一消費者佇列**：drain 過的 tick 就消失了，兩個組件各自 drain 會互搶事件。
因此 rAF 迴圈只存在於 transport store，組件一律經 `useTransportTick()` 讀取，
禁止任何 `setInterval` / `setTimeout` / 自建 rAF 驅動的節拍視覺。

---

## 4. 關鍵契約索引

| 契約 | 位置 |
|---|---|
| 度數 / 音名 / Note / FretCell 型別 | `src/core/theory/types.ts` |
| 和弦、音階公式表 | `src/core/theory/formulas.ts` |
| 進行記法文法（白名單）與 realize 規則 | `src/core/theory/progressions/parser.ts` 頂部註解 |
| TickEvent / RhythmPattern / CellRole | `src/core/audio/types.ts` |
| TickSource / Scheduler 行為 | `src/core/audio/scheduler.ts` |
| ClickVoice Strategy | `src/core/audio/voices.ts` |
| ChordVoice Strategy | `src/core/audio/chordVoice.ts` |
| 12 色 mapping | `src/core/colors/degreeColors.ts`（CSS token 副本：`src/assets/main.css`，兩處需同步） |
| UI 設計系統（灰階 token、元件視覺規格） | `docs/design-system.md`（規範性）＋ `src/assets/main.css` ink token |
| 練習模組 manifest | `src/modules/types.ts` |
| 節拍視覺訂閱（回傳形態即契約） | `src/composables/useTransportTick.ts` |
| 練習模組的 click 接線 | `src/composables/usePracticeTransport.ts` |
| 拍號表與持久化驗證 | `src/core/audio/types.ts`（TIME_SIGNATURES / resolveTimeSignature） |
| 指板幾何 | `src/components/Fretboard/geometry.ts` |
| 指板座標 vs 指板上的音（FretPosition／FretCell） | `src/core/theory/types.ts` |
| 指板的互動能力（selectable／marks／fretClick） | `src/components/Fretboard/Fretboard.vue` 頂部註解 |
| 回想測驗的出題、洗牌與計分 | `src/modules/scales/recall/quiz.ts` |
| 五度圈幾何與調性位置 | `src/components/CircleOfFifths/geometry.ts` |
| 五度圈的三種互動模式（display／key／chord） | `src/components/CircleOfFifths/CircleOfFifths.vue` 頂部註解 |
| 和弦時間軸條目與選取事件 | `src/components/ChordTimeline/ChordTimeline.vue` |
| 小節游標（強制切換）的位移語意 | `src/composables/useBarCursor.ts` |
| 和弦線共用調選項與同音異名正規化 | `src/modules/chords/keys.ts` |
| 琶音音序與「第幾格彈第幾個音」 | `src/modules/chords/arpeggio/sequence.ts` |
| 七和弦琶音課表（級數記法） | `src/modules/chords/arpeggio/drills.ts` |
| 琶音示範音（一格一音） | `src/composables/useArpeggioDemo.ts` |
| 進行記法文法 | `src/core/theory/progressions/parser.ts` 頂部註解 |
| 進行 preset 與分級課表 | `src/modules/chords/presets.ts` |
| 知識內容格式與行內標記 | `src/content/blocks.ts`（知識條目與法遵頁共用） |
| 知識條目 id ↔ 網址 slug | `src/content/knowledge/slug.ts` |
| 法遵頁內容格式（含 updated 日期） | `src/content/legal/index.ts` |
| 音階線共用選項與驗證 | `src/modules/scales/shared.ts` |
| 測試輔助（AudioContext stub、withSetup） | `src/test/` |
| 持久化 envelope 與 migration | `src/persistence/storage.ts` |
| 站台常數與 SiteConfig 組裝（不得讀 env） | `src/config/site.ts` |
| 建置期環境變數的唯一讀取點 | `src/config/env.ts` |
| 靜態路由目錄（sitemap／預渲染來源） | `src/config/routes.ts` |
| 廣告版位白名單與保留高度 | `src/config/ads.ts` |
| 第三方網域白名單（＝ production CSP 來源） | `src/config/third-party.json` |
| 需事前同意的地區清單 | `src/config/consentRegions.ts` |
| canonical／hreflang／OG／sitemap／robots | `src/core/seo/` |
| head 標籤的唯一套用點與 `data-rcs-seo` 標記 | `src/composables/useSeo.ts`（預渲染端：`build/prerender.ts` 的 `SEO_MARKER`） |
| 語系前綴的脫／裝規則 | `src/router/pageMeta.ts` |
| 第三方 script 注入閘門 | `src/thirdParty/loader.ts` |
| Firebase Hosting 設定（產生式） | `deploy/firebaseConfig.ts` → `firebase.json` |
| 部署與營運的人工步驟 | `docs/ops/runbook.md` |

---

## 5. 程式慣例

- **命名**：模組 id `<category>.<kebab-name>`；路由 `/<category>/<kebab-name>`；
  i18n key `modules.<category>.<camelName>.title|description`；持久化 key `rcs.<storeName>`。
- **i18n**：使用者可見字串一律走 `$t()` / `t()`，兩個 locale 檔同步增修。樂理符號
  （C、Am7、b3）不翻譯。知識內容放 `src/content/{locale}/<entry-id>.md`。
- **測試**：與被測檔同層，`*.spec.ts`。core 層新功能必附測試；行為變更先改測試。
- **`test.todo` 是規格**：實作前先讀對應 spec 檔的 todo 清單；實作後把 todo 轉為
  真測試。不允許為通過測試而改規格（規格疑義回報 PRD）。
- **TODO 標記**：未實作處以 `TODO(opus) Phase X / Fx-y：說明` 標註，完成後移除。
- **註解語言**：架構契約與規格用繁中；一般程式註解從簡，符合周邊風格。

---

## 6. 測試策略

1. **theory**：行為鎖定測試（拼寫邊界、公式內容）。改動導致既有測試變紅 = 回歸，
   不是「更新測試」的理由。12 調全展開需有快照或窮舉。
2. **audio**：一律 ManualClock + `intervalMs: 0` 手動 `tick()`；驗證間距、角色、
   計數、BPM 變更語意。禁止在測試中依賴真實時間（`vi.useFakeTimers` 也不需要）。
3. **swing / pattern（Phase 4）**：以「pattern → 期望 audioTime 序列」的表格測試鎖定
  （66% swing 反拍 = 三連音第 3 格，PRD F4 驗收）。
4. **組件**：@vue/test-utils + happy-dom（於 Phase 1 導入，用來驗證組件確實掛得起來）。
   測 props 契約與渲染數量，不寫脆弱的 DOM 快照；視覺細節靠瀏覽器人工／截圖驗收。
   組件測試檔首行加 `// @vitest-environment happy-dom`（預設環境為 node）。
5. **端到端**：需要真實 AudioContext 與 rAF 的行為（播放、拍燈、計數）以瀏覽器驗收，
   單元測試只鎖住其契約形態（例：useTransportTick 回傳的 playing 必須是 ref）。
6. **進行引擎（Phase 3）**：12 調 × 全部 preset 的 symbol 序列快照。

---

## 7. 每個工作項的 Definition of Done

- [ ] 對應 `TODO(opus)` 標記已移除；契約註解仍與實作一致（不一致就更新註解）
- [ ] `npm run test` 綠燈；該項對應的 `test.todo` 已轉為真測試
- [ ] `npm run typecheck` 零錯誤（strict、不使用 `any` / `as unknown as` 硬轉）
- [ ] 依賴規則（§1 表格）零違規；未引入表外設計模式（或已更新 §2 表格）
- [ ] 使用者可見字串已進兩個 locale 檔
- [ ] `npm run build` 成功；首屏 bundle 未顯著成長（練習模組必須 lazy load）

---

## 8. 反模式清單（一票否決）

1. ❌ UI / 模組內 hardcode 音名、和弦組成、音階內容（一律走公式表 + spell）
2. ❌ `setInterval` / `setTimeout` / rAF 直接驅動聲音；`Date.now()` 參與任何節拍計算
3. ❌ 組件內做樂理計算；presentational 組件 import store
4. ❌ 練習模組互相 import、模組直接 new AudioContext / Transport
5. ❌ 直接讀寫 localStorage（一律 VersionedStore）；改 schema 不寫 migration
6. ❌ 散落 hex 色碼表示音程顏色（一律 colorForInterval / CSS token）
7. ❌ 為通過測試修改行為鎖定測試或規格
8. ❌ 在 core/** import Vue 或 DOM API
9. ❌ 新增第三方依賴未經評估記錄（在 PR/commit 說明中交代理由與 bundle 影響）
10. ❌ **從 store 或 composable 回傳「已解包的響應式純值」**。`const { playing } = useX()`
    若 playing 是布林值而非 ref，呼叫端拿到的是當下快照，畫面永遠不會更新
    （Phase 1 實作時真的發生過：拍燈與小節計數全部不動，但按鈕狀態正常，極難察覺）。
    跨邊界回傳一律用 ref / computed / reactive 物件。

---

## 9. 現況基線（Phase 6 完成）

**已實作並有測試（65 個測試）**：theory（音程／拼寫／公式／指板推導）、colors、
scheduler + Transport（含 10 分鐘無漂移驗證）、TickBus、三音色 SynthClickVoice、
VersionedStore（含 migration）、模組 registry、composables（tick／模組設定／練習接線）、
Fretboard SVG（22 格全覆蓋）、TransportBar（BPM／拍號／細分／拍燈／三音色混音）、
App shell（路由生成、i18n 雙語、深色主題）、兩個練習模組（音階總覽、節拍器）。

播放行為（AudioContext、rAF、拍燈同步）已於瀏覽器實測驗收：240 BPM 4/4 下
小節計數每秒前進一格、拍燈與 tick 同步、停止歸零、無 console 錯誤。

**Phase 2 追加（89 個測試）**：知識內容系統（結構化區塊、雙語各 13 條、獨立分包）、
KnowledgeCard／RichText、usePracticeSession（練習計時與日誌）、音階跟練模組、
Scale Explorer 的特徵音標註與知識卡、模組間以 query 傳遞選擇。

**Phase 3 追加（129 個測試）**：進行引擎（parser + realize，含 12 調快照）、
五度圈組件（互動與跟練兩種模式）、和弦時間軸、12 調循環模型、
兩個和弦練習模組（五度圈進行、固定調 5 級課表）、11 條雙語和弦知識內容。

**Phase 4 追加（188 個測試）**：pattern 編譯層（swing 非等距排程、示範／靜默、速記法）、
pattern 驅動的 Transport（播放中換 pattern／拍號一律對齊小節線）、RhythmSheet 節奏譜
（雙計數法、游標跟捲、編輯模式）、兩個節奏練習模組（切分課表、律動風格）、
26 個 pattern preset 與 9 條雙語節奏知識內容。

節奏線已於瀏覽器實測驗收：游標與 click 同步、示範→靜默切換正確、編輯改格即時反映並持久化、
6/8 拍號與細分標籤正確（`6/8 · 8`）、375px 手機無頁面橫捲且游標自動跟捲、無 console 錯誤。

**Phase 5 追加（370+ 個測試）**：和弦示範音（core/theory 的中音域 close voicing 與自動聲部
連接、core/audio 的 SynthChordVoice、pad／strum 兩種模式）、練習統計儀表板（core/stats 純函式
聚合 + 自繪 SVG 圖表 + 備份匯出／匯入）、自訂進行編輯器（逐 token 即時驗證、五度圈點選輸入、
獨立模組 chords.custom）、體驗打磨（全域鍵盤快捷鍵與說明面板、五度圈鍵盤可達、
全域錯誤邊界、文字對比全面複核）。

三件事在瀏覽器實測驗收：示範音在小節線準時發聲且聲部就近移動（C→F 只動兩個聲部）、
strum 音符錯開 14ms、快捷鍵在文字輸入框內不攔截、六條路由的文字對比全數通過 AA。

**Phase 6 追加（545 個測試）**：營運上線的整套骨架——

- **部署**：`firebase.json` 由 `deploy/firebaseConfig.ts` 產生（SPA rewrite、資產 immutable
  快取、HTML no-cache、CSP + 三個安全標頭），GitHub Actions 兩份 workflow
  （CI 不碰憑證所以 fork PR 跑得動；部署走 Workload Identity Federation，零長期金鑰）。
- **SEO**：`core/seo` 純函式產生 canonical／hreflang／OG／sitemap／robots；
  `build/prerender.ts` 在建置期把 33 條雙語知識條目 + 首頁 + 索引 + 三份法遵頁
  寫成 76 個靜態 HTML，不執行 JS 也讀得到全文與內部連結。
- **內容路由**：`/knowledge`、`/knowledge/:slug`、`/privacy`、`/cookies`、`/about`，
  每一條都有 `/en/…` 孿生路由；catch-all 404 標 noindex。
- **廣告與同意**：AdSlot（保留高度 → CLS = 0、未投放或被攔截就整塊收合）、
  Consent Mode v2 預設值、全站載入的 Google CMP、受同意管控的 GA4。
  廣告版位白名單只含首頁／知識頁／統計頁。

瀏覽器實測驗收：投放成功時版位保留 250–280px、unfilled 與攔截器情境整塊收合且不留白、
三條跟練路由零廣告容器、關閉 JS 時六個預渲染網址都有完整內文與 4–37 條外連、
canonical／hreflang／lang 三者一致、七個新頁面文字對比全數通過 AA、無 console 錯誤。

**Phase 6 之後的優化（573 個測試）**：跟練畫面的**強制切換**——和弦時間軸由滾動的 4 格視窗
改為「當前這一段的每一個和弦」且每一格可點，五度圈外圈在跟練畫面可點以切換 Root
（12 調循環跳到那個調、固定調練習直接改設定並正規化同音異名）。兩者都走 `useBarCursor` 的
小節位移，時鐘不停、示範音在下一個小節線跟上。

**Phase 7 追加（599 個測試）**：指板回想模組（`scales.recall`）——把資訊流向反過來，
答案藏起來再問。兩個正交設定（方向 find／name × 語言 note／degree）＝四種練法共用一套機制；
限時模式的換題由 transport 小節數驅動，不引入第二條時間線。Fretboard 取得互動能力
（`selectable` 的透明命中層、`marks` 空心圈），`FretCell` 抽出 `FretPosition` 基底型別。

**Phase 7 之後的追加（640 個測試）**：七和弦琶音模組（`chords.arpeggio`）——和弦線的第四個模組，
也是第一個把時間解析度推進到**音符**的跟練：小節線換和弦，格線換音（`useArpeggioDemo` 一格送一個音高
進 ChordVoice，仍走排程訂閱）。八份課表以級數記法定義（順階七和弦、大小調 2-5-1，以及
maj7／7／m7／m7b5／dim7 各自走 12 調），沿五度圈的展開直接沿用 `buildCircleCycle`，
12 調的拼寫（含 Gb 調減七的重降記號）全部由公式表推導。音序、格位對應與「序列除不盡小節格數」
的判斷都是純函式（`arpeggio/sequence.ts`），畫面與示範音共用同一份索引序列。
指板的把位聚焦改記**錨定弦**而不是把位 id——id 綁在根音的格號上，換調就失效，
而「根音在第 6 弦的指型」正是這個練習要練的東西；`marks` 從回想測驗的題目標記兼任「這一格該彈的音」。

**待人工完成（需要帳號，不是程式碼）**：見 `docs/ops/runbook.md`——
建立 Firebase 專案與自訂網域、設定 GitHub repository variables、AdSense 送審與版位建立、
CMP 訊息設定、GCP 預算警示、Search Console 驗證。程式端已就緒，缺的只是這些設定值。
