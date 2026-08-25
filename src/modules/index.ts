/**
 * 模組註冊入口：每新增一個練習模組，在此 import 其 manifest（僅此一行改動）。
 */
import { registerModule } from './registry'
import { chordsCircleManifest } from './chords/circle/manifest'
import { chordsCustomManifest } from './chords/custom/manifest'
import { chordsKeyPracticeManifest } from './chords/key/manifest'
import { rhythmGrooveManifest } from './rhythm/groove/manifest'
import { rhythmMetronomeManifest } from './rhythm/metronome/manifest'
import { rhythmSubdivisionManifest } from './rhythm/subdivision/manifest'
import { scalesExplorerManifest } from './scales/explorer/manifest'
import { scalesPracticeManifest } from './scales/practice/manifest'

registerModule(rhythmMetronomeManifest)
registerModule(rhythmSubdivisionManifest)
registerModule(rhythmGrooveManifest)
registerModule(chordsCircleManifest)
registerModule(chordsKeyPracticeManifest)
registerModule(chordsCustomManifest)
registerModule(scalesExplorerManifest)
registerModule(scalesPracticeManifest)
