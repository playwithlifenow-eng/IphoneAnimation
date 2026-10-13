# Visual instrument PoC · 13 October 2026

Source: `studio/broad-v1` at `03eea25d814dbfc77ce0f6e09229b5668f99c71d`.
Working branch: `studio/visual-instruments-poc`. Only `studio/` changes.

The default route is the working visual instrument editor. `/?legacy` preserves the advanced editor and its regression suite. The backend remains the existing optimistic-versioned SQLite workspace service with per-writer recovery, semantic transaction history, Takes and episodes. The document gains an optional independently versioned `visual` extension. Legacy composition data stays intact; the first visual-editor opening captures a Take before adding the extension. Existing schema v1/v2 documents still validate. No destructive conversion runs.

## Shared implementation

- `instruments/types.ts`: versioned definitions, instances, typed ports, drivers, modulators, variants, boards, linked states, beats, references.
- `registry.ts`: reusable capability-filtered instrument definitions. Examples contain editable instances, not demo-specific evaluation code.
- `engine.ts`: legacy track/binding evaluation, responsive decisions, state interpolation, ordered property composition, quaternion rotation, bounds-driven relationships, dependency cycle rejection and conflict diagnostics.
- `editing.ts`: all authoring uses `visual-project` commands through the existing store. Pointer gestures preview, Escape cancels and one release makes one undoable transaction.
- `Stage.tsx`: common DOM/media renderer for editor and exported runtime. Only the active product has WebGL; other products remain editable live pose proxies. Proxy appearance is not a material preview.
- `InstrumentScene.tsx`: demand rendering, cloned materials, real GLB named-mesh movement, camera projection, frustum-clipped hotspots and original procedural fixtures. The four-mesh phone uses actual `Glass_Front` translation. Point picking stores mesh-local coordinates.
- `VisualStudio.tsx`, `Rack.tsx`: light canvas, pan/zoom, linked responsive artboards, independent forks, visual controls, on-canvas text/width edits, playable beats, references and export.
- `visual-runtime.tsx`: standalone shared renderer and scroll driver. Native Framer/Webflow integration is not verified.

## Use

Select an actor from the canvas or Layers. Toggle an instrument and scrub Story. Drag a model to orbit; release returns to the scroll pose. Shift & drag moves its frame. Select a moment to edit its endpoint; clear endpoint mode with Escape. Select an artboard title, then Ctrl & D to fork it. A Mobile shares A's base composition and retains mobile overrides. B is independent. Focus with F; fit all with Shift & F; use two-finger pan and Ctrl & wheel / pinch to zoom.

Examples: iGlass, Olympic editorial, Cartier rhythm, Morpho portal, Aevion states, Teatika material, shape playground. Original watch/drone/can/case fixtures demonstrate choreography without claiming reproduction of original models. Scenery is original vector illustration; tide.webm is animated illustration, not nature footage. Supplied contact sheets are available in References for their corresponding examples. Original source videos were not attached to this session.

Export intent captures raster storyboard frames from the actual mixed DOM/WebGL stage, packages assets, the complete instrument/state/link graph and a separately built replay runtime. Run `npm run build` before export; the existing source-hash gate rejects stale builds. Frames disclose active real WebGL and secondary proxies. Serve the unzipped runtime over HTTP.

## Baseline evidence

`npm ci`: success, Node 24.19.0. Untouched baseline built in a separate worktree. 30/30 unit tests and 38/38 browser checks passed. The first browser attempt lacked Chromium; installing it resolved the environment issue. A later baseline export attempt overlapped editing and correctly rejected a stale build; the isolated baseline rerun passed. Final PoC evidence is recorded separately under `docs/poc/`.

## Human acceptance

Matt decides whether this is an evolutionary advance on the Windows laptop. The automated checks establish behaviour, persistence and repeatability, not aesthetic acceptance. Further expansion awaits that verdict.
