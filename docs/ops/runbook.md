# 營運 Runbook（Phase 6）

> 程式端已經就緒。這份文件列出**只有帳號擁有者做得到**的事：建立專案、申請帳號、填設定值。
> 依序做完就會上線。每一步都標了「做完之後怎麼確認」——沒有確認方式的步驟不算做完。

---

## 0. 先決定兩件事

| 要決定的 | 目前預設 | 影響 |
|---|---|---|
| **正式網域** | `https://rcs.guitar`（`src/config/site.ts` 的 `DEFAULT_ORIGIN`） | canonical、hreflang、sitemap、robots 全都用它 |
| **對外聯絡信箱** | `contact@rcs.guitar`（寫在三份法遵頁裡） | AdSense 審核會看；沒有可聯絡的方式是常見的退件理由 |

網域換掉的話：改 `DEFAULT_ORIGIN`，並把 GitHub variable `SITE_ORIGIN` 設成同一個值。
信箱換掉的話：改 `src/content/legal/zh-TW.json` 與 `en.json` 三份文件裡的 `contact@rcs.guitar`
（`legal.spec.ts` 會確認每份文件仍留有 `@`，但它認不出信箱是不是真的收得到信）。

---

## 1. Firebase Hosting 專案

```bash
npm i -g firebase-tools
firebase login
firebase projects:create rcs-app        # 專案 ID 自己取，之後到處都用它
firebase use --add                      # 在本機關聯專案（.firebaserc 不進版控）
```

`firebase.json` **不要手改**——它由 `deploy/firebaseConfig.ts` 產生：

```bash
npm run gen:firebase   # 改過 src/config/third-party.json 之後才需要跑
```

`deploy/firebase.spec.ts` 會確認 commit 進去的 `firebase.json` 與產生器輸出逐字相同，
所以忘了重新產生會在 CI 失敗，而不是在正式站失敗。

**確認**：`npx vite build && firebase hosting:channel:deploy manual-test --expires 1d`
→ 開預覽網址，站可用、`/knowledge/scale-ionian` 直接輸入也打得開（SPA rewrite 有效）。

---

## 2. Workload Identity Federation（給 GitHub Actions 用，零長期金鑰）

`PROJECT_ID`、`PROJECT_NUMBER`、`GITHUB_REPO`（`owner/repo`）先填成自己的值。

```bash
gcloud config set project PROJECT_ID

# 部署用的服務帳號
gcloud iam service-accounts create gh-deployer --display-name "GitHub Actions deployer"
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member "serviceAccount:gh-deployer@PROJECT_ID.iam.gserviceaccount.com" \
  --role roles/firebasehosting.admin
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member "serviceAccount:gh-deployer@PROJECT_ID.iam.gserviceaccount.com" \
  --role roles/serviceusage.serviceUsageConsumer

# OIDC 池與提供者
gcloud iam workload-identity-pools create github --location global
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location global --workload-identity-pool github \
  --issuer-uri "https://token.actions.githubusercontent.com" \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition "assertion.repository == 'GITHUB_REPO'"

# 只讓這個 repo 冒用這個服務帳號
gcloud iam service-accounts add-iam-policy-binding \
  gh-deployer@PROJECT_ID.iam.gserviceaccount.com \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/GITHUB_REPO"
```

> `--attribute-condition` 不能省。少了它，**任何** GitHub repo 的 workflow 都能拿到這個身分。

**確認**：推一個 PR，Deploy workflow 的 `auth` 步驟綠燈且輸出預覽網址。

---

## 3. GitHub repository variables

Settings → Secrets and variables → Actions → **Variables**（不是 Secrets）。

| 名稱 | 例 | 說明 |
|---|---|---|
| `FIREBASE_PROJECT_ID` | `rcs-app` | 第 1 步的專案 ID |
| `GCP_WIF_PROVIDER` | `projects/123.../locations/global/workloadIdentityPools/github/providers/github-provider` | 第 2 步的完整資源名稱 |
| `GCP_DEPLOY_SA` | `gh-deployer@rcs-app.iam.gserviceaccount.com` | 第 2 步的服務帳號 |
| `SITE_ORIGIN` | `https://rcs.guitar` | 無尾斜線 |
| `ADSENSE_CLIENT` | `ca-pub-0000000000000000` | 第 5 步拿到；**還沒過審就留空** |
| `ADSENSE_SLOTS` | `home:1111111111,knowledge:2222222222,stats:3333333333` | 第 5 步拿到 |
| `GA_MEASUREMENT_ID` | `G-XXXXXXXXXX` | 第 7 步拿到 |

**為什麼是 variables 而不是 secrets**：AdSense client、GA ID、網域本來就會出現在網頁原始碼裡。
把公開值當機密管理只會製造「以為它是機密」的錯覺，真正該保護的（部署權限）走 OIDC，沒有值可以外洩。

留空的變數不會壞事：`config/env.ts` 的規則是**什麼都沒設定就一個第三方 script 都不載**。
預覽頻道永遠是零廣告、`robots.txt` 全站 Disallow 的站。

---

## 4. 自訂網域

Firebase Console → Hosting → Add custom domain → 照指示加 TXT（驗證）與 A/AAAA（指向）記錄。
憑證由 Firebase 代管，通常數分鐘到 24 小時。

`www` → apex 的 301：在網域註冊商或 DNS 服務商設轉址（Firebase Hosting 兩個網域都加，
再把 `www` 設成 redirect）。

**確認**：`curl -sI https://<網域>/knowledge | head -3` 回 200；
`curl -sI https://www.<網域>/` 回 301 指向 apex。

---

## 5. AdSense（送審 → 開版位）

**順序很重要：內容與法遵頁全部上線之後才送審。** 目前站上已備妥：

- 33 條雙語樂理知識條目（`/knowledge`，每條有獨立網址與靜態 HTML）
- 首頁的產品介紹實質文案
- 隱私權政策、Cookie 政策、關於（含聯絡方式）
- `sitemap.xml`、`robots.txt`

步驟：

1. adsense.google.com 申請，填入正式網域。
2. 把 AdSense 給的驗證碼放進 `index.html` 的 `<head>`，或用 Console 提供的 `ads.txt` 驗證方式。
   > `ads.txt` 由建置自動產生（`VITE_ADSENSE_CLIENT` 有值時），內容是
   > `google.com, pub-…, DIRECT, f08c47fec0942fa0`。
3. **審核期間不要開版位**：`ADSENSE_CLIENT` 保持空白，站上零廣告。
4. 過審後在 AdSense 建三個**展示廣告**單元（不要用 Auto ads），記下 slot id：
   `home`、`knowledge`、`stats`。
5. 填 `ADSENSE_CLIENT` 與 `ADSENSE_SLOTS` 兩個 variables，push 到 main。

**版位在哪裡是程式決定的**（`src/config/ads.ts` 的白名單），AdSense 後台改不了。
想加版位要改那份白名單，`config.spec.ts` 會擋下任何指向練習模組路由的版位。

**確認**：正式站的 `/`、`/knowledge/*`、`/stats` 出現廣告；
`/rhythm/groove`、`/scales/practice`、`/chords/key-practice` 的 DOM 裡連 `ins.adsbygoogle` 都沒有。

---

## 6. 同意管理（CMP）

AdSense Console → Privacy & messaging → 建立 **GDPR** 訊息（歐洲）與 **Cookie 同意** 訊息。
發布之後，`src/thirdParty/cmp.ts` 會在**每一頁**載入它——包含沒有廣告的練習頁，
因為從練習頁進站的 EEA 訪客一樣需要被詢問。

Consent Mode v2 的預設值已經在 `installConsentDefaults()` 排好：
EEA/UK/CH 四項全 denied 並等 CMP 回覆，其餘地區 granted。

**確認**：用 VPN 連到德國開站，同意視窗出現；拒絕之後網站全部功能仍可用，
頁尾出現「Cookie 設定」按鈕（非 EEA 訪客不會有這顆按鈕，這是正常的）。

---

## 7. GA4

analytics.google.com 建立資源 → 拿 `G-XXXXXXXXXX` → 填 `GA_MEASUREMENT_ID`。
不需要另外接同意訊號：GA4 讀的是同一組 Consent Mode 預設值。

page_view 由 `router.afterEach` 明確送出（SPA 換頁不會重新載入，交給 gtag 自動送只會記到第一頁）。

**確認**：GA4 即時報表看得到 `/knowledge/...` 這類路徑，而不是全部記成 `/`。

---

## 8. GCP 預算警示

Billing → Budgets & alerts → Create budget，範圍選這個專案，
門檻設 **$5 / $10 / $25**（實際金額），通知寄給帳單管理員。

**確認**：把第一段門檻暫時設成 $0.01 存檔，等通知信到再改回 $5。
沒收到信就是通知設定沒生效——這件事要在帳單真的爆掉之前知道。

---

## 9. Search Console

搜尋主控台 → 以網域資源驗證（DNS TXT）→ 提交 `https://<網域>/sitemap.xml`。
中英各 47 個網址，共 94 個。

**確認**：兩週後「網頁」報表中已索引數 > 0，且「國際定位」沒有 hreflang 錯誤。

---

## 10. 日常部署

- PR：CI 跑 typecheck／測試／建置／bundle 預算；Deploy workflow 另外開一個 7 天到期的預覽頻道。
- 合併進 main：自動部署 production。
- 回滾：Firebase Console → Hosting → 版本清單 → Rollback（不需要重新建置）。

---

## 11. 疑難排解

**廣告完全不出現（正式站）**
1. 看 console 有沒有 CSP 違規。有的話：把被擋的網域加進 `src/config/third-party.json`
   的對應指令 → `npm run gen:firebase` → commit。**兩件事一起做**，只做一半 CI 會失敗。
2. 檢查 `ADSENSE_CLIENT` 與 `ADSENSE_SLOTS` 兩個 variables 有沒有填，以及 slot id 對不對。
3. AdSense 新版位要幾小時才會開始投放；期間 `data-ad-status` 會是 `unfilled`，
   版位依設計整塊收合——這不是壞掉。

**某些廣告素材空白但其他正常**
CSP 的 `script-src` 目前**沒有** `'unsafe-eval'`。少數素材需要它。
確認是這個原因（console 會有 `unsafe-eval` 的違規訊息）再加，並在這裡記一筆日期與原因。

**部署後使用者還看到舊版**
HTML 是 `no-cache`、`/assets/**` 是 immutable（檔名帶 hash），正常情況下不會發生。
若真的發生，先確認 `firebase.json` 的 headers 有沒有被手改過（`deploy/firebase.spec.ts` 會抓）。

**預覽頻道被 Google 索引**
不會：非 production 的建置 `robots.txt` 是全站 Disallow，每一頁也帶 `noindex`。
若真的看到，檢查該次建置的 `VITE_DEPLOY_ENV` 是不是誤設成 `production`。

---

## 13. 曲庫的著作權處理（公開上線前必辦）

The Jazz Book 的內建曲庫分三層（設計理由見 `docs/PRD/phase-08.md` §0）：
形式練習與公版曲可以公開發佈，**保護期內的曲目只在內測版本收錄**。

上線前要做的事：

1. `npx vitest run src/modules/chords/jazzBook/charts.spec.ts` ——
   「保護期內的曲目」那個測試會把當前清單印出來，那就是待辦清單。
   程式端也可以直接讀 `IN_COPYRIGHT_CHARTS`。
2. 逐首決定：**取得授權**、**移除**，或**降級成使用者自行輸入**
   （把和弦文字放進說明頁，讓使用者自己貼進編輯器——資料就不在我們的發佈物裡了）。
3. 決定移除時：刪掉 `src/modules/chords/jazzBook/charts.ts` 裡
   `origin.kind === 'in-copyright'` 的那幾筆，並更新 `charts.spec.ts` 的清單斷言。
   設定裡指到已刪曲目的使用者會自動落回預設曲目（`resolved` 有回退），不會壞掉。
4. 公版曲（`public-domain`）另有一件事要辦：**逐首查證出版年與屬地**。
   目前以美國 1930 年界線為準，歐盟採作者歿後 70 年，未必同步。
   有疑義的一律降級成使用者自行輸入。

> 現況（內測）：`strasbourg-st-denis`（Roy Hargrove, 2008）一首。

---

## 12. 每月營運筆記

每月一頁，用 `docs/ops/monthly-template.md`，存成 `docs/ops/YYYY-MM.md`。
目的只有一個：驗證「廣告收入 ≥ 主機開銷」這個營運假設還成立。
連續兩個月不成立就要重新評估收入結構，而不是繼續加版位。
