# Recorded visual demonstrations

These are recordings of the running Studio interface. Each recording changes the story position and an actual rack control. The capture script checks that the scene pixels change and that there are no page exceptions. They are not generated mockups.

The headless Linux renderer uses SwiftShader. Its rendering speed is not a measurement of the Windows laptop GPU or touchpad experience. Delivery videos remove repeated idle frames and use condensed playback; they do not demonstrate real-time performance. `node tests/compact-demos.cjs` reproduces this optional encoding when ffmpeg is installed. The primary capture command produces unretimed recordings.

| Scene | Workspace screenshot | Stage detail | Recording | Fidelity |
|---|---|---|---|---|
| iGlass | [PNG](iglass.png) | [PNG](iglass-stage.png) | [WebM](iglass.webm) | Original phone GLB; named glass lift, orbit, glint and bounds-driven headline. |
| Olympic editorial | [PNG](olympic.png) | [PNG](olympic-stage.png) | [WebM](olympic.webm) | Original vector scenery; parallax, soft rise and flow. |
| Cartier rhythm | [PNG](cartier.png) | [PNG](cartier-stage.png) | [WebM](cartier.webm) | Original watch fixture; aperture, left/right handoff and illustrated final video. |
| Morpho portal | [PNG](morpho.png) | [PNG](morpho-stage.png) | [WebM](morpho.webm) | Can fixture and animated illustrated video; aligned CSS portal proxy. |
| Aevion states | [PNG](aevion.png) | [PNG](aevion-stage.png) | [WebM](aevion.webm) | Folding drone fixture; three poses, metrics, hotspot and grab/release. |
| Teatika material | [PNG](teatika.png) | [PNG](teatika-stage.png) | [WebM](teatika.webm) | Hinged case fixture; wireframe/solid, part and real light changes. |
| Shape playground | [PNG](shapes.png) | [PNG](shapes-stage.png) | [WebM](shapes.webm) | Editable triangle, rectangle and circle state interpolation. |

Run `npm run demo:poc` to reproduce the captures. See [machine-readable capture results](demo-report.json), [verification](verification.md), [capability ledger](../capability-ledger.md), and [Windows startup and five-minute test](START-WINDOWS.md).
