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

## Milestone 1 — visual authoring (0.3.1)

Select text and drag its right-edge handle to shape the line breaks. The corner handle still resizes the whole frame. The line-length handle also accepts Left/Right arrow keys (Shift for larger steps). Guides show nearby sibling alignment and clearance while you adjust; they do not snap or change the document.

Use typography starting points, then refine **Type size**, **Type weight**, **Rhythm** and **Prominence** with live sliders. Rhythm moves line-height and letter-spacing together; individual values remain in **Typography precision**. **Position & size precision** preserves exact transform entry. Native disclosures start collapsed. Font weight depends on the available font faces.

Every slider drag or held keyboard adjustment is one undoable gesture. Escape cancels, including continued movement until release. Profile tags, key diamonds and signal badges remain available on visual controls. Mobile edits fork inherited motion/signal ownership without altering Desktop.

**Capture Take** in the header or Inspector immediately preserves the direction with an automatic name. Compare with the latest Take from the Inspector, or restore/compare in Takes. Optional **Capture a named Take…** retains the naming workflow. Captures preserve document state; they are not rendered thumbnails.

Milestone 1 technical verification and Matt's Windows-laptop creative acceptance are separate. The 30-second scenario is guidance, never a speed gate. Advanced 3D work follows resolution of significant usability problems; the long-term architecture is retained in the master plan.

## Workspace controls

The graphite workspace has a single 44px header. Workspace tabs live in the left panel; feedback/help and the version are under the question-mark menu. Panel buttons in the header hide/show Layers and Inspector. Drag their dividers to resize, or focus a divider and use arrow keys. Choreography has its own resize divider and Collapse/Expand button. These preferences survive reloads independently of your composition.

Drag a numeric property label to scrub; Shift adjusts coarsely, Alt finely. Release commits one undo record; Escape cancels. Numeric entry remains available. A profile tag and animation diamond can appear together; the profile tag restores inheritance in one undoable action. Solid diamonds mean a key at this position; hollow diamonds mean animation between keys. Click a diamond to seek its owning clock. Signal pills identify the effective signal owner and open its controls.

Shortcuts: **V** select, **H** pan, **R** turntable (rotate the model), **C** camera orbit (change viewpoint), **P** motion path, **Space** play/pause. Camera yaw/pitch orbit around the scene origin; distance and FOV stay separate. The existing **Key this moment / Offset animation** policy is unchanged.

For an already installed Windows checkout, stop the current Studio server before updating. After pulling `studio/broad-v1`, run `npm run build` then `npm run dev` from `studio`. This release changes no dependency versions, so reinstalling is unnecessary. If an install is needed later, first stop any Studio Vite process holding Rollup's native module. The separately installed `IG START POSE` launcher is not maintained in this repository and has not been modified by this update.

## Working now

- Pan/zoom composition board, real DOM page, selection, direct text editing, move/resize, multi-selection, alignment, grouping/ungrouping, duplication and deletion.
- Flowing sections, on-canvas insertion, reordering, fixed/viewport/authored-content height, and pinned scroll travel; free positioning or stacks inside sections.
- Shared copy fragments and variants; typography; frames and horizontal/vertical stacks; imported images, SVG and video; known component cards.
- Original GLB plus imported GLBs, object transforms, camera orbit/distance/FOV, ambient/key lighting, global material parameters, and direct rotation with adjustable sensitivity. Selection tests actual mesh geometry, passes through empty viewport space, and supports Alt-click overlap cycling.
- Desktop/mobile art direction, explicit overrides and reset, editable profile dimensions.
- Named poses, numeric keyframes, linear/smooth/hold interpolation, timeline playback and scrubbing; draggable page/freeform-section position paths with keyboard nudging and transactional undo.
- Time or scroll choreography with page/section scope and percentage scrubbing; Reveal/Move/Rotate/Scale actions with editable amount, timing and stagger.
- Explicit property owners; pointer/scroll bindings; controlled scroll preview; signal inputs retained in feedback.
- Undo/redo, transient gesture preview/cancel, SQLite persistence, browser recovery, stale-write protection.
- Immutable Takes, restoration, accepted reference, synchronised A/B views, authored-value differences and one bounded look preset.
- Evaluate: original reaction, exact document, profile, playhead, signals, selection, bounded command history, measured DOM boxes, environment and explicit capture limitations. Episodes can be searched and exported.
- Authored frame alignment/clearance relationships, measured pass/fail/unknown readings, and composition connectors retained in exported output.
- Capability envelopes distinguish supported, limited and unavailable operations.
- Project JSON, portable media-inclusive project, independent static runtime ZIP, four manifests and artifact SHA-256 digests.

## Boundaries of this checkpoint

This is implementation progress toward broad V1. Milestone 1 is the immediate creative-use checkpoint, **not the completed V1 acceptance gate**. The following scope remains preserved and sequenced after that checkpoint:

- Coordinated pose/cue editing, 3D paths and richer camera controls. Current handles edit page/freeform-section X/Y tracks; spline tangents and nested coordinate spaces remain unimplemented.
- Connector routing/style controls and scene-space probes. Current connectors join frame centres. Evaluate measures DOM frame bounds and alignment/clearance; it does not infer 3D occlusion or perceptual quality.
- A richer component registry and the live legacy Hero adapter. The “Existing Hero” card is explicitly a source reference. The imported GLB is real; playback equivalence with the production Hero has not been claimed.
- Stronger acceptance/decision history, protected four-manifest Take bundles, richer Discovery Deck locks and comparison modes.
- Still/video capture and replay fidelity beyond document plus controlled time/input. Pixel and original-video capture are explicitly unavailable.
- Responsive runtime selection beyond the initial desktop/mobile rule; target-device quality profiling; comprehensive reduced-motion alternatives.
- Actual Framer delivery fixture and host verification, when that specific task needs access.

Agents, islands, recombination, evolutionary search, contextual knowledge and promotion remain specified in the master plan. They are not running autonomously in this alpha.

## Editing semantics

Desktop edits currently target base values; other profiles create overrides. Driver resolution is profile driver, base driver, profile static override, then base static value. At a given profile scope, a property cannot have both a track and a signal owner. Canvas, inspector and rotation edits share the mode shown in Choreography: **Key this moment** edits the owning track at its clock position; **Offset animation** shifts every key without flattening the curve. Static properties stay static until keyed or assigned an action. Numeric signal-owned edits offset the mapping while retaining its range. The ownership indicator remains visible.

Canvas transforms use a transient preview and one committed undo record. Grouping supports static, unrotated siblings on the page or inside freeform sections/groups and preserves positions in every profile. Ungrouping requires a free-layout group without padding/rotation/opacity changes. Linked copy stays shared when duplicated.

The Path tool edits coordinated X/Y tracks for page elements and direct children of freeform sections. It uses the owning clock’s playhead. Drag points, nudge with arrows, hold Shift for 8px steps, or Delete a point. Profile edits fork inherited keys before changing them. Relations uses measured DOM frames in page CSS pixels; hidden endpoints are unknown.

Poses are transform/camera snapshots. Their recall is one transaction. Current smooth interpolation is scalar smoothstep between key values; it does not claim spline or quaternion interpolation.

## Sections and motion: a short workflow

1. Use **+ Add section below** in Layers, or the insertion button at a section seam. The first insertion wraps the existing composition without changing its authored coordinates. Undo reverses the whole insertion.
2. Select a section in Layers; choose its height and optionally **Pin during scroll choreography**. **Scroll distance** is the extra travel while its frame stays pinned.
3. Select an element and choose a scope in **Choreography**. Choose **Scroll** for percentage timing or **Time** for seconds. Existing tracks retain their original clock when elements move between sections.
4. Add keys, or open **Motion actions** and apply Reveal, Move, Rotate or Scale. Scrub the percentage playhead to see the result. **Follow scroll** keeps the relevant page region in view; turn it off to inspect the whole composition.
5. Drag an animated item to key the current moment. Choose **Offset animation** to shift its entire curve instead. Direct key edits mark a generated action as customized; remove it before replacing the action.
6. Collapse Choreography for more canvas room. Two-finger scrolling pans the workspace; pinch zooms. Use the dedicated rotation tool and its speed slider to turn the selected model. Escape cancels an active drag, then deselects.

Action tracks are authoritative; action descriptors are editing aids. Duplicated animations retain keys, but duplicate action parameter cards are not currently regenerated. Content-fit section sizing uses authored child bounds rather than arbitrary intrinsic HTML measurement. Individual GLB viewports still use separate WebGL contexts; shared-context rendering and continuous cross-section scene transitions remain future work.

## Persistence and recovery

The default local store is `.studio-data/studio.sqlite`; imported assets live in `.studio-data/assets`. `STUDIO_DATA_DIR` can point at another directory. These are deliberately excluded from git. Back up that directory or export a portable project before moving machines.

Each save uses an expected server version. A competing save is rejected. Each editor instance writes a separate browser recovery slot. On reopening, ambiguous or stale copies never replace newer server work; **Export → Recovery copies** lists downloadable versions. A failed server save only reports recovery success if browser storage actually succeeded. Do not discard the browser recovery until it has been exported or reconciled.

A project JSON retains media references. A portable project stores each referenced image/video/SVG/GLB once in a content-addressed asset bundle shared by the working document, Takes and episodes. Import verifies asset hashes and restores local asset files before opening the document. Fonts and CSS background URLs remain external. Supported single-asset imports are capped at 25 MB; the local JSON request limit is 40 MB.

## Runtime delivery

Serve the runtime ZIP contents over HTTP. It includes `composition.json`, referenced media, the shared evaluator/renderer, and composition, instrument, implementation and environment manifests. It excludes the editor and SQLite service. The implementation manifest records hashes of the actual runtime artifacts.

The initial runtime selects `mobile` below 700 CSS pixels and `desktop` otherwise, scales the selected page to fit, and plays time clocks once. Scroll clocks respond to the actual page/section scroll range; viewport-height sections adapt to the live viewport. Reduced-motion preference holds wall-clock time at zero; scroll animations currently still follow explicit user scrolling. Fully authored reduced-motion alternatives remain pending. Native video is not synchronised to the choreography clock. Component action handling, externally hosted fonts and Framer embedding need their own host integration.

## Verify

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

The browser script starts its own isolated Vite/SQLite fixture and verifies actual UI actions plus an independent HTTP runtime export. It writes screenshots and a report to `test-results/`. `STUDIO_BROWSER_EXECUTABLE` can supply a compatible headless Chromium where browser downloads are unavailable.

See [the implementation checkpoint](docs/implementation-checkpoint.md) for the exact validation record and next executable work.
