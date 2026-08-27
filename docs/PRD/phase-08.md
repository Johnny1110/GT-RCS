# Phase 8 PRD — The Jazz Book（爵士曲式跟練）

> 目標：把和弦線從「四小節的進行」推進到**一首曲子的曲式**。
> 前面四個和弦模組練的都是片段——2516、12 小節藍調、一段課表；但真正上台要撐的是
> 32 小節 AABA 走三遍，而且要記得現在在第幾段、下一段是什麼。
> 本 Phase 讓 RCS 能跑完整曲式：段落、遍數（chorus）、段落循環、任意調移調，
> 以及書上那行 feel 標記真正的意思——速度區間與 comping 律動。
>
> 結束狀態：和弦線多一個模組（`chords.jazz-book`），核心多一層「曲式」；
> 使用者可以匯入自己手上的譜，把 RCS 當成 backing track 與練習節拍器的合體。

---

## 0. 命名與內容來源（先讀，這決定了曲庫長什麼樣）

需求原文是「叫做 the real book，內容是書裡所有的和弦進行」。實作上做兩處調整，理由如下：

1. **模組不叫 The Real Book。** 那是 Hal Leonard 的註冊商標，本站是公開且有廣告收入的
   營利性質站台，借用書名會把商標問題直接接到自己身上。模組名為 **The Jazz Book**
   （id `chords.jazz-book`、路由 `/chords/jazz-book`）。
   > 備查：`The Jazz Book` 是 Joachim-Ernst Berendt 一本爵士史著作的書名，
   > 但那是樂史書而非和弦譜品牌，單一書名一般也不作為商標受保護，
   > 與本模組不構成同類商品的混淆。上線前若要更保守，可再退一步用純描述性名稱（Standards）。
2. **內建曲庫不收錄仍在著作權保護期內的曲子。** 書裡絕大多數曲目（1930 年之後出版）
   仍受保護，而書上那份和弦編排另有該社的編輯著作權。內建整本 = 把侵權風險寫進 repo。

改採**三層曲庫**，三層都走同一套資料模型與同一個畫面：

| 層 | 內容 | 放在哪 | 說明 |
|---|---|---|---|
| **A. 形式練習**（`drill`） | 從曲目群裡抽出來的**和聲形式**：爵士藍調、Rhythm Changes A／Bridge、Bird Blues、大三度循環、各種 turnaround、小調 2-5-1、backdoor 終止 | `charts.ts`（進 repo） | 通用和聲模板不是特定樂曲，這也是這些東西在教材裡的存在方式。**本 Phase 的主力內容**——真正在練的就是這些 |
| **B. 公版曲**（`public-domain`） | 1930 年（含）以前於美國出版的標準曲 | `charts.ts`（進 repo） | 和弦譜須**依原曲和聲自行編寫**，不得轉錄任何出版品的編排。每首標註作者與出版年 |
| **C. 使用者匯入**（`user`） | 使用者自己手上那本書的任何一首 | localStorage（`rcs.userCharts`） | 只存在使用者瀏覽器、不上傳、不進備份以外的任何地方（本站無後端，這是產品既有優勢） |

> **公版判定屬地不同**：1930 年界線是美國標準（截至 2026 年）；歐盟採作者歿後 70 年，
> 同一首曲子未必同步。B 層每一首入庫前須逐首查證出版年，且**清單本身要能被 review**——
> 因此 `ChartOrigin` 帶 `composer` 與 `firstPublished` 兩個必填欄位，不是選填備註。
> 有疑義的一律留在 C 層，不進 repo。

---

## 1. 範圍

### In scope
- 曲式引擎（`core/theory/progressions/form.ts`）：段落 → 展開成小節表，含**小節內偏移**
- 曲譜文字記法（`core/theory/progressions/chartText.ts`）：以小節線書寫，內建曲庫與使用者匯入共用同一份文法
- Feel 表（`modules/chords/jazzBook/feels.ts`）：書上的 feel 標記 → BPM 區間／拍號／swing／comping pattern
- The Jazz Book 模組（`chords.jazz-book`）：曲式圖 + 段落時間軸 + 指板 + 五度圈 + chorus 計數
- comping 示範音（`composables/useCompDemo.ts`）：和弦跟著 comp pattern 敲，不再是一小節一下
- 使用者曲譜的匯入／編輯／刪除（`stores/userCharts.ts`，VersionedStore）
- 爵士常用和弦品質補進公式表（7sus4、7b9、7#9、7#5、7b5、11、m11、maj7#11、69）

### Out of scope（列入後續）
- **旋律（head）與 TAB**：這是跟練工具不是譜面閱讀器；本 Phase 只處理和聲
- **反覆記號、D.S. al Coda、1st/2nd ending 的記號語意**：曲式一律**展開**成段落陣列（見 §4 決策 2）
- **走 bass line／drum kit 音源**：示範音維持既有的合成 pad／strum，不引入取樣
- **自動 reharm、代理和弦提示、和弦音階建議**：那是「爵士助教」的範圍，值得獨立一個 Phase
- **rubato／無拍子曲目**：全站前提是「Click 是心臟」，沒有拍子的曲子不屬於這個工具
- 上傳／分享使用者曲譜（本站無後端，這是刻意的）

---

## 2. 功能需求

### F8-1 曲譜文字記法（core，白名單制）

一段以小節線書寫，**與級數記法共用既有的 `parseProgression` 文法**，只多三條規則：

```
A: | I6 vim7 | iim7 V7 | iiim7 V/ii | iim7 V7 | IVmaj7 | ivm6 | iiim7 V/ii | iim7 V7 |
B: | V/vi   | %       | V/ii      | %       | V/V    | %    | V7        | %       |
```

1. `|` 分隔小節，首尾的 `|` 可省略。一小節內以空白分隔和弦，**n 個和弦平分該小節**
   （1 → 1 拍位、2 → 各半小節、4 → 各 1/4 小節）。
2. `%` = 與前一小節完全相同。第一小節寫 `%` 是語法錯誤。
3. 空小節（`| |`）是**錯誤**，不是「延續前一個和弦」。文法外一律 `ProgressionSyntaxError`
   並帶 `barIndex`／`tokenIndex`，不猜——與既有 parser 同一條原則。

`parseChartBars(text)` 回傳**以小節為單位**的結構 `ChartBar[]`；和弦本身沿用既有的
`parseProgression`，**不新增第二套和弦文法**，而且**和弦錯字也在這一層擋掉**
（否則要等展開曲式甚至播放才爆，且指不出是哪一小節）。
另有 `parseChartText` / `formatChartText` 處理整份曲譜（含 `key:` / `feel:` / `form:` 標頭），
兩者互為反向，round-trip 由測試鎖定。

> 為什麼內建曲庫也用這個文字記法、而不是直接寫 `tokens` + `barsPerChord` 兩個平行陣列：
> 兩個陣列必須等長且和要等於小節數，人工維護 32 小節的曲子必錯，而且錯了只會在
> 「第 17 小節開始整首歪掉」的時候才發現。小節線寫法把小節數寫在字面上，一眼可讀，
> 而且**內建曲庫與使用者匯入的格式完全相同**——使用者匯出一首曲子，格式就是我們的原始碼。

### F8-2 曲式引擎（core）

```ts
export interface ChartSection {
  /** 段落標記，樂手通用（A / A2 / B / Intro / Coda），不翻譯 */
  label: string
  /** F8-1 的小節線記法 */
  bars: string
  harmonyLevel?: HarmonyLevel
}

export interface ChartForm {
  homeKey: NoteName
  /** 段落展開順序，如 ['A', 'A2', 'B', 'A3'] */
  form: readonly string[]
  sections: readonly ChartSection[]
}

/** 小節內的一個和弦（offsetBeats 讓半小節換和弦成為可排程的事實） */
export interface BarChord {
  chord: RealizedChord
  /** 距小節起點的偏移，單位＝拍 */
  offsetBeats: number
  /** 持續幾拍 */
  beats: number
}

export interface FormBar {
  /** 1-based 絕對小節（一個 chorus 內） */
  bar: number
  /** 這一小節屬於 form 的第幾個段落（0-based） */
  sectionIndex: number
  label: string
  chords: BarChord[]
}

export function expandForm(form: ChartForm, options: RealizeOptions & { beatsPerBar: number }): FormBar[]
export function sectionSpans(form: ChartForm): readonly { label: string; firstBar: number; bars: number }[]
export function formBarCount(form: ChartForm): number
```

1. `form` 陣列裡出現 `sections` 沒定義的 label → 丟例外（拼錯段名不該安靜地少一段）。
2. `expandForm` 的輸出是**一個 chorus 的完整小節表**；反覆由模組層以 `loopIndex` 取模，
   與既有和弦模組同一種做法（時鐘不因為換段而重排）。
3. **`BarChord.offsetBeats` 是本 Phase 對既有 `RealizedBar` 的實質升級**：現有的
   `RealizedBar.chords` 只知道「這一小節有這幾個和弦」，不知道第二個和弦從第幾拍開始。
   一小節兩個和弦在爵士曲裡是常態，comping 示範音必須知道確切位置才排得準。
4. **不沿用 `realizeProgression`，也不動它。** 原設計是抽出共用的 `realizeTokens`，
   實作時發現那條路是錯的：`realizeProgression` 用「累加位置再 floor」決定和弦落在第幾小節，
   而平分小節會產生 1/3——累加三次是 0.999…，floor 之後整首往前錯一小節。
   `expandForm` 改為逐小節展開（`parseChartBars` 已經把小節切好了），跨小節零浮點累加。
   代價是兩支展開器並存；換來的是既有進行模組**一行未改、測試一字未動**。

### F8-3 Feel 表（模組層）

書上寫的是 feel 標記，不是 BPM。本表就是「標記 → 可跟練的設定」的翻譯，
**每一格都是本專案的編排，不是任何出版品的資料**。

```ts
export interface Feel {
  id: FeelId
  /** 譜上印的標記字樣，不翻譯 */
  marking: string
  descriptionKey: string
  timeSig: TimeSignature
  ticksPerBeat: TicksPerBeat
  swing: number
  bpm: { min: number; default: number; max: number }
  /** 計時用的 click 格子（掛進 Transport，由它決定拍號與細分） */
  click: RhythmPattern
  /** 和弦敲點；每小節一列，長度可與 click 不同（兩小節的圖形就寫兩列） */
  comp: readonly (readonly CellRole[])[]
}
```

> **click 與 comp 是兩張格子**（實作時才浮現的規格）。節奏線的模組只有一張 pattern：
> 畫面畫什麼、click 就響什麼。這裡不行——comp 圖形（Charleston 只敲 1 與 2 的反拍）
> 拿來當節拍器會讓人整個失去拍子。所以計時歸計時、律動歸律動，兩張格子共用
> 同一個 `timeSig` × `ticksPerBeat` 網格，格號可以直接互換（由 `feels.spec.ts` 鎖定對齊）。

| id | marking | 拍號 | BPM（min／預設／max） | swing | comp 概念 |
|---|---|---|---|---|---|
| `ballad` | Ballad | 4/4 | 50 / 62 / 80 | shuffle | 1、3 各一擊 |
| `mediumSwing` | Medium Swing | 4/4 | 110 / 140 / 170 | shuffle | Freddie Green 四分 |
| `mediumUpSwing` | Medium Up Swing | 4/4 | 170 / 190 / 220 | shuffle | Charleston（1 與 2 的反拍） |
| `upTempo` | Up Tempo | 4/4 | 220 / 240 / 300 | shuffle | two-feel（一小節兩擊） |
| `jazzWaltz` | Jazz Waltz | 3/4 | 120 / 160 / 200 | shuffle | 1 與 2 的反拍 + 3 |
| `bossa` | Bossa Nova | 4/4 | 110 / 132 / 160 | straight | 兩小節 comp 圖形 |
| `samba` | Samba | 4/4 | 170 / 200 / 240 | straight | 十六分 comp |
| `afroCuban` | Afro-Cuban | 4/4 | 150 / 176 / 200 | straight | 2-3 son clave |
| `shuffleBlues` | Medium Blues Shuffle | 4/4 | 90 / 112 / 130 | shuffle | 反拍重音 |
| `evenEighths` | Even Eighths | 4/4 | 120 / 144 / 180 | straight | 八分平均 |

1. 選曲 → 套用該曲的 feel（拍號、BPM 預設、swing、comp pattern 一次到位）。
2. 使用者在 TransportBar 上改 BPM **一律以使用者為準**（沿用 `usePracticeTransport` 的回寫），
   但畫面在超出 `bpm.min/max` 時顯示提示（「Up Tempo 通常在 220–300」），不阻擋。
3. `swing` 一律走 `SWING_SHUFFLE` / `SWING_STRAIGHT` 常數，不寫 66 這種近似值。
4. `upTempo` 的 comp 預設是 two-feel：240 BPM 下四分音符 comping 是噪音不是練習。

### F8-4 曲庫（`charts.ts`）

```ts
export type ChartOrigin =
  | { kind: 'drill' }
  | { kind: 'public-domain'; composer: string; firstPublished: number }

export interface Chart extends ChartForm {
  id: string
  /** 曲名／形式名，**不翻譯**（與和弦符號同一條規則，見 §4 決策 4） */
  title: string
  descriptionKey: string
  feel: FeelId
  bpm?: number
  origin: ChartOrigin
  knowledgeIds?: readonly string[]
}
```

**A 層（形式練習）首發清單**——本 Phase 的主要內容，每一條都是通用和聲模板：

| id | title | 曲式 | 記法（節錄） |
|---|---|---|---|
| `jazz-blues` | Jazz Blues | 12 | `I7 \| IV7 \| I7 \| vm7 I7 \| IV7 \| #ivdim7 \| I7 \| V/ii \| ii \| V7 \| I7 V/ii \| ii V7` |
| `bird-blues` | Bird Blues | 12 | 以 `Imaj7 \| viim7b5 V/vi \| vim7 V/V \| vm7 V/IV` 起的下行 2-5 串 |
| `rhythm-a` | Rhythm Changes A | 8 | `I6 vim7 \| iim7 V7 \| iiim7 V/ii \| iim7 V7 \| IVmaj7 \| ivm6 \| iiim7 V/ii \| iim7 V7` |
| `rhythm-bridge` | Rhythm Bridge | 8 | `V/vi \| % \| V/ii \| % \| V/V \| % \| V7 \| %` |
| `rhythm-full` | Rhythm Changes | 32（AABA） | 由前兩者組成，`form: ['A','A2','B','A3']` |
| `major-thirds` | Major-Thirds Cycle | 4 | `Imaj7 bIII7 \| bVImaj7 VII7 \| IIImaj7 V7 \| Imaj7` |
| `minor-251` | Minor ii-V-i | 4 | `iim7b5 \| V7b9 \| imMaj7 \| %` |
| `backdoor` | Backdoor Cadence | 4 | `Imaj7 \| iim7 \| bVII7 \| Imaj7` |
| `turnarounds` | Turnaround Set | 4 × n | `I vim7 \| iim7 V7`、`iiim7 V/ii \| iim7 V7`、`I bIII7 \| bVImaj7 V7` |
| `aaba-32` | Typical AABA | 32 | 由常見手法組成的通用 32 小節骨架 |

**B 層（公版曲）候選**（每首入庫前逐首查證出版年與屬地，畫面上標示作者與年份）：
St. Louis Blues（1914）、After You've Gone（1918）、Sweet Georgia Brown（1925）、
Bye Bye Blackbird（1926）、Someone to Watch Over Me（1926）、Ain't Misbehavin'（1929）、
Honeysuckle Rose（1929）、I Got Rhythm（1930）、Body and Soul（1930）、
On the Sunny Side of the Street（1930）。

### F8-5 跟練畫面

由上而下：TransportBar（既有）→ 曲式圖 → 段落時間軸 → 指板 → 五度圈 → 設定列。

1. **曲式圖**：一列段落籤（`A A B A`），當前段落高亮，每格顯示段名與小節數。
   點一格 = 跳到那一段（`useBarCursor` 位移，時鐘不停）；**循環範圍另有一個獨立的切換鈕**
   （整首／只循環當前段），不用長按——長按在桌機上沒有對應手勢，而把兩種行為疊在同一個
   點擊上會讓人不知道自己按到哪一種。循環單段時，點別的段＝把循環換到那一段。
2. **段落時間軸**：沿用 `ChordTimeline` + `buildChordStrip`，顯示**當前段落的每一小節**
   （通常 8 格，不是整首 32 格——32 格在手機上點不到也看不清）。
   一小節兩個和弦以 `·` 併排；點任一格強制切換。
3. **指板**：當前和弦組成音全覆蓋 + 把位框（與 `KeyPracticeView` 完全一致的接線）。
4. **五度圈**：顯示當前和弦根音位置；點外圈 = **移調**（寫回設定並經 `toPracticeKey` 正規化，
   與固定調練習同一種行為）。
5. **chorus 計數**：`第 3 遍 · B 段 · 第 5 小節`。由 transport 的絕對小節數整除曲式長度求得，
   不另開計數器。

### F8-6 練習控制

1. **段落循環**：`全曲` / 各段 / `自訂範圍`（起訖小節）。循環邊界一律落在小節線。
2. **移調**：12 調任選（級數記法直接支援，這是本設計選擇級數而非絕對和弦名的主要理由）。
   另有 `隨機換調`：每 N 遍換一個調——這是標準曲練習的核心，「你只會在 F 調彈這首」是常見死角。
3. **漸進消音**：沿用既有的 `demoSilence`（示範 N 小節 / 靜默 N 小節）。
   標準曲的預設是「示範一遍、靜默一遍」——先聽對，再自己撐住。
4. **comp 開關**：`和弦 comp` / `只有低音根音` / `關閉`。
5. 練習日誌沿用 `usePracticeSession`，`params` 記 `{ chartId, key, feel, bpm }`。

### F8-7 comping 示範音（`composables/useCompDemo.ts`）

既有 `useChordDemo` 一小節只在 beat 1／tick 1 響一次；標準曲需要
（a）小節內換和弦、（b）和弦跟著 comp pattern 的發聲格敲。新增一個並列的接線：

```ts
export interface CompChord { /** 同一個和弦的穩定識別（通常是 symbol） */ key: string; tones: readonly Note[] }
export function useCompDemo(chordAt: (e: TickEvent) => CompChord | undefined): void
```

1. 訂閱 `subscribeSchedule`（與 `useNoteDemo`／`useChordDemo` 同一條理由：發聲要提前排程）。
2. `role === 'rest'` 的格不發聲——comp pattern 的休止就是 comping 的一部分。
3. **和弦沒換就不重新配置聲位**：以 `key` 比對，同一個和弦連敲三下要是同一個把位；
   每次都跑一遍 `voiceChord()` 會讓同一個和弦每敲一次跳一個轉位，聽起來像有人在亂彈。
   換和弦時才以 `previous` 求最近轉位（沿用既有的自動聲部連接）。
4. 音長取「到下一個發聲格」，不是整小節——四分音符 comping 用整小節音長會糊成一片。

### F8-8 使用者曲譜（匯入／編輯）

1. `stores/userCharts.ts`：`VersionedStore<UserChart[]>('rcs.userCharts', 1, () => [])`，
   結構與 `Chart` 相同但 `origin.kind === 'user'`、多 `createdAt`。
   **與 `customProgressions` 平行、不共用**——那是單段進行，這是曲式，schema 不同。
2. 編輯器沿用 `ProgressionEditor` 的做法：逐段即時驗證，錯誤標到**第幾段第幾小節第幾個 token**。
3. 匯入／匯出為純文字（F8-1 的格式 + `key:` / `feel:` / `form:` 三行標頭），
   可貼上、可複製。使用者的譜是他自己的資產，要能帶得走。
4. `persistence/backup.ts` 的鍵名清單加入 `'rcs.userCharts'`（否則備份會靜靜漏掉）。
5. 曲目選單分三組：`形式練習` / `標準曲` / `我的曲譜`。

### F8-9 公式表補完（core）

爵士曲式跑不動的直接原因是公式表缺品質。新增 9 個（每個一行 + `QUALITY_SUFFIX` 一行）：

| quality | 公式 | 用途 |
|---|---|---|
| `7sus4` | 1 4 5 b7 | sus 屬和弦，bossa 與現代標準曲滿地都是 |
| `7b9` | 1 3 5 b7 b9 | 小調 2-5-1 的 V |
| `7#9` | 1 3 5 b7 #9 | blues／alt |
| `7#5` | 1 3 #5 b7 | alt |
| `7b5` | 1 3 b5 b7 | alt／全音階 |
| `11` | 1 5 b7 9 11 | 省 3 音的屬十一 |
| `m11` | 1 b3 5 b7 9 11 | modal ii |
| `maj7#11` | 1 3 5 7 #11 | lydian 大七 |
| `69` | 1 3 5 6 9 | 結尾主和弦 |

`DegreeLabel` 已含 `b9`／`#9`／`#11`／`11`，無需改型別。

---

## 3. 驗收標準（Phase DoD）

- [ ] `expandForm` 對所有內建曲譜 × 12 調都不丟例外；符號序列有快照測試（沿用 Phase 3 的做法）
- [ ] `parseChartBars` 有純函式測試：小節數、平分、`%`、以及**每一種語法錯誤都帶正確的 barIndex**
- [ ] `BarChord.offsetBeats` 有測試鎖定：一小節兩個和弦在 4/4 下是 0 與 2 拍
- [ ] `realizeProgression` 重構後**既有測試一字未改且全綠**（行為鎖定）
- [ ] comping 示範音在瀏覽器實測：同一個和弦連敲不換轉位、換和弦就近移動、`rest` 格不發聲
- [ ] 段落跳轉與強制切換不中斷 click（時鐘不重排，沿用 `useBarCursor`）
- [ ] 模組內零 hardcode 音名；曲庫只存級數與品質（測試鎖定）
- [ ] `npm run test` 綠燈、`npm run typecheck` 零錯誤、依賴規則零違規
- [ ] 兩個 locale 檔同步；`config/routes.ts` 補 `/chords/jazz-book`（漂移守門測試會擋）
- [ ] `config/ads.ts` 的白名單**不含**本路由（跟練頁零廣告，`ads.spec.ts` 已鎖）
- [ ] `npm run build` 成功，首屏 bundle 未成長（模組 lazy load）
- [ ] B 層每一首都有 `composer` 與 `firstPublished`，且有一份查證紀錄

---

## 4. 本 Phase 的實作決策（補充規格）

1. **歸在和弦線，不另開第四類。** 「三要素＝節奏／和弦／音階」是產品的骨架承諾
   （overview §1）。標準曲練的是和聲行進，它是和弦線的第五個模組，不是新的一條線。

2. **曲式一律展開成段落陣列，不做反覆記號。** 書上的 `1st/2nd ending`、`D.S. al Coda`
   是**排版的省字法**，服務的是「一頁印得下」；跟練需要的是「第 27 小節該彈什麼」。
   展開成 `form: ['A','A2','B','A3']` 之後，段落循環、強制切換、chorus 計數全部
   退化成單純的索引運算，而 A 與 A2 只差最後兩小節這件事，讓兩段各寫一次就解決了。
   （代價：資料略長。那是划算的交易——記號語意的實作與測試成本高得多。）

3. **曲譜存級數，不存絕對和弦名。** 移調因此是免費的，而「同一首在 12 個調」正是
   標準曲練習的重點。副作用是遇到明確轉調的曲子級數會出現大量升降記號
   （`bVImaj7`、`VII7`）——那是**正確的資訊**：它明說了這個和弦離主調有多遠。
   parser 的 `ALLOWED_DEGREES` 已涵蓋 12 個半音，文法足夠。

4. **曲名不進 i18n。** `Rhythm Changes`、`Bird Blues`、`Body and Soul` 是專有名詞，
   全世界的樂手用同一個字串溝通，與和弦符號（`Am7`）同一條規則。
   翻成「節奏變化」只會讓使用者找不到自己要的那首。
   翻譯的是 `descriptionKey`（練習說明）與 feel 的說明文字。

5. **feel 表是本專案的編排，不是抄來的資料。** 書上只有標記；BPM 區間、comp pattern
   是我們對那個標記的詮釋。因此它可以、也應該被使用者覆寫——預設值是起點不是規定。

6. **comp 的和弦聲位以「和弦有沒有換」為界重算。** 這是 F8-7 唯一容易寫錯的地方：
   若每個發聲格都呼叫 `voiceChord()`，同一個 Dm7 敲四下會出現四個轉位。
   症狀不是「錯音」而是「聽起來很怪」，最難查。

7. **時間軸只顯示當前段落。** 32 小節全列出來，每格會窄到手機上點不到——
   而「點得到看得見的和弦」正是強制切換這個設計的前提（見 `timeline.ts` 頂部註解）。
   整首的鳥瞰交給曲式圖（4–8 格），兩者分工。

8. **使用者曲譜不上傳。** 站台無後端是產品優勢也是法律優勢：使用者輸入自己那本書的內容，
   資料從不離開他的瀏覽器，我方沒有伺服器可存放（隱私權政策已如此宣告）。

---

## 5. 風險

| 風險 | 對策 |
|---|---|
| 商標與著作權 | 不用書名；內建只收形式練習與公版曲；使用者曲譜只存本機。B 層每首附作者與出版年，清單可被 review |
| 「公版」判定屬地不一致（美 vs 歐） | 界線取最保守者；有疑義的一律不進 repo，留給使用者自行輸入 |
| 32–64 小節的曲子在手機上塞不下 | 時間軸只畫當前段落，曲式圖負責鳥瞰；沿用既有的橫捲與游標跟捲 |
| 240 BPM 的 up tempo 下和弦示範音變成一團 | `upTempo` 預設 two-feel comp；comp 開關提供「只有低音根音」 |
| 移調後拼寫爆炸（Gb 調的 `VII7`） | 12 調 × 全曲庫的符號序列快照測試，與 Phase 3、七和弦琶音同一種鎖定方式 |
| 使用者輸入的譜格式千奇百怪 | 白名單 parser，錯誤指到「第幾段第幾小節第幾個 token」；不猜、不容錯 |
| 曲庫變大之後首屏 bundle 成長 | 曲庫與模組同屬 lazy chunk；若超過門檻，曲庫再切一層 dynamic import（`check-bundle-size.mjs` 守門） |

---

## 6. 實作檔案地圖

```
core/theory/formulas.ts                    ← +9 個品質 + QUALITY_SUFFIX（F8-9）
core/theory/progressions/types.ts          ← +ChartSection / ChartForm / BarChord / FormBar
core/theory/progressions/parser.ts         ← 抽出 realizeTokens（行為不變）
core/theory/progressions/form.ts           ← 新增：expandForm / sectionSpans / formBarCount
core/theory/progressions/form.spec.ts      ← 新增
core/theory/progressions/chartText.ts      ← 新增：parseChartBars
core/theory/progressions/chartText.spec.ts ← 新增
composables/useCompDemo.ts                 ← 新增（F8-7）
stores/userCharts.ts                       ← 新增（VersionedStore，version 1）
persistence/backup.ts                      ← 鍵名清單 +'rcs.userCharts'
modules/chords/jazzBook/manifest.ts        ← 新增
modules/chords/jazzBook/settings.ts        ← 新增
modules/chords/jazzBook/feels.ts(+spec)    ← 新增（F8-3）
modules/chords/jazzBook/charts.ts(+spec)   ← 新增（F8-4，含 12 調快照）
modules/chords/jazzBook/JazzBookView.vue   ← 新增
modules/chords/jazzBook/ChartEditor.vue    ← 新增（F8-8）
modules/index.ts                           ← +1 行註冊
config/routes.ts                           ← +'/chords/jazz-book'
locales/zh-TW.json / en.json               ← modules.chords.jazzBook.* / jazzBook.* / feel.*
content/knowledge/*                        ← +4 條雙語：AABA 曲式、Rhythm Changes、
                                              turnaround、feel 標記怎麼讀
```

**同時要更新的規範文件**（架構文件是法律，新增的模式要進表）：
- `docs/architecture.md` §2 設計模式地圖：`form.ts`、`chartText.ts`、`feels.ts`、`useCompDemo` 各一列
- `docs/architecture.md` §4 關鍵契約索引：曲譜文字文法、曲式展開、feel 表
- `docs/overview.md` §5 和弦線與 §6 路線圖各補一段

---

## 7. 實作記錄（本 Phase 已完成）

**規模**：新增 784−719 = 65 個測試（總計 784 全綠）、typecheck 零錯誤、
首屏 bundle 93.72 KB gz（預算 200 KB，未成長——模組是 lazy chunk，28.1 KB / 9.0 KB gz）。

**曲庫**：19 份曲譜。

- **形式練習 14 份**：Jazz Blues、Bird Blues、Rhythm Changes A／Bridge／全曲（32 小節 AABA）、
  Typical AABA、Turnaround Set（四種各四小節）、Minor ii-V-i、Minor Blues、Major-Thirds Cycle、
  Coltrane Cadence、Tritone Substitution、Descending ii-V Chain、Modal Vamp。
- **公版曲 5 首**：St. Louis Blues（Handy, 1914）、Sweet Georgia Brown（1925）、
  When the Saints Go Marching In（Trad., 1896）、Careless Love（Trad., 1911）、
  Frankie and Johnny（Trad., 1904）。**公版界線寫成測試**（`charts.spec.ts` 斷言
  `firstPublished <= 1930`），與 `ads.spec.ts` 同一種做法：要放寬就得先改測試。

**與設計的差異**（三處，都是實作時才看得到的）：

1. 曲式展開不共用 `realizeProgression`（浮點累加，見 F8-2.4）。
2. Feel 拆成 click 與 comp 兩張格子（見 F8-3）。
3. 段落循環改用獨立切換鈕，不用長按（見 F8-5.1）。

**仍待人工驗收**（需要瀏覽器與耳朵，不是程式碼）：

- comping 在各 feel 下的實際聽感；同一個和弦連敲不換轉位、換和弦就近移動
- 240 BPM 的 up tempo 下 two-feel 是否仍然清楚
- 手機（375px）上曲式圖與時間軸的可點性
- **公版曲的出版年與屬地逐首查證**，以及五首曲子的和聲是否與原曲相符
  （目前依原曲和聲自行編寫，未經第二人複核）
