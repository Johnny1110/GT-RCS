# Phase 6 PRD — 營運上線（GCP 部署 + 廣告變現）

> 目標：把 RCS 從「可部署的專案」變成「對外公開營運的服務」——架設於 GCP、以 Google AdSense 廣告收入支撐主機開銷，並補齊公開營運所需的法遵與監控。
> 結束狀態：正式網域上線、CI/CD 自動部署、廣告開始投放且不干擾練習體驗、GCP 成本有預算警示、每月開銷 ≈ 由廣告收入覆蓋。

## 1. 範圍

### In scope
- GCP 部署架構（Firebase Hosting）+ 自訂網域 + HTTPS
- CI/CD（GitHub Actions：測試 → 建置 → 部署，PR 預覽頻道）
- Google AdSense 整合（版位策略、審核準備、ads.txt）
- 同意管理（EEA/UK 法遵 CMP）與隱私權/Cookie 政策頁
- SEO 與 AdSense 審核所需的內容可及性
- 成本監控與預算警示、基本流量分析

### Out of scope
- 付費會員/訂閱制、移除廣告的付費方案（未來若廣告不敷成本再評估）
- 後端 API（維持純靜態）

## 2. 部署架構決策

| 方案 | 每月成本（低流量） | 評估 |
|---|---|---|
| **Firebase Hosting（採用）** | $0 起（Spark 免費額度：10GB 儲存、每日 360MB 流量；超出走 Blaze 按量計費） | GCP 生態系、內建全球 CDN 與 HTTPS、預覽頻道、CLI 部署一行。靜態 SPA 的最佳解 |
| Cloud Storage + HTTPS LB + Cloud CDN | 固定 ~US$18+/月（LB 轉發規則） | 對純靜態站是殺雞用牛刀，固定成本高 |
| Cloud Run + nginx | ~$0–數美元 | 多維護一層容器，無必要 |

- 結論：**Firebase Hosting**。RCS 音訊零資源、首屏 < 200KB gz（Phase 5 守住的預算在此變現——流量成本極低），低中流量下主機開銷趨近於 0，AdSense 收入覆蓋綽綽有餘。
- 若日後流量暴增再評估 Blaze 帳單與快取命中率，不預先過度設計。

## 3. 功能需求

### F6-1 部署與網域
1. Firebase Hosting 專案建立，`firebase.json` 設定：SPA rewrite（全路由 → index.html）、靜態資產長快取（hash 檔名 immutable）、`index.html` no-cache。
2. 自訂網域 + 自動憑證（Firebase 代管）；`www` → apex 301。
3. 安全標頭：CSP（允許 AdSense/CMP 所需網域的白名單）、`X-Content-Type-Options`、`Referrer-Policy`。

### F6-2 CI/CD（GitHub Actions）
1. PR：lint + `npm run test` + build → 部署到 Firebase **預覽頻道**（獨立網址，review 用，7 天過期）。
2. main 合併：全檢查通過後自動部署 production。
3. 部署憑證用 Workload Identity Federation（不放長期金鑰）。

### F6-3 AdSense 整合
1. **版位策略（產品原則：練習體驗絕不被廣告打斷）**：
   - ✅ 允許版位：首頁導覽區底部、Scale/和弦 Explorer 頁側欄（桌機）或列表底部（行動）、練習結束總結畫面、統計儀表板底部
   - ❌ 禁止版位：**任何跟練畫面播放中**、指板/五度圈/節奏譜組件周圍、TransportBar 附近；不用自動廣告（Auto ads）避免 Google 亂插版位，全部手動指定廣告單元
   - 版位預留固定尺寸容器（載入前後同高），CLS = 0
2. 技術整合：AdSense script 僅在含廣告版位的路由載入、`async` 延後於 App 可互動之後；廣告被攔截器擋掉時容器優雅收合（不留白、不出提示）。
3. `ads.txt` 置於網域根目錄；廣告單元以環境變數注入（開發/預覽環境不載入真廣告）。
4. 效能守則：含廣告頁面的 Lighthouse perf 允許降至 ≥ 80（廣告 script 為主因），**練習頁面（無廣告）維持 ≥ 90**。

### F6-4 同意管理與隱私（AdSense 審核與 GDPR 必要條件）
1. CMP：採用 Google 認證 CMP（優先用 Google 自家 consent message / IAB TCF 相容），EEA/UK/瑞士訪客顯示同意徵求；未同意者投放非個人化廣告（NPA）。
2. Google Consent Mode v2 訊號接入。
3. 新增頁面（雙語，footer 連結）：隱私權政策、Cookie 政策、關於本站（含聯絡方式——AdSense 審核加分項）。
4. localStorage 練習紀錄屬本機資料不外傳——在隱私權政策明確說明（這是產品優勢，寫清楚）。

### F6-5 SEO 與 AdSense 審核準備
1. AdSense 審核需要「有實質內容、可爬取」的網站：
   - 落地首頁含產品介紹實質文案（非純 App shell）
   - 樂理知識內容（Phase 2–4 累積的雙語知識庫）以可獨立連結的靜態路由呈現（`/knowledge/...`），成為審核與 SEO 的內容資產
   - 以 vite-ssg 或建置期 prerender 產出上述內容頁的靜態 HTML（App 本體維持 SPA）
2. 基本 SEO：每路由 title/meta description（i18n）、`sitemap.xml`、`robots.txt`、Open Graph 卡片、`hreflang`（zh-TW/en）。
3. 送審流程：內容頁與法遵頁全數上線 → 掛驗證碼送審 → 通過後才開廣告單元（審核期間站上無廣告）。

### F6-6 成本監控與分析
1. GCP Budget：月預算警示（例：$5、$10、$25 三段通知信）。
2. Firebase Hosting 用量儀表板每月檢視；快取命中率異常（帳單突增）有 checklist。
3. 流量分析：GA4（納入 CMP 同意管控）或隱私友善替代（如自架 GoatCounter）——v1 先 GA4（與 AdSense 同一同意流程，整合成本最低）。
4. 每月一頁營運筆記：流量、廣告收入、GCP 帳單，驗證「收入 ≥ 開銷」的營運假設。

## 4. 驗收標準（Phase DoD）

這個 Phase 的 DoD 有一半不是程式問題，而是帳號問題。分開記，才看得出哪些是「還沒做」、
哪些是「做完了但要等一個人去按核准」。操作步驟見 `docs/ops/runbook.md`。

### 程式端（已完成並驗證）

- [x] **廣告版位 CLS = 0；攔截器環境下版面無破損**
      Lighthouse 實測四條路由 CLS 全部 0。投放成功時容器保留 250–280px；
      `data-ad-status="unfilled"` 與 script 被擋兩種情境都整塊移除，不留白也不出提示。
- [x] **所有跟練播放畫面零廣告**
      不是播放時隱藏，而是那些路由根本沒有廣告容器（`config/ads.ts` 白名單）。
      瀏覽器實測 `/rhythm/groove`、`/scales/explorer`、`/chords/key-practice` 的 DOM
      連一個 `ins.adsbygoogle` 都沒有；`config.spec.ts` 鎖定白名單不含任何模組路由。
- [x] **隱私權/Cookie/關於頁（zh-TW/en）上線且 footer 可達**
      三份雙語文件（各 8–10 個區塊）＋ 每一頁都有的頁尾，連預渲染的靜態 HTML 也帶頁尾連結。
- [x] **SPA 全路由直達可用**
      以模擬 Firebase 路由規則的靜態伺服器驗證：`/knowledge/scale-ionian` 直接輸入回 200，
      未知路徑落到 SPA fallback 並顯示標了 noindex 的 404 頁。
- [x] **練習頁 Lighthouse perf ≥ 90 維持不變**
      `/rhythm/groove` 97、`/scales/practice` 97；內容頁 `/knowledge/scale-ionian` 98、首頁 96。
      SEO 與 best-practices 四條路由都是 100。
- [x] **內容可被爬取**：關閉 JS 時六個預渲染網址都有完整內文、正確的 title／canonical／
      hreflang，且每頁都有 4–37 條可跟隨的內部連結（條目頁 = 1 麵包屑 + 6 同類 + 4 頁尾）。
- [x] **Consent Mode v2 預設值**：EEA/UK/CH 四項全 denied 並 `wait_for_update`，其餘地區 granted，
      且排在任何 Google tag 之前（`thirdParty.spec.ts` 鎖定順序與內容）。

### 待帳號設定（程式已就緒，缺的是設定值）

- [ ] 正式網域 HTTPS 上線；PR 預覽頻道運作 → runbook §1、§2、§4
- [ ] AdSense 審核通過並建立三個版位 → runbook §5（`ADSENSE_CLIENT` 空白時全站零廣告，可安心先上線）
- [ ] EEA 地區顯示同意徵求 → runbook §6（CMP 訊息要在 AdSense 後台發布）
- [ ] 知識內容頁被 Google 索引 → runbook §9（sitemap 已產生，中英共 94 個網址）
- [ ] GCP 預算警示測試觸發成功 → runbook §8

### 已知債（不在本 Phase 範圍，但量到了就記下來）

Lighthouse a11y 在**練習頁**是 96（內容頁與首頁都是 100），扣分在兩處既有元件：

- `target-size`：TransportBar 的三音色靜音鈕與音量滑桿小於 24×24（WCAG 2.2 AA 的 2.5.8）。
  放大會讓 TransportBar 在手機上更佔空間——這是同一個未解的取捨，一起處理比較合理。
- `label-content-name-mismatch`：節奏譜格子的 `aria-label`（「第 1 小節第 5 格：鬼音」）
  不包含格內可見文字（計數標籤）。修法是把可見文字納入 label 開頭。

## 5. 風險
| 風險 | 對策 |
|---|---|
| AdSense 審核不過（內容不足/純工具站） | F6-5 的知識內容頁先行：送審前確保有足量可爬取的雙語樂理內容與關於/聯絡頁；被拒依理由補強再送 |
| 廣告傷害練習體驗招致負評 | 版位白名單制 + 禁用 Auto ads；把「練習中零廣告」寫進產品原則對外承諾 |
| CMP/廣告 script 拖慢首屏 | 只在含廣告路由載入、App 可互動後才注入；練習頁完全不載廣告 script |
| 流量成長導致 Blaze 帳單超過廣告收入 | 預算警示 + 每月營運筆記追蹤；資產長快取壓 CDN 回源；必要時再評估收入結構 |
| CSP 與第三方 script 網域清單衝突 | 廣告/CMP 網域白名單集中管理，預覽頻道先驗證再上 production |

---

## 6. 實作決策（Phase 6 完成時補記）

1. **廣告版位改放知識頁，不放 Scale Explorer**（偏離 F6-3.1 的字面）。
   PRD 同時允許 Explorer 側欄、又禁止「TransportBar 附近」，而 Explorer 在 RCS 正是掛著
   TransportBar 的模組頁。照字面實作只剩兩條路：播放中隱藏（廣告已投放才隱藏，
   是 AdSense 政策風險），或播放中照顯示（違反產品承諾）。兩條都不能走，所以版位改成
   首頁／知識頁／統計頁——三個純粹用來「讀」的頁面，也是內容最多的頁面。
   附帶好處：`AdSlot` 因此不需要認識 transport，維持純顯示組件。

2. **「練習中零廣告」實作成白名單而不是條件隱藏。** 沒列在 `PLACEMENT_ROUTES` 的路由，
   連廣告容器都不存在。條件隱藏會留下「某天有人把條件改錯」的空間；不存在的東西改不壞。
   `config.spec.ts` 逐條比對白名單與模組註冊表，要在練習頁放廣告得先改測試——那一刻就會有人問為什麼。

3. **不用 vite-ssg，自己寫預渲染。** 內容本來就是結構化 JSON，變成 HTML 只需要純函式；
   引 SSR 框架等於為了 38 頁靜態內容扛一整條相依鏈，而首屏 bundle 是本專案的硬指標。
   代價是要自己維護「靜態 HTML 的 class 要跟 Vue 組件一致」——用共用 `content/blocks.ts`
   的解析與摘要實作把這個代價壓到最小。

4. **預渲染的 head 標籤帶 `data-rcs-seo`。** 這是 Lighthouse 抓出來的：不帶標記的話，
   Vue 掛載後寫的 canonical 會與靜態 HTML 的並存，同一頁兩個 canonical。
   SPA fallback 的頁面更糟——留下的是首頁的 canonical。修正後 `/rhythm/groove` 的
   Lighthouse SEO 從 92 回到 100。

5. **`firebase.json` 是產生的，不是手寫的。** CSP 的第三方網域必須與執行期實際載入的清單
   一致，而兩份手動維護的清單一定會漂移。漂移的症狀是「正式站廣告不見了」，
   本機與預覽都看不到（那裡本來就不載廣告）。`deploy/firebase.spec.ts` 逐字比對，
   忘了重新產生會在 CI 失敗而不是在正式站失敗。

6. **CSP 的 `script-src` 含 `'unsafe-inline'`，且明說原因。** AdSense 與 CMP 會注入行內
   script，靜態主機又發不出 per-request nonce。與其假裝有一個更嚴格的 CSP，不如把它的
   實際價值講清楚：限制**可載入的第三方網域**。`'unsafe-eval'` 沒有預先開，
   真的遇到素材壞掉再加並在 runbook 記一筆。

7. **CMP 全站載入，廣告只在白名單頁。** 若讓 CMP 跟著 AdSense script 走，
   從練習頁進站的 EEA 訪客永遠不會被詢問，而 GA4 仍在跑——那是漏洞。

8. **部署設定用 repository variables 而不是 secrets。** AdSense client、GA ID、網域
   本來就寫在網頁原始碼裡。把公開值當機密管理只會製造「以為它是機密」的錯覺；
   真正該保護的部署權限走 Workload Identity Federation，根本沒有值可以外洩。

9. **每條路由都有 `/en/…` 孿生路由，不是只有內容頁。** hreflang 是成對宣告的，
   sitemap 也逐語系列出網址；只有一半路由有英文版，sitemap 就會指向 404。

10. **網址是語系的真相來源。** 帶前綴 = 這次瀏覽用英文；不帶前綴而使用者語言是英文時，
    導向帶前綴的網址。不同步的話會出現「網址說自己是中文版、畫面卻是英文」，
    `lang`、canonical 與實際內容三者互相打架。
    這裡踩到兩個真實的 bug，都是瀏覽器實測抓到的：
    - 掛載時初始導航還沒 commit，`route` 還是 `START_LOCATION`（path `/`），
      語系同步照著它導頁 → 直接輸入 `/stats` 會落到 `/en`。
      根治方式是 `main.ts` 等 `router.isReady()` 再掛載。
    - i18n 的初始語系比路由晚一步決定 → 內容頁先用舊語系載一次再用新語系載一次，
      兩個非同步結果誰後到誰贏。根治方式是 `createI18n` 之前先用 `localeFromPath()`
      讀網址，並在三個內容 view 加上過期結果保護。

11. **`config/routes.ts` 手寫一份路由目錄，並用測試鎖住。** sitemap 與預渲染需要一份
    Node 讀得到的清單，而 manifest 連著 Vue 與 `@/` 別名。手寫的代價是可能漂移，
    所以 `config.spec.ts` 比對它與註冊表——這條測試在寫完的第一次執行就抓到
    `/chords/circle` 其實叫 `/chords/circle-progressions`。

12. **bundle 預算進 CI。** `scripts/check-bundle-size.mjs` 量 index.html 直接引用的
    entry JS + CSS（lazy 分包不算，那是點進去才付的成本）。目前 82.32 KB gz / 200 KB。

## 7. 量到的數字

| 項目 | 值 |
|---|---|
| 測試 | 545 個（37 個檔案） |
| 首屏 bundle | 82.32 KB gz（77.41 JS + 4.91 CSS），預算 200 KB |
| 預渲染頁面 | 76 個（雙語 × 38） |
| sitemap 網址 | 94 個 |
| Lighthouse `/`（含廣告版位） | perf 96 / a11y 100 / BP 100 / SEO 100，CLS 0 |
| Lighthouse `/knowledge/scale-ionian` | perf 98 / a11y 100 / BP 100 / SEO 100，CLS 0 |
| Lighthouse `/rhythm/groove`（練習頁） | perf 97 / a11y 96 / BP 100 / SEO 100，CLS 0 |
| Lighthouse `/scales/practice`（練習頁） | perf 97 / a11y 96 / BP 100 / SEO 100，CLS 0 |
