/**
 * 模組註冊入口：每新增一個練習模組，在此 import 其 manifest（僅此一行改動）。
 */
import { registerModule } from './registry'
import { chordsArpeggioManifest } from './chords/arpeggio/manifest'
import { chordsCircleManifest } from './chords/circle/manifest'
import { chordsCustomManifest } from './chords/custom/manifest'
import { chordsJazzBookManifest } from './chords/jazzBook/manifest'
import { chordsKeyPracticeManifest } from './chords/key/manifest'
import { rhythmGrooveManifest } from './rhythm/groove/manifest'
import { rhythmMetronomeManifest } from './rhythm/metronome/manifest'
import { rhythmSubdivisionManifest } from './rhythm/subdivision/manifest'
import { scalesExplorerManifest } from './scales/explorer/manifest'
import { scalesRecallManifest } from './scales/recall/manifest'
import { scalesPracticeManifest } from './scales/practice/manifest'
import { scalesSequenceManifest } from './scales/sequence/manifest'

registerModule(rhythmMetronomeManifest)
registerModule(rhythmSubdivisionManifest)
registerModule(rhythmGrooveManifest)
registerModule(chordsCircleManifest)
registerModule(chordsKeyPracticeManifest)
registerModule(chordsCustomManifest)
registerModule(chordsArpeggioManifest)
registerModule(chordsJazzBookManifest)
registerModule(scalesExplorerManifest)
registerModule(scalesPracticeManifest)
registerModule(scalesSequenceManifest)
registerModule(scalesRecallManifest)
