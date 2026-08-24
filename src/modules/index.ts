/**
 * 模組註冊入口：每新增一個練習模組，在此 import 其 manifest（僅此一行改動）。
 */
import { registerModule } from './registry'
import { rhythmMetronomeManifest } from './rhythm/metronome/manifest'
import { scalesExplorerManifest } from './scales/explorer/manifest'
import { scalesPracticeManifest } from './scales/practice/manifest'

registerModule(rhythmMetronomeManifest)
registerModule(scalesExplorerManifest)
registerModule(scalesPracticeManifest)
