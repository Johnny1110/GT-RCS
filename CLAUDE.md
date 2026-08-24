# RCS — Rhythm & Chord & Scales

給吉他手的練琴 Web App。Vue 3 + TypeScript(strict) + Vite + Pinia + Tailwind v4 + vue-i18n，無後端。

## 指令

- `npm run dev` — 開發伺服器
- `npm run test` — Vitest（core 層行為鎖定測試）
- `npm run typecheck` — vue-tsc strict 檢查
- `npm run build` — typecheck + 產線建置（首屏 bundle 目標 < 200KB gz）

## 開工前必讀（依序）

1. **`docs/architecture.md` — 規範性架構文件，違反其依賴規則與反模式清單的程式碼一律不收。**
2. `docs/design-system.md` — 規範性設計系統（黑白灰面板 × 12 音程色；動 UI 前必讀）
3. `docs/overview.md` — 產品全貌與已確認決策
4. 對應 Phase 的 `docs/PRD/phase-0x.md`
5. 要動的檔案頂部契約註解

## 硬規則摘要（完整版見 architecture.md）

- `src/core/**` 是純 TS：禁止 import Vue / DOM / localStorage；時間一律經 `IClock`。
- 樂理資料只有一個真相：`core/theory/formulas.ts` 公式表 + `spell()` 推導。UI 禁止 hardcode 音名。
- 聲音排程只走 `Transport`（lookahead scheduler）；禁止 `setInterval`/`Date.now()` 參與節拍。
- 音程顏色只走 `colorForInterval()` / `--degree-*` token（TS 與 CSS 兩份定義需同步）。
- localStorage 只走 `VersionedStore`；改 schema 必附 migration。
- 練習模組：新資料夾 + manifest + 在 `src/modules/index.ts` 註冊一行；模組間禁止互相 import。
- 使用者可見字串走 i18n，`src/locales/zh-TW.json` 與 `en.json` 同步。

## 找工作項

全域搜尋 `TODO(opus)`——每個標記註明 PRD 條目（如 `Phase 3 / F3-2`）。
`*.spec.ts` 內的 `it.todo` 是可執行規格：實作後轉為真測試，不得為過測改規格。
單項工作的 Definition of Done：`docs/architecture.md` §7。
