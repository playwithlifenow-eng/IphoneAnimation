# Implementation checkpoint — 12 October 2026

**State:** integrated alpha 0.3.0. The broad V1 remains BUILD_NOW under `docs/master-plan.md`; the full V1 acceptance gate and later evolutionary systems remain in that plan.

## Scope and isolation

Changes are confined to `studio/`. The existing Hero application, original GLB and production configuration are unchanged. Publication targets `studio/broad-v1` only. The workspace redesign builds on published commit `117ae4ca6e74c9c9bda79121e687a8cea1f64b42`.

## Implemented

- Graphite workspace with a single 44px header, left-panel workspace navigation, 12–13px labels, 32px numeric controls, resizable/collapsible side panels and resizable/collapsible choreography. Preferences persist independently of documents. Feedback/help/version remain accessible through the header question-mark menu.
- Numeric label scrubbing with Shift/Alt precision, keyboard adjustment, one history entry per drag and Escape cancellation. Profile scope and effective driver badges coexist; inherit-base resets a property's local static/track/signal overrides atomically. Key diamonds distinguish keyed positions and seek the owning clock.
- Separate model turntable and camera orbit tools, keyboard shortcuts, authored camera yaw/pitch around the origin, and independent distance/FOV. Existing scene documents retain the same zero-yaw/pitch camera by default. Camera properties participate in ordinary tracks, poses, responsive overrides, Takes and export.

- Mesh-aware selection with transparent viewport pass-through, Alt-click overlap cycling, background/Escape deselection and distinct move/pan/rotate tools. Rotation sensitivity is adjustable. WebGL viewport measurement ignores workspace transforms, preventing double application of canvas zoom.
- First-class sections in normal page flow, insertion seams, reordering, local freeform/stack layout, fixed/viewport/authored-content heights, and separate pinned scroll travel. First insertion wraps a legacy page in one undoable conversion. Stack-to-free conversion retains the visible arrangement. Elements can move between sections while retaining local values and existing clocks.
- Page/section clocks driven by time or scroll. Scroll choreography displays percentages and uses the same evaluator for DOM and 3D. Editor scroll preview and exported sticky sections share range calculations. Percentage timing survives changes to the global time duration.
- Canvas, inspector and rotation share one edit policy: key the owning clock's current moment or offset all keys. Mobile edits fork inherited curves. Signal edits offset the numeric mapping. Gestures preview, commit once, cancel and undo. Static properties stay static until keyed or assigned an action.
- Reveal, Move, Rotate and Scale actions with amount, timing and stagger. Generated tracks remain runtime authority. Manual key edits mark the descriptor customized, preventing parameter regeneration from silently replacing detailed edits.
- Paths continue working for page elements and direct children of freeform sections, including scroll-clock sampling. Existing Takes, named poses, responsive overrides, relationships, feedback and portable export remain integrated.
- Independent browser recovery slots per writer, identifiable downloadable copies, server-version conflict protection and truthful status when both browser and server persistence fail.
- Choreography retains explicit key/offset modes when collapsed; primary tools now live in the unified header. Two-finger scroll pans; pinch zooms. Follow scroll keeps the relevant page region in view.
- Version 1 documents migrate to version 2 on validation. Takes and episodes migrate with the workspace. Implementation/instrument manifests use version 0.3.0, with source and artifact hashes.

## Verification

**27 automated tests and 30 browser checks pass**, along with TypeScript and the production build. `npm test`, `npm run build` and `npm run test:browser` exercise the integrated code. The checked-in `verification/browser-report.json` is the exact browser assertion record; `verification/tested-build.json` identifies the tested source. Screenshots in the same directory show the tested editor and independent exports.

The invariant suite covers migration, section preservation/reordering, scoped DOM/3D clocks, percentage preservation, independent duplicated section clocks, mobile curve forks, stack conversion, action ownership, nested section paths, gesture history, Takes, recovery separation and double-save failure. The browser fixture covers real GLB pixel/mesh selection, direct tracked dragging, offsets, sensitivity, background deselection, section conversion/undo, scroll actions, scoped key editing, mobile forks, two real conflicting tabs, save/reopen, media-inclusive imports and standalone runtime playback/pinning at desktop and mobile sizes.

Additional workspace checks cover 1366×768 header fit, canvas expansion with panels hidden, preference persistence, pointer/keyboard divider resizing, static and animated numeric scrubbing, cancellation, reversible profile inheritance, key navigation and camera/model separation.

Browser tests use an isolated SQLite directory, Playwright and Chromium with software WebGL. They do not exercise Matt's working document or production hosts. Target-device GPU performance and trackpad feel still require his use. The deferred Three/R3F chunk is approximately 837 kB uncompressed; no GPU or performance-budget pass is claimed.

## Explicit limits and next work

1. Each GLB viewport still has its own WebGL context. Shared-context rendering, continuous cross-section 3D scenes and per-mesh actions such as Separate glass require further implementation; shared context alone would not create a shared scene.
2. Paths support page/freeform-section X/Y tracks. Nested transformed groups, spline tangents, 3D camera paths and richer pose/cue coordination remain open. Action duplicates preserve generated motion tracks but do not recreate action parameter cards.
3. Content-fit sections use authored child bounds, not arbitrary intrinsic HTML measurement. Existing tracks keep their clocks during reparenting; automatic clock rebinding is deliberately absent.
4. Reduced-motion preference stops time playback; explicit scroll still drives scroll clocks. Authored alternatives and target-device quality profiles remain to be completed.
5. Live legacy Hero/component adapters, richer component contracts, scene probes, comparison/discovery locks, decision history and protected four-manifest Takes remain part of the broad V1 work. The Hero reference card is not a verified adapter.
6. Framer host compatibility remains unverified and is required only for its delivery fixture. No production access is needed for ordinary editor work. Agent, island, recombination and evolutionary mechanisms retain their later phases.

## Reproduce

From `studio/`, use Node 22.13+ and run `npm ci`, `npm test`, `npm run build`, then `npm run dev`. The browser fixture uses `npm run test:browser` after installing Chromium with `npx playwright install chromium`; `STUDIO_BROWSER_EXECUTABLE` can identify an already installed compatible binary.
