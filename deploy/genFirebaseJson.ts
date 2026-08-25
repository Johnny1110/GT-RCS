/**
 * 寫出 firebase.json。執行：`npm run gen:firebase`
 * （用 vite-node 跑，才吃得到 TS 與 JSON import；專案不另外裝 ts 執行器）
 */
import { writeFileSync } from 'node:fs'
import { serializeFirebaseConfig } from './firebaseConfig'

writeFileSync('firebase.json', serializeFirebaseConfig(), 'utf8')
console.log('firebase.json written')
