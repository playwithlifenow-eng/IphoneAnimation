# iGlass Composition Studio

A working integrated alpha of the broad V1 in [the authoritative master plan](docs/master-plan.md). The Studio lives in this directory and leaves the existing Hero application, its dependencies, and its production configuration intact.

## Run

Use Node **22.13+** (tested with 24.19) for the built-in SQLite service.

```sh
cd studio
npm ci
npm run build
npm run dev
```

Open `http://127.0.0.1:5173`. `npm run build` also prepares the independent runtime used by Export. Rebuild after changing source; exporting an outdated runtime is rejected. `npm run preview` serves the production editor build with the same local service.

The service is intended for a local, single-user workspace. Keep its default loopback binding. It is not a hosted multi-user service.

## Working now

- Pan/zoom composition board, real DOM page, selection, direct text editing, move/resize, multi-selection, alignment, grouping/ungrouping, duplication and deletion.
- Shared copy fragments and variants; typography; frames and horizontal/vertical stacks; imported images, SVG and video; known component cards.
- Original GLB plus imported GLBs, object transforms, camera distance/FOV, ambient/key lighting, global material parameters, and direct orbit manipulation.
- Desktop/mobile art direction, explicit overrides and reset, editable profile dimensions.
- Named poses, numeric keyframes, linear/smooth/hold interpolation, timeline playback and scrubbing; draggable page-level position paths with keyboard nudging and transactional undo.
- Explicit property owners; pointer/scroll bindings; controlled scroll preview; signal inputs retained in feedback.
- Undo/redo, transient gesture preview/cancel, SQLite persistence, browser recovery, stale-write protection.
- Immutable Takes, restoration, accepted reference, synchronised A/B views, authored-value differences and one bounded look preset.
- Evaluate: original reaction, exact document, profile, playhead, signals, selection, bounded command history, measured DOM boxes, environment and explicit capture limitations. Episodes can be searched and exported.
- Authored frame alignment/clearance relationships, measured pass/fail/unknown readings, and composition connectors retained in exported output.
- Capability envelopes distinguish supported, limited and unavailable operations.
- Project JSON, portable media-inclusive project, independent static runtime ZIP, four manifests and artifact SHA-256 digests.

## Boundaries of this checkpoint

This is implementation progress toward the broad V1, **not the completed V1 acceptance gate**. Work remains within BUILD_NOW:

- Coordinated pose/cue editing, 3D paths and richer camera controls. Current handles edit page-level X/Y tracks; spline tangents and nested coordinate spaces remain unimplemented.
- Connector routing/style controls and scene-space probes. Current connectors join frame centres. Evaluate measures DOM frame bounds and alignment/clearance; it does not infer 3D occlusion or perceptual quality.
- A richer component registry and the live legacy Hero adapter. The “Existing Hero” card is explicitly a source reference. The imported GLB is real; playback equivalence with the production Hero has not been claimed.
- Stronger acceptance/decision history, protected four-manifest Take bundles, richer Discovery Deck locks and comparison modes.
- Still/video capture and replay fidelity beyond document plus controlled time/input. Pixel and original-video capture are explicitly unavailable.
- Responsive runtime selection beyond the initial desktop/mobile rule; target-device quality profiling; comprehensive reduced-motion alternatives.
- Actual Framer delivery fixture and host verification, when that specific task needs access.

Agents, islands, recombination, evolutionary search, contextual knowledge and promotion remain specified in the master plan. They are not running autonomously in this alpha.

## Editing semantics

Desktop edits currently target base values; other profiles create overrides. Driver resolution is profile driver, base driver, profile static override, then base static value. At a given profile scope, a property cannot have both a track and a signal owner. Editing a tracked numeric field writes a key at the playhead; signal-owned fields must be released first.

Canvas transforms use a transient preview and one committed undo record. Grouping supports static, unrotated page-level elements and preserves positions in every profile. Ungrouping requires a free-layout group without padding/rotation/opacity changes. Linked copy stays shared when duplicated.

The Path tool edits coordinated X/Y tracks at the playhead. Drag points, nudge with arrows, hold Shift for 8px steps, or Delete a point. Profile edits fork inherited keys before changing them. Relations uses measured DOM frames in page CSS pixels; hidden endpoints are unknown.

Poses are transform/camera snapshots. Their recall is one transaction. Current smooth interpolation is scalar smoothstep between key values; it does not claim spline or quaternion interpolation.

## Persistence and recovery

The default local store is `.studio-data/studio.sqlite`; imported assets live in `.studio-data/assets`. `STUDIO_DATA_DIR` can point at another directory. These are deliberately excluded from git. Back up that directory or export a portable project before moving machines.

Each save uses an expected server version. A competing save is rejected. On reopening, a recovery made against an older server version is retained separately instead of replacing newer server work; Export → Conflict recovery downloads it. Do not discard the browser recovery until it has been exported or reconciled.

A project JSON retains media references. A portable project stores each referenced image/video/SVG/GLB once in a content-addressed asset bundle shared by the working document, Takes and episodes. Import verifies asset hashes and restores local asset files before opening the document. Fonts and CSS background URLs remain external. Supported single-asset imports are capped at 25 MB; the local JSON request limit is 40 MB.

## Runtime delivery

Serve the runtime ZIP contents over HTTP. It includes `composition.json`, referenced media, the shared evaluator/renderer, and composition, instrument, implementation and environment manifests. It excludes the editor and SQLite service. The implementation manifest records hashes of the actual runtime artifacts.

The initial runtime selects `mobile` below 700 CSS pixels and `desktop` otherwise, scales the selected page to fit, and plays once. Reduced-motion preference holds time at zero. Native video is not synchronised to the choreography clock. Component action handling, externally hosted fonts and Framer embedding need their own host integration.

## Verify

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

The browser script starts its own isolated Vite/SQLite fixture and verifies actual UI actions plus an independent HTTP runtime export. It writes screenshots and a report to `test-results/`. `STUDIO_BROWSER_EXECUTABLE` can supply a compatible headless Chromium where browser downloads are unavailable.

See [the implementation checkpoint](docs/implementation-checkpoint.md) for the exact validation record and next executable work.
