# Evolutionary PoC verification

Branch: `studio/visual-instruments-poc`, based on `studio/broad-v1` at `03eea25d814dbfc77ce0f6e09229b5668f99c71d`.

## Delivered software

The default route opens the light, spatial instrument editor. Seven editable examples share the instrument registry, evaluator, scene states, Story Beats and relationship graph. A Desktop and A Mobile share responsive intent; B is an independent variant. The existing semantic store, undo/recovery and SQLite backend remain in use. The accepted advanced editor is available at `/?legacy`.

Implementation commits: `6bff1f4509406f4884724429e6605076e26c245b` and `cbf7b3b3f49f3243ac7ca1569dd090a1758659f7`. The delivery commit adds the recorded evidence and final test receipts, plus the small capture/export metadata corrections. The exact delivery SHA is reported with the GitHub handoff.

## Test receipts

Environment: Linux, Node 24.19.0, Chromium 140 / Playwright 1.55.1, SwiftShader software WebGL. The Windows laptop and touchpad still require Matt's acceptance test.

| Command / check | Result |
|---|---|
| `npm ci` | Passed; 131 packages installed, 13 October |
| `npm run build` | Passed, 14 October; TypeScript and all three Vite entries |
| `npm test` | 49 passed across six files; includes 19 instrument tests |
| `npm run test:browser` | Passed: 38 legacy checks + 18 visual PoC checks; process exit 0 |
| `npm run demo:poc` | Seven scenes captured; pixels changed and zero page exceptions |
| `git diff --check` | Passed |
| Production scope | No changes outside `studio/` |

[Consolidated final command receipt](test-run.log), [machine-readable summary](test-summary.json), [PoC browser assertions](browser-report.json), [recording results](demo-report.json), [screens and videos](evidence.md).

The browser checks cover clean bypass, live bounds-driven clearance, undo/cancel, orbit release through autosave, projected hotspots, independent variants, linked mobile edits, intermediate widths, native scroll/reversal, scene endpoint editing and ordering, beat stretching, SQLite reload, packaged assets/storyboards, independent desktop/mobile replay, reduced-motion loading and console errors. Legacy tests also cover real GLB picking, imported assets, portable projects, multi-writer recovery, Takes, responsive tracks and exported runtime parity.

Build warning: the shared model/Three chunk is approximately 676 kB before gzip. This is a passing build with a size warning, not a verified laptop performance measurement.

## Failures found and resolved

- Missing browser binaries and a truncated primary CDN download: Chromium installation succeeded through Playwright's fallback mirror.
- A fixed 700 ms replay assertion was unreliable under software rendering. The test now waits for the required progress value with a bounded timeout.
- Saving while releasing orbit could replace instrument references and cancel decay. Cleanup now cancels decay on unmount or scene/profile changes, not every instrument-reference update. The regression deliberately saves during release.
- Export capture exceeded the former 60-second test allowance while recordings ran concurrently. The final suite runs without a competing recording process and permits up to 180 seconds for the actual download; export content assertions remain intact.
- An intermediate TypeScript build rejected an incomplete mobile-override test fixture. The fixture now uses the same complete contract as the editor.
- The final test command was rerun after partial terminal-log retention. It exited 0. Its browser stdout is consolidated from observed tool outputs because the streamed file again retained only its initial portion. The generated browser JSON independently records all 18 PoC checks. No failed or interrupted run is counted as a final pass.

## Hero and repository protection

All code, assets, documentation and evidence changes are under `studio/`. `main` was not updated. Root production tree identities match the source baseline exactly:

| Tree | Baseline and delivery identity |
|---|---|
| Root `src/` | `d867a5bc6c1b2fa258b2d0acf5509f493f8b6a9d` |
| Root `public/` | `9e505181ae5a83e6a27c15397e42dad6dc5c1778` |

Publishing uses the connected GitHub account, base-tree updates and only changed files. Existing repository files are not reconstructed through blob calls. New screenshots, recordings and sample binary assets use new blob objects.

## Fidelity and remaining scope

This is a working bounded PoC, not completion of every inventory item. [The capability ledger](../capability-ledger.md) marks working, proxy, partial and pending items individually. iGlass uses the original GLB and named front glass. Other product scenes use original procedural watch, can, drone and case fixtures; scenery is original vector artwork and animated illustration. Morpho's portal uses an aligned CSS mask. Secondary inactive models are labelled pose proxies. True geometry portals, surface occlusion, arbitrary React/Spline/Framer imports and universal native production-host mappings remain unverified or pending.

The seven delivery videos are actual UI captures with repeated idle frames removed and condensed playback. They establish editable behaviour, not real-time GPU performance. The unretimed capture can be reproduced with `npm run demo:poc`; optional delivery encoding is `node tests/compact-demos.cjs` with ffmpeg installed.

[Exact Windows startup and five-minute acceptance test](START-WINDOWS.md). Matt's judgement of the evolutionary advance remains the acceptance gate before further expansion.
