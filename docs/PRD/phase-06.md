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
- [ ] 正式網域 HTTPS 上線，SPA 全路由直達可用；PR 預覽頻道運作
- [ ] AdSense 審核通過，指定版位開始投放；**所有跟練播放畫面零廣告**
- [ ] 廣告版位 CLS = 0；攔截器環境下版面無破損
- [ ] EEA 地區顯示同意徵求，拒絕後仍可完整使用網站（非個人化廣告）
- [ ] 隱私權/Cookie/關於頁（zh-TW/en）上線且 footer 可達
- [ ] 知識內容頁被 Google 索引（Search Console 驗證）
- [ ] GCP 預算警示測試觸發成功
- [ ] 練習頁 Lighthouse perf ≥ 90 維持不變

## 5. 風險
| 風險 | 對策 |
|---|---|
| AdSense 審核不過（內容不足/純工具站） | F6-5 的知識內容頁先行：送審前確保有足量可爬取的雙語樂理內容與關於/聯絡頁；被拒依理由補強再送 |
| 廣告傷害練習體驗招致負評 | 版位白名單制 + 禁用 Auto ads；把「練習中零廣告」寫進產品原則對外承諾 |
| CMP/廣告 script 拖慢首屏 | 只在含廣告路由載入、App 可互動後才注入；練習頁完全不載廣告 script |
| 流量成長導致 Blaze 帳單超過廣告收入 | 預算警示 + 每月營運筆記追蹤；資產長快取壓 CDN 回源；必要時再評估收入結構 |
| CSP 與第三方 script 網域清單衝突 | 廣告/CMP 網域白名單集中管理，預覽頻道先驗證再上 production |
