# Astra Max — Pose Studio evolutionary proof-of-concept rebuild

**Date:** 2026-10-13  
**Repository:** `playwithlifenow-eng/IphoneAnimation`  
**Source branch:** `studio/broad-v1`  
**Working branch:** create `studio/visual-instruments-poc` from the inspected source head; avoid changing `main` or the accepted Hero.  
**Required execution:** full working integrated build, checked into the user's connected GitHub account, with tests and local Windows startup instructions. This is **not** a request for another design discussion or a mockup-only deliverable.  
**Acceptance authority:** the user tests the experience on the real Windows laptop/touchpad; a passing build is not equivalent to creative acceptance.

## 0. READ THIS FIRST — PROTECT THE ACTUAL INTENT

**Pose Studio is NOT a clone, replacement, or feature-by-feature reproduction of Framer/Webflow. It is NOT an animation preset catalogue. It is NOT a database administration product.**

**Its job is to provide a high-dimensional, directly manipulable visual language in which the user discovers and communicates artistic outcomes without describing them in prose or calculating engineering parameters.** An imported React/R3F/Spline/GLB/video/image component may be constructed elsewhere. Studio manipulates its capabilities in concert with other actors, enabling sophisticated emergent scrollytelling. AI interprets selected visual intent, implements production code in appropriate engines/hosts, and checks the result. Studio may use simplified visual proxies when appropriate, but must not falsely represent approximate physics, interoperability or production fidelity as verified.

Metaphor: **Ableton/Logic for spatial web choreography**. Actors are instruments or tracks; behaviour modules are reusable effects/instruments; drivers, modulators and relational connections make them interact; Story Beats are coordinated arrangements. Users need an immediately musical instrument, not a box of transistors. An ON/OFF switch instantly enables/disables an effect without deleting its settings. Expressive controls need genuine range: 1–3 intuitive controls visible by default, full meaningful parameter depth accessible without an artificial 1–3-param ceiling.

**This run proves the ontology by a working evolutionary leap, not by a prettier UI or a slide deck.** Stop collecting more videos until the proof of concept has been tested.

### Evidence/epistemic hygiene
- Describe features as **working / visual-proxy / partially implemented / unsupported**, demonstrated by concrete test. A menu item or method name is not evidence of implemented behaviour.
- Do not say a user-visible effect has been recreated just because a generic GSAP/Three technique is known.
- Do not claim software technology was identified solely from an example recording; video proves appearance/behaviour, not original source implementation.
- Changes motivated by videos should be traceable to those recordings. Existing ideas should not be relabelled new discoveries. New hypotheses should be marked hypotheses.
- Don't assume smooth apparent scroll means Lenis or parallax necessarily means 0.7 speed: test and implement equivalent behaviour.

## 1. SOURCE BASELINE AND SAFETY

Live read-only GitHub inspection in this conversation confirms:

- `studio/package.json` is v0.3.1; Node `>=22.13.0`; scripts `npm run build`, `npm test`, `npm run test:browser`, `npm run dev` (Vite at 127.0.0.1).
- `studio/src/App.tsx` ~1,630 lines; six left tabs: Compose, Copy, Components, Scene & look, Motion actions, Takes. Single currently active `PageRenderer`, profile selector and modal-based Takes/Compare.
- `studio/src/Inspector.tsx`: already has text visual size/weight/rhythm sliders, typography presets and collapsed positioning precision. Do NOT rebuild these as if absent.
- `studio/src/PageRenderer.tsx`: already has a selected text line-width drag handle. Reuse.
- `studio/src/Timeline.tsx`: existing keyed tracks and clocks; retain backend capability but hide low-level grids in normal composing mode.
- `studio/src/store.ts`: semantic commands, preview gestures, undo/recovery/autosave; protect.
- `studio/src/model.ts`: document, entities, profiles, tracks, clock sources, bindings, relationships, Takes and episodes; presently not a full independent multi-artboard/effects-rack model. Versioned, additive changes required.
- `studio/src/capabilities.ts`: lists working and unavailable features. At present arbitrary React code import, named per-mesh material controls, live Hero integration and rich SVG authoring are not supported. Build bounded adapters; do not claim universal import.
- `studio/src/seed.ts`: only three hardcoded registered components. Rework Assets library surface, not just restyle oversized cards.
- For external components, design bounded manifest adapters for registered React/R3F components and GLBs first; Spline/Webflow integration can have a capability mapping where tool access exists, but do not claim native arbitrary Spline or Framer component import without a working integration test. Webflow and Framer target backends are a **translation responsibility**, not limitations that should dictate Studio UI.
- `studio/src/SceneView.tsx`: R3F 8.15.16, Three 0.158.0; one GLB/model per scene frame supported. Existing iPhone GLB `/assets/14_pro_oled_repaired.glb` is a regression fixture.
- Authoritative `studio/docs/master-plan.md` already explicitly declares outcome-first instruments, readable numeric-free authoring, typed units/coordinate spaces, owner conflicts, responsive profiles, signals, compound choreography and evidence. Preserve valid mechanisms while updating operative build priorities to this PoC. It is **not** acceptable to erase earlier research or documentation.

**Run:** inspect HEAD/dirty changes; create fresh PoC branch; baseline build/tests; save baseline receipts. Preserve the working production Hero, `main`, accepted Framer/Vercel scene, existing saves, undo/recovery and SQL evidence. Use migrations with round-trip tests. Avoid giant source-file rewrites if modular extraction can solve it. Do not scatter one tool across bespoke database fields/forms; the shared contract is fundamental.

**Publishing:** use the user's connected GitHub account for branch commits/push, not a shell requiring missing Git credentials. Do not reconstruct unchanged repo trees through individual blob operations. Prefer normal incremental git commit/push where connected/authenticated; if shell credentials are absent, use connected GitHub write operations for only changed files. Verify actual remote HEAD and report exact SHA; no claim of successful push without evidence. Ask for platform-required permission when necessary, but not for gratuitous approval at every intermediate step.

## 2. REQUIRED UI REPLACEMENT — THE WHOLE FRONT END

### Shell
- Replace dark graphite/dot-grid/engineering-cave chrome with a predominantly light Framer/Apple-like neutral editor: workspace `#F5F5F7`, panels white, borders `#E5E5E7`, ink `#1D1D1F`, restrained blue `#0071E3`. Distinguish **editor theme** from authored website colours.
- A single large usable light infinite canvas. Smooth pointer/touchpad pan, zoom-to-cursor, frame fit, space/hand drag, minimap only if useful; no tiny 38%-scale-only artboard. No involuntary tool context switches while dragging.
- Compact top toolbar (add/import, undo/redo, fit, preview, export intent, project). Left panel primarily **Layers & Assets**, foldered/searchable library with compact thumbnails and asset categories, not six workflow tabs. Right contextual inspector with **Instrument Rack**, collapsed advanced precision. Bottom **one clear scroll/Story Beat scrubber** with expandable tracks only when needed.
- Remove Takes tab/Compare modal/Copy sidebar/Relations forms/Motion Actions parameter-card UI as **default experiences**. Do not delete data, recovery, copy, relational evaluation, history, or advanced editing implementations. Surface them spatially and contextually.
- Inline text editing on canvas; drag selected text right-edge width handle (already exists), presets for typography; support images/videos/GLBs and registered components.
- Give the user **immediate creative starting points**: from selected references or a rough on-canvas sketch, offer 2–4 generated *arrangement* variations with visible differences in composition, motion and emphasis. If no AI-generation runtime is connected in the PoC, offer a genuinely useful preset/fork/variation generator driven by scene-state instruments and explicitly mark its limits. Do not quietly simulate remote AI execution.

### True multi-artboard
- At minimum show/edit **A Desktop, A Mobile (linked responsive art direction), B Desktop (independent creative variant)** simultaneously on board; add/duplicate/delete/rename/reorder freely.
- `Ctrl+D` on selected *artboard* duplicates the **artboard/variant**, not merely its selected entity. `Alt+drag` optional if reliable; keep entity duplication with explicit context. Copy/variant forks preserve independent creative outcomes; responsive linked views share base composition with scoped overrides.
- Selecting element in an artboard scopes inspector/gesture/selection to the correct variant + profile. Undo/recovery correct across boards. Do not simulate multiple artboards as merely static compare screenshots.
- Live viewport-dependent art direction; test intermediate responsive widths, not only 390/1200. If multiple expensive GL canvases exceed budget, only active frame may run full WebGL; inactive frames must remain useful/live-editable, marked if approximated; maintain synchronized intent state.

### Rack interaction
- Select actor -> see directly relevant instruments, not entire catalogue. `+ Add Instrument` opens searchable short menu. Each active card includes ON/OFF toggle, visual affordance, 1–3 immediately accessible macro controls, expandable full parameter range, drag handle if spatial, reset/bypass, and a direct real-time preview.
- The default view must avoid descriptions, disclaimers, code IDs, raw units and numeric forms. Hover/optional precision inspector can reveal exact values, units and current driver/provenance. The user should not need to understand ScrollTrigger, Euler angles or DOM APIs.
- Compound instruments: enable/disable/duplicate/reorder and change their coupling strength. One gesture may intentionally change several internal properties.
- Every gesture should preview live, cancel on Escape, commit one semantic transaction, undo once and preserve a meaningful snapshot.

## 3. COMMON ONTOLOGY / TOPOLOGY: A SMALL ENGINE, NOT 50 ONE-OFF FORMS

Define a **versioned universal InstrumentDefinition** (not a rigid model rewriting for each preset):

```
InstrumentDefinition {
  id, version, name, icon, category, purpose;
  supportedActorCapabilities;          // not just actor kind
  inputs: typed macro controls with semantic units, ranges/defaults;
  advancedControls?: [...];           // 88-key access, not artificial 3 knob ceiling
  driverPorts: typed signals/clocks;  // progress, velocity, pointer, time, enter, actor ports
  outputPorts: typed properties/signals with coordinate spaces;
  composePolicy: per-output arbitration/composition strategy;
  visualHandle: interaction representation;
  previewAdapter: real | proxy | unavailable, quality caveats;
  runtimeAdapter: actual reusable preview evaluation, ON/OFF bypass;
  deliveryRoutes: framer | webflow | react_gsap_r3f | external;
  constraints, dependencies, fallback, determinism, tests;
}
InstrumentInstance { stableId, definitionId, version, targetId?, enabled,
                     macroValues, advancedValues?, drivers, outputBindings, scope }
```

Treat separate scopes appropriately: GLOBAL environment effects (e.g. smooth scroll), STAGE/SECTION effects, ACTOR effects, RELATIONSHIP effects, COMPOUND MULTI-ACTOR rigs. Do not attach all global effects to one arbitrary element.

**Core graph:**

```
User gesture / scroll / pointer / clock / viewport / actor event
                 ↓
Typed DRIVER + SIGNAL ROUTING
                 ↓
MODULATORS (ease, delay, velocity, damping, thresholds, springs)
                 ↓
INSTRUMENTS + COMPOUND RIGS
                 ↔
RELATIONAL LINKS between multiple ACTORS
                 ↓
TYPED PROPERTY RESOLUTION / ARBITRATION
                 ↓
DOM + Three.js / React + media PREVIEW
                 ↓
ARTBOARD STATES, STORY BEATS, INTENT EVIDENCE, PRODUCTION HANDOFF
```

**Property arbitration:** design for scroll + drag + inertia + direct authored base + responsive offset to coexist. No single naive numerical addition of every property. Translations may add in declared spaces; scales multiply; quaternions compose; opacity may be composited/clamped; booleans and masks use state/priority/transform-specific policies. Model user-grab handoff, release blend, finite spring damping and reverse-scroll continuity. Detect incompatible writers explicitly, but use intelligible ownership choices rather than locking controls behind numeric errors. Test interrupted drag, fast scroll, reversal, reset, disable, resize, re-entry and reduced-motion.

**Cross-actor modulation:** connect actor output (bounds, position, orientation, progress, highlight phase, size, states) to another actor input. Include visual relationship wires/handles, named behaviours (clearance, follow, align, displace, synchronize, tether hotspot, trigger, reveal); actual evaluation must preserve unit/space conversion, acyclic data dependencies unless explicit delayed feedback, stable IDs and fault tolerance. Distinguish an explicitly choreographed parallel movement from truly relational response to changing geometry.

**Linked Scene States + Transitions:** author complete visual state A/B/C (object poses, text, evidence cards, material, camera, light, mask, framing) on side-by-side artboards; define continuous transition by manipulating endpoints and scroll ranges; define conflicts with manual interaction. A Story Beat coordinates multiple actor/instrument states; it is not just one action in a track.

**Reference/video grounding:** import a video/reference frame as visual evidence/overlay; scrub, freeze selected frames, sketch/trace relevant bounds and movements; preserve file/timecode, source observation, inferred control, fidelity status. This must not become a separate forced research workflow to use Studio normally.

**Semantic intent handoff:** export JSON of actors, assets, ranges, state/transition graph, instrument configs, relationships, triggers, responsive decisions, fidelity/provenance **plus** reference stills/storyboard and, when feasible, captured preview video. AI must receive enough visual evidence to reproduce user's chosen aesthetics, not merely few numbers. Compiler adapters may map supported cases to real code but aren't required to universally replicate Framer/Webflow's native Designer state in PoC. Export should identify unsupported/unknown production mappings rather than pretend.

## 4. FULL INSTRUMENT / CAPABILITY INVENTORY DERIVED FROM THE CHAT + GEMINI

Use this as a **coverage inventory**, not instructions to create a tab or panel per item. Each item must be recorded in `CAPABILITY_LEDGER.md` as **working / proxy / partial / pending**, with a reference/demo/test. Major reusable building blocks must genuinely function in this PoC; simple visual effects cannot be represented by inert toggles.

### Global dynamics, drivers and modulators
- Inertial/smooth scroll engine (OFF / Gentle / Weighty), accessible in preview and exported runtime; respect reduced-motion and nested scroll context. Never claim site uses Lenis from the mere appearance of smoothing.
- Scroll velocity/skew/stretch response with bounded amount and relax/snapback; preserve normal readability; optional.
- Time/autoplay, progress, scroll position and velocity, pointer drag/hover/click, viewport entry thresholds, actor-emitted state signals. Shared master clock + scoped section clocks with scrub/reverse/handoff.
- Spring tension, damping, inertial settling, lag, stagger, threshold/hysteresis, easing, response curve, interpolation, phase offsets.
- Global/section theme transition (light/dark), subtle grain, controlled ambient visual styling; hover magnetic pull optional.

### Viewport motion and typography
- Soft Rise viewport entrance and exit (fade + translate with sensible defaults); Scale Settle entrance; soft top-edge exit fade.
- Masked text line reveal with stagger, line breaks, split-text response; numeric/telemetry counter reveal; hover/focus transitions where relevant.
- Text width right-edge handle, visual typography presets/rhythm, progressive advanced control; art-directed mobile wrapping.
- Trigger/scrub modes: once on entry, every entry, reverse playback, and continuously scroll-linked. Explain with glyph/preview, not a numeric form.

### Images, video and layout
- Parallax Window in a clipped media container; depth presets + a real visual drag/intensity control; bounded overscan so no empty borders.
- Image/media clip/curtain reveal and multi-shape aperture masks (circle, stadium/arch, custom SVG where supported). Video inside expanding portal to full bleed; source focal point editable independently from mask.
- Image hover drift/cursor parallax, optional grain/film texture, decorative frame corner accents.
- Apparent photo depth/parallax, scale/position/crop, multi-plane foreground/midground/background staging.
- Pinned section/stage with direct drag of scroll travel; section-to-section flow and transition continuity.
- Asymmetrical magazine split (flip L/R), grid/card layouts, stacking deck, horizontal scroll-pinned ribbon, rotating left/right product handoffs, full-bleed media section, and adaptive composition. Layout must survive editing and responsive breakpoints.
- Gallery transitions with simultaneous scale, mask, crop, text timing and background handoffs.

### 3D, camera, lighting, material and hybrid DOM
- Dual authority orbit/turntable: scroll-oriented pose + direct pointer orbit + smooth release/handoff; not two fighting owners.
- Part articulation/explode and hinge with existing GLB named submesh where available; raycast pick, transform axis handle, stable mesh identity. If model lacks separable submesh, use a labelled rig proxy rather than falsely modifying GLB topology.
- Camera dolly, orbit, target, perspective/framing, FOV visual handles, per-responsive-profile camera decisions.
- Specular glint sweep visual puck/disc; approximate proxy allowed, real controlled light/material when supported; declare difference.
- Wireframe/lattice-to-solid/material state progression; representation cross-fade (not universally a true topology morph), reveal/wipe; preserve material PBR where applicable.
- 3D hotspot anchors: raycast surface/mesh local-space point projected into 2D overlay with leader, tracking camera movement/occlusion policy.
- Depth sandwich: layers that visually interleave HTML, 3D, fog/particle/backdrop; distinguish flat CSS stacking vs true depth-aware occlusion/refraction. Allow visual ordering and intentional occlusion.
- Model state changes and linked evidence/telemetry cards that change *together*; mesh articulation and data labels as one compound scene state.
- Cross-media continuity: 3D opening visually becomes 2D video portal; staged handoff can use carefully aligned proxy if production masks require further work.

### Compound composition rigs (one toggle, expandable full controls)
- Cartier: clipped hero/video narrows to circle → editorial/lifestyle depth → pinned rotating watch/product on right → handoff left with new product appearing on right → full-bleed closing video.
- Morpho: pinned can/product → rotation + camera dolly toward opening → animated opening + expanding video portal → typography over immersive video.
- Teatika: product wireframe/lattice → solid PBR appearance → opening/hinge → macro specular jewellery/light choreography; 3D dimensions can attach to object.
- Aevion: drone/product Scan / Connection / Compactness linked states, orientation/part fold, changing metrics and viewport-aligned geometry anchors/hotspots → 3D terrain information overlays.
- Montfort/Watches & Wonders: multi-plane atmospheric depth sandwich; camera through clouds/text; curtain wipe revealing scene.
- Olympic.no editorial: smooth inertial scrolling, image parallax windows, viewport soft-rise/scale settle, alternating L/R split, image grid, full-bleed media.
- iGlass: real GLB Hero as source; phone pose/camera + front-glass separation if separable or visibly-labelled proxy + glint + text avoidance/reflow + scroll narrative + responsive framing, as integrated compound rig.

Additional cases: responsive variants (desktop/mobile simultaneously), direct shape-morph A→B→C with continuous transition, animated masks, product configurator as scene state/options, state-driven background inversion, saved rearrangements and variant recombination, on-canvas rough visual intent sketches/annotation.

## 5. REQUIREMENT: LIVE, PLAYABLE PROOF OF CONCEPT — NOT CHECKBOX DEMO

Demonstrate at least these six scenarios in the actual rebuilt UI. Prefer a built-in `Examples` drawer, each example made with **the same universal instruments/rack/graph**, never hardcoded demo-only effects the user cannot modify:

1. **Olympic editorial — the fast sanity test**: Open sample page with images, text and L/R magazine sections. Enable Smooth Scroll and *feel it*; choose an image, turn Parallax Window ON, adjust depth live; click text/card Soft Rise; scrub or scroll for reveal. Disable effects, confirm clean bypass; duplicate artboard B and make variation, compare simultaneously.
2. **Cartier product story**: Use supplied media or substitute legal/sample assets (label substitutes). Shrink hero media to circular/stadium aperture on scroll; scroll into photo with depth; rotating imported model/product pinned right, transition its pose and handoff left; new product on right; then full-width video. Both the individual tools and compound beat must be editable, not just autoplay a fixed sample.
3. **Morpho portal**: Camera/product approach, mask begins local and expands into full-frame video, text arrives over scene; interactively alter portal endpoint/shape and timing. Full real geometry portal only when actual scene data supports it; proxy if clearly marked.
4. **Aevion linked states & dual authority**: Three coordinated product states (pose, annotation, metric, emphasis); scrub across them; grab product during scroll, rotate; release returns smoothly without snapping. Attach at least one 3D→DOM hotspot and verify anchoring through a camera orbit.
5. **Teatika-like material/part/glint**: Editable representation shift and specular light, 3D subpart if available; show genuinely interactive parameter changes with before/after. Use explicit proxy if existing model doesn't expose the needed submesh.
6. **iGlass compound choreography**: Existing iPhone GLB; connect its pose to headline avoidance/wrap and a light cue; use a Story Beat joining multiple behaviours. When changing phone scale/orientation, genuinely relational headline adjustment should update, not just be a coincident scroll keyframe.

**Independent mini-test:** User sketches/places triangle, rectangle and circle as 3 states, connects transition, scrubs and changes order; code/model chooses reasonable interpolation. This validates *expressive intent* rather than pre-authored songs.

**At least one scene** must demonstrate all of: two simultaneous active drivers, multiple modulators, cross-actor connection, linked states, a compound beat, independently editable A/B artboards and correct mobile profile. Ideally the iGlass or Aevion scene.

## 6. ACCEPTANCE / EVIDENCE — TEST THE EVOLUTIONARY LEAP

### UX acceptance (human decides)
- First frame is a **light, spatial, comprehensible canvas**, not six tabs; multiple useful artboards visible; good fit on a Windows laptop with a touchpad.
- A new user can make an Olympic-like page feel premium by importing media and using native rack presets, without manually creating keyframes or entering numbers. Test with real scrolling and interaction, not a scripted screenshot.
- A single toggle works immediately, and OFF truly bypasses without deleting settings; full meaningful parameter range discoverable and controllable, values editable through direct handles where spatial.
- Change one actor's pose/scale and watch a related actor's layout/annotation respond on the same stage (actual coupling).
- Scrub compound Story Beat and see camera, object, text and light change coherently; drag a beat span to change duration without breaking independent operations.
- A/B desktop and mobile on same board, variants editable independently and responsive profiles linked appropriately.
- Export `intent.json` *and* captured screenshot/storyboard frames (ideally MP4/WebM or reproducible capture) that describe exactly what the user selected, with adapter route/fidelity status.
- No mandatory tab switches to author copy, compare variants, edit scroll relationships or set image entrance.

### Technical regression
- `npm ci`, `npm run build`, `npm test`, `npm run test:browser`; report results separately and don't claim unrun tests passed.
- Browser E2E tests for instrument ON/OFF, state save/reload, undo/cancel, variants/profile editing, scroll reversal/re-entry, pointer orbit handoff, property conflict/priority resolution, asset loading/unloading, reduced motion, export integrity and hard refresh.
- Capable of running on the user's Windows laptop/touchpad; no unexpected horizontal page scroll, stuck pointer capture, spinning idle render loops, duplicated WebGL contexts multiplying per artboard, or delayed UI updates.
- Preserve accepted Hero scene/source and old documents via version migration. Explicit migration tests, backup before destructive conversion; full tests plus manual acceptance.
- Provide screens and short GIF/video showing actual controls manipulated, not only pre/post screenshots.

### Honest shipping statuses
- Distinguish true renderer (already accurate) vs proxy/approximation; show fidelity in developer diagnostics or export metadata, **not long UI notices**.
- If unavailable assets, credentials, hosting features or editor browser restrictions block a particular module, substitute an explicitly labelled fixture/proxy, continue with independent work, and report exact gap. Never claim full support.
- Don't implement all 30 ideas as dead menu entries. A coherent, working end-to-end experience with clear coverage marks beats dozens of inert switches. However **every item in §4 remains explicitly tracked** in the delivery ledger. User requested all chat findings included, not silently discarded.

## 7. IMPLEMENTATION ORDER (BUILD, NOT ANOTHER RESEARCH SWARM)

**Gate 0 — verified source baseline:** checkout+protect; baseline tests/commits. Update master-plan only enough to record the new operative PoC and precedence, preserving research chapters. Add `docs/visual-instrument-poc.md` and `docs/capability-ledger.md`.

**Gate 1 — core model:** versioned instrument registry, actor capability adapters, typed driver/modulator/output ports, deterministic evaluation and property arbitration; migration and focused unit tests. Preserve compatibility of existing tracks/poses/bindings; wrap them where feasible rather than mass deletion. Implement parallel signal & user gesture arbitration.

**Gate 2 — spatial shell:** working light canvas/multi-artboards A desktop + A mobile + B desktop, contextual inspector rack, Layers/Assets, direct text/media/3D selection, undo/restore, one scrubber, source browser. Keep advanced old features accessible where needed but out of normal workflow.

**Gate 3 — foundational playable rigs:** smooth scroll, parallax, viewport soft rise, editorial split, stage pin, image shape mask/video portal, dual authority 3D orbit and cross-actor geometric constraint. These must run end-to-end and be modifiable while previewing.

**Gate 4 — compound expressivity:** scene states, compound Story Beats, modular enable/bypass and reordering, glint, articulated part where possible, wireframe/solid representation, hotspots. Provide examples across the reference sites (§5), even if difficult ones require declared proxies.

**Gate 5 — export and prove:** versioned intent+reference payload, production routes/mappings, browser acceptance tests, videos, local machine procedure and GitHub branch commit. Mark uncertainties, exact tests and video example outcomes. Don't push `main`, don't alter production Hero.

**Each gate must yield a usable, tested integrated artifact**, not weeks of backend abstractions. If functionality requires more work than budgeted, preserve architectural completeness and actual end-to-end demos, label gaps and avoid fake confirmations.

## 8. VERIFICATION REPORT REQUIRED WITH DELIVERY

Return concise:
1. Branch and exact pushed SHA / linked diff; code changed only on PoC branch; original Hero verified unchanged.
2. Exact startup from user's Windows checkout: `cd 'C:\Users\matth\Desktop\R3F Repo\IphoneAnimation-live\IphoneAnimation\studio'`, `git fetch`, `git switch studio/visual-instruments-poc` (or safe branch setup instructions reflecting real remote), `npm ci`, `npm run dev`, and observed local URL (normally `http://127.0.0.1:5173/`). Do NOT tell user to clone into an unrelated folder unless necessary.
3. One screenshot and short preview video/GIF per benchmark scenario; no unsupported visual claims.
4. Actual `npm run build`/`npm test`/`npm run test:browser` results, including failures.
5. Capability ledger: working/proxy/partial/pending, each referencing one instrument definition, sample, test, and source inspiration.
6. Known blockers and first specific action needed from user—only if unavoidable.
7. A short guided 5-minute user test: activate Parallax + Soft Rise, duplicate artboard, adjust 3D linked beat, scrub and export.

**Stop condition:** The user sees and manipulates several complex, integrated effects quickly; confirms or rejects whether it is an evolutionary leap. Further video-led engineering-manual research resumes **only after this acceptance test**.

## 9. NONNEGOTIABLE NEGATIVE CONSTRAINTS

- Do not build a competing visual website builder, generic CMS or Framer copy.
- Do not re-explain to the user that React/Three battery physics require custom code. Known premise.
- Do not ask for a new detailed prose account of the product purpose. It is defined here.
- Do not substitute UX prose, static design images or a mockup for a live interactive build.
- Do not use separate tabs/forms for Takes, Copy, Relations or Motion as main authoring paths.
- Do not claim code automatically understands arbitrary external components without an adapter/capability contract.
- Do not over-abstract into a framework that cannot demonstrate Olympic/Cartier/iGlass workflows.
- Do not declare that a fixed list of 12 instruments is exhaustive or that every conceivable scrollytelling effect reduces to exactly three vectors. Extensibility is required; claimed universality needs empirical testing.
- Do not discard the SQLite evidence system, current valid engineering research, semantic document, undo history or the production Hero.
- Do not claim an exact original site's implementation technology solely from a recording.
- Do not invent validation, verified outcomes, or success before tests execute.
- Do not repeatedly ask human to pick low-level engine decisions; choose reversible defaults, deliver visual alternatives where aesthetics are uncertain.

**The output is the working software, not a persuasive explanation of why it can be built.**
