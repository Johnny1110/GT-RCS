# RCS — Rhythm & Chord & Scales 產品總覽

> 給吉他手的練琴專用 Web App。純前端、無後端、可靜態部署。
> 吉他三要素：**節奏（Rhythm）、和弦（Chord）、音階（Scales）** —— 全站練習皆圍繞這三大類。

---

## 1. 產品願景

市面上的節拍器 App、和弦查詢 App、音階圖 App 都是分開的工具。RCS 把三者整合成**一套以「跟練」為核心的練習系統**：

- 每一個練習項目都掛在同一顆高精度 Click（節拍器）上，視覺提示跟著拍子走。
- 樂理不是查表，而是**用顏色與位置內化**：12 個音程對主音的關係各有固定顏色，走到哪個練習都一致。
- 練習不只是操作，還附**樂理小知識與應用場景**（為什麼 C 大調可以借用 Fm、2516 從哪來），讓使用者知其所以然。

### 目標使用者

- 入門～中階吉他手：需要系統性的和弦進行、音階位置、節奏切分訓練。
- 進階玩家：拿來當高階節拍器與 12 調循環跟練工具（blues、fusion、neo-soul 素材）。

### 產品原則

1. **Click 是全站心臟**：所有練習必有 click；視覺 highlight 與音訊時鐘同步，不飄拍。
2. **資料由公式計算，不用人工維護**：和弦與音階只定義音程公式（const），指板上的位置、調內音名全部由樂理引擎推導。
3. **顏色是第二語言**：12 音程 → 12 固定顏色，全站唯一 mapping；文字度數標記（1, b3, 5…）永遠存在，顏色是輔助而非唯一資訊。
4. **練習皆模組**：每個練習是獨立模組，掛進統一的模組框架，新增練習不動核心。

---

## 2. 已確認的產品決策（Q&A 結論）

| 決策點 | 結論 |
|---|---|
| 前端框架 | Vue 3 + TypeScript + Vite，無後端，靜態部署 |
| 指板和弦顯示 | **組成音全覆蓋**：顯示和弦/音階在 22 格指板上的所有組成音，voicing 由使用者自行抓；不維護指型（grip）資料庫 |
| 聲音引擎 | Phase 1–4 專注 click（重拍／一般／ghost 多音色）；Phase 5 加入 Web Audio 合成和弦示範音 |
| 語言 | 雙語 i18n（vue-i18n，預設 zh-TW，支援 en），樂理知識內容雙語維護 |
| 裝置 | 響應式、桌機優先；平板為重要練琴場景，手機可用 |
| 資料保存 | localStorage：各練習設定 + 練習日誌（日期、項目、時長、BPM） |
| 樣式 | Tailwind CSS；指板／五度圈／節奏譜為自訂 SVG 組件 |
| 主題 | 深色優先單一主題；主音用**白色**（無彩度 = 中心的色彩邏輯），淺色主題列為未來擴充 |
| 開發順序 | 共用基礎 → **音階線 → 和弦線 → 節奏線** → 進階功能 → 營運上線 |
| 部署 | Firebase Hosting（GCP 生態、內建 CDN 與 HTTPS、預覽頻道）；純靜態，維持無後端 |
| 收入模式 | Google AdSense 支撐主機開銷。**練習中零廣告是產品承諾**：任何會播放節拍的畫面上不存在廣告版位（不是隱藏，是不存在），版位只在首頁、樂理知識頁、統計頁 |
| 網址與語系 | 中文為預設語系（無前綴），英文為 `/en/…`。網址是語系的真相來源，canonical／hreflang 成對宣告 |
| 內容資產 | 樂理知識庫以 `/knowledge/<slug>` 獨立網址呈現，建置期預渲染成靜態 HTML——同時是 SEO 資產與 AdSense 審核的「實質內容」依據 |
| 隱私 | 練習紀錄只在 localStorage，不外傳、我方無伺服器可存放。這是產品優勢，寫進隱私權政策也寫在每一頁的頁尾 |

### 目前的非目標（未來擴充候選）

左手模式、自訂調弦（先固定標準調弦 EADGBE）、和弦採樣音源、淺色主題、PWA 離線、帳號與雲端同步、社群分享。架構上預留（調弦作為參數傳入指板引擎），但不在前五個 Phase 交付。

---

## 3. 系統架構

> 本節為摘要；**規範性細節（依賴規則、設計模式地圖、反模式清單、DoD）見 [architecture.md](architecture.md)**，開發前必讀。

```
┌─────────────────────────────────────────────────┐
│  Practice Modules（練習模組，路由驅動、可擴充）      │
│  scales/*   chords/*   rhythm/*                  │
├─────────────────────────────────────────────────┤
│  Shared Components（共用 UI 組件）                 │
│  Fretboard ─ CircleOfFifths ─ RhythmSheet        │
│  TransportBar ─ SettingsPanel ─ KnowledgeCard    │
├─────────────────────────────────────────────────┤
│  Core（純 TS，無 UI 依賴，可單元測試）              │
│  theory/  音程・音名拼寫・和弦・音階・進行解析       │
│  audio/   Transport・lookahead scheduler・音色     │
│  colors/  12 音程色彩 token                       │
├─────────────────────────────────────────────────┤
│  Stores（Pinia）+ Persistence（localStorage）      │
│  settings ─ practiceLog ─ transport state         │
└─────────────────────────────────────────────────┘
```

### 技術棧

- **Vue 3**（Composition API + `<script setup>`）、**TypeScript** strict mode
- **Vite** 建置、**Vue Router**（每個練習模組一條路由）、**Pinia** 狀態管理
- **Tailwind CSS**（design token 由 theme 延伸：12 音色票、間距）
- **vue-i18n**（zh-TW / en）
- **Web Audio API**（不依賴第三方音訊庫；click 用合成音色，零資源載入）
- **Vitest** 單元測試（樂理引擎 100% 覆蓋為目標）
- 部署：開發期以任一靜態託管預覽即可；正式營運部署於 **GCP（Firebase Hosting + 全球 CDN）**，並以 **Google AdSense** 廣告收入支撐主機開銷（見 [phase-06](PRD/phase-06.md)）

### 目錄規劃

```
src/
  core/
    theory/      # 音高數學、音名拼寫、和弦/音階公式、進行解析（純 TS）
    audio/       # Transport、scheduler、click 音色
    colors/      # degree → color mapping
  components/    # Fretboard、CircleOfFifths、RhythmSheet、TransportBar…
  modules/       # 練習模組（每個模組一個資料夾，含 manifest）
    scales/
    chords/
    rhythm/
  stores/        # Pinia：settings、practiceLog、transport
  locales/       # zh-TW.json、en.json（介面字串）
  content/       # 樂理知識內容（結構化，依 locale 分檔）
docs/
  overview.md
  PRD/phase-01.md … phase-05.md
```

---

## 4. 核心共用系統

### 4.1 樂理引擎（core/theory）

一切顯示的唯一真相來源（single source of truth）：

- **音高數學**：pitch class（0–11）運算 + **正確音名拼寫**（F# 大調要拼 E# 不是 F；用五度線 spelling 演算法依調性決定升降記號）。
- **和弦公式（const）**：maj、min、dim、aug、sus2、sus4、6、m6、maj7、m7、7、m7b5、dim7、mMaj7、add9、9、m9、maj9、11、13…（音程集合表示，如 `maj7 = [1, 3, 5, 7]`）。
- **音階公式（const）**：大調七調式（Ionian…Locrian）、大小調五聲、藍調音階、和聲小調、旋律小調。
- **進行解析**：羅馬數字/級數記法（`2516` → ii–V7–Imaj7–vi；`4536251` 等）→ 帶入任意調 → 產出實際和弦序列；支援調外記號（如 `iv`、`bVII`、`V/ii` 借用與副屬）。
- **指板推導**：`(調弦, 格數, 音集合) → 每弦每格的度數標記`。調弦為參數（預設 EADGBE、22 格），為未來自訂調弦預留。

### 4.2 12 音程色彩系統（core/colors）

全站唯一 mapping，深色主題（背景 zinc-900 系）設計。設計邏輯：**協和度 → 彩度**（越穩定越無彩），**音程性格 → 色相**（暖 = 明亮大調感，冷 = 憂鬱小調感）：

| 度數 | 音程 | 顏色 | HEX（暫定） | 色彩學理由 |
|---|---|---|---|---|
| 1 | 主音 | 白 | `#FFFFFF` | 無彩度 = 一切的中心錨點 |
| b2 | 小二度 | 暗紅 | `#E5484D` | 半音摩擦，最強張力與警示感 |
| 2 | 大二度 | 綠 | `#66BB6A` | 開放、清新（9th 的明亮延伸感） |
| b3 | 小三度 | 藍 | `#5B8DEF` | 憂鬱系——小調性格的代表色 |
| 3 | 大三度 | 橙 | `#FF9F43` | 陽光溫暖——大調性格的代表色 |
| 4 | 完全四度 | 青 | `#26C6B9` | 懸浮、待解決（sus4 的漂浮感） |
| #4/b5 | 三全音 | 紫 | `#9C6ADE` | 神秘與不安定（Lydian／減和弦核心） |
| 5 | 完全五度 | 灰 | `#9BA1A6` | 主音的輔助色——近乎無性格的支撐 |
| b6 | 小六度 | 梅紫紅 | `#B5589F` | 哀愁的暗色浪漫（和聲小調的嘆息） |
| 6 | 大六度 | 粉 | `#F48FB1` | 甜美柔和（6th／13th 的圓潤） |
| b7 | 小七度 | 赭棕 | `#C08B5C` | 藍調土味、鬆弛的屬七感 |
| 7 | 大七度 | 亮黃 | `#FFD54F` | 導音——指向主音的最強光 |

設計約束：
- 音點上永遠顯示**度數文字**（1、b3、5…），顏色是輔助編碼（兼顧色覺辨認障礙）。
- 音點底色亮色 + 深色文字，確保深色背景下的對比度；最終色票需通過對比檢核後定稿。
- 色票以 Tailwind theme token 形式輸出（`degree-1`、`degree-b3`…），全站組件共用。

### 4.3 Click／Transport 引擎（core/audio）

全站心臟，規格：

- **精準排程**：Web Audio lookahead scheduling（背景 timer 每 ~25ms 檢查、提前 ~100ms 把 click 排上 audio clock），拍點誤差 < 1ms，不受 UI 卡頓影響。
- **Transport 模型**：BPM（30–300）、拍號（4/4、3/4、6/8、12/8…）、細分（4/8/16 分、三連音）、小節計數、循環段落。
- **多音色（合成，零資源）**：
  - `accent`：重拍／撥弦提示（亮、高頻）
  - `normal`：一般拍
  - `ghost`：悶音／ghost note 提示（低通、弱）
  - 每音色獨立音量、可靜音。
- **視覺同步**：排程時發出 tick 事件佇列（含 `audioTime`、小節/拍/細分位置），UI 用 rAF 對時消費 → 五度圈 highlight、節奏譜游標、和弦切換全部吃同一個時鐘。
- **節奏 pattern**：每小節細分網格，每格指定音色角色或休止 → 這就是節奏線「示範 click」的資料模型。

### 4.4 指板組件（Fretboard）

- 22 格 + 空弦、橫式 SVG、高音 e 弦在上（與 TAB 一致）、3/5/7/9/15/17/19/21 單點、12 格雙點記號。
- 輸入：要顯示的音集合（度數 → pitch class mapping）＋主音 → 每個音點以度數文字 + 對應顏色渲染。
- 響應式：桌機全幅；窄螢幕橫向捲動 + 把位快速跳轉。
- 純顯示組件，不含樂理邏輯（一律由 theory 引擎算好餵入）。

### 4.5 五度圈組件（CircleOfFifths）

- SVG 雙層環：外圈 12 大調（C 在頂端順時針加升號），內圈對應關係小調（Am 在 C 下方），減和弦（vii°）以第三層薄環或徽章標示。
- 互動模式：點選主音 → highlight 調內 7 個和弦（外圈 I/IV/V + 內圈 ii/iii/vi + vii°）。
  跟練畫面用它**直接切換 Root**（只開放外圈，內圈是關係小調，進行記法一律以大調為基準）；
  進行編輯器則內外圈都可點，點到哪一格就把那個級數接到記法後面。
- 跟練模式：由 Transport 驅動——當前調、當前和弦隨小節數移動 highlight，供五度下行 12 調循環練習使用。
- 通用套件設計：純 props/events，不綁定任何練習模組。

### 4.6 節奏譜組件（RhythmSheet）

- 一小節為單位的細分網格視覺化（4/8/16 分、正反拍、三連音、6/8）。
- 每格顯示角色：重音（撥弦）／一般／ghost／休止，配色與 click 音色對應。
- 跟練時播放游標與 click 同步移動。

### 4.7 練習模組框架

```ts
interface PracticeModule {
  id: string                          // 'chords.circle-of-fifths-progressions'
  category: 'scales' | 'chords' | 'rhythm'
  titleKey: string                    // i18n key
  descriptionKey: string
  component: Component                // 練習主畫面
  defaultSettings: Record<string, unknown>  // BPM、調、level… 持久化於 localStorage
  knowledge?: KnowledgeEntry[]        // 附帶的樂理小知識（雙語）
}
```

- 模組註冊表 → 自動生成路由與首頁導覽卡片。
- 模組只組裝共用組件 + 撰寫練習流程邏輯與知識內容；新增練習不改核心。
- 框架提供練習計時 hook：進入練習自動開始記錄，結束寫入練習日誌。

### 4.8 持久化（localStorage）

- `settings`：全域（音量、語言）＋各模組設定（以模組 id 為 key）。
- `practiceLog`：`{ date, moduleId, durationSec, bpm, params }` 陣列，供統計頁使用。
- 版本欄位 + migration 機制，避免格式演進破壞舊資料。

---

## 5. 三條練習線（功能地圖）

### 音階線（Phase 2）
- **音階總覽（Scale Explorer）**：任選 12 調 × 任一音階（七調式／五聲／藍調／和聲小調／旋律小調）→ 指板全覆蓋 + 12 色度數呈現。
- **音階跟練**：可設 click（BPM／拍號），依節拍練習音階上下行與把位移動。
- **指板回想（Phase 7）**：把答案藏起來再問——「找出全指板所有的 C#」「白圈那一格在 A dorian 是幾度」。
  方向（找位置／說名字）與語言（音名／度數）是兩個正交設定，四種練法共用一套機制；
  限時模式由 click 換題。前面兩個模組練的是**辨認**，這一個練的是**產出**。

### 和弦線（Phase 3）
- **五度圈經典進行**：預設經典進行（2516、4536251、1645、卡農進行…）沿五度圈逆時針走 12 調，每調 8 小節，五度圈 highlight + 指板同步顯示當前和弦組成音全覆蓋；附進行的歷史與應用場景知識。
- **強制切換**（和弦線各模組共通）：時間軸列出當前這一段的**每一個**和弦，點下去就跳過去；
  點五度圈外圈則換調（12 調循環是跳到那個調，固定調練習是直接改設定）。跳轉一律是小節游標的位移，
  時鐘不停也不重排——練難的那兩小節不必等它自己輪回來。
- **固定調分級練習**：單一調內，入門三和弦 → 全 diatonic → 七和弦 → 藍調屬七 → fusion／neo-soul 延伸音與借用和弦；附「為什麼 C 大調能接 Fm」等調式互換知識。
- **七和弦琶音（Phase 7 之後追加）**：同樣沿五度圈走 12 調，但練的是**音符**不是和弦——
  一格一個音跟著 click 走。課表分兩種形狀：調內走完（順階七和弦、大小調 2-5-1）練功能，
  單一品質（maj7／7／m7／m7b5／dim7）走 12 調練指型；方向可選上行／下行／上下行。
  指板的把位聚焦記的是「根音在第幾弦」，換調時指型跟著走。

### 節奏線（Phase 4）
- **切分專項**：4/8/16 分正反拍、切分 pattern，節奏譜 + 示範 click（重音/ghost 雙音色）跟練。
- **律動風格**：FUNK、SOUL 等風格 preset；6/8、shuffle（三連音 feel）專項。
- 和弦僅作背景提示，功能聚焦節奏譜與 click。

---

## 6. 開發路線圖

| Phase | 主題 | 交付重點 | PRD |
|---|---|---|---|
| 1 | 基礎建設 | 專案骨架、樂理引擎、色彩系統、Click 引擎 v1、指板組件、模組框架、i18n、持久化 | [phase-01](PRD/phase-01.md) |
| 2 | 音階線 | Scale Explorer、音階跟練、練習日誌 v1、知識內容框架 | [phase-02](PRD/phase-02.md) |
| 3 | 和弦線 | 五度圈組件、進行引擎、五度圈經典進行跟練、固定調分級練習 | [phase-03](PRD/phase-03.md) |
| 4 | 節奏線 | 節奏譜組件、pattern 系統、示範 click、風格專項（FUNK/SOUL/shuffle/6-8） | [phase-04](PRD/phase-04.md) |
| 5 | 進階強化 | 和弦合成示範音、練習統計儀表板、自訂進行編輯器、體驗打磨 | [phase-05](PRD/phase-05.md) |
| 6 | 營運上線 | GCP 公開部署（Firebase Hosting）、CI/CD、AdSense 廣告、同意管理與隱私頁、成本監控 | [phase-06](PRD/phase-06.md) |
| 7 | 回想閉環 | 指板回想模組（四種練法）、Fretboard 互動能力、限時出題 | [phase-07](PRD/phase-07.md) |
| — | 追加 | 七和弦琶音模組（12 調 × 五種實用七和弦，一格一音的示範與指板標記） | — |

每個 Phase 結束皆為**可部署可用**的狀態（Phase 1 結束時至少有可玩的指板 + 節拍器 demo 頁）。

Phase 6 之後，程式端已具備上線條件；實際上線還需要帳號層面的設定
（Firebase 專案、自訂網域、AdSense 送審、CMP 訊息、GCP 預算警示、Search Console），
步驟與確認方式見 [`docs/ops/runbook.md`](ops/runbook.md)。
