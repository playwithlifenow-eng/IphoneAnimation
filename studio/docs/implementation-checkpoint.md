# Implementation checkpoint — 28 September 2026

> Historical checkpoint. See [29 September workspace revision](feedback-2026-09-29.md) for the newer canvas, hierarchy, deletion, Take preview and Framer import implementation.

**State:** runnable integrated alpha; broad V1 implementation is underway. This is a checkpoint against the master plan, not a competing execution plan or a claim that V1 acceptance is complete.

## Authority and isolation

- `docs/master-plan.md` is the consolidated authoritative specification. The broad integrated V1 is BUILD_NOW; superseded instrument-first release gates were removed.
- Branch: `studio/broad-v1` in `playwithlifenow-eng/IphoneAnimation`.
- Local commits are preserved. GitHub push was blocked by automatic approval review pending explicit authorisation to share this code, plan and assets with the repository. No remote branch publication is claimed.
- Source baseline: `ef3850a8d74619c99ac79eb833eeb31e86ef8dad`.
- All implementation changes are inside `studio/`. No existing Hero source, dependency, host or deployment configuration was changed.
- The copied GLB matches the repository asset byte-for-byte: SHA-256 `ed566096636bfc871e85c2df95dee48ee1a684f44db5356be06c0702ff78b635`.

## Delivered machinery

A single semantic document and command system connect Compose, Copy, Components, Scene & look, the choreography timeline, responsive profiles, and Takes/Evaluate. These are functioning surfaces rather than independent mockups. The renderer and evaluator are shared with standalone output.

The common editing path includes transient pointer previews, one-record gesture commit, cancellation, undo/redo, scoped property ownership, stale revision checks, local SQLite persistence and conflict-aware recovery. Grouping preserves static element positions across every profile. Duplication retains descendant relationships and motion bindings. Named pose recall is one command transaction. Take branching records the restored ancestor, and importing a project can be undone with its previous Takes intact.

Path editing now supports page-level position handles, keyboard nudges and one-transaction drag/undo. Responsive track edits retain inherited keys. Authored frame relationships provide alignment/clearance readings and centre-to-centre connectors through the shared renderer.

The minimum feedback path retains original text, an exact document snapshot, selected profile, controlled time and signal inputs, selected IDs, a bounded command buffer, measured DOM boxes in page coordinates, relationship readings and environment. It does not fabricate stills, video, scene geometry or perceptual scores. Capability envelopes state current limits.

Portable project export deduplicates media across elements, Takes and episodes; re-import validates hashes and restores local assets. Runtime export packages media references, uses the shared renderer, excludes editor/store code, and emits four manifests with artifact hashes. A source identity check rejects stale runtime builds. Actual Framer compatibility remains unverified.

## Verification

- TypeScript and Vite production build pass.
- **18 invariant/transaction/geometry tests pass**, covering revisions, immutable states, owner precedence/conflicts, interpolation, grouping, duplication, deletion, gesture cancellation/history, Take restoration/lineage, whole-project import undo, overlapping saves, stale recovery, coordinated paths, inherited-track preservation, and missing geometry evidence.
- **20 browser checks pass**, including deduplicated portable project re-import with Takes, path gestures, relationships and an independent exported runtime. These were exercised in headless Chromium with software WebGL. See `verification/browser-report.json` for the exact assertions and browser version; screenshots are in the same directory.
- Tested editor viewport: 1512 × 982. Both desktop and mobile composition profiles were edited. This does not certify a touch-only editor or target-device GPU performance.
- The default agent-browser daemon could not bind its socket in this execution environment. Direct Playwright used an installed headless Chromium binary and exercised the same app. No production systems were used as a workaround.
- Vite reports a large shared renderer chunk (~996 kB uncompressed, ~279 kB gzip), primarily Three/R3F. No performance budget pass is claimed; splitting and target-device measurement remain work.

## Next executable work within BUILD_NOW

1. Extend paths into coordinated pose/cue editing, nested coordinate spaces and 3D camera paths. Keep explicit units and reversible edits. Extend measured cases to a DOM-only layout and a non-Hero composition.
2. Extend connector routing/style and scene-space probes while preserving the distinction between observed bounds and unsupported occlusion claims.
3. Adapt reusable Hero motion/component machinery behind a versioned local contract. Preserve accepted source settings; test local fixtures before requesting host access. A reference card is not that adapter.
4. Expand the component registry, Discovery Deck locks and comparison modes, and retain explicit decision history and protected four-manifest Take references.
5. Complete responsive/quality/reduced-motion alternatives and the supported production/Framer fixture. Request host access only for that host-specific test.

These are parallel candidates after shared interfaces are settled, not a new one-instrument release ladder. The existing broad V1 acceptance checklist remains operative. Agent/evolutionary work stays in its specified later phases.

## Reproduction

From `studio/`: `npm ci`, `npm test`, `npm run build`, `npm run dev`. For the automated UI fixture, install Chromium with `npx playwright install chromium` and run `npm run test:browser`. Use `STUDIO_BROWSER_EXECUTABLE` only when supplying an already installed compatible Chromium. The browser fixture uses a separate SQLite directory and does not overwrite the working composition.
