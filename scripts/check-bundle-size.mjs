/**
 * 首屏 bundle 預算守門員（CLAUDE.md：首屏 < 200KB gz）。
 *
 * 量的是 index.html 直接引用的 entry JS + CSS——也就是使用者在看到第一個畫面前
 * 一定得下載的東西。lazy 分包的模組不算，那是點進去才付的成本。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const BUDGET_BYTES = 200 * 1024
const DIST = 'dist'

const html = readFileSync(join(DIST, 'index.html'), 'utf8')
const referenced = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1])

if (referenced.length === 0) {
  console.error('No entry assets found in dist/index.html — did the build run?')
  process.exit(1)
}

let total = 0
for (const asset of referenced) {
  const size = gzipSync(readFileSync(join(DIST, asset))).length
  total += size
  console.log(`  ${asset}  ${(size / 1024).toFixed(2)} KB gz`)
}

const kb = (total / 1024).toFixed(2)
const budgetKb = (BUDGET_BYTES / 1024).toFixed(0)
if (total > BUDGET_BYTES) {
  console.error(`First-load bundle ${kb} KB gz exceeds the ${budgetKb} KB budget.`)
  process.exit(1)
}
console.log(`First-load bundle ${kb} KB gz (budget ${budgetKb} KB) — OK`)

// dist/assets 裡多出來的檔案不影響首屏，但列個總數方便 review
const chunks = readdirSync(join(DIST, 'assets')).filter((f) => f.endsWith('.js')).length
console.log(`${chunks} JS chunks total (lazy chunks are not counted against the budget)`)
