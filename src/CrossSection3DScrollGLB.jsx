import screenImg from "./Screen 2.webp";
import internalsImg from "./internals.jpg";
import crackImg from "./Crack.webp";
import { useRef, useMemo, useEffect, useLayoutEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  useGLTF,
  useTexture,
  TransformControls,
  Html,
} from "@react-three/drei";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Leva, useControls, button, folder } from "leva";

gsap.registerPlugin(ScrollTrigger);

const IGLASS_APP_VERSION = "7.5.36-terminal-mobile-shine-corner-fix";

// ============================================
// v7.5.36 BOTTOM-LEFT SHINE LEAK — REGRESSION FIX
//
//   PANE TRANSFORM   The shine overlay uses the cloned front-glass geometry,
//                    so it now inherits the same rebased position,
//                    quaternion and scale as that pane. Geometry without the
//                    source transform placed the sweep beside the chassis.
//   DEPTH OCCLUSION  Shine depth testing is restored. The chassis/rim can
//                    occlude the overlay instead of a misplaced highlight
//                    drawing through the phone body.
//   TRUE ZERO        A hard shader launch gate,
//                    smoothstep(0.0, 0.03, uProgress), makes shine=0 produce
//                    physically zero RGB/alpha rather than parking a live
//                    strip on the pane edge.
//   CPU FAIL-CLOSED  The material is also hidden at exact progress zero;
//                    the shader remains the continuous authority for the
//                    0.00 -> 0.03 launch ramp.
//   NO CHOREOGRAPHY  Terminal lighting profiles, motion JSON, timings,
//                    sweep paths and desktop/mobile routing are unchanged.
//
// ============================================

// ============================================
// v7.5.35 TERMINAL DESKTOP/MOBILE PROFILES
//
//   EXPLICIT ROUTE   The terminal light sequence now selects its recorded rig
//                    from ?terminal=desktop|mobile. Desktop is the backwards-
//                    compatible default; Framer adds terminal=mobile only to
//                    its existing <810px mobile iframe URL. No viewport/path
//                    inference and no motion JSON changes.
//   DESKTOP LOCKED   v7.5.34 desktop values and sweep directions are preserved
//                    exactly.
//   MOBILE RESTORED  ambient .44; key 3.00 at Y -15 / Z 13.3 / 8800K; fill
//                    1.20 at Y +20 / Z -20 / 7000K; environment .70; exposure
//                    1.00. KEY X +20 -> -20, then FILL X +20 -> -20.
//   SAME CLOCK       Glass sweep, gap, setup matching, durations, easing,
//                    autoplay completion and render governor are unchanged.
//   URL ROUND-TRIP   Preview/capture URLs preserve the active terminal profile.
//
// ============================================

// ============================================
// v7.5.34 TERMINAL RECORDED RIG
//
//   AUTHORED RIG    The terminal sequence no longer runs on whatever
//                   lighting the final JSON node happens to carry. It
//                   settles onto the recorded working setup the effect
//                   was designed against — ambient 0.44, key 3.00 at
//                   Y -8.2 / Z 9.4 / 8800K, fill 1.20 at Y +10 / Z -20 /
//                   7000K, environment 0.70, exposure 1.55 — and holds
//                   those constants absolutely through both sweeps.
//   ONE CROSS-FADE  The rig arrives over the SAME eased entry the key X
//                   already used, so there is no lighting pop when the
//                   sequence begins, and every constant is EXACT (assigned,
//                   not interpolated) from the key sweep onward.
//   STILL X ONLY    Between keyStart and fillEnd the only channels that
//                   move are lightKeyX, then lightFillX. Y, Z, intensity
//                   and temperature are frozen at the recorded values.
//   BEZEL MATERIAL  Gloss 1.00 -> 0.41 and depth push -4 -> -7.5, black
//                   level unchanged at 0.00. Module defaults, not pose
//                   channels and not animated: the fill travelling across
//                   a bezel that HAS a specular lobe is the effect.
//   NO PATH DATA    Unchanged. Both production JSONs still import and run
//                   untouched.
//
// ============================================

// ============================================
// v7.5.33 TERMINAL LIGHT SWEEP
//
//   ONE SEQUENCE    The automatic terminal glass sweep is extended into a
//                   deterministic terminal EFFECTS sequence. After the
//                   sweep completes: a short gap, the KEY light travels
//                   +20 -> -20 across the body, then the FILL light
//                   travels -20 -> +20 across the bezel. Strictly
//                   sequential; the two never overlap.
//   SAME CLOCK      Every phase is appended by motionPlaybackTiming() and
//                   read back by sampleMotionPlayback(), exactly as the
//                   glass sweep already is. No setTimeout, no GSAP tween,
//                   no component state, no wall clock — the same playback
//                   progress always produces the same lighting.
//   SAME GATE       It runs on precisely the paths the terminal sweep
//                   already qualifies for: the last node must return
//                   glass registration to its home XYZ. A non-qualifying
//                   path is timed and played exactly as before.
//   SPATIAL ONLY    Only lightKeyX, then only lightFillX, are overridden.
//                   Y, Z, intensity, temperature, ambient, environment
//                   and exposure continue to come from the final
//                   authored pose. The effect is the light MOVING, never
//                   the light changing brightness or colour.
//   NO POP          Both production paths end with the key light far from
//                   +20, so each phase opens with a short eased entry
//                   from the authored X to its start X. That entry is a
//                   declared span inside the terminal timeline, not a
//                   hidden state mutation.
//   GOVERNOR SAFE   The added spans are inside totalDuration, so autoplay
//                   completion, the Framer completion message and the
//                   render-loop park all happen after the FILL sweep, not
//                   after the glass sweep.
//   ZERO PATH DATA  No node, pose, slot, schema, export format or saved
//                   path changes. Both supplied production JSONs import
//                   and run unmodified.
//
// ============================================

// ============================================
// v7.5.32 WEBP OLED IMAGE
//
//   STATIC SCREEN    The OLED uses Screen.webp directly through its existing
//                    mesh material, UVs, luminance and texture filtering.
//   STATIC ONLY      Removes the hidden media element, dynamic texture,
//                    frame callbacks, playback controls and switching logic.
//   MOTION SAFE      Geometry, materials, lighting and motion paths are
//                    otherwise unchanged.
//
// ============================================

// ============================================
// v7.5.26 — OVERHEAD GLASS REFLECTIONS + ±35 GLASS REGISTRATION
//
//   OVERHEAD CARDS   A broad ceiling softbox and a narrow overhead kicker
//                    add readable moving reflections to the clean and cracked
//                    glass without lifting the ambient fill.
//   CRACK RESPONSE   The cracked surface receives a restrained reflection
//                    boost so its fracture detail catches the overhead cards
//                    while it travels across the OLED.
//   GLASS REG ±35    X, Y and Z registration now share a ±35 range so removal
//                    poses can carry the complete glass unit beyond the mobile
//                    viewport.
//
// ============================================

// ============================================
// v7.5.25 — HIDE FROM THE PLAYBACK ROW
//
//   SECOND HIDE      A "hide" chip joins preview and start inside MOTION
//                    PATH PREVIEW. Press preview, press hide: both are
//                    under the same finger, so the panel is gone before
//                    the first leg has travelled. The chip at the top of
//                    the dashboard is unchanged and still works.
//   PLAYBACK SAFE    Collapsing swaps the panel's markup only; it does
//                    not unmount the dashboard, so the requestAnimationFrame
//                    playback chain, the pose writes and the progress
//                    state all continue untouched. Nothing is dropped and
//                    no node is skipped.
//   SCOPED CHANGE    One chip. No pose, path, slot, timing, easing or
//                    render behaviour is altered.
//
// ============================================

// ============================================
// v7.5.24 — 200 POSE SLOTS
//
//   200 TOTAL        The pose library grows from 150 to 200 named slots.
//   ALL USABLE       PRIMARY_SLOT_COUNT rises with it. The browser only
//                    ever rendered the primary block plus any FILLED slot
//                    above it, and a slot that is never rendered can never
//                    be Shift-clicked into existence — so raising
//                    SLOT_COUNT alone would have added fifty slots that
//                    could not be reached. Both counts move together.
//   NOTHING MIGRATES Existing saved slots load by index into the first
//                    150 of 200. Saved paths, node references, thumbnails,
//                    metadata and studio backups are untouched; every slot
//                    number a path already points at still means the same
//                    pose. Old 150-slot backups import unchanged.
//   STORAGE          Slots, metadata and thumbnails all live in
//                    localStorage. 200 filled slots plus a large saved-path
//                    library approaches the ~5 MB origin quota; the writes
//                    already fail silently and stay session-only rather
//                    than throwing, but a full studio backup is the only
//                    durable copy.
//   SCOPED CHANGE    No pose, path, easing, damping, lighting, crack,
//                    glass, bezel or material value is altered.
//
// ============================================

// ============================================
// v7.5.23 — POSE SLOT USAGE MARKING
//
//   ORANGE = SPOKEN FOR  A filled pose slot outlines ORANGE when it is
//                        referenced by the working path or by any saved
//                        path. Green means filled but referenced by
//                        nothing, so it is safe to overwrite or delete.
//   LIVE                 Ctrl-clicking a slot onto the loaded path turns
//                        it orange immediately; removing that node turns
//                        it back green — unless a saved path still holds
//                        it. Derived from state, never cached.
//   ALL VERSIONS         Every version of every saved path counts, not
//                        just the latest. A slot only an older version
//                        references still breaks that version if deleted.
//   SCOPED CHANGE        Read-only presentation. No pose, path, slot or
//                        save behaviour is altered.
//
// ============================================

// ============================================
// v7.5.22 — DASHBOARD DENSITY + SLIDER ORDER
//
//   ONE ACTION ROW   undo / redo / clear / preview / manifest share a row.
//   NODE MOTION      Departure easing sits on the hold row; depart amount
//                    and a short "reset" share the row below it.
//   LESS NOISE       The saved-paths explainer paragraph is removed.
//   SLIDER ORDER     Leva order is now glass registration -> stage ->
//                    cracked pane, then everything else unchanged.
//   SCOPED CHANGE    Layout and ordering only. No control, value, range,
//                    default, handler or pose channel is altered.
//
// ============================================

// ============================================
// v7.5.21 — UPDATE IS ALWAYS AVAILABLE
//
//   LINK SURVIVES    Which library entry the working path came from is now
//                    persisted. It used to live only in React state, so a
//                    page refresh dropped it and UPDATE greyed out even
//                    though the restored working path WAS that saved path.
//   NEVER A DEAD END UPDATE is always pressable. Linked -> overwrite in
//                    place. Not linked -> save as a new path and link it,
//                    so the very next press overwrites.
//   RENAME STICKS    The path name box is authoritative. UPDATE and
//                    + version both carry the current name onto the
//                    library entry instead of preserving the old one.
//   STALE LINK       A link pointing at a deleted entry clears itself.
//
// ============================================

// ============================================
// v7.5.20 — CRACK STATE AUTHORITY + PATH OVERWRITE + LEFT LIGHT BANK
//
//   CRACK AUTHORITY  CRACK.on is now written by ONE function. Previously
//                    the toggle went through Leva, and Leva's set() is a
//                    no-op when its cached value already matches — while
//                    path playback had mutated CRACK.on directly behind
//                    its back. Result: the chip appeared to do nothing,
//                    the crack stayed on, and readPoseParams saved ON.
//   SLOT PRESERVING  PLAY on the path that is ALREADY loaded now runs the
//                    LIVE slots instead of re-restoring the saved
//                    snapshot over them. Restoring wiped every slot edit
//                    made since the load, which is the second and larger
//                    reason a crack turned off on a node came back.
//   SAVE ON A NODE   Mid-fade scrubs no longer save a half-faded crack as
//                    ON; the saved boolean is the nearer authored state.
//   PATH OVERWRITE   "update loaded path" overwrites the loaded path's
//                    latest version in place. "+ version" and "+ save as
//                    new path" remain for non-destructive saves.
//   LEFT LIGHT BANK  Three camera-side cards on -X, on one dial
//                    (SHINE.envLeft), so the front glass, the left chassis
//                    flank and left-facing crack facets have something to
//                    reflect. envLeft 0 restores the v7.5.19 look exactly.
//   SCOPED CHANGE    No geometry, pose, path, easing, damping or
//                    interpolation value is altered.
//
// ============================================

// ============================================
// v7.5.19 — WEBP TEXTURES + POSTER-FIRST LOAD
//
//   WEBP SWAP        Screen.png -> Screen.webp (5,032,736 -> 1,391,306 B)
//                    Crack.png  -> Crack.webp  (  737,714 ->   476,830 B)
//                    Both lossless, pixel-diff verified NONE. CRA 5.0.1
//                    routes .webp through its catch-all asset/resource
//                    rule, so both are content-hashed into static/media/
//                    and inherit the immutable cache header.
//   POSTER-FIRST     A still of the p=0 composition lives in index.html
//                    ABOVE #root and paints during HTML parse — before
//                    the bundle finishes, long before 6.5 MB of GLB and
//                    textures resolve. It is dismissed on the SAME
//                    scene-ready signal the autoplay gate already uses,
//                    so poster and first live frame are one composition.
//   FALLBACK FREE    If scene-ready never arrives (WebGL blocked, context
//                    lost at boot, decode failure) the poster is never
//                    dismissed and becomes the permanent still fallback.
//   TIMING           boot / assets / ready / complete marks posted to the
//                    parent and mirrored on window.__iglassTiming. The
//                    assets->ready gap brackets exactly one rendered
//                    frame, which is where first-draw shader compile is.
//   SCOPED CHANGE    No geometry, material, lighting, pose, path, easing,
//                    damping or interpolation value is altered. The two
//                    textures are byte-for-byte the same pixels.
//
// ============================================

// ============================================
// v7.5.18 — RENDER LIFECYCLE GOVERNANCE
//
//   IDLE ON FINISH   The render loop parks after the authored path
//                    completes instead of running at 60fps forever.
//                    45 settle frames run first, at the EXISTING damping,
//                    so the held pose is pixel-identical to today's.
//   TAB / OFFSCREEN  Rendering stops while the document is hidden, and
//                    on an optional iglass-visibility message from Framer.
//   CONTEXT LOSS     webglcontextlost is preventDefault-ed (without it a
//                    restore is impossible) and both events are reported
//                    to the parent so the poster can be re-shown.
//   CAPABILITY GATE  A throwaway-canvas probe with
//                    failIfMajorPerformanceCaveat runs BEFORE mount, so a
//                    failure never throws inside R3F. Skipped for ?snap=1
//                    and ?dev=1 — headless SwiftShader is itself a major
//                    performance caveat and gating it would kill capture.
//   REDUCED MOTION   prefers-reduced-motion jumps autoplay straight to the
//                    finished composition and reports completion.
//   SCOPED CHANGE    No geometry, material, lighting, texture, pose, path,
//                    easing, damping or interpolation value is altered.
//
// ============================================

// ============================================
// v7.5.17 — CRACK UV-EDGE CLIP
//
//   NO EDGE STREAKS  Crack alpha is explicitly zero outside transformed UV
//                    bounds instead of inheriting ClampToEdge border pixels.
//   SAFE REGISTRATION X/Y registration can move the fracture texture without
//                    drawing straight lines from its edge into the pane.
//   SOFT CROP        A derivative-sized feather removes the final texel seam
//                    while preserving the authored fracture pattern.
//   BOTH FACES       The same UV law is applied to front and underside crack.
//   SCOPED CHANGE    Glass geometry, crack position values, motion, lighting
//                    and all material controls remain unchanged.
//
// ============================================

// ============================================
// v7.5.16 — DEPARTURE MOTION RESTORED
//
//   VISIBLE CONTROL   Departure easing is shown for every node with an
//                     outgoing leg, not only nodes with an authored hold.
//   WORKING CONTROL   Editing an unheld intermediate departure makes its
//                     outgoing leg custom so the chosen easing takes effect.
//   CONTINUITY SAFE   Untouched continuous legs keep their existing sampling;
//                     saved departure values and legacy paths remain valid.
//   SCOPED CHANGE     Lighting, crack rendering, materials, poses, autoplay
//                     and all existing defaults remain unchanged.
//
// ============================================

// ============================================
// v7.5.15 — CRACK SURFACE LOCK
//
//   FIXED CARRIER     Crack registration now offsets texture UVs; it no
//                     longer translates the glass-sized overlay geometry.
//   EXACT TRANSFORM   The crack carrier inherits the source pane's rebased
//                     position, quaternion and scale.
//   REAL OCCLUSION    Front-crack depth testing is restored so the OLED,
//                     bezel and chassis can hide physically covered pixels.
//   SURFACE BIAS      A tiny local-normal offset places the crack above the
//                     authored pane/OLED depth defect without visible travel.
//   SCOPED CHANGE     Crack controls and saved X/Y values remain compatible;
//                     lighting, materials, paths and all other defaults stay.
//
// ============================================

// ============================================
// v7.5.14 — CONTINUOUS STATIC REFLECTION COVERAGE
//
//   REVERSE COVERAGE  Three restrained Lightformer cards fill the positive-Z
//                     hemisphere left empty by the original studio rig.
//   NATURAL TRAVEL    The cards remain fixed in world space, so their reflected
//                     shapes travel naturally as the phone rotates.
//   SINGLE CAPTURE    The expanded environment is still captured once only;
//                     no CubeCamera or per-frame environment renders are added.
//   EXISTING DIALS    New broad/strip/rim cards inherit the existing studio-card
//                     controls. No defaults, materials or animation logic change.
//
// ============================================

// ============================================
// v7.5.13 — POSE-ANIMATED ILLUMINATION
//
//   OLED LUMINANCE    The unlit OLED texture now has a 0–1 luminance channel
//                     that saves in pose slots and interpolates on paths.
//   LIGHTING POSES    Ambient, key, fill, environment and exposure are now
//                     first-class numeric pose/path channels.
//   MOVING LIGHTS     Key/fill XYZ and colour temperature are pose channels;
//                     the original positions and colours remain the defaults.
//   LEGACY SAFE       Old slots and motion payloads are completed from the
//                     active URL/static lighting baseline before playback.
//
// ============================================

// ============================================
// v7.5.12 — PATH-NATIVE FULL AUTOPLAY
//
//   NO SCROLL GATE    Once the GLB has rendered two frames, the complete
//                     authored motion path plays automatically from 0 to 1.
//   NATIVE HOLDS      Node holds remain part of sampleMotionPlayback; there
//                     is no second artificial pause at a fixed parent p.
//   INTRO SYNC        The first authored hold boundary is reported to Framer
//                     so its black→white lift and silver "imagine" reveal
//                     finish exactly on the arrival at slot 120.
//   SMOOTH LAUNCH     The first leg now honours node 1's authored departure
//                     easing even though there is no hold before it.
//
// ============================================

// ============================================
// v7.5.11 — RENDER-GATED HYBRID AUTOPLAY
//
//   TRUE READY        Autoplay cannot start until the GLB, textures and
//                     scene have completed two rendered frames.
//   FIRST HOLD        Autoplay stops exactly at p=0.20 (URL-overridable via
//                     ?hold=) and waits for one parent resume message.
//   SHARED PROGRESS   Autoplay progress is posted to Framer every frame so
//                     the DOM headlines remain on the same clock.
//   ONE-WAY PLAYBACK  After the first downward gesture, playback continues
//                     once to p=1; it does not loop or yoyo.
//   EDGE CONTINUITY   The calibrated dual-edge feed also runs in autoplay.
//
// ============================================

// ============================================
// v7.5.10 — STABLE DUAL LONG-EDGE FEED
//
//   LONG EDGES        Reports the pane's two real long edges (local x-min
//                     and x-max) instead of joining whichever two corners
//                     happen to be highest on screen.
//   NEAR / FAR        Classifies those two stable edges by live camera-space
//                     depth and sends both. Framer chooses the calibrated
//                     nearside/far-side boundary without guessing geometry.
//   PROGRESS FEED     A changed parent p also emits even if the pane is nearly
//                     stationary, so the 0.781 / 0.796 gates cannot miss.
//
// ============================================

// ============================================
// v7.5.9 — GLASS EDGE FEED
//
//   EDGE REPORTER     In embedded scroll mode the app projects the front
//                     pane's four bounding corners through the live camera
//                     each frame and posts the pane's upper screen-space
//                     edge to the parent as {type:'glass-edge', a, b} in
//                     normalized viewport coords (0–1, y-down). The parent
//                     Framer driver uses that line as the clip boundary for
//                     the "just the glass" reveal — physically locked, not
//                     a timed approximation.
//   DUMB EMITTER      All reveal thresholds (arming, hysteresis) live on
//                     the Framer side. The emitter only reports geometry,
//                     epsilon-gated so it is silent when nothing moves.
//   PARENT PROGRESS   scrollState.parentProgress now records the parent
//                     page's scroll progress in scroll mode; the edge
//                     payload carries it for diagnostics.
//
// ============================================

// ============================================
// v7.5.8 — PATH OVERLAY REMOVAL
//
//   OVERLAY REMOVAL   The 3D path line, node markers, playhead, wireframe
//                     ghosts and selected-node drag handles are no longer
//                     mounted in the scene. Path data and 2D controls remain.
//
// ============================================

// ============================================
// v7.5.7 — COINCIDENT-NODE + THUMBNAIL INTEGRITY FIXES
//
//   STATIC LEGS       Consecutive nodes at the same Stage XYZ now retain
//                     their authored time and interpolate non-spatial pose
//                     channels instead of collapsing to the curve midpoint.
//   NODE TRACKING      Spatial ties use authored timeline position, so the
//                     active-node indicator can distinguish static nodes.
//   LEGACY GLASS       Missing glass-registration keys resolve to the defined
//                     home values on both sides of an interpolation.
//   PATH THUMBNAILS    New saved-path versions retain their own ordered node
//                     thumbnails instead of reading later slot replacements.
//   THUMB BACKFILL     Clicking a filled "no render" pose captures its exact
//                     restored view automatically; no extra UI is added.
//
// ============================================

// ============================================
// v7.5.6 — VISUAL POSE + SAVED-PATH LIBRARIES
//
//   POSE BROWSER      The 100-slot working library is now a four-column grid
//                     of the real WebGL thumbnails captured with each pose.
//                     Existing filled slots 101–150 remain visible so older
//                     studio data and path references are never discarded.
//   DIRECT DELETE     Select a pose thumbnail, then use the single Delete
//                     action. The former refresh/clear/move/copy/swap card is
//                     removed.
//   PATH STORYBOARDS  Every saved path shows its ordered node thumbnails.
//   UI CLEANUP        Production Preset, 3D Path, Ghosts and Drag Handles
//                     controls are removed without changing path data.
//
// ============================================

// ============================================
// v7.5.5 — REFLECTION LIGHTING / NO PROJECTED SHADOWS
//
//   Removes all v7.5.3 mesh shadow flags, PCSS soft-shadow injection and
//   shadow-key configuration. The premium Lightformer reflections and direct
//   material lighting remain unchanged.
//
// ============================================

// ============================================
// v7.5.4 — MATERIAL LIGHTING ONLY
//
//   Removes the v7.5.3 landing shadow catcher and its controls. The studio
//   reflection cards and phone self-shadowing remain; no shadow is projected
//   onto the transparent canvas or surrounding page.
//
// ============================================

// ============================================
// v7.5.3 — PREMIUM LIVE STUDIO LIGHTING
//
//   REFLECTION RIG  The existing custom Lightformer environment is enabled
//                   with a narrower, brighter hero strip for edge definition.
//   REAL SHADOWS    Opaque phone components now cast/receive one configured
//                   dynamic key shadow with PCSS softening.
//   LANDING SHADOW  A transparent shadow-only catcher fades in near the end
//                   of motion-path playback; the CSS page remains visible.
//
// ============================================

// ============================================
// v7.5.2 — UNDERSIDE CRACK VISIBILITY
//
//   BACKSIDE LAYER   A separate BackSide crack material makes the fracture
//                    visible from the gap between the lifted glass and OLED.
//   SAFE OCCLUSION   depthTest stays enabled on the underside layer, so the
//                    chassis still hides it when the phone is viewed behind.
//   LIVE CONTROLS    Independent underside shade, opacity, reflection and
//                    roughness controls do not alter the existing front crack.
//
// ============================================

// ============================================
// v7.5.1 — CRACK FADE + LANDED-GLASS SHINE
//
//   CRACK FADE       crackOn remains the saved node truth, but path playback
//                    now interpolates a render presence between OFF and ON.
//                    Severity and sharpness continue to interpolate with it.
//   TERMINAL SHINE   The automatic sweep remains appended after the final
//                    node when glass registration is exactly back at home.
//                    Its production defaults match the approved look.
//
// ============================================

// ============================================
// v7.5.0 — CURRENT-PATH IMPORT
//
//   ROUND TRIP       The current-path-only AI JSON can now be imported after
//                    external editing without requiring a full studio backup.
//   SCOPED RESTORE   Import restores only the pose slots referenced by that
//                    path. Unrelated slots and the saved-path library remain.
//
// ============================================
// v7.4.9 — SPLIT CURRENT-PATH / STUDIO EXPORTS
//
//   CURRENT PATH     A dedicated AI-readable export contains exactly the
//                    currently loaded path and one resolved pose per node.
//                    It excludes saved paths, unreferenced slots and thumbs.
//   EXPLICIT IDS     Nodes carry one-based UI node/slot numbers alongside
//                    clearly labelled zero-based internal indexes.
//   FULL BACKUP      The former monolithic export remains available under the
//                    explicit "full studio backup" label for restoration.
//
// ============================================
// v7.4.8 — AUTHORITATIVE SLOT/PATH SAVES
//
//   SYNCHRONOUS STORE Every slot mutation updates one authoritative ref before
//                     React rendering or localStorage persistence. Path saves
//                     and JSON exports read that ref, never a stale closure.
//   SAVE VALIDATION   Each path snapshot is compared with its source slots
//                     before it can enter the version library or download.
//                     A mismatch aborts the operation instead of losing work.
//   AUDIT METADATA    Saved versions and studio exports record the application
//                     version, snapshot source, slot revision and timestamp.
//
// ============================================
// v7.4.7 — SAVED PATH POSE SNAPSHOTS
//
//   VERSION RESTORE  Loading a saved path/version restores its embedded node
//                    poses into the referenced named slots before activation.
//                    Historical Glass Registration values therefore survive
//                    later edits made to those same slots in another path.
//   SNAPSHOT PLAY    PLAY resolves the saved snapshot first, then activates
//                    and animates that exact restored slot state.
//   CURRENT SAVES    New paths/versions still snapshot the current named-slot
//                    poses; active editable paths remain live-linked to slots.
//
// ============================================
// v7.4.6 — LIVE PATH/SLOT POSE SYNCHRONISATION
//
//   SLOT AUTHORITY   A motion node now reads the current named-slot pose when
//                    that slot exists. An embedded pose is used only when its
//                    referenced slot is unavailable.
//   EXPORT REFRESH   Studio exports and saved path versions refresh embedded
//                    fallback poses from the current named slots, preventing
//                    old Glass Registration values from being re-exported.
//   CONSISTENT UI    Playback, position display, previews and saved versions
//                    all resolve node poses through the same precedence rule.
//
// ============================================
// v7.4.5 — GIZMO MODIFIER-STATE STABILITY
//
//   SNAP LIFETIME    Shift snapping is now scoped to an active canvas drag.
//                    Pose-slot confirmation dialogs can no longer swallow
//                    key-up and leave the gizmo stuck at 0.1-unit snapping.
//   FAIL-SAFE CLEAR  Pointer release/cancel, blur and hidden-tab transitions
//                    all clear transient snap state without a page refresh.
//
// ============================================
// v7.4.4 — MORE SEVERE CRACK ASSET
//
//   CRACK ASSET      Denser bottom-right fracture pattern with stronger
//                    primary spines and substantially more fine branches.
//                    Lighting, material, registration and motion unchanged.
//
// ============================================
// v7.4.3 — RESTORED SPATIAL-VELOCITY GRAPH
//
//   PATH DIAGNOSTIC  Motion Path Preview again plots spatial velocity
//                    |v|(t), with average/max u/s and a live playhead.
//                    Sampling is read-only and does not alter path motion.
//
// ============================================
// v7.4.2 — CRACK POSITION DEFAULTS + SLOT OVERRIDES
//
//   DEFAULT POSITION  One persistent X/Y default is inherited by every
//                     legacy and new pose slot unless that slot is explicitly
//                     saved with a manual crack-position override.
//   PATH RESOLUTION   Embedded node poses no longer revive stale crack X/Y
//                     values when their slot is using the default position.
//   MANUAL OVERRIDE   Switch off "use default position", set manual X/Y, then
//                     save the pose; the override state saves with the slot.
//
// ============================================
// v7.4.1 — REPLACEMENT CRACK + APPEARANCE CONTROL
//
//   CRACK ASSET      Bottom-right impact pattern with long sparse fractures
//                    radiating upward and left, supplied as Crack.webp.
//   SEVERITY         Controls fracture visibility without changing CRACK ON.
//   SHARPNESS        Controls the alpha-edge profile of the crack texture.
//                    Both values save in pose slots and interpolate in paths.
//
// ============================================
// v7.4.0 — HYBRID NODE TIMING
//
//   HYBRID PATH      Continuous and custom-timed legs can coexist in one
//                    path. Each destination node inherits the path default
//                    or overrides its incoming leg as continuous/custom.
//   NODE HOLDS       Holds are independent of the path default. A held node
//                    can decelerate on arrival and accelerate on departure
//                    while untouched nodes remain continuously sampled.
//   NODE PANEL       Motion controls replace the always-visible XYZ editors.
//                    Position overrides remain available in a collapsed area.
//   COMPATIBILITY    v2 paths import into the v3 hybrid schema without losing
//                    their continuous/per-leg default or authored timing.
//
// ============================================
// v7.3.2 — MOTION CONTROL FINESSE
//
//   GLASS TIMING     Separate OUT and RETURN easing/strength controls are
//                    saved with each motion path. RETURN span can complete
//                    the glass move earlier inside its incoming camera leg.
//   EASE STRENGTH    Global continuous easing and each per-leg ease now have
//                    a 0–100% amount control. 100% preserves prior output.
//   OLED BOND        One explicit action registers the glass over the OLED
//                    at the current teardown P without changing P or OLED.
//   NUMBER STEPPERS  Enlarged throughout the development dashboard.
//   PER-LEG UI      In per-leg timing mode the advanced easing controls now
//                    edit the selected incoming leg instead of appearing as
//                    disabled global controls. Entering the mode selects the
//                    first destination node when no leg is already selected.
//
// ============================================
// v7.3.0 — HYBRID: v7.2 MOTION RIG × v3.11 GLASS LAW
//
//   ChatGPT's motion studio (150 named slots, path engine, unlimited
//   saved-path library, bridge generator) is kept in full. Three silent
//   re-litigations of v3.11 decisions are reverted, and three defects
//   are fixed:
//
//   CRACK LAW        ON/OFF + X/Y registration ONLY. Opacity and Z are
//                    culled again — a crack is not translucent and has
//                    no depth of its own. The boolean saves into every
//                    pose slot; THAT is the glass swap.
//   GLASS REG ±25    Restored (v7.2 had reverted it to ±1 — a quarter of
//                    a phone-width, nowhere near out of shot). ±25
//                    carries the glass unit fully out of frame. Glass
//                    reg is now ALSO a first-class pose/path parameter:
//                    saved in slots, interpolated by motion paths,
//                    wireable in compound motion — so the swap move
//                    (drive out → crack OFF → drive back) can be
//                    choreographed by the rig.
//   BEZEL PARENTING  Reverted to what it has always been: pane + bezel +
//                    crack are ONE glass unit and travel together.
//   pathPreview      v7.2 set it once and never cleared it — one path
//                    scrub killed render damping for the whole session.
//                    Now a one-frame flag re-armed by the path engine.
//   swap             Dead code (reinstated in phaseMap, consumed
//                    nowhere). Removed again.
//   front-glass      v7.1's exact-name routing is KEPT — "Back Glass"
//                    can no longer be caught by a generic glass test.
//
// ============================================
// v7.2.0 — PATH LIBRARY CONSOLIDATION + COMPOUND CONTROL
//
//   Separated front glass keeps a visible neutral optical body. Saved motion
//   paths and unlimited versions now live in one playable list. The redundant
//   snippet/A-B-C systems and their diagnostic UI are removed. Compound
//   motion uses human labels and Driven B can be disabled for double motion.
//
// ============================================
// v7.1.2 — TRANSPARENT SWEEP + RESTORED CRACK STATE
//
//   The sweep shader now writes zero alpha wherever it has no visible
//   highlight instead of painting the entire front pane opaque black.
//   Crack visibility is again an explicit saved control and is no longer
//   forcibly disabled by teardown timeline progress.
//
// ============================================
// v7.1.1 — FRONT-GLASS ROUTING + CRACK RESTORATION
//
//   "Back Glass" is no longer caught by the generic glass-name test and
//   moved as though it were the transparent front pane. The crack asset is
//   restored as a default import, rendered as the outermost surface, and
//   parented to the moving front glass so its registration cannot drift.
//
// ============================================
// v7.1 — CONTROL PLACEMENT + GLASS/BEZEL DECOUPLING
//
//   The top-left slider is the original teardown timeline `p`. Motion-path
//   scrub/preview lives below the path nodes. Reflection controls no longer
//   depend on a master checkbox. (Its bezel decoupling is REVERTED in
//   v7.3.0 — the bezel rides the glass unit, as it always has.)
//
// ============================================
// v7.0 — PRODUCTION MOTION STUDIO
//
//   Simplified production preset, one compound-motion editor, unified top
//   playhead with live node following, reusable motion snippets, and A/B/C
//   path comparison. The clean-glass sweep now begins visibly at 0 and sits
//   over a neutral transparent pane instead of a black-tinted substrate.
//
// ============================================
// v6.0 — PREMIUM GLASS LAB
//
//   Deterministic clean-glass reflection sweep, Fresnel edge sheen,
//   optical micro-bevel, controlled glint/halo, subtle iridescence,
//   optional physical transmission, and a custom softbox environment.
//
//   `shine` is a pose parameter. Save it in slots exactly like position
//   or rotation; motion paths interpolate it and ?mp capture reproduces it
//   without elapsed time, randomness, or localStorage.
//
// ============================================
// v5.0 — CREATIVE MOTION STUDIO
//
//   150 named pose slots with thumbnails, safe move/copy/swap, search and
//   automatic path-reference remapping. Existing v4 100-slot stores migrate.
//
//   Centripetal Catmull-Rom, optional arc-length timing, continuous global
//   easing, independent quaternion/tangent/look-at orientation, banking,
//   editable spatial handles, visible path/node/playhead/ghost overlays,
//   bridge generation, bulk timing tools, diagnostics, undo/redo, JSON
//   import/export, and named/versioned path presets.
//
//   Triple compound motion: one master drives two independent parameters.
//
// ============================================
// v4.0 — SLOT-BASED MOTION PATH STUDIO
//
//   POSE SLOTS -> PATH   Ctrl/Cmd-click filled slots to append them to an
//                        ordered path. Each incoming leg owns its duration,
//                        arrival hold, and easing. Paths persist locally.
//
//   MOTION TESTING       Preview, pause, restart, loop, scrub, switch between
//                        straight and Catmull-Rom stage travel, and compare
//                        easing curves without changing the saved poses.
//
//   CAPTURE CONTRACT     "copy preview URL" embeds every pose into the URL;
//                        "path manifest" emits the existing capture manifest
//                        with sweepParam "mp". Therefore ?snap=1&mp=0.5000
//                        renders one exact path pose in a fresh browser with
//                        no dependency on localStorage.
//
// ============================================
// v3.11 — THE CRACK IS THE GLASS (the law this hybrid restores)
//
//   A crack has no velocity of its own. The cracked pane is a CHILD of
//   the glass unit; its only truths are whether it exists and where the
//   fracture sits on the pane. crack ON/OFF is saved into the pose slot
//   with everything else — pose A wears the crack, pose B does not.
//   v3.11.1 added depthTest:false: docked at p=0 the pane is not reliably
//   proud of the opaque OLED slab (the Blender mesh defect), so the crack
//   lost the depth test and vanished at p=0 only.
//
// ============================================
// v3.9 — GLASS MATERIAL, IBL SOFTNESS, AND THE CRACKED-GLASS LAYER
//
//   THE HARD CIRCLE     It is not a light. It is a REFLECTION. Glass_Front
//                       ran roughness 0.04 — that is a mirror — and
//                       Environment preset="studio" is a virtual photo
//                       studio whose HDRI contains actual softbox panels.
//                       A mirror reflects a softbox as a hard-edged bright
//                       shape. That is the circle.
//
//   SHINIER GLASS       Glass_Front is MeshPhysicalMaterial: the clearcoat
//                       is a second specular layer over the base, with its
//                       own roughness — the lacquer-over-paint model.
//
//   CRACKED GLASS       No Blender. No second GLB. Glass_Front is a FLAT
//                       1216-vert plane with TEXCOORD_0, so the cracked
//                       pane is its geometry, cloned in code, with a crack
//                       PNG on it. crackTexture is an optional prop; absent,
//                       the whole layer costs nothing and renders nothing.
//
// ============================================
// v3.8.x — lighting rig + ACES, OLED slab three-way face split, bezel
//          dials, contact shadow removed, keyboard tap-vs-hold drive.
// v3.7 — trackball ring (orientation-independent), 100 pose slots, labels.
// v3.6 — timeline locks abolished, auto target routing, smooth square-up.
// v3.5 — glass-reg baked (x -0.03, y 0.09, z 0.07), Leva reinstated.
// v3.4 — sat-nav HUD, true square-up (quaternion), panel-aware gizmo.
// v3.3 — glass registration folder, body emission kill.
// v3.2 — hierarchy bake (anchored rebase).
// v3.1 — proxy-anchored gizmo, fat handles, click-to-target.
// v3.0 — world/local, wiring, snapshots. v2.9 — screen-space arrow drive.
// ============================================
let CAPTURE_SNAP = false;
let SNAP_FRAMES = 0;

// ============================================
// RENDER LIFECYCLE (v7.5.18)
//
// This section governs WHEN the renderer runs, never WHAT it draws.
// ============================================

// Parent origin, resolved once by the scene component and cached here so
// low-level canvas handlers can report without prop-drilling.
const IFRAME = { parentOrigin: "*" };

function postToParent(payload) {
  if (typeof window === "undefined" || window.self === window.top) return;
  try {
    window.parent.postMessage(
      { version: IGLASS_APP_VERSION, ...payload },
      IFRAME.parentOrigin
    );
  } catch (e) {
    /* parent gone or origin mismatch -> silent */
  }
}

// ============================================
// POSTER-FIRST LOAD (v7.5.19)
//
// The poster element is authored in public/index.html, above #root, so it
// paints at HTML parse time. Nothing here creates it; this module only
// dismisses it. Dismissal rides the existing scene-ready signal, which
// already means GLB decoded + textures uploaded + one full frame drawn —
// so the pixels behind the poster are the identical p=0 composition and
// the cross-fade has nothing to reveal but itself.
//
// A/B arms, both set on the iframe src by the Framer embed:
//   ?poster=1  (or omitted)  poster shown  — arm A
//   ?poster=0                poster removed at parse — arm B (control)
// Tuning:
//   ?posterhold=<ms>   minimum ms from navigation start before the poster
//                      may leave, so a warm cache cannot produce a flash
//   ?posterfade=<ms>   cross-fade duration (default 420)
// ============================================

const POSTER = {
  el: null,
  resolved: false,
  dismissed: false,
  fadeMs: 420,
  minHoldMs: 0,
};

function posterResolve() {
  if (POSTER.resolved || typeof document === "undefined") return;
  POSTER.resolved = true;
  POSTER.el = document.getElementById("iglass-poster");
  try {
    const q = new URLSearchParams(window.location.search);
    const hold = parseInt(q.get("posterhold"), 10);
    if (!isNaN(hold)) POSTER.minHoldMs = Math.max(0, Math.min(4000, hold));
    const fade = parseInt(q.get("posterfade"), 10);
    if (!isNaN(fade)) POSTER.fadeMs = Math.max(0, Math.min(2000, fade));
  } catch (e) {
    /* no search params -> defaults */
  }
}

// Never called on the webgl-unavailable path, so a blocked scene keeps the
// poster as its still fallback rather than fading to nothing.
function posterDismiss() {
  posterResolve();
  const el = POSTER.el;
  if (!el || POSTER.dismissed) return;
  POSTER.dismissed = true;

  const run = () => {
    el.style.transition = `opacity ${POSTER.fadeMs}ms ease-out`;
    el.style.opacity = "0";
    window.setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, POSTER.fadeMs + 80);
  };

  // performance.now() is ms since navigation start, so it IS the elapsed
  // visible time — no separate shownAt bookkeeping to drift.
  const elapsed = typeof performance !== "undefined" ? performance.now() : 0;
  const remaining = Math.max(0, POSTER.minHoldMs - elapsed);
  if (remaining > 0) window.setTimeout(run, remaining);
  else run();
}

// ============================================
// LOAD TIMING (v7.5.19)
//
//   boot      this bundle finished executing
//   assets    GLB decoded, textures uploaded, phone mesh exists — measured
//             at the top of the FIRST frame that draws it
//   ready     top of the second frame; the boot->assets gap is transfer
//             and decode, the assets->ready gap is first-draw shader
//             compile, which is where old GPUs actually hurt
//   complete  authored path finished
//
// Read on-device with window.__iglassTiming, or listen for iglass-timing
// in the parent. Each mark fires once; re-marks are ignored.
// ============================================

const TIMING = {
  boot: null,
  assets: null,
  ready: null,
  complete: null,
};

function markTiming(key) {
  if (!(key in TIMING) || TIMING[key] !== null) return;
  TIMING[key] =
    typeof performance !== "undefined" ? Math.round(performance.now()) : 0;
  if (typeof window !== "undefined") window.__iglassTiming = TIMING;
  postToParent({
    type: "iglass-timing",
    mark: key,
    t: TIMING[key],
    marks: { ...TIMING },
  });
}

// After the authored path completes, keep rendering for this many frames so
// the existing damped lerps settle exactly as they do today, then stop. No
// damping value is changed, so the final held image is unaltered.
const IDLE_AFTER_COMPLETE_FRAMES = 45;

const RENDER_GOV = {
  idleCountdown: -1,    // frames left before idling; -1 = inactive
  suspended: false,     // document hidden, or parent reports off-screen
  finished: false,      // authored path has completed
  invalidate: null,     // R3F invalidate handle
  setFrameloop: null,   // Canvas frameloop setter
  contextLost: false,
  probeFailure: null,
};

// The studio needs a live loop for Leva/gizmo work, and deterministic
// capture needs frames on demand. Neither may ever be parked.
function renderGovernorLocked() {
  return DEV.enabled || CAPTURE_SNAP;
}

function renderGovernorActivate() {
  RENDER_GOV.idleCountdown = -1;
  if (RENDER_GOV.setFrameloop) RENDER_GOV.setFrameloop("always");
  if (RENDER_GOV.invalidate) RENDER_GOV.invalidate();
}

function renderGovernorIdle() {
  RENDER_GOV.idleCountdown = -1;
  if (renderGovernorLocked()) return;
  if (RENDER_GOV.setFrameloop) RENDER_GOV.setFrameloop("demand");
}

function renderGovernorFinish() {
  RENDER_GOV.finished = true;
  if (renderGovernorLocked()) return;
  RENDER_GOV.idleCountdown = IDLE_AFTER_COMPLETE_FRAMES;
}

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    return false;
  }
}

// Pre-flight capability probe on a THROWAWAY canvas. Running the check here
// rather than passing failIfMajorPerformanceCaveat to the live renderer means
// a failure never throws inside R3F: we simply do not mount, and the parent
// keeps its poster.
function webglCapabilityProbe() {
  if (typeof document === "undefined") {
    return { ok: false, reason: "no-document" };
  }
  let canvas = null;
  try {
    canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const attrs = {
      alpha: true,
      antialias: false,
      depth: true,
      failIfMajorPerformanceCaveat: true,
    };
    const ctx =
      canvas.getContext("webgl2", attrs) || canvas.getContext("webgl", attrs);
    if (!ctx) {
      return { ok: false, reason: "major-performance-caveat-or-unsupported" };
    }
    const lose = ctx.getExtension("WEBGL_lose_context");
    if (lose) lose.loseContext();
    return { ok: true, reason: null };
  } catch (e) {
    return { ok: false, reason: "probe-threw" };
  } finally {
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

// WebKit drops the GL context under memory pressure. preventDefault() on the
// lost event is what makes a later restore possible at all; without it the
// canvas is dead permanently and the hero silently disappears.
function attachContextGuards(gl) {
  const el = gl && gl.domElement;
  if (!el || el.__iglassContextGuards) return;
  el.__iglassContextGuards = true;

  el.addEventListener(
    "webglcontextlost",
    (event) => {
      event.preventDefault();
      RENDER_GOV.contextLost = true;
      postToParent({ type: "iglass-context-lost" });
    },
    false
  );

  el.addEventListener(
    "webglcontextrestored",
    () => {
      RENDER_GOV.contextLost = false;
      postToParent({ type: "iglass-context-restored" });
      if (!RENDER_GOV.suspended && !RENDER_GOV.finished) {
        renderGovernorActivate();
      } else if (RENDER_GOV.invalidate) {
        RENDER_GOV.invalidate();
      }
    },
    false
  );
}

// ============================================
// Utility
// ============================================
function mapRange(value, inMin, inMax, outMin, outMax) {
  const clamped = Math.max(inMin, Math.min(inMax, value));
  if (inMax === inMin) return outMin;
  return outMin + ((clamped - inMin) / (inMax - inMin)) * (outMax - outMin);
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function wrapDeg(rad) {
  let d = (rad * 180) / Math.PI;
  d = ((((d + 180) % 360) + 360) % 360) - 180;
  if (d === -180) d = 180;
  return Number(d.toFixed(2));
}

// ---------------------------------------------------------
// TRUE SQUARE-UP maths — nearest axis-aligned ORIENTATION.
// ---------------------------------------------------------
function nearestCardinal(v) {
  const ax = Math.abs(v.x),
    ay = Math.abs(v.y),
    az = Math.abs(v.z);
  if (ax >= ay && ax >= az)
    return new THREE.Vector3(Math.sign(v.x) || 1, 0, 0);
  if (ay >= az) return new THREE.Vector3(0, Math.sign(v.y) || 1, 0);
  return new THREE.Vector3(0, 0, Math.sign(v.z) || 1);
}

function snapQuatTo90(q) {
  const m = new THREE.Matrix4().makeRotationFromQuaternion(q);
  const e = m.elements;
  const xCol = new THREE.Vector3(e[0], e[1], e[2]);
  const yCol = new THREE.Vector3(e[4], e[5], e[6]);

  const sx = nearestCardinal(xCol);

  const yAdj = yCol.clone().sub(sx.clone().multiplyScalar(yCol.dot(sx)));
  if (yAdj.lengthSq() < 1e-6) {
    yAdj.set(sx.x ? 0 : 1, sx.x ? 1 : 0, 0);
  }
  let sy = nearestCardinal(yAdj);
  if (Math.abs(sx.dot(sy)) > 0.5) {
    sy = new THREE.Vector3(1, 0, 0).cross(sx);
    if (sy.lengthSq() < 1e-6) sy = new THREE.Vector3(0, 1, 0).cross(sx);
    sy.normalize();
  }

  const sz = new THREE.Vector3().crossVectors(sx, sy).normalize();
  sy.crossVectors(sz, sx).normalize();

  const snapped = new THREE.Matrix4().makeBasis(sx, sy, sz);
  return new THREE.Quaternion().setFromRotationMatrix(snapped);
}

// ============================================
// Timeline phases
// ============================================
const TIMELINE = {
  explodeEnd: 0.35,
  holdEnd: 0.45,
  reassembleEnd: 0.7,
};

const START = {
  tilt: Math.PI / 10, // 18°
};

const SETTLE = {
  targetEuler: [0, Math.PI, 0],
  scale: 0.8,
  xShiftFraction: 0.22,
  yShiftFraction: 0,
  arcLift: 0.08,
  desktopMinWidth: 810,
};

const STAGE = {
  position: [0, 0, 0],
  rotationEuler: [0, 0, 0],
  scale: 1,
};

const MODEL = {
  targetSize: 1.6,
};

const GLASS_REG_HOME = Object.freeze({ x: -0.03, y: 0.09, z: 0.07 });
const GLASS_REG = { ...GLASS_REG_HOME };
const GLASS_REG_TRIGGER_EPSILON = 0.0001;

// ±35 (v7.5.26). The model measures ~15.7 local units tall fitted
// to 1.6 world units, so 1 slider unit ≈ 0.1 world units and the visible
// frame is ~3.1 world units across. Clearing the frame needs ≈19 units;
// ±35 gives mobile removal poses extra clearance and carries the whole glass
// unit (pane + bezel + crack) clean out of shot and back.
const GLASS_REG_RANGE = 35;

// ============================================
// LIGHT (v3.8) — the whole lighting rig as one tunable config.
//
// WHY THIS EXISTS: the old rig hard-coded ambient 0.8 + directional 1.5 +
// directional 0.8 + point 0.5 + a studio IBL, then rendered with
// NoToneMapping. That is five sources with no highlight rolloff — every
// metal surface (chassis and buttons are metalness 1.0, i.e. mirrors)
// clipped flat to white. The fix is not a magic number, it is a DIAL, so
// the reference render can be matched by eye rather than by guess.
//
//   amb   ambient fill. The form-killer if pushed. Start LOW.
//   key   main directional — this is what creates the gradient.
//   fill  cool rim/fill directional from the opposite side.
//   env   studio IBL contribution (scene.environmentIntensity).
//         The IBL is *also* an ambient source — amb + env stack.
//   exp   ACES tone-mapping exposure. Rolls highlights off instead of
//         clipping them. This is what stops the blowout.
//
// Overridable: ?light=amb,key,fill,env,exp,keyX,keyY,keyZ,keyK,fillX,fillY,fillZ,fillK
// ============================================
const LIGHT = {
  amb: 0.05,
  key: 1.2,
  fill: 0.25,
  env: 0.5,
  exp: 1.0,
  keyPosition: [5, 10, 5],
  fillPosition: [-6, 3, 4],
  keyTemperature: 6500,
  fillTemperature: 9000,
  preset: "studio", // the HDRI whose SHAPES get reflected in the glass
  blur: 0.0, // blurs the IBL itself — softens every reflection at once
};

const ENV_PRESETS = [
  "studio",
  "apartment",
  "city",
  "lobby",
  "warehouse",
  "dawn",
  "sunset",
  "park",
  "forest",
  "night",
];

// ---------------------------------------------------------
// BEZEL (v3.8.1) — dials, because the black-rim cause is UNRESOLVED.
//
// Two candidates for the faint black rim on the OLED edge and the front
// outward edge, and a screenshot cannot separate them:
//   (a) the bezel is now DEAD black (env 0, rough 1.0), so its rim
//       geometry — which was always drawn — is finally conspicuous
//   (b) offset -4 pushes it in front of the chassis edge at grazing
//       angles, expanding its visible footprint
//
// Confidence is MEDIUM/MEDIUM, which is a hard stop. So: dials, not a
// guess. Drag "depth push" toward 0 — if the rim goes, it was (b). If it
// doesn't, raise "black level" off 0 until the rim reads as glossy trim
// instead of an outline; that means it was (a).
//
// Overridable: ?bezel=env,rough,offset
// ---------------------------------------------------------
// ---------------------------------------------------------
// OLED (v3.8.4) — the front/back face-split threshold.
//
// Each triangle of the Display_OLED slab is classified by its UNIT normal
// Z. nz < faceCut takes the screen texture; everything else goes black.
//
//   front cap  nz ~ -1.0     back cap  nz ~ +1.0     rim  nz ~ 0.0
//
// -0.5 sits in the gap. -1.0 would starve the cap; 0.0 is the v3.8 bug.
// Overridable: ?oled=faceCut,showRim,luminance
// ---------------------------------------------------------
const OLED = {
  faceCut: -0.5,
  showRim: false, // the slab's side wall — artefact, hidden by default
  luminance: 1,
};

const LIGHT_TEMPERATURE_MIN = 2000;
const LIGHT_TEMPERATURE_MAX = 12000;
const LIGHT_KEY_BASE_SRGB = [1, 1, 1];
const LIGHT_FILL_BASE_SRGB = [0xe8 / 255, 0xf0 / 255, 1];

function clampLightPosition(value) {
  return Math.max(-20, Math.min(20, Number(value) || 0));
}

function clampLightTemperature(value) {
  return Math.max(
    LIGHT_TEMPERATURE_MIN,
    Math.min(LIGHT_TEMPERATURE_MAX, Number(value) || 6500)
  );
}

function temperatureSrgb(temperature) {
  const t = clampLightTemperature(temperature) / 100;
  const clampByte = (value) => Math.max(0, Math.min(255, value)) / 255;
  const red = t <= 66
    ? 255
    : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const green = t <= 66
    ? 99.4708025861 * Math.log(t) - 161.1195681661
    : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const blue = t >= 66
    ? 255
    : t <= 19
    ? 0
    : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [clampByte(red), clampByte(green), clampByte(blue)];
}

function setTemperatureTint(target, temperature, neutral, baseSrgb) {
  const color = temperatureSrgb(temperature);
  const anchor = temperatureSrgb(neutral);
  const corrected = color.map((channel, index) =>
    Math.max(
      0,
      Math.min(1, channel * (baseSrgb[index] / Math.max(0.000001, anchor[index])))
    )
  );
  target.setRGB(corrected[0], corrected[1], corrected[2], THREE.SRGBColorSpace);
  return target;
}

function animatedLightingPoseDefaults() {
  return {
    oledLuminance: OLED.luminance,
    lightAmbient: LIGHT.amb,
    lightKey: LIGHT.key,
    lightFill: LIGHT.fill,
    lightEnvironment: LIGHT.env,
    exp: LIGHT.exp,
    lightKeyX: LIGHT.keyPosition[0],
    lightKeyY: LIGHT.keyPosition[1],
    lightKeyZ: LIGHT.keyPosition[2],
    lightKeyTemperature: LIGHT.keyTemperature,
    lightFillX: LIGHT.fillPosition[0],
    lightFillY: LIGHT.fillPosition[1],
    lightFillZ: LIGHT.fillPosition[2],
    lightFillTemperature: LIGHT.fillTemperature,
  };
}

function withAnimatedLightingDefaults(pose) {
  if (!pose || typeof pose !== "object") return pose;
  const next = { ...pose };
  const defaults = animatedLightingPoseDefaults();
  for (const [key, value] of Object.entries(defaults)) {
    if (!Number.isFinite(next[key])) next[key] = value;
  }
  return next;
}

// ---------------------------------------------------------
// GLASS (v3.9) — the front pane's material, as dials.
//
//   rough      THE softness control for the studio-light circle. 0.04 is a
//              mirror and reflects the HDRI's softbox as a hard shape.
//              0.10-0.30 spreads it into a soft bloom. Costs nothing —
//              roughness reads the env map's prefiltered mip chain.
//   env        reflection BRIGHTNESS (envMapIntensity), independent of
//              spread. Turn this down and up separately from rough and the
//              two together give you the full highlight.
//   opacity    how much the pane darkens what is under it.
//   clearcoat  the second specular layer — the lacquer coat. This is the
//              "expensive glass" lever.
//   ccRough    the clearcoat's OWN roughness. Lets the coat highlight stay
//              tight while the base reflection goes soft, or vice versa.
// Overridable: ?glass=rough,env,opacity,clearcoat,ccRough
// ---------------------------------------------------------
const GLASS = {
  color: 0xa8b6b0,
  rough: 0.12,
  env: 1.4,
  opacity: 0.18,
  clearcoat: 1.0,
  ccRough: 0.06,
};

// The crack carrier is mostly transparent, so it needs a little more IBL
// response than the clean pane for reflected cards to remain legible.
const CRACK_REFLECTION_BOOST = 1.35;

function crackReflectionIntensity() {
  return Math.max(0, Math.min(4, GLASS.env * CRACK_REFLECTION_BOOST));
}

// ---------------------------------------------------------
// SHINE (v6) — the creative clean-glass layer.
//
// progress is deliberately DATA, not elapsed time. It can therefore be
// saved in a pose slot and interpolated by the motion-path engine. A value
// of 0 parks the sweep off the pane and hides the persistent edge treatment;
// 1 leaves the completed, settled premium sheen.
//
// The overlay reuses the authored Glass_Front geometry, including its true
// Dynamic Island hole. No rectangle is placed over the screen.
// range/speed define an automatic terminal pass. It is appended only when
// the LAST motion-path node returns glass registration to its home XYZ.
// ---------------------------------------------------------
const SHINE = {
  progress: 0,
  range: [0, 1],
  speed: 0.7,
  sweepStrength: 0.23,
  broadWidth: 0.23,
  stripWidth: 0.04,
  angleDeg: -41,
  persistent: 0.04,
  glint: true,
  glintStrength: 0.7,
  glintSize: 0.12,
  glintAt: 0.72,
  glintSpread: 0.055,
  glintX: 0.78,
  glintY: 0.78,
  customEnv: true,
  envBroad: 2.0,
  envStrip: 8.0,
  envRim: 1.4,
  // v7.5.26 — master intensity for the two ceiling reflection cards.
  envTop: 4.5,
  // v7.5.20 — one master for the whole left-hand card bank. 0 = the
  // v7.5.19 rig unchanged; 1 = the mirrored bank at its authored level.
  envLeft: 1.0,
};

// ---------------------------------------------------------
// TERMINAL LIGHT SWEEP (v7.5.33) — the travelling lights that follow the
// automatic glass sweep.
//
// This is the same KIND of object as SHINE's range/speed pair: it is not
// pose data, it is not authored into any motion path, and it adds no JSON
// field. It describes extra terminal phases that motionPlaybackTiming()
// appends after the glass sweep, on exactly the paths that sweep already
// qualifies for — the final node must return glass registration home.
//
// The effect is SPATIAL, never photometric. During the key phase only
// lightKeyX is overridden; during the fill phase only lightFillX. Y, Z,
// intensity, temperature, ambient, environment and exposure keep coming
// from the final authored pose, so the premium look is the light MOVING,
// not the light changing.
//
//   afterShineGap  seconds of stillness between the glass sweep finishing
//                  and the key light beginning. 0–0.10 is the useful band.
//   setup          MINIMUM seconds spent easing from the AUTHORED final X
//                  to that phase's fromX. Both production paths end with
//                  the key light a long way from +20 (-12.8 mobile, +5.0
//                  desktop), so assigning fromX instantly would be a
//                  visible lighting pop. This is that reposition, spread
//                  over a short eased entry and declared inside the
//                  terminal timeline. Set it to 0 (with matchSweepSpeed
//                  off) to accept the instant jump.
//   matchSweepSpeed  the entry is never allowed to travel FASTER than the
//                  sweep it introduces. Its distance is path-dependent —
//                  32.8 units on mobile against 15.0 on desktop — so a
//                  fixed entry would whip on one path and glide on the
//                  other. With this on, the entry span is the longer of
//                  `setup` and the distance-matched span, which keeps it
//                  visually subordinate on any path. Same easing, so
//                  matching mean speed matches peak speed.
//   duration       seconds for the sweep itself, fromX -> toX.
//
// Every value here is tunable without touching the playback engine: the
// timing model reads them, the sampler reads the timing model.
// ---------------------------------------------------------
const TERMINAL_LIGHT_FX_DESKTOP = {
  enabled: true,
  afterShineGap: 0.05,
  // v7.5.34 desktop recorded working setup — intentionally unchanged.
  base: {
    lightAmbient: 0.44,
    lightKey: 3.0,
    lightKeyY: -8.2,
    lightKeyZ: 9.4,
    lightKeyTemperature: 8800,
    lightFill: 1.2,
    lightFillY: 10.0,
    lightFillZ: -20.0,
    lightFillTemperature: 7000,
    lightEnvironment: 0.7,
    exp: 1.55,
  },
  key: {
    setup: 0.3,
    matchSweepSpeed: true,
    fromX: 20,
    toX: -20,
    duration: 0.75,
  },
  fill: {
    setup: 0.3,
    matchSweepSpeed: true,
    fromX: -20,
    toX: 20,
    duration: 0.75,
  },
};

const TERMINAL_LIGHT_FX_MOBILE = {
  enabled: true,
  afterShineGap: 0.05,
  // Recorded mobile terminal rig recovered from the authored lighting sequence.
  base: {
    lightAmbient: 0.44,
    lightKey: 3.0,
    lightKeyY: -15.0,
    lightKeyZ: 13.3,
    lightKeyTemperature: 8800,
    lightFill: 1.2,
    lightFillY: 20.0,
    lightFillZ: -20.0,
    lightFillTemperature: 7000,
    lightEnvironment: 0.7,
    exp: 1.0,
  },
  key: {
    setup: 0.3,
    matchSweepSpeed: true,
    fromX: 20,
    toX: -20,
    duration: 0.75,
  },
  fill: {
    setup: 0.3,
    matchSweepSpeed: true,
    fromX: 20,
    toX: -20,
    duration: 0.75,
  },
};

// Framer already owns the breakpoint decision. We only consume its explicit
// route signal here; desktop remains the default for every existing URL.
const TERMINAL_LIGHT_PROFILE = (() => {
  if (typeof window === "undefined") return "desktop";
  try {
    return new URLSearchParams(window.location.search).get("terminal") === "mobile"
      ? "mobile"
      : "desktop";
  } catch (e) {
    return "desktop";
  }
})();

function activeTerminalLightFx() {
  return TERMINAL_LIGHT_PROFILE === "mobile"
    ? TERMINAL_LIGHT_FX_MOBILE
    : TERMINAL_LIGHT_FX_DESKTOP;
}

// Sine in / sine out. Zero velocity at both ends, so there is no abrupt
// launch and no abrupt stop, and it cannot overshoot or bounce. A pure
// function of phase progress — nothing else.
function terminalLightEase(t) {
  const safe = Math.max(0, Math.min(1, Number(t) || 0));
  return 0.5 - 0.5 * Math.cos(Math.PI * safe);
}

// Every span in the terminal timeline goes through this, so a NaN, a
// negative or an absurd value in the config can never produce a
// non-finite duration or an out-of-order timeline.
function terminalLightSeconds(value, max = 10) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, n));
}

function terminalPhaseT(elapsed, start, duration) {
  if (!(duration > 0)) return 1;
  return Math.max(0, Math.min(1, (elapsed - start) / duration));
}

// The last authored pose, used ONLY to size the entry glide. The rendered
// anchor is the sampled pose, which is that same node (the terminal window
// begins after the path has finished); the two can differ by a final-lerp
// ulp, which is far below anything a duration is sensitive to.
function finalAuthoredPose(path) {
  const nodes = path?.nodes;
  if (!Array.isArray(nodes) || !nodes.length) return null;
  return nodes[nodes.length - 1]?.pose || null;
}

// How long the eased entry from the authored X to fromX should take. With
// matchSweepSpeed the entry covers its distance at no more than the sweep's
// own speed, so it can never out-run the move it is introducing.
function terminalEntryDuration(config, anchorX) {
  const base = terminalLightSeconds(config?.setup);
  if (config?.matchSweepSpeed !== true) return base;
  const from = clampLightPosition(config.fromX);
  const to = clampLightPosition(config.toX);
  const sweepDuration = terminalLightSeconds(config.duration);
  const sweepDistance = Math.abs(to - from);
  if (!(sweepDistance > 0) || !(sweepDuration > 0)) return base;
  const entryDistance = Math.abs(
    from - (Number.isFinite(anchorX) ? clampLightPosition(anchorX) : from)
  );
  return terminalLightSeconds(
    Math.max(base, (entryDistance / sweepDistance) * sweepDuration)
  );
}

function terminalLightTravel(from, to, t) {
  return THREE.MathUtils.lerp(from, to, terminalLightEase(t));
}

// ---------------------------------------------------------
// CRACK — presence, pane registration, and user-requested appearance controls.
//
// ON/OFF is saved into the pose slot with everything else — THAT is the
// glass swap: pose A wears the crack, pose B does not. During path playback,
// `mix` is derived from the adjacent nodes so an OFF → ON or ON → OFF change
// fades instead of popping. exit is where the fracture pattern sits on the
// pane (X/Y only — a crack has no independent depth). Severity and sharpness
// remain authored pose values and interpolate normally.
// ---------------------------------------------------------
const CRACK_DEFAULT_POSITION_KEY = "iglass_crack_default_position_v1";

function loadCrackDefaultPosition() {
  if (typeof window === "undefined") return [0.09, 0.09];
  try {
    const saved = JSON.parse(window.localStorage.getItem(CRACK_DEFAULT_POSITION_KEY));
    return Array.isArray(saved) && saved.length === 2 && saved.every(Number.isFinite)
      ? saved.map((v) => Math.max(-4, Math.min(4, v)))
      : [0.09, 0.09];
  } catch (e) {
    return [0.09, 0.09];
  }
}

function persistCrackDefaultPosition(position) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CRACK_DEFAULT_POSITION_KEY, JSON.stringify(position));
  } catch (e) {
    /* storage blocked -> default remains session-only */
  }
}

const initialCrackDefaultPosition = loadCrackDefaultPosition();

const CRACK = {
  on: true,
  mix: 1,
  defaultExit: [...initialCrackDefaultPosition],
  exit: [...initialCrackDefaultPosition],
  useDefault: true,
  severity: 1,
  sharpness: 1,
};

// Independent inner-face treatment. These values are global rendering
// controls, not pose parameters; crack timing/state still comes exclusively
// from the existing CRACK pose data.
const CRACK_UNDERSIDE = {
  enabled: true,
  shade: 0.35,
  opacity: 0.7,
  reflection: 1.55,
  roughness: 0.2,
};

// Local pane units. The source front pane sits fractionally behind the OLED
// at the docked pose; this is only enough to put the crack on the outer face.
const CRACK_SURFACE_EPSILON = 0.02;

function poseUsesDefaultCrackPosition(pose) {
  return pose?.crackUseDefault !== false;
}

function effectivePoseCrackPosition(pose) {
  if (poseUsesDefaultCrackPosition(pose)) return [...CRACK.defaultExit];
  return [pose?.crackExitX, pose?.crackExitY].every(Number.isFinite)
    ? [pose.crackExitX, pose.crackExitY]
    : [...CRACK.defaultExit];
}

// 1x1 fully transparent PNG. useTexture cannot be called conditionally
// (hooks rule), so when no crackTexture prop is supplied this loads
// instead and the crack layer is simply never mounted.
const BLANK_PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

// v7.5.34 — these three are Matthew's RECORDED working setup, the material
// state the travelling rim-light effect was visually designed against. They
// are not pose channels and they are not animated: the fill light moving
// across a bezel with a real specular lobe IS the effect, so the gloss must
// simply be there, before and after. ?bezel= still overrides all three.
const BEZEL = {
  env: 0.0,      // black level — envMapIntensity. 0 = no IBL reflection
  rough: 0.41,   // gloss — 0.41 gives the rim a specular lobe to catch the
                 // travelling fill. Was 1.0 (fully matte, nothing to catch).
  offset: -7.5,  // depth push — polygonOffset factor+units. Glass_Front sits
                 // at -2, the crack at -3, the sweep at -4; -7.5 keeps the
                 // bezel in front of all of them where they are coplanar.
};

// ============================================
// DEV RIG
// ============================================
const DEV = {
  enabled: false,
  dirtyQuat: false,
  dirtyFit: false,
  dirtyStage: true,
  dirtyLight: true, // LIGHT changed → re-apply exposure + env intensity
  applyProgress: null,
  lastP: 0,
  gizmo: "off",
  gizmoTarget: "settle",
  gizmoSpace: "local",
  gizmoDragging: false,
  lastDragEnd: 0,
  modelGroup: null,
  stageGroup: null,
  canvasEl: null,
  setLeva: null,
  driveMode: 0,
  driveGrain: 0,
  viewport: null,
  hudMode: "move",
  leftClampNDC: -0.85,
  bezelMat: null, // live handle — the bezel Leva folder writes through it
  bezelMeshes: [], // live handles — the "hide bezel" isolate toggle
  oledRimMat: null, // live handle — the "show OLED rim" toggle
  oledScreenMats: [], // live handles — pose-animated OLED luminance
  glassMat: null, // live handle — the front-glass folder
  glassPaneMesh: null, // live handle — v7.5.9 glass edge feed projection source
  crackMat: null, // live handle — the cracked-pane folder
  crackUndersideMat: null, // inner-face crack; depth-tested against the phone
  shineMat: null, // deterministic sweep / glint shader
  setEnv: null, // Scene's setter — preset/blur need a React re-render
  refreshEnvironment: null, // custom Lightformer props need a React render
  pathPreview: false, // ONE-FRAME flag: path engine owns easing this frame
  explodeDistance: 1.2,
};

function syncCrackAppearance() {
  for (const mat of [DEV.crackMat, DEV.crackUndersideMat]) {
    const uniforms = mat?.userData?.crackAppearanceUniforms;
    if (!uniforms) continue;
    uniforms.uCrackPresence.value = Math.max(0, Math.min(1, CRACK.mix));
    uniforms.uCrackSeverity.value = Math.max(0, Math.min(1, CRACK.severity));
    uniforms.uCrackSharpness.value = Math.max(0.35, Math.min(3, CRACK.sharpness));
  }
}

function syncCrackUndersideMaterial() {
  const mat = DEV.crackUndersideMat;
  if (!mat) return;
  mat.color.setScalar(Math.max(0, Math.min(1, CRACK_UNDERSIDE.shade)));
  mat.opacity = Math.max(0, Math.min(1, CRACK_UNDERSIDE.opacity));
  mat.envMapIntensity = Math.max(0, Math.min(3, CRACK_UNDERSIDE.reflection));
  mat.roughness = Math.max(0, Math.min(1, CRACK_UNDERSIDE.roughness));
  mat.visible = CRACK_UNDERSIDE.enabled && CRACK.mix > 0.0001;
  mat.needsUpdate = true;
}

// ---------------------------------------------------------
// THE ONLY PLACE CRACK ON/OFF IS SET BY A HUMAN (v7.5.20)
//
// Every UI route — the dashboard chip, the C shortcut, the Leva checkbox,
// a slot warp — goes through here. It writes the runtime truth FIRST and
// mirrors Leva afterwards, never the other way round.
//
// The bug this kills: Leva's set() does not emit when the incoming value
// already equals its cached value. Path playback writes CRACK.on directly
// (it must — it runs per frame), so Leva's cache and CRACK.on drift apart.
// Once drifted, `set({ crackOn: !CRACK.on })` could resolve to the value
// Leva already held, emit nothing, and leave CRACK.on untouched. The chip
// did nothing, the crack would not go off, and the slot saved ON.
// ---------------------------------------------------------
function setCrackOn(value) {
  const next = !!value;
  CRACK.on = next;
  CRACK.mix = next ? 1 : 0;
  syncCrackAppearance();
  syncCrackUndersideMaterial();
  if (DEV.setLeva) {
    const suspended = WIRE.suspended;
    WIRE.suspended = true;
    DEV.setLeva({ crackOn: next });
    WIRE.suspended = suspended;
  }
  return next;
}

function syncOledLuminance() {
  const luminance = Math.max(0, Math.min(1, Number(OLED.luminance) || 0));
  for (const mat of DEV.oledScreenMats) {
    if (!mat?.color) continue;
    mat.color.setScalar(luminance);
  }
}

function applyPremiumGlassMaterial() {
  const mat = DEV.glassMat;
  if (mat) {
    mat.color.setHex(GLASS.color);
    mat.roughness = GLASS.rough;
    mat.envMapIntensity = GLASS.env;
    mat.clearcoat = GLASS.clearcoat;
    mat.clearcoatRoughness = GLASS.ccRough;
    mat.opacity = GLASS.opacity;
  }
  if (DEV.crackMat) {
    DEV.crackMat.envMapIntensity = crackReflectionIntensity();
  }
}

// The dashboard and R3F scene deliberately meet through one tiny live bridge.
// Path data remains React state; the overlay only receives a compiled snapshot.
const MOTION_DEV = {
  path: null,
  progress: 0,
  selectedNode: -1,
  activeNode: -1,
  showPath: true,
  showGhosts: true,
  editHandles: false,
  version: 0,
  moveHandle: null,
  selectNode: null,
};

function atEndpoint() {
  return DEV.lastP >= 0.999;
}

function effectiveTarget() {
  return DEV.gizmoTarget === "settle" && !atEndpoint()
    ? "stage"
    : DEV.gizmoTarget;
}

// ---------------------------------------------------------
// KEYBOARD DRIVE
// ---------------------------------------------------------
const MODE_LABELS = ["MOVE", "ROTATE", "ROLL·ZOOM"];
const GRAIN_LABELS = ["fine", "mid", "coarse"];

const GRAIN_STEPS = {
  frac: [0.002, 0.01, 0.05],
  deg: [0.5, 2, 10],
  unit: [0.005, 0.02, 0.1],
  size: [0.01, 0.05, 0.25],
  p: [0.002, 0.01, 0.05],
};

// HOLD curve. Taps do not touch any of this.
//   delay  ms of continuous hold before the glide engages. Below this, a
//          tap is still just a tap.
//   ramp   ms to travel from the slow end of the glide to the fast end.
//   min/max  per-FRAME step as a multiple of the grain step. At 60 fps,
//          0.25x grain = 15 grain-steps/sec; 1.5x = 90/sec.
//   gain   live multiplier on the whole glide ("hold speed" dial).
const KEYS = {
  delay: 200,
  ramp: 900,
  min: 0.25,
  max: 1.5,
  gain: 1.0,
};

const HOLD = { keys: new Set(), raf: 0, t0: 0 };

const ARROWS = {
  ArrowLeft: ["x", -1],
  ArrowRight: ["x", 1],
  ArrowUp: ["y", 1],
  ArrowDown: ["y", -1],
};

function holdScale(elapsed) {
  if (elapsed < KEYS.delay) return 0; // still a tap — the loop stays silent
  const t = Math.min(1, (elapsed - KEYS.delay) / KEYS.ramp);
  return (KEYS.min + (KEYS.max - KEYS.min) * smoothstep(t)) * KEYS.gain;
}

function stopHold() {
  HOLD.keys.clear();
  if (HOLD.raf) cancelAnimationFrame(HOLD.raf);
  HOLD.raf = 0;
}

const SCREEN_ROT_SIGNS = { yaw: 1, pitch: -1, roll: -1 };
const HUD_ROT_SIGNS = { yaw: 1, pitch: -1, roll: 1 };

const DRIVE_MAP = {
  settle: [
    { x: null, y: null },
    { x: null, y: null },
    { x: null, y: ["size", "size", -1] },
  ],
  stage: [
    { x: ["sposX", "unit", 1], y: ["sposY", "unit", 1] },
    { x: null, y: null },
    { x: null, y: ["sscale", "size", 1] },
  ],
};

const DRIVE_READERS = {
  shift: () => SETTLE.xShiftFraction,
  vshift: () => SETTLE.yShiftFraction,
  settleX: () => (SETTLE.targetEuler[0] * 180) / Math.PI,
  settleY: () => (SETTLE.targetEuler[1] * 180) / Math.PI,
  settleZ: () => (SETTLE.targetEuler[2] * 180) / Math.PI,
  size: () => MODEL.targetSize,
  sposX: () => STAGE.position[0],
  sposY: () => STAGE.position[1],
  sposZ: () => STAGE.position[2],
  srotX: () => (STAGE.rotationEuler[0] * 180) / Math.PI,
  srotY: () => (STAGE.rotationEuler[1] * 180) / Math.PI,
  srotZ: () => (STAGE.rotationEuler[2] * 180) / Math.PI,
  sscale: () => STAGE.scale,
  tilt: () => (START.tilt * 180) / Math.PI,
  lift: () => SETTLE.arcLift,
  pscale: () => SETTLE.scale,
  shine: () => SHINE.progress,
  oledLuminance: () => OLED.luminance,
  lightAmbient: () => LIGHT.amb,
  lightKey: () => LIGHT.key,
  lightFill: () => LIGHT.fill,
  lightEnvironment: () => LIGHT.env,
  exp: () => LIGHT.exp,
  lightKeyX: () => LIGHT.keyPosition[0],
  lightKeyY: () => LIGHT.keyPosition[1],
  lightKeyZ: () => LIGHT.keyPosition[2],
  lightKeyTemperature: () => LIGHT.keyTemperature,
  lightFillX: () => LIGHT.fillPosition[0],
  lightFillY: () => LIGHT.fillPosition[1],
  lightFillZ: () => LIGHT.fillPosition[2],
  lightFillTemperature: () => LIGHT.fillTemperature,
  // v7.3 — glass reg and crack registration are first-class pose/path
  // parameters: saved in slots, interpolated by paths, wireable.
  glassRegX: () => GLASS_REG.x,
  glassRegY: () => GLASS_REG.y,
  glassRegZ: () => GLASS_REG.z,
  crackExitX: () => CRACK.exit[0],
  crackExitY: () => CRACK.exit[1],
  crackSeverity: () => CRACK.severity,
  crackSharpness: () => CRACK.sharpness,
};

const DRIVE_CLAMPS = {
  shift: [-0.5, 0.5],
  vshift: [-1, 1],
  settleX: [-180, 180],
  settleY: [-180, 180],
  settleZ: [-180, 180],
  size: [0.5, 6],
  sposX: [-3, 3],
  sposY: [-3, 3],
  sposZ: [-3, 3],
  srotX: [-180, 180],
  srotY: [-180, 180],
  srotZ: [-180, 180],
  sscale: [0.2, 3],
  tilt: [-45, 45],
  lift: [-0.5, 0.5],
  pscale: [0.2, 1.5],
  shine: [0, 1],
  oledLuminance: [0, 1],
  lightAmbient: [0, 1],
  lightKey: [0, 5],
  lightFill: [0, 3],
  lightEnvironment: [0, 3],
  exp: [0.1, 3],
  lightKeyX: [-20, 20],
  lightKeyY: [-20, 20],
  lightKeyZ: [-20, 20],
  lightKeyTemperature: [LIGHT_TEMPERATURE_MIN, LIGHT_TEMPERATURE_MAX],
  lightFillX: [-20, 20],
  lightFillY: [-20, 20],
  lightFillZ: [-20, 20],
  lightFillTemperature: [LIGHT_TEMPERATURE_MIN, LIGHT_TEMPERATURE_MAX],
  glassRegX: [-GLASS_REG_RANGE, GLASS_REG_RANGE],
  glassRegY: [-GLASS_REG_RANGE, GLASS_REG_RANGE],
  glassRegZ: [-GLASS_REG_RANGE, GLASS_REG_RANGE],
  crackExitX: [-4, 4],
  crackExitY: [-4, 4],
  crackSeverity: [0, 1],
  crackSharpness: [0.35, 3],
};

// Pose slots and motion paths may carry keys that no longer exist as Leva
// controls (crackOpacity, crackExitZ, crackSpin* …). Every write to Leva
// is filtered through this set so unknown keys never reach it and legacy
// slots warp cleanly.
const LEVA_KEYS = new Set([
  ...Object.keys(DRIVE_READERS),
  "crackOn",
  "crackUseDefault",
]);

function changeGizmoContext(targetMode) {
  if (DEV.gizmoDragging) return;
  DEV.gizmoTarget = targetMode;
  DEV.gizmoSpace = effectiveTarget() === "stage" ? "world" : "local";
  if (DEV.setLeva) DEV.setLeva({ drive: driveLabel() });
}

function setGizmoMode(v) {
  DEV.gizmo = v;
}

// ---------------------------------------------------------
// PARAMETER WIRING
// ---------------------------------------------------------
const WIREABLE = [
  "sposX", "sposY", "sposZ", "srotX", "srotY", "srotZ", "sscale",
  "shift", "vshift", "lift", "pscale", "size",
  "settleX", "settleY", "settleZ", "tilt", "shine",
  "glassRegX", "glassRegY", "glassRegZ", "crackExitX", "crackExitY",
];

const WIREABLE_OPTIONS = {
  "Stage ↔": "sposX",
  "Stage ↕": "sposY",
  "Stage depth": "sposZ",
  "Stage pitch °": "srotX",
  "Stage yaw °": "srotY",
  "Stage roll °": "srotZ",
  "Stage zoom": "sscale",
  "Phone final ↔": "shift",
  "Phone final ↕": "vshift",
  "Travel arc lift": "lift",
  "Final size": "pscale",
  "Phone fit size": "size",
  "Phone pitch °": "settleX",
  "Phone yaw °": "settleY",
  "Phone roll °": "settleZ",
  "Start tilt °": "tilt",
  "Glass reflection progress": "shine",
  "Glass reg ↔ (X)": "glassRegX",
  "Glass reg ↕ (Y)": "glassRegY",
  "Glass reg depth (Z)": "glassRegZ",
  "Crack ← →": "crackExitX",
  "Crack ↑ ↓": "crackExitY",
  "Crack severity": "crackSeverity",
  "Crack sharpness": "crackSharpness",
};

const WIRE = {
  enabled: false,
  master: "sposZ",
  drivenA: "sposY",
  drivenBEnabled: true,
  drivenB: "srotY",
  ratioA: 1.0,
  ratioB: 45.0,
  masterAnchor: 0,
  drivenAnchorA: 0,
  drivenAnchorB: 0,
  suspended: false,
};

function wireAnchors() {
  WIRE.masterAnchor = DRIVE_READERS[WIRE.master]();
  WIRE.drivenAnchorA = DRIVE_READERS[WIRE.drivenA]();
  if (WIRE.drivenBEnabled) {
    WIRE.drivenAnchorB = DRIVE_READERS[WIRE.drivenB]();
  }
}

function wireTap(param, value) {
  if (!WIRE.enabled || WIRE.suspended) return;
  if (param !== WIRE.master) return;
  if (!DEV.setLeva) return;
  const delta = value - WIRE.masterAnchor;
  const writes = {};
  const drive = (key, anchor, ratio) => {
    if (key === WIRE.master || Object.prototype.hasOwnProperty.call(writes, key)) return;
    const [lo, hi] = DRIVE_CLAMPS[key] || [-Infinity, Infinity];
    const next = anchor + delta * ratio;
    writes[key] = Number(Math.min(hi, Math.max(lo, next)).toFixed(4));
  };
  drive(WIRE.drivenA, WIRE.drivenAnchorA, WIRE.ratioA);
  if (WIRE.drivenBEnabled) {
    drive(WIRE.drivenB, WIRE.drivenAnchorB, WIRE.ratioB);
  }
  if (!Object.keys(writes).length) return;
  WIRE.suspended = true;
  DEV.setLeva(writes);
  WIRE.suspended = false;
}

function wireResetRun() {
  if (!DEV.setLeva) return;
  const writes = {
    [WIRE.master]: Number(WIRE.masterAnchor.toFixed(4)),
  };
  if (WIRE.drivenA !== WIRE.master) {
    writes[WIRE.drivenA] = Number(WIRE.drivenAnchorA.toFixed(4));
  }
  if (
    WIRE.drivenBEnabled &&
    WIRE.drivenB !== WIRE.master &&
    WIRE.drivenB !== WIRE.drivenA
  ) {
    writes[WIRE.drivenB] = Number(WIRE.drivenAnchorB.toFixed(4));
  }
  WIRE.suspended = true;
  DEV.setLeva(writes);
  WIRE.suspended = false;
}

// ---------------------------------------------------------
// SNAPSHOT / SLOT ENGINE
// ---------------------------------------------------------
const SNAPSHOTS = { origin: null };

const SLOT_KEY = "iglass_pose_slots_v1";
const SLOT_META_KEY = "iglass_pose_slot_meta_v1";
const SLOT_THUMB_KEY = "iglass_pose_slot_thumbs_v1";
const SLOT_COUNT = 200;
// Must track SLOT_COUNT. The browser renders this block unconditionally and
// anything above it only when already filled — so a slot outside the primary
// block is unreachable for saving, not merely hidden.
const PRIMARY_SLOT_COUNT = 200;
const MOTION_PATH_KEY = "iglass_motion_path_v1";
const MOTION_LIBRARY_KEY = "iglass_motion_path_library_v1";
// v7.5.21 — which saved path the working path is currently linked to.
const MOTION_PATH_LINK_KEY = "iglass_motion_path_link_v1";
const LEGACY_MOTION_COMPARE_KEY = "iglass_motion_compare_v1";

const MOTION_EASES = {
  linear: (t) => t,
  smooth: (t) => t * t * (3 - 2 * t),
  cinematic: (t) => t * t * t * (t * (t * 6 - 15) + 10),
  sine: (t) => 0.5 - 0.5 * Math.cos(Math.PI * t),
  accelerate: (t) => t * t * t,
  decelerate: (t) => 1 - Math.pow(1 - t, 3),
};

function applyEaseAmount(t, easeName, amount = 1) {
  const safeT = Math.max(0, Math.min(1, Number(t) || 0));
  const safeAmount = Math.max(0, Math.min(1, Number(amount)));
  const ease = MOTION_EASES[easeName] || MOTION_EASES.linear;
  return THREE.MathUtils.lerp(
    safeT,
    ease(safeT),
    Number.isFinite(safeAmount) ? safeAmount : 1
  );
}

const MOTION_EASE_LABELS = {
  linear: "linear",
  smooth: "smooth",
  cinematic: "cinematic",
  sine: "sine",
  accelerate: "accelerate",
  decelerate: "decelerate",
};

const POSE_ROTATION_GROUPS = [
  ["settleX", "settleY", "settleZ"],
  ["srotX", "srotY", "srotZ"],
];

const POSE_ROTATION_KEYS = new Set(POSE_ROTATION_GROUPS.flat());
const POSE_GLASS_REG_KEYS = new Set(["glassRegX", "glassRegY", "glassRegZ"]);
const POSE_CRACK_POSITION_KEYS = new Set([
  "crackExitX",
  "crackExitY",
  "crackUseDefault",
]);

function defaultMotionPath() {
  return {
    version: 3,
    productionPresetVersion: 1,
    name: "Untitled path",
    trajectory: "curve",
    curveType: "catmullrom",
    tension: 0.5,
    arcLength: true,
    continuous: true,
    globalEase: "linear",
    globalEaseStrength: 1,
    glassOutEase: "linear",
    glassOutEaseStrength: 1,
    glassReturnEase: "linear",
    glassReturnEaseStrength: 1,
    glassReturnSpan: 1,
    orientationMode: "quaternion",
    lookAt: [0, 0, 0],
    orientationOffset: [0, 0, 0],
    bank: 0,
    showPath: true,
    showGhosts: true,
    editHandles: false,
    speed: 1,
    loop: true,
    nodes: [],
  };
}

function applyProductionPreset(path) {
  return normaliseMotionPath({
    ...path,
    trajectory: "curve",
    curveType: "catmullrom",
    arcLength: true,
    continuous: true,
    globalEase: "linear",
    orientationMode: "quaternion",
    bank: 0,
    productionPresetVersion: 1,
  });
}

function normaliseMotionPath(saved) {
  const base = defaultMotionPath();
  const legacy = !saved || Number(saved.version) < 2;
  const source = saved && typeof saved === "object" ? saved : {};
  const nodes = Array.isArray(source.nodes)
    ? source.nodes
        .filter((n) => Number.isInteger(n.slot))
        .map((n, i) => ({
          slot: n.slot,
          duration: i === 0 ? 0 : Math.max(0.1, Number(n.duration) || 1.25),
          hold: Math.max(0, Number(n.hold) || 0),
          motionMode: ["inherit", "continuous", "custom"].includes(n.motionMode)
            ? n.motionMode
            : "inherit",
          ease: MOTION_EASES[n.ease] ? n.ease : "cinematic",
          easeStrength: Number.isFinite(Number(n.easeStrength))
            ? Math.max(0, Math.min(1, Number(n.easeStrength)))
            : 1,
          departureEase: MOTION_EASES[n.departureEase]
            ? n.departureEase
            : "accelerate",
          departureEaseStrength: Number.isFinite(Number(n.departureEaseStrength))
            ? Math.max(0, Math.min(1, Number(n.departureEaseStrength)))
            : 1,
          position:
            Array.isArray(n.position) && n.position.length === 3 && n.position.every(Number.isFinite)
              ? n.position.map(Number)
              : null,
          pose: n.pose && typeof n.pose === "object"
            ? withAnimatedLightingDefaults(n.pose)
            : null,
        }))
    : [];
  return {
    ...base,
    ...source,
    version: 3,
    trajectory: source.trajectory === "line" ? "line" : "curve",
    curveType: ["centripetal", "chordal", "catmullrom"].includes(source.curveType)
      ? source.curveType
      : legacy
      ? "catmullrom"
      : "centripetal",
    tension: Math.max(0, Math.min(1, Number(source.tension) || 0.5)),
    arcLength: legacy ? false : source.arcLength !== false,
    continuous: legacy ? false : source.continuous !== false,
    globalEase: MOTION_EASES[source.globalEase] ? source.globalEase : "linear",
    globalEaseStrength: Number.isFinite(Number(source.globalEaseStrength))
      ? Math.max(0, Math.min(1, Number(source.globalEaseStrength)))
      : 1,
    glassOutEase: MOTION_EASES[source.glassOutEase]
      ? source.glassOutEase
      : "linear",
    glassOutEaseStrength: Number.isFinite(Number(source.glassOutEaseStrength))
      ? Math.max(0, Math.min(1, Number(source.glassOutEaseStrength)))
      : 1,
    glassReturnEase: MOTION_EASES[source.glassReturnEase]
      ? source.glassReturnEase
      : "linear",
    glassReturnEaseStrength: Number.isFinite(Number(source.glassReturnEaseStrength))
      ? Math.max(0, Math.min(1, Number(source.glassReturnEaseStrength)))
      : 1,
    glassReturnSpan: Number.isFinite(Number(source.glassReturnSpan))
      ? Math.max(0.1, Math.min(1, Number(source.glassReturnSpan)))
      : 1,
    orientationMode: ["quaternion", "tangent", "lookAt"].includes(source.orientationMode)
      ? source.orientationMode
      : "quaternion",
    lookAt:
      Array.isArray(source.lookAt) && source.lookAt.length === 3
        ? source.lookAt.map((v) => Number(v) || 0)
        : [0, 0, 0],
    orientationOffset:
      Array.isArray(source.orientationOffset) && source.orientationOffset.length === 3
        ? source.orientationOffset.map((v) => Number(v) || 0)
        : [0, 0, 0],
    bank: Number(source.bank) || 0,
    speed: Math.max(0.1, Number(source.speed) || 1),
    loop: source.loop !== false,
    showPath: source.showPath !== false,
    showGhosts: source.showGhosts !== false,
    editHandles: source.editHandles === true,
    nodes,
  };
}

function loadMotionPath() {
  try {
    const raw = window.localStorage.getItem(MOTION_PATH_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if (saved && Array.isArray(saved.nodes)) {
      return saved.productionPresetVersion === 1
        ? normaliseMotionPath(saved)
        : applyProductionPreset(saved);
    }
  } catch (e) {
    /* corrupted store -> fresh path */
  }
  return defaultMotionPath();
}

function persistMotionPath(path) {
  try {
    window.localStorage.setItem(MOTION_PATH_KEY, JSON.stringify(path));
  } catch (e) {
    /* storage blocked -> path remains session-only */
  }
}

function motionPathFromCurrentPathExport(payload) {
  const source = payload?.path;
  if (!source || !Array.isArray(source.nodes)) {
    throw new Error("current-path JSON has no path.nodes array");
  }
  const nodes = source.nodes.map((node) => {
    const timing = node.timing || {};
    const slot = Number.isInteger(node.slotIndex)
      ? node.slotIndex
      : Number(node.slotNumber) - 1;
    if (!Number.isInteger(slot) || slot < 0 || slot >= SLOT_COUNT) {
      throw new Error(`invalid slot on current-path node ${node.nodeNumber ?? "?"}`);
    }
    return {
      slot,
      duration: Number(timing.duration),
      hold: Number(timing.hold),
      motionMode: timing.motionMode,
      ease: timing.arrivalEase,
      easeStrength: Number(timing.arrivalEaseStrength),
      departureEase: timing.departureEase,
      departureEaseStrength: Number(timing.departureEaseStrength),
      position: Array.isArray(node.positionOverride)
        ? node.positionOverride.map(Number)
        : null,
      pose: node.pose && typeof node.pose === "object"
        ? withAnimatedLightingDefaults(node.pose)
        : null,
    };
  });
  return normaliseMotionPath({
    ...(source.settings || {}),
    name: source.name || "Imported current path",
    nodes,
  });
}

function resolveMotionNodePose(node, slots) {
  const slotPose = node && slots?.[node.slot];
  if (slotPose && typeof slotPose === "object") return slotPose;
  return node?.pose && typeof node.pose === "object" ? node.pose : null;
}

function poseSnapshotMismatch(source, snapshot) {
  if (!source || !snapshot) return source === snapshot ? "" : "missing pose";
  const keys = new Set([...Object.keys(source), ...Object.keys(snapshot)]);
  for (const key of keys) {
    const a = source[key];
    const b = snapshot[key];
    if (typeof a === "number" && typeof b === "number") {
      if (Number.isNaN(a) && Number.isNaN(b)) continue;
      if (Math.abs(a - b) <= 1e-12) continue;
    } else if (Object.is(a, b)) {
      continue;
    }
    return `${key}: source ${String(a)} / snapshot ${String(b)}`;
  }
  return "";
}

function validateMotionPathSnapshot(path, sourceSlots) {
  const errors = [];
  (path?.nodes || []).forEach((node, index) => {
    const source = resolveMotionNodePose(node, sourceSlots);
    const mismatch = poseSnapshotMismatch(source, node.pose || null);
    if (mismatch) errors.push(`node ${index + 1} / S${node.slot + 1} — ${mismatch}`);
  });
  return errors;
}

function slotsWithSavedPathSnapshot(path, slots) {
  const nextSlots = [...slots];
  let restored = 0;
  for (const node of path?.nodes || []) {
    if (
      !Number.isInteger(node.slot) ||
      node.slot < 0 ||
      node.slot >= nextSlots.length ||
      !node.pose ||
      typeof node.pose !== "object"
    ) continue;
    nextSlots[node.slot] = {
      ...withAnimatedLightingDefaults(node.pose),
      shine: Number.isFinite(node.pose.shine) ? node.pose.shine : 0,
    };
    restored++;
  }
  return { slots: nextSlots, restored };
}

function compileMotionPath(path, slots) {
  const nodes = path.nodes
    .map((node) => {
      const pose = resolveMotionNodePose(node, slots);
      const position =
        Array.isArray(node.position) && node.position.every(Number.isFinite)
          ? node.position.map(Number)
          : pose && [pose.sposX, pose.sposY, pose.sposZ].every(Number.isFinite)
          ? [pose.sposX, pose.sposY, pose.sposZ]
          : null;
      return { ...node, position, pose };
    })
    .filter((node) => node.pose);
  const compiled = {
    type: "iglass-motion-path",
    version: 3,
    name: path.name || "Untitled path",
    trajectory: path.trajectory === "line" ? "line" : "curve",
    curveType: path.curveType || "centripetal",
    tension: Number(path.tension) || 0.5,
    arcLength: path.arcLength !== false,
    continuous: path.continuous !== false,
    globalEase: MOTION_EASES[path.globalEase] ? path.globalEase : "linear",
    globalEaseStrength: Number.isFinite(Number(path.globalEaseStrength))
      ? Math.max(0, Math.min(1, Number(path.globalEaseStrength)))
      : 1,
    glassOutEase: MOTION_EASES[path.glassOutEase]
      ? path.glassOutEase
      : "linear",
    glassOutEaseStrength: Number.isFinite(Number(path.glassOutEaseStrength))
      ? Math.max(0, Math.min(1, Number(path.glassOutEaseStrength)))
      : 1,
    glassReturnEase: MOTION_EASES[path.glassReturnEase]
      ? path.glassReturnEase
      : "linear",
    glassReturnEaseStrength: Number.isFinite(Number(path.glassReturnEaseStrength))
      ? Math.max(0, Math.min(1, Number(path.glassReturnEaseStrength)))
      : 1,
    glassReturnSpan: Number.isFinite(Number(path.glassReturnSpan))
      ? Math.max(0.1, Math.min(1, Number(path.glassReturnSpan)))
      : 1,
    orientationMode: path.orientationMode || "quaternion",
    lookAt: Array.isArray(path.lookAt) ? path.lookAt : [0, 0, 0],
    orientationOffset: Array.isArray(path.orientationOffset)
      ? path.orientationOffset
      : [0, 0, 0],
    bank: Number(path.bank) || 0,
    speed: Math.max(0.1, Number(path.speed) || 1),
    loop: path.loop !== false,
    nodes,
  };
  return attachMotionCurve(compiled);
}

function nodeTravelDuration(node) {
  return Math.max(0.1, Number(node?.duration) || 1.25);
}

function nodeHoldDuration(node) {
  return Math.max(0, Number(node?.hold) || 0);
}

function effectiveNodeMotionMode(path, index) {
  if (index <= 0) return "continuous";
  const mode = path?.nodes?.[index]?.motionMode;
  if (mode === "continuous" || mode === "custom") return mode;
  return path?.continuous === false ? "custom" : "continuous";
}

function spatialLegIsStatic(nodes, start, end) {
  const a = nodes?.[start]?.position;
  const b = nodes?.[end]?.position;
  if (
    !Array.isArray(a) ||
    !Array.isArray(b) ||
    a.length !== 3 ||
    b.length !== 3 ||
    !a.every(Number.isFinite) ||
    !b.every(Number.isFinite)
  ) return false;
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz <= 1e-12;
}

function trackTToPathU(path, trackT) {
  const target = Math.max(0, Math.min(1, Number(trackT) || 0));
  if (!path.arcLength || target <= 0 || target >= 1) return target;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) * 0.5;
    if (positionTrackSample(path, mid).trackT < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) * 0.5;
}

function buildMotionTimeline(path) {
  if (!path?.nodes?.length) return { events: [], total: 0 };
  if (path._motionTimeline) return path._motionTimeline;

  const nodes = path.nodes;
  const last = nodes.length - 1;
  const events = [];
  const pushHold = (index) => {
    const duration = nodeHoldDuration(nodes[index]);
    if (duration > 0) events.push({ type: "hold", index, duration });
  };
  const pushTravel = (start, end, mode, duration) => {
    const denominator = Math.max(1, last);
    const startTrackT = start / denominator;
    const endTrackT = end / denominator;
    events.push({
      type: "travel",
      start,
      end,
      mode,
      duration,
      startTrackT,
      endTrackT,
      startU: mode === "continuous" ? trackTToPathU(path, startTrackT) : startTrackT,
      endU: mode === "continuous" ? trackTToPathU(path, endTrackT) : endTrackT,
    });
  };

  pushHold(0);
  let incoming = 1;
  while (incoming <= last) {
    const mode = effectiveNodeMotionMode(path, incoming);
    if (mode === "custom") {
      pushTravel(incoming - 1, incoming, "custom", nodeTravelDuration(nodes[incoming]));
      pushHold(incoming);
      incoming += 1;
      continue;
    }

    // Arc-length curves have no spatial parameter for a zero-distance leg.
    // Give that leg its own temporal event so glass registration, teardown P,
    // shine and every other pose channel can still travel between its nodes.
    if (spatialLegIsStatic(nodes, incoming - 1, incoming)) {
      pushTravel(incoming - 1, incoming, "static", nodeTravelDuration(nodes[incoming]));
      pushHold(incoming);
      incoming += 1;
      continue;
    }

    const start = incoming - 1;
    let end = incoming;
    let duration = nodeTravelDuration(nodes[incoming]);
    const acceleratingFromHold = nodeHoldDuration(nodes[start]) > 0;
    while (
      !acceleratingFromHold &&
      end < last &&
      nodeHoldDuration(nodes[end]) <= 0 &&
      effectiveNodeMotionMode(path, end + 1) === "continuous" &&
      !spatialLegIsStatic(nodes, end, end + 1)
    ) {
      end += 1;
      duration += nodeTravelDuration(nodes[end]);
    }
    pushTravel(start, end, "continuous", duration);
    pushHold(end);
    incoming = end + 1;
  }

  const timeline = {
    events,
    total: events.reduce((sum, event) => sum + event.duration, 0),
  };
  try {
    Object.defineProperty(path, "_motionTimeline", {
      value: timeline,
      writable: true,
      configurable: true,
      enumerable: false,
    });
  } catch (e) {
    /* frozen preview payload -> uncached timeline is still valid */
  }
  return timeline;
}

function motionPathDuration(path) {
  return buildMotionTimeline(path).total;
}

function finalNodeGlassIsRegistered(path) {
  if (!path?.nodes || path.nodes.length < 2) return false;
  const pose = path.nodes[path.nodes.length - 1]?.pose;
  if (!pose) return false;
  return [
    [pose.glassRegX, GLASS_REG_HOME.x],
    [pose.glassRegY, GLASS_REG_HOME.y],
    [pose.glassRegZ, GLASS_REG_HOME.z],
  ].every(
    ([value, home]) =>
      Number.isFinite(value) &&
      Math.abs(value - home) <= GLASS_REG_TRIGGER_EPSILON
  );
}

// THE authoritative timing calculation for one playback. Everything that
// happens after the authored path — the glass sweep, and from v7.5.33 the
// travelling key and fill lights — is a span declared here and read back
// by sampleMotionPlayback(). No other function computes terminal timing.
//
//   pathArrival   the phone reaches its final authored node (= the start
//                 of the final hold, which is where the sweep begins)
//   pathDuration  the authored path including that final hold
//   shineStart/Duration/End      phase 1, unchanged from v7.5.1
//   keySetupStart -> keyStart    eased entry to key fromX
//   keyStart -> keyEnd           phase 2, key fromX -> toX
//   fillSetupStart -> fillStart  eased entry to fill fromX
//   fillStart -> fillEnd         phase 3, fill fromX -> toX
//   totalDuration                what the render governor waits for
function motionPlaybackTiming(path, speedOverride) {
  const authoredDuration = motionPathDuration(path);
  const pathSpeed = Math.max(
    0.1,
    Number(speedOverride ?? path?.speed) || 1
  );
  const pathDuration = authoredDuration / pathSpeed;
  const finalHold = path?.nodes?.length
    ? nodeHoldDuration(path.nodes[path.nodes.length - 1]) / pathSpeed
    : 0;
  const shineStart = Math.max(0, pathDuration - finalHold);
  const rangeStart = Math.max(0, Math.min(1, Number(SHINE.range[0]) || 0));
  const rangeEnd = Math.max(0, Math.min(1, Number(SHINE.range[1]) || 0));
  const shineDistance = Math.abs(rangeEnd - rangeStart);
  // ONE qualifying test for the whole terminal sequence. The sweep's
  // existing condition is unchanged; the travelling lights simply inherit
  // it, so a path that never sweeps never lights either.
  const terminalQualifies =
    finalNodeGlassIsRegistered(path) && shineDistance > 0.000001;
  const shineDuration = terminalQualifies
    ? shineDistance / Math.max(0.01, Number(SHINE.speed) || 0.5)
    : 0;
  const shineEnd = shineStart + shineDuration;

  // ---- v7.5.33 travelling lights ----
  const lightsRun = terminalQualifies && activeTerminalLightFx().enabled === true;
  const afterShineGap = lightsRun
    ? terminalLightSeconds(activeTerminalLightFx().afterShineGap, 1)
    : 0;
  const terminalPose = lightsRun ? finalAuthoredPose(path) : null;
  const keySetupDuration = lightsRun
    ? terminalEntryDuration(activeTerminalLightFx().key, terminalPose?.lightKeyX)
    : 0;
  const keyDuration = lightsRun
    ? terminalLightSeconds(activeTerminalLightFx().key.duration)
    : 0;
  const fillSetupDuration = lightsRun
    ? terminalEntryDuration(activeTerminalLightFx().fill, terminalPose?.lightFillX)
    : 0;
  const fillDuration = lightsRun
    ? terminalLightSeconds(activeTerminalLightFx().fill.duration)
    : 0;
  // The lights begin only once BOTH the authored path and the sweep have
  // finished. On both production paths the sweep already outlasts the
  // path, so this changes nothing there; it guarantees in general that
  // every non-X channel the lights leave alone is the settled final pose
  // rather than a value still being interpolated.
  const keySetupStart = lightsRun
    ? Math.max(pathDuration, shineEnd) + afterShineGap
    : shineEnd;
  const keyStart = keySetupStart + keySetupDuration;
  const keyEnd = keyStart + keyDuration;
  // No intentional gap between the key finishing and the fill beginning.
  const fillSetupStart = keyEnd;
  const fillStart = fillSetupStart + fillSetupDuration;
  const fillEnd = fillStart + fillDuration;

  return {
    pathArrival: shineStart,
    pathDuration,
    shineStart,
    shineDuration,
    shineEnd,
    lightsRun,
    afterShineGap,
    keySetupStart,
    keySetupDuration,
    keyStart,
    keyDuration,
    keyEnd,
    fillSetupStart,
    fillSetupDuration,
    fillStart,
    fillDuration,
    fillEnd,
    terminalLightDuration: lightsRun ? fillEnd - keySetupStart : 0,
    totalDuration: Math.max(
      pathDuration,
      shineEnd,
      lightsRun ? fillEnd : 0
    ),
    rangeStart,
    rangeEnd,
  };
}

// Derives the key/fill X overrides for one instant of terminal playback.
// Returns null outside the terminal window, so a non-qualifying path and
// every pre-terminal sample are byte-identical to v7.5.32.
//
// `pose` supplies the AUTHORED anchor for each eased entry. During the
// terminal window the sampled pose is the settled final node, so that
// anchor is constant and the result depends on nothing but elapsed time.
function terminalLightOverrides(pose, timing, elapsed) {
  if (!pose || !timing?.lightsRun) return null;
  if (elapsed < timing.keySetupStart) return null;

  const keyFrom = clampLightPosition(activeTerminalLightFx().key.fromX);
  const keyTo = clampLightPosition(activeTerminalLightFx().key.toX);
  const fillFrom = clampLightPosition(activeTerminalLightFx().fill.fromX);
  const fillTo = clampLightPosition(activeTerminalLightFx().fill.toX);
  const out = {};

  // ---- RECORDED RIG (v7.5.34) ----
  // Every non-X channel of the working setup crosses over during the SAME
  // eased entry the key X uses, then holds its exact authored constant for
  // the rest of playback. So by the time the key sweep starts, the rig is
  // already the recorded one and nothing but X moves through either sweep.
  // Riding the existing entry window is what stops this being a lighting
  // pop at the moment the sequence begins.
  const entryT = terminalPhaseT(
    elapsed,
    timing.keySetupStart,
    timing.keySetupDuration
  );
  for (const channel of Object.keys(activeTerminalLightFx().base)) {
    const target = Number(activeTerminalLightFx().base[channel]);
    if (!Number.isFinite(target)) continue;
    if (entryT >= 1) {
      // Assigned, never interpolated — the held value must be exact.
      out[channel] = target;
      continue;
    }
    const anchor = Number.isFinite(pose[channel]) ? pose[channel] : target;
    out[channel] = terminalLightTravel(anchor, target, entryT);
  }

  // ---- PHASE 2 — key travels across the body ----
  if (elapsed < timing.keyStart) {
    const anchor = Number.isFinite(pose.lightKeyX) ? pose.lightKeyX : keyFrom;
    out.lightKeyX = terminalLightTravel(
      anchor,
      keyFrom,
      terminalPhaseT(elapsed, timing.keySetupStart, timing.keySetupDuration)
    );
  } else if (elapsed < timing.keyEnd) {
    out.lightKeyX = terminalLightTravel(
      keyFrom,
      keyTo,
      terminalPhaseT(elapsed, timing.keyStart, timing.keyDuration)
    );
  } else {
    // Held for the remainder of playback, including progress = 1.
    out.lightKeyX = keyTo;
  }

  // ---- PHASE 3 — fill travels back across the bezel ----
  if (elapsed >= timing.fillSetupStart) {
    if (elapsed < timing.fillStart) {
      const anchor = Number.isFinite(pose.lightFillX)
        ? pose.lightFillX
        : fillFrom;
      out.lightFillX = terminalLightTravel(
        anchor,
        fillFrom,
        terminalPhaseT(elapsed, timing.fillSetupStart, timing.fillSetupDuration)
      );
    } else if (elapsed < timing.fillEnd) {
      out.lightFillX = terminalLightTravel(
        fillFrom,
        fillTo,
        terminalPhaseT(elapsed, timing.fillStart, timing.fillDuration)
      );
    } else {
      out.lightFillX = fillTo;
    }
  }

  return out;
}

function sampleMotionPlayback(path, progress, speedOverride) {
  const timing = motionPlaybackTiming(path, speedOverride);
  const total = Math.max(0.000001, timing.totalDuration);
  const elapsed = Math.max(0, Math.min(1, progress)) * total;
  const pathProgress =
    timing.pathDuration <= 0
      ? 1
      : Math.max(0, Math.min(1, elapsed / timing.pathDuration));
  const sampledPose = sampleMotionPath(path, pathProgress);
  if (!sampledPose) return { pose: null, pathProgress, ...timing };

  let pose = sampledPose;
  if (timing.shineDuration > 0 && elapsed >= timing.shineStart) {
    const shineT = Math.max(
      0,
      Math.min(1, (elapsed - timing.shineStart) / timing.shineDuration)
    );
    pose = {
      ...sampledPose,
      shine: THREE.MathUtils.lerp(
        timing.rangeStart,
        timing.rangeEnd,
        shineT
      ),
    };
  }
  // v7.5.33 — the travelling lights are the next terminal phase, derived
  // from the same elapsed time. A new object every time: the sampled pose
  // is never mutated, and only the channel belonging to the active phase
  // is replaced.
  const terminalLights = terminalLightOverrides(pose, timing, elapsed);
  if (terminalLights) pose = { ...pose, ...terminalLights };
  return { pose, pathProgress, ...timing };
}

function playbackProgressAtFirstHold(path, speedOverride) {
  const timeline = buildMotionTimeline(path);
  const holdEventIndex = timeline.events.findIndex(
    (event) => event.type === "hold" && event.index > 0
  );
  if (holdEventIndex < 0) return null;

  const authoredElapsed = timeline.events
    .slice(0, holdEventIndex)
    .reduce((sum, event) => sum + event.duration, 0);
  const pathSpeed = Math.max(
    0.1,
    Number(speedOverride ?? path?.speed) || 1
  );
  const totalDuration = Math.max(
    0.000001,
    motionPlaybackTiming(path, speedOverride).totalDuration
  );
  return Math.max(
    0,
    Math.min(1, authoredElapsed / pathSpeed / totalDuration)
  );
}

function expectedMotionNodeIndex(path, progress) {
  const timeline = buildMotionTimeline(path);
  if (!timeline.events.length || timeline.total <= 0) {
    return Math.max(0, path.nodes.length - 1);
  }
  let time = Math.max(0, Math.min(1, progress)) * timeline.total;
  for (const event of timeline.events) {
    if (time <= event.duration) {
      if (event.type === "hold") return event.index;
      const raw = Math.max(0, Math.min(1, time / event.duration));
      return THREE.MathUtils.lerp(
        event.start,
        event.end,
        motionEventProgress(path, event, raw)
      );
    }
    time -= event.duration;
  }
  return path.nodes.length - 1;
}

function nearestMotionNode(path, progress) {
  if (!path || !path.nodes?.length) return -1;
  if (path.nodes.length === 1) return 0;
  const clamped = Math.max(0, Math.min(1, progress));
  const pose = sampleMotionPath(path, clamped);
  if (!pose) return -1;
  const point = new THREE.Vector3(pose.sposX, pose.sposY, pose.sposZ);
  const expectedIndex = expectedMotionNodeIndex(path, clamped);
  let nearest = 0;
  let nearestDistance = Infinity;
  path.nodes.forEach((node, i) => {
    if (!Array.isArray(node.position)) return;
    const distance = point.distanceToSquared(new THREE.Vector3(...node.position));
    if (
      distance < nearestDistance - 1e-12 ||
      (
        Math.abs(distance - nearestDistance) <= 1e-12 &&
        Math.abs(i - expectedIndex) < Math.abs(nearest - expectedIndex)
      )
    ) {
      nearestDistance = distance;
      nearest = i;
    }
  });
  return nearest;
}

function attachMotionCurve(path) {
  const points = path.nodes
    .map((node) => node.position)
    .filter((p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite))
    .map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const curve =
    path.trajectory === "curve" && points.length > 1
      ? new THREE.CatmullRomCurve3(
          points,
          false,
          path.curveType || "centripetal",
          Number(path.tension) || 0.5
        )
      : null;
  Object.defineProperty(path, "_curve", { value: curve, writable: true, enumerable: false });
  return path;
}

function poseQuaternion(pose, keys) {
  const rad = Math.PI / 180;
  return new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      (Number(pose[keys[0]]) || 0) * rad,
      (Number(pose[keys[1]]) || 0) * rad,
      (Number(pose[keys[2]]) || 0) * rad,
      "XYZ"
    )
  );
}

function alignQuaternion(q, reference) {
  if (reference.dot(q) >= 0) return q;
  return new THREE.Quaternion(-q.x, -q.y, -q.z, -q.w);
}

function quaternionLog(q) {
  const w = Math.max(-1, Math.min(1, q.w));
  const a = Math.acos(w);
  const s = Math.sin(a);
  return Math.abs(s) < 1e-7
    ? new THREE.Vector3()
    : new THREE.Vector3(q.x, q.y, q.z).multiplyScalar(a / s);
}

function quaternionExp(v) {
  const a = v.length();
  if (a < 1e-7) return new THREE.Quaternion(0, 0, 0, 1);
  const s = Math.sin(a) / a;
  return new THREE.Quaternion(v.x * s, v.y * s, v.z * s, Math.cos(a)).normalize();
}

function squadControl(prev, q, next) {
  const inv = q.clone().invert();
  const a = quaternionLog(inv.clone().multiply(prev));
  const b = quaternionLog(inv.clone().multiply(next));
  return q.clone().multiply(quaternionExp(a.add(b).multiplyScalar(-0.25))).normalize();
}

function sampleQuaternionTrack(nodes, keys, trackT) {
  if (nodes.length === 1) return poseQuaternion(nodes[0].pose, keys);
  const scaled = Math.max(0, Math.min(1, trackT)) * (nodes.length - 1);
  const i = Math.min(nodes.length - 2, Math.floor(scaled));
  const t = scaled - i;
  const q0 = poseQuaternion(nodes[i].pose, keys);
  const q1 = alignQuaternion(poseQuaternion(nodes[i + 1].pose, keys), q0);

  // A hold is a deliberate angular-velocity boundary. Use direct SLERP on
  // both legs touching it, so neighbouring nodes
  // cannot bend the arrival or departure tangent. Two-node paths likewise
  // have no continuous interior junction that would benefit from SQUAD.
  const holdBoundary =
    nodeHoldDuration(nodes[i]) > 0 ||
    nodeHoldDuration(nodes[i + 1]) > 0;
  if (nodes.length === 2 || holdBoundary) {
    return new THREE.Quaternion().slerpQuaternions(q0, q1, t).normalize();
  }

  const qm = alignQuaternion(poseQuaternion(nodes[Math.max(0, i - 1)].pose, keys), q0);
  const q2 = alignQuaternion(
    poseQuaternion(nodes[Math.min(nodes.length - 1, i + 2)].pose, keys),
    q1
  );
  const s0 = squadControl(qm, q0, q1);
  const s1 = squadControl(q0, q1, q2);
  const a = new THREE.Quaternion().slerpQuaternions(q0, q1, t);
  const b = new THREE.Quaternion().slerpQuaternions(s0, s1, t);
  return new THREE.Quaternion().slerpQuaternions(a, b, 2 * t * (1 - t)).normalize();
}

function lineTrackSample(path, u) {
  const pts = path.nodes.map((n) => new THREE.Vector3(...n.position));
  const n = pts.length;
  if (n < 2) return { point: pts[0] || new THREE.Vector3(), tangent: new THREE.Vector3(1, 0, 0), trackT: 0 };
  let scaled;
  if (path.arcLength) {
    const lengths = [];
    let total = 0;
    for (let i = 0; i < n - 1; i++) {
      const d = pts[i].distanceTo(pts[i + 1]);
      lengths.push(d);
      total += d;
    }
    let target = Math.max(0, Math.min(1, u)) * (total || 1);
    let segment = 0;
    while (segment < lengths.length - 1 && target > lengths[segment]) {
      target -= lengths[segment];
      segment++;
    }
    scaled = segment + (lengths[segment] ? target / lengths[segment] : 0);
  } else {
    scaled = Math.max(0, Math.min(1, u)) * (n - 1);
  }
  const i = Math.min(n - 2, Math.floor(scaled));
  const local = scaled - i;
  return {
    point: pts[i].clone().lerp(pts[i + 1], local),
    tangent: pts[i + 1].clone().sub(pts[i]).normalize(),
    trackT: scaled / (n - 1),
  };
}

function positionTrackSample(path, u) {
  if (!path._curve) return lineTrackSample(path, u);
  const safe = Math.max(0, Math.min(1, u));
  const trackT = path.arcLength ? path._curve.getUtoTmapping(safe) : safe;
  return {
    point: path.arcLength ? path._curve.getPointAt(safe) : path._curve.getPoint(safe),
    tangent: path.arcLength ? path._curve.getTangentAt(safe) : path._curve.getTangent(trackT),
    trackT,
  };
}

function positionTrackSampleRaw(path, trackT) {
  const safe = Math.max(0, Math.min(1, trackT));
  if (path._curve) {
    return {
      point: path._curve.getPoint(safe),
      tangent: path._curve.getTangent(safe),
      trackT: safe,
    };
  }
  const points = path.nodes.map((node) => new THREE.Vector3(...node.position));
  const scaled = safe * (points.length - 1);
  const i = Math.min(points.length - 2, Math.floor(scaled));
  const local = scaled - i;
  return {
    point: points[i].clone().lerp(points[i + 1], local),
    tangent: points[i + 1].clone().sub(points[i]).normalize(),
    trackT: safe,
  };
}

function writeQuaternionToPose(q, keys, out) {
  const e = new THREE.Euler().setFromQuaternion(q, "XYZ");
  out[keys[0]] = wrapDeg(e.x);
  out[keys[1]] = wrapDeg(e.y);
  out[keys[2]] = wrapDeg(e.z);
}

function orientStage(path, spatial, out) {
  if (path.orientationMode === "quaternion") return;
  const point = spatial.point;
  const target =
    path.orientationMode === "lookAt"
      ? new THREE.Vector3(...(path.lookAt || [0, 0, 0]))
      : point.clone().add(spatial.tangent.lengthSq() ? spatial.tangent : new THREE.Vector3(0, 0, -1));
  if (point.distanceToSquared(target) < 1e-10) return;
  const m = new THREE.Matrix4().lookAt(point, target, new THREE.Vector3(0, 1, 0));
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  const off = path.orientationOffset || [0, 0, 0];
  q.multiply(
    new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        (Number(off[0]) || 0) * Math.PI / 180,
        (Number(off[1]) || 0) * Math.PI / 180,
        (Number(off[2]) || 0) * Math.PI / 180
      )
    )
  );
  q.multiply(
    new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      (Number(path.bank) || 0) * Math.PI / 180
    )
  );
  writeQuaternionToPose(q, ["srotX", "srotY", "srotZ"], out);
}

function interpolateMotionPose(path, trackT, spatial) {
  const nodes = path.nodes;
  const scaled = Math.max(0, Math.min(1, trackT)) * (nodes.length - 1);
  const fromIndex = Math.min(nodes.length - 2, Math.floor(scaled));
  const t = scaled - fromIndex;
  const a = nodes[fromIndex].pose;
  const b = nodes[fromIndex + 1].pose;
  const out = {};

  const aGlass = new THREE.Vector3(
    Number.isFinite(a.glassRegX) ? a.glassRegX : GLASS_REG_HOME.x,
    Number.isFinite(a.glassRegY) ? a.glassRegY : GLASS_REG_HOME.y,
    Number.isFinite(a.glassRegZ) ? a.glassRegZ : GLASS_REG_HOME.z
  );
  const bGlass = new THREE.Vector3(
    Number.isFinite(b.glassRegX) ? b.glassRegX : GLASS_REG_HOME.x,
    Number.isFinite(b.glassRegY) ? b.glassRegY : GLASS_REG_HOME.y,
    Number.isFinite(b.glassRegZ) ? b.glassRegZ : GLASS_REG_HOME.z
  );
  const home = new THREE.Vector3(
    GLASS_REG_HOME.x,
    GLASS_REG_HOME.y,
    GLASS_REG_HOME.z
  );
  const glassReturning =
    bGlass.distanceToSquared(home) < aGlass.distanceToSquared(home) - 1e-10;
  const glassSpan = glassReturning
    ? Math.max(0.1, Math.min(1, Number(path.glassReturnSpan) || 1))
    : 1;
  const glassRawT = Math.min(1, t / glassSpan);
  const glassEaseName = glassReturning
    ? path.glassReturnEase
    : path.glassOutEase;
  const glassEaseStrength = glassReturning
    ? path.glassReturnEaseStrength
    : path.glassOutEaseStrength;
  const glassT = applyEaseAmount(
    glassRawT,
    glassEaseName,
    glassEaseStrength
  );
  const aCrackPosition = effectivePoseCrackPosition(a);
  const bCrackPosition = effectivePoseCrackPosition(b);
  const aCrackPresence = a.crackOn === false ? 0 : 1;
  const bCrackPresence = b.crackOn === false ? 0 : 1;

  const glassValues = {
    glassRegX: [aGlass.x, bGlass.x],
    glassRegY: [aGlass.y, bGlass.y],
    glassRegZ: [aGlass.z, bGlass.z],
  };
  const poseKeys = new Set([
    ...Object.keys(a),
    ...Object.keys(b),
    ...POSE_GLASS_REG_KEYS,
  ]);

  for (const key of poseKeys) {
    if (
      POSE_ROTATION_KEYS.has(key) ||
      POSE_CRACK_POSITION_KEYS.has(key) ||
      ["sposX", "sposY", "sposZ"].includes(key)
    ) continue;
    const av = POSE_GLASS_REG_KEYS.has(key) ? glassValues[key][0] : a[key];
    const bv = POSE_GLASS_REG_KEYS.has(key) ? glassValues[key][1] : b[key];
    if (typeof av === "number" && typeof bv === "number") {
      const parameterT = POSE_GLASS_REG_KEYS.has(key) ? glassT : t;
      out[key] = av + (bv - av) * parameterT;
    } else {
      out[key] = t < 1 ? av : bv;
    }
  }

  out.crackExitX = THREE.MathUtils.lerp(aCrackPosition[0], bCrackPosition[0], t);
  out.crackExitY = THREE.MathUtils.lerp(aCrackPosition[1], bCrackPosition[1], t);
  out.crackUseDefault = t < 1
    ? poseUsesDefaultCrackPosition(a)
    : poseUsesDefaultCrackPosition(b);
  out.__crackPresence = THREE.MathUtils.lerp(
    aCrackPresence,
    bCrackPresence,
    t
  );
  out.crackOn = out.__crackPresence > 0.0001;
  out.__crackPositionResolved = true;

  for (const keys of POSE_ROTATION_GROUPS) {
    writeQuaternionToPose(sampleQuaternionTrack(nodes, keys, trackT), keys, out);
  }
  out.sposX = spatial.point.x;
  out.sposY = spatial.point.y;
  out.sposZ = spatial.point.z;
  orientStage(path, spatial, out);
  return out;
}

function sampleAtTrack(path, trackT) {
  const spatial = positionTrackSampleRaw(path, trackT);
  return interpolateMotionPose(path, spatial.trackT, spatial);
}

function applyEndpointEases(
  t,
  startEase,
  startStrength,
  endEase,
  endStrength
) {
  const safeT = Math.max(0, Math.min(1, Number(t) || 0));
  const hasStart = !!startEase && Number(startStrength) > 0;
  const hasEnd = !!endEase && Number(endStrength) > 0;
  if (!hasStart && !hasEnd) return safeT;
  if (!hasStart) return applyEaseAmount(safeT, endEase, endStrength);
  if (!hasEnd) return applyEaseAmount(safeT, startEase, startStrength);
  const fromStart = applyEaseAmount(safeT, startEase, startStrength);
  const intoEnd = applyEaseAmount(safeT, endEase, endStrength);
  const blend = safeT * safeT * (3 - 2 * safeT);
  return THREE.MathUtils.lerp(fromStart, intoEnd, blend);
}

function motionEventProgress(path, event, raw) {
  const startNode = path.nodes[event.start];
  const endNode = path.nodes[event.end];
  const startsAfterHold = nodeHoldDuration(startNode) > 0;
  const startsAtPath = event.start === 0;
  // A custom outgoing leg owns both endpoints even without a hold. Previously
  // its saved departure easing was ignored unless it started at node 1 or
  // followed a hold, despite the value already being stored and exported.
  const usesDepartureEase = startsAfterHold || startsAtPath || event.mode === "custom";
  const endsAtHold = nodeHoldDuration(endNode) > 0;
  const departureEase = usesDepartureEase
    ? (MOTION_EASES[startNode.departureEase] ? startNode.departureEase : "accelerate")
    : null;
  const departureStrength = usesDepartureEase
    ? Math.max(0, Math.min(1, Number(startNode.departureEaseStrength) || 0))
    : 0;

  if (event.mode === "custom") {
    return applyEndpointEases(
      raw,
      departureEase,
      departureStrength,
      MOTION_EASES[endNode.ease] ? endNode.ease : "cinematic",
      Number.isFinite(Number(endNode.easeStrength)) ? endNode.easeStrength : 1
    );
  }

  if (startsAfterHold || endsAtHold) {
    return applyEndpointEases(
      raw,
      departureEase,
      departureStrength,
      endsAtHold ? (MOTION_EASES[endNode.ease] ? endNode.ease : "decelerate") : null,
      endsAtHold
        ? (Number.isFinite(Number(endNode.easeStrength)) ? endNode.easeStrength : 1)
        : 0
    );
  }

  return applyEaseAmount(raw, path.globalEase, path.globalEaseStrength);
}

function sampleMotionEvent(path, event, raw) {
  const eased = motionEventProgress(path, event, raw);
  if (event.mode === "continuous") {
    const u = THREE.MathUtils.lerp(event.startU, event.endU, eased);
    const spatial = positionTrackSample(path, u);
    return interpolateMotionPose(path, spatial.trackT, spatial);
  }
  if (event.mode === "static") {
    const trackT = THREE.MathUtils.lerp(
      event.startTrackT,
      event.endTrackT,
      eased
    );
    const start = new THREE.Vector3(...path.nodes[event.start].position);
    const end = new THREE.Vector3(...path.nodes[event.end].position);
    return interpolateMotionPose(path, trackT, {
      point: start.clone().lerp(end, eased),
      tangent: new THREE.Vector3(0, 0, -1),
      trackT,
    });
  }
  return sampleAtTrack(
    path,
    THREE.MathUtils.lerp(event.startTrackT, event.endTrackT, eased)
  );
}

function sampleMotionPath(path, progress) {
  if (!path || !path.nodes || !path.nodes.length) return null;
  if (path.nodes.length === 1) return { ...path.nodes[0].pose };
  if (!Object.prototype.hasOwnProperty.call(path, "_curve")) attachMotionCurve(path);

  const clamped = Math.max(0, Math.min(1, progress));
  const timeline = buildMotionTimeline(path);
  const total = timeline.total;
  if (total <= 0) return sampleAtTrack(path, 1);

  let time = clamped * total;
  for (const event of timeline.events) {
    if (time <= event.duration) {
      if (event.type === "hold") {
        return sampleAtTrack(path, event.index / (path.nodes.length - 1));
      }
      return sampleMotionEvent(
        path,
        event,
        Math.max(0, Math.min(1, time / event.duration))
      );
    }
    time -= event.duration;
  }

  return sampleAtTrack(path, 1);
}

function spatialVelocityDiagnostics(path, sampleCount = 180) {
  if (!path?.nodes || path.nodes.length < 2) {
    return { values: [], average: 0, maximum: 0 };
  }

  const authoredDuration = motionPathDuration(path);
  const playbackSpeed = Math.max(0.1, Number(path.speed) || 1);
  const playbackDuration = authoredDuration / playbackSpeed;
  if (!(playbackDuration > 0)) {
    return { values: [], average: 0, maximum: 0 };
  }

  const segments = Math.max(60, Math.floor(sampleCount));
  const positions = [];
  for (let i = 0; i <= segments; i++) {
    const pose = sampleMotionPath(path, i / segments);
    if (!pose || ![pose.sposX, pose.sposY, pose.sposZ].every(Number.isFinite)) {
      return { values: [], average: 0, maximum: 0 };
    }
    positions.push(new THREE.Vector3(pose.sposX, pose.sposY, pose.sposZ));
  }

  const dt = playbackDuration / segments;
  const segmentSpeeds = [];
  for (let i = 1; i < positions.length; i++) {
    segmentSpeeds.push(positions[i].distanceTo(positions[i - 1]) / dt);
  }

  const values = segmentSpeeds.map((speed, i) =>
    i === 0 ? speed : (segmentSpeeds[i - 1] + speed) * 0.5
  );
  values.push(segmentSpeeds[segmentSpeeds.length - 1] || 0);

  return {
    values,
    average: segmentSpeeds.reduce((sum, speed) => sum + speed, 0) / Math.max(1, segmentSpeeds.length),
    maximum: segmentSpeeds.reduce((max, speed) => Math.max(max, speed), 0),
  };
}

function applyPoseParamsDirect(pose) {
  if (!pose) return;
  const rad = Math.PI / 180;

  if (Number.isFinite(pose.shift)) SETTLE.xShiftFraction = pose.shift;
  if (Number.isFinite(pose.vshift)) SETTLE.yShiftFraction = pose.vshift;
  if ([pose.settleX, pose.settleY, pose.settleZ].every(Number.isFinite)) {
    SETTLE.targetEuler = [pose.settleX * rad, pose.settleY * rad, pose.settleZ * rad];
    DEV.dirtyQuat = true;
  }
  if (Number.isFinite(pose.size) && pose.size > 0) {
    MODEL.targetSize = pose.size;
    DEV.dirtyFit = true;
  }
  if ([pose.sposX, pose.sposY, pose.sposZ].every(Number.isFinite)) {
    STAGE.position = [pose.sposX, pose.sposY, pose.sposZ];
    DEV.dirtyStage = true;
  }
  if ([pose.srotX, pose.srotY, pose.srotZ].every(Number.isFinite)) {
    STAGE.rotationEuler = [pose.srotX * rad, pose.srotY * rad, pose.srotZ * rad];
    DEV.dirtyStage = true;
  }
  if (Number.isFinite(pose.sscale) && pose.sscale > 0) {
    STAGE.scale = pose.sscale;
    DEV.dirtyStage = true;
  }
  if (Number.isFinite(pose.tilt)) {
    START.tilt = pose.tilt * rad;
    DEV.dirtyQuat = true;
  }
  if (Number.isFinite(pose.lift)) SETTLE.arcLift = pose.lift;
  if (Number.isFinite(pose.pscale) && pose.pscale > 0) SETTLE.scale = pose.pscale;
  if (Number.isFinite(pose.shine)) {
    SHINE.progress = Math.max(0, Math.min(1, pose.shine));
  }
  if (Number.isFinite(pose.oledLuminance)) {
    OLED.luminance = Math.max(0, Math.min(1, pose.oledLuminance));
    syncOledLuminance();
  }
  if (Number.isFinite(pose.lightAmbient)) {
    LIGHT.amb = Math.max(0, Math.min(1, pose.lightAmbient));
  }
  if (Number.isFinite(pose.lightKey)) {
    LIGHT.key = Math.max(0, Math.min(5, pose.lightKey));
  }
  if (Number.isFinite(pose.lightFill)) {
    LIGHT.fill = Math.max(0, Math.min(3, pose.lightFill));
  }
  if (Number.isFinite(pose.lightEnvironment)) {
    LIGHT.env = Math.max(0, Math.min(3, pose.lightEnvironment));
    DEV.dirtyLight = true;
  }
  if (Number.isFinite(pose.exp)) {
    LIGHT.exp = Math.max(0.1, Math.min(3, pose.exp));
    DEV.dirtyLight = true;
  }
  if ([pose.lightKeyX, pose.lightKeyY, pose.lightKeyZ].every(Number.isFinite)) {
    LIGHT.keyPosition = [
      clampLightPosition(pose.lightKeyX),
      clampLightPosition(pose.lightKeyY),
      clampLightPosition(pose.lightKeyZ),
    ];
  }
  if (Number.isFinite(pose.lightKeyTemperature)) {
    LIGHT.keyTemperature = clampLightTemperature(pose.lightKeyTemperature);
  }
  if ([pose.lightFillX, pose.lightFillY, pose.lightFillZ].every(Number.isFinite)) {
    LIGHT.fillPosition = [
      clampLightPosition(pose.lightFillX),
      clampLightPosition(pose.lightFillY),
      clampLightPosition(pose.lightFillZ),
    ];
  }
  if (Number.isFinite(pose.lightFillTemperature)) {
    LIGHT.fillTemperature = clampLightTemperature(pose.lightFillTemperature);
  }
  // v7.3 — glass registration is a pose/path parameter. This is the swap
  // choreography: drive the unit out along a path, flip crack OFF at the
  // out-of-shot node, drive it back in clean.
  if ([pose.glassRegX, pose.glassRegY, pose.glassRegZ].every(Number.isFinite)) {
    const clampReg = (v) =>
      Math.max(-GLASS_REG_RANGE, Math.min(GLASS_REG_RANGE, v));
    GLASS_REG.x = clampReg(pose.glassRegX);
    GLASS_REG.y = clampReg(pose.glassRegY);
    GLASS_REG.z = clampReg(pose.glassRegZ);
  }
  if (Number.isFinite(pose.__crackPresence)) {
    CRACK.mix = Math.max(0, Math.min(1, pose.__crackPresence));
    CRACK.on = CRACK.mix > 0.0001;
  } else if (typeof pose.crackOn === "boolean") {
    CRACK.on = pose.crackOn;
    CRACK.mix = pose.crackOn ? 1 : 0;
  }
  CRACK.useDefault = poseUsesDefaultCrackPosition(pose);
  CRACK.exit = pose.__crackPositionResolved &&
    [pose.crackExitX, pose.crackExitY].every(Number.isFinite)
    ? [pose.crackExitX, pose.crackExitY]
    : effectivePoseCrackPosition(pose);
  if (Number.isFinite(pose.crackSeverity)) {
    CRACK.severity = Math.max(0, Math.min(1, pose.crackSeverity));
  }
  if (Number.isFinite(pose.crackSharpness)) {
    CRACK.sharpness = Math.max(0.35, Math.min(3, pose.crackSharpness));
  }
  syncCrackAppearance();
  if (Number.isFinite(pose.p)) {
    const p = Math.max(0, Math.min(1, pose.p));
    DEV.lastP = p;
    if (DEV.applyProgress) DEV.applyProgress(p);
  }

  DEV.pathPreview = true;
}

function syncPoseControls(pose) {
  if (!pose || !DEV.setLeva) return;
  WIRE.suspended = true;
  const writes = { drive: driveLabel() };
  for (const k of Object.keys(pose)) {
    if (LEVA_KEYS.has(k)) writes[k] = pose[k];
  }
  DEV.setLeva(writes);
  if (typeof pose.crackOn === "boolean") setCrackOn(pose.crackOn);
  WIRE.suspended = false;
}

function encodeMotionPath(path) {
  const json = JSON.stringify(path);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeMotionPath(value) {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (parsed && parsed.type === "iglass-motion-path" && Array.isArray(parsed.nodes)) {
      const nodes = parsed.nodes
        .filter((node) => node && node.pose && typeof node.pose === "object")
        .map((node, i) => ({
          duration: i === 0 ? 0 : Math.max(0.1, Number(node.duration) || 1.25),
          hold: Math.max(0, Number(node.hold) || 0),
          motionMode: ["inherit", "continuous", "custom"].includes(node.motionMode)
            ? node.motionMode
            : "inherit",
          ease: MOTION_EASES[node.ease] ? node.ease : "cinematic",
          easeStrength: Number.isFinite(Number(node.easeStrength))
            ? Math.max(0, Math.min(1, Number(node.easeStrength)))
            : 1,
          departureEase: MOTION_EASES[node.departureEase]
            ? node.departureEase
            : "accelerate",
          departureEaseStrength: Number.isFinite(Number(node.departureEaseStrength))
            ? Math.max(0, Math.min(1, Number(node.departureEaseStrength)))
            : 1,
          position:
            Array.isArray(node.position) && node.position.length === 3
              ? node.position.map(Number)
              : [node.pose.sposX, node.pose.sposY, node.pose.sposZ],
          pose: withAnimatedLightingDefaults(node.pose),
        }));
      if (!nodes.length) return null;
      const legacy = Number(parsed.version) < 2;
      return attachMotionCurve({
        ...defaultMotionPath(),
        ...parsed,
        type: "iglass-motion-path",
        version: 3,
        trajectory: parsed.trajectory === "line" ? "line" : "curve",
        curveType: legacy ? "catmullrom" : parsed.curveType || "centripetal",
        arcLength: legacy ? false : parsed.arcLength !== false,
        continuous: legacy ? false : parsed.continuous !== false,
        globalEaseStrength: Number.isFinite(Number(parsed.globalEaseStrength))
          ? Math.max(0, Math.min(1, Number(parsed.globalEaseStrength)))
          : 1,
        glassOutEase: MOTION_EASES[parsed.glassOutEase]
          ? parsed.glassOutEase
          : "linear",
        glassOutEaseStrength: Number.isFinite(Number(parsed.glassOutEaseStrength))
          ? Math.max(0, Math.min(1, Number(parsed.glassOutEaseStrength)))
          : 1,
        glassReturnEase: MOTION_EASES[parsed.glassReturnEase]
          ? parsed.glassReturnEase
          : "linear",
        glassReturnEaseStrength: Number.isFinite(Number(parsed.glassReturnEaseStrength))
          ? Math.max(0, Math.min(1, Number(parsed.glassReturnEaseStrength)))
          : 1,
        glassReturnSpan: Number.isFinite(Number(parsed.glassReturnSpan))
          ? Math.max(0.1, Math.min(1, Number(parsed.glassReturnSpan)))
          : 1,
        speed: Math.max(0.1, Number(parsed.speed) || 1),
        loop: parsed.loop !== false,
        nodes,
      });
    }
  } catch (e) {
    /* invalid motion payload -> fall back to the normal timeline */
  }
  return null;
}

function loadSlots() {
  try {
    const raw = window.localStorage.getItem(SLOT_KEY);
    const arr = raw ? JSON.parse(raw) : null;
    if (Array.isArray(arr)) {
      const out = Array(SLOT_COUNT).fill(null);
      const n = Math.min(arr.length, SLOT_COUNT);
      for (let i = 0; i < n; i++) {
        const pose = arr[i];
        out[i] = pose && typeof pose === "object"
          ? {
              ...withAnimatedLightingDefaults(pose),
              shine: Number.isFinite(pose.shine) ? pose.shine : 0,
            }
          : null;
      }
      return out;
    }
  } catch (e) {
    /* corrupted store → fresh grid */
  }
  return Array(SLOT_COUNT).fill(null);
}

function persistSlots(slots) {
  try {
    window.localStorage.setItem(SLOT_KEY, JSON.stringify(slots));
  } catch (e) {
    /* storage full/blocked — slots stay session-only */
  }
}

function loadSlotRecord(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
}

function persistSlotRecord(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* metadata/thumbnails stay session-only if storage is unavailable */
  }
}

function loadMotionLibrary() {
  const saved = loadSlotRecord(MOTION_LIBRARY_KEY, []);
  const library = Array.isArray(saved) ? saved : [];

  // One-time, lossless migration of the former fixed A/B/C comparison banks
  // into the unlimited path list. The old key is left untouched as backup.
  const legacy = loadSlotRecord(LEGACY_MOTION_COMPARE_KEY, []);
  if (!Array.isArray(legacy)) return library;
  const migrated = legacy
    .map((bank, index) => {
      if (!bank?.path) return null;
      const id = `legacy-comparison-${index}`;
      return {
        id,
        name: bank.name || `Comparison ${String.fromCharCode(65 + index)}`,
        versions: [{ savedAt: bank.savedAt || new Date().toISOString(), path: bank.path }],
      };
    })
    .filter(Boolean)
    .filter((entry) => !library.some((savedEntry) => savedEntry.id === entry.id));
  return [...library, ...migrated];
}

// The working path in MOTION_PATH_KEY survives a refresh; this is what it
// came FROM. Persisting the pair together is what lets UPDATE keep working
// across sessions instead of only until the next reload.
function loadMotionPathLink() {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(MOTION_PATH_LINK_KEY);
    const parsed = raw ? JSON.parse(raw) : "";
    return typeof parsed === "string" ? parsed : "";
  } catch (e) {
    return "";
  }
}

function persistMotionPathLink(id) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MOTION_PATH_LINK_KEY, JSON.stringify(id || ""));
  } catch (e) {
    /* storage blocked -> the link stays session-only */
  }
}

function capturePoseThumbnail() {
  const src = DEV.canvasEl;
  if (!src) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 120;
    canvas.height = 68;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.5);
  } catch (e) {
    return null;
  }
}

function downloadJSON(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function readPoseParams() {
  const o = {};
  for (const k of Object.keys(DRIVE_READERS)) o[k] = DRIVE_READERS[k]();
  // Glass registration, effective crack X/Y, appearance, and the explicit
  // default/manual crack-position state save with the pose.
  // A mid-leg scrub sits inside an ON -> OFF fade, where CRACK.mix is
  // fractional. Saving the nearer authored state means a pose captured
  // just off a node still records the intent, not the transition.
  o.crackOn = Number.isFinite(CRACK.mix) ? CRACK.mix >= 0.5 : !!CRACK.on;
  o.crackUseDefault = CRACK.useDefault;
  o.p = DEV.lastP;
  return o;
}

function takeSnapshot(slot) {
  SNAPSHOTS[slot] = readPoseParams();
}

function warpToParams(snap) {
  if (!snap || !DEV.setLeva) return;
  WIRE.suspended = true;
  const writes = {};
  for (const k of Object.keys(snap)) {
    if (LEVA_KEYS.has(k)) writes[k] = snap[k];
  }
  const useDefault = poseUsesDefaultCrackPosition(snap);
  CRACK.useDefault = useDefault;
  CRACK.exit = effectivePoseCrackPosition(snap);
  writes.crackUseDefault = useDefault;
  if (useDefault) {
    writes.crackExitX = CRACK.defaultExit[0];
    writes.crackExitY = CRACK.defaultExit[1];
  }
  DEV.setLeva(writes);
  // Authoritative, because the bulk write above cannot be trusted to emit.
  setCrackOn(snap.crackOn !== false);
  if (typeof snap.p === "number") jumpToP(snap.p);
  WIRE.suspended = false;
}

function warpToSnapshot(slot) {
  warpToParams(SNAPSHOTS[slot]);
}

// ---------------------------------------------------------
// SMOOTH SQUARE-UP
// ---------------------------------------------------------
const SQUARE_ANIM = { raf: 0 };

function cancelSquareAnim() {
  if (SQUARE_ANIM.raf) cancelAnimationFrame(SQUARE_ANIM.raf);
  SQUARE_ANIM.raf = 0;
}

function animateQuat(fromQ, toQ, writeFn, ms = 450) {
  cancelSquareAnim();
  const t0 = performance.now();
  const q = new THREE.Quaternion();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / ms);
    q.slerpQuaternions(fromQ, toQ, smoothstep(t));
    writeFn(q);
    if (t < 1) {
      SQUARE_ANIM.raf = requestAnimationFrame(step);
    } else {
      SQUARE_ANIM.raf = 0;
    }
  };
  SQUARE_ANIM.raf = requestAnimationFrame(step);
}

function writeStageEuler(q) {
  if (!DEV.setLeva) return;
  const e = new THREE.Euler().setFromQuaternion(q, "XYZ");
  DEV.setLeva({ srotX: wrapDeg(e.x), srotY: wrapDeg(e.y), srotZ: wrapDeg(e.z) });
}

function writeSettleEuler(q) {
  if (!DEV.setLeva) return;
  const e = new THREE.Euler().setFromQuaternion(q, "XYZ");
  DEV.setLeva({
    settleX: wrapDeg(e.x),
    settleY: wrapDeg(e.y),
    settleZ: wrapDeg(e.z),
  });
}

function squareUpPhone() {
  if (!DEV.setLeva) return;
  const stageQ = stageQuat();

  if (atEndpoint()) {
    const fromLocal = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        SETTLE.targetEuler[0],
        SETTLE.targetEuler[1],
        SETTLE.targetEuler[2]
      )
    );
    const worldPhone = stageQ.clone().multiply(fromLocal);
    const snappedWorld = snapQuatTo90(worldPhone);
    const toLocal = stageQ.clone().invert().multiply(snappedWorld);
    animateQuat(fromLocal, toLocal, writeSettleEuler);
  } else {
    const modelQ = DEV.modelGroup
      ? DEV.modelGroup.quaternion.clone()
      : new THREE.Quaternion();
    const worldPhone = stageQ.clone().multiply(modelQ);
    const snappedWorld = snapQuatTo90(worldPhone);
    const toStage = snappedWorld.clone().multiply(modelQ.clone().invert());
    animateQuat(stageQ.clone(), toStage, writeStageEuler);
  }
}

function squareUpStage() {
  if (!DEV.setLeva) return;
  const from = stageQuat();
  const to = snapQuatTo90(from);
  animateQuat(from, to, writeStageEuler);
}

function driveLabel() {
  const eff = effectiveTarget();
  const routed = eff !== DEV.gizmoTarget;
  return `${MODE_LABELS[DEV.driveMode]} · ${GRAIN_LABELS[DEV.driveGrain]} (${eff}${routed ? " ·auto" : ""})`;
}

function stageQuat() {
  return new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      STAGE.rotationEuler[0],
      STAGE.rotationEuler[1],
      STAGE.rotationEuler[2]
    )
  );
}

function nudgeSettleMoveScreen(set, axis, dir, scale = 1) {
  const step = GRAIN_STEPS.frac[DEV.driveGrain] * dir * scale;
  const aspect = DEV.viewport
    ? DEV.viewport.width / DEV.viewport.height
    : window.innerWidth / window.innerHeight;

  const world =
    axis === "x"
      ? new THREE.Vector3(step * aspect, 0, 0)
      : new THREE.Vector3(0, step, 0);

  const local = world
    .applyQuaternion(stageQuat().invert())
    .divideScalar(STAGE.scale || 1);

  const dShift = local.x / aspect;
  const dVshift = local.y;

  const [sLo, sHi] = DRIVE_CLAMPS.shift;
  const [vLo, vHi] = DRIVE_CLAMPS.vshift;
  set({
    shift: Number(
      Math.min(sHi, Math.max(sLo, SETTLE.xShiftFraction + dShift)).toFixed(4)
    ),
    vshift: Number(
      Math.min(vHi, Math.max(vLo, SETTLE.yShiftFraction + dVshift)).toFixed(4)
    ),
  });
}

function nudgeRotateScreen(set, axis, dir, isRoll, scale = 1) {
  const stepRad =
    (GRAIN_STEPS.deg[DEV.driveGrain] * scale * Math.PI) / 180;
  let axisVec, sign;
  if (isRoll) {
    axisVec = new THREE.Vector3(0, 0, 1);
    sign = SCREEN_ROT_SIGNS.roll;
  } else if (axis === "x") {
    axisVec = new THREE.Vector3(0, 1, 0);
    sign = SCREEN_ROT_SIGNS.yaw;
  } else {
    axisVec = new THREE.Vector3(1, 0, 0);
    sign = SCREEN_ROT_SIGNS.pitch;
  }
  const W = new THREE.Quaternion().setFromAxisAngle(
    axisVec,
    stepRad * dir * sign
  );

  if (effectiveTarget() === "stage") {
    const q = stageQuat().premultiply(W);
    const e = new THREE.Euler().setFromQuaternion(q, "XYZ");
    set({ srotX: wrapDeg(e.x), srotY: wrapDeg(e.y), srotZ: wrapDeg(e.z) });
  } else {
    const Rs = stageQuat();
    const localW = Rs.clone().invert().multiply(W).multiply(Rs);
    const q = new THREE.Quaternion()
      .setFromEuler(
        new THREE.Euler(
          SETTLE.targetEuler[0],
          SETTLE.targetEuler[1],
          SETTLE.targetEuler[2]
        )
      )
      .premultiply(localW);
    const e = new THREE.Euler().setFromQuaternion(q, "XYZ");
    set({ settleX: wrapDeg(e.x), settleY: wrapDeg(e.y), settleZ: wrapDeg(e.z) });
  }
}

function driveNudge(set, axis, dir, scale = 1) {
  cancelSquareAnim();
  const eff = effectiveTarget();
  const mode = DEV.driveMode;

  if (mode === 0 && eff === "settle")
    return nudgeSettleMoveScreen(set, axis, dir, scale);
  if (mode === 1) return nudgeRotateScreen(set, axis, dir, false, scale);
  if (mode === 2 && axis === "x")
    return nudgeRotateScreen(set, axis, dir, true, scale);

  const entry = DRIVE_MAP[eff][mode][axis];
  if (!entry) return;
  const [param, cls, sign] = entry;
  const step = GRAIN_STEPS[cls][DEV.driveGrain] * dir * sign * scale;
  const [lo, hi] = DRIVE_CLAMPS[param];
  const next = Math.min(hi, Math.max(lo, DRIVE_READERS[param]() + step));
  set({ [param]: Number(next.toFixed(4)) });
}

// ---------------------------------------------------------
// URL / manifest serialisation
// ---------------------------------------------------------
function serialiseParams(params) {
  const deg = (r) => Math.round((r * 180) / Math.PI);
  params.set("terminal", TERMINAL_LIGHT_PROFILE);
  params.set("tilt", ((START.tilt * 180) / Math.PI).toFixed(1));
  params.set("settle", SETTLE.targetEuler.map(deg).join(","));
  params.set("shift", SETTLE.xShiftFraction.toFixed(3));
  params.set("vshift", SETTLE.yShiftFraction.toFixed(3));
  params.set("lift", SETTLE.arcLift.toFixed(3));
  params.set("pscale", SETTLE.scale.toFixed(2));
  params.set("size", MODEL.targetSize.toFixed(2));
  params.set("spos", STAGE.position.map((v) => v.toFixed(3)).join(","));
  params.set("srot", STAGE.rotationEuler.map(deg).join(","));
  params.set("sscale", STAGE.scale.toFixed(2));
  params.set(
    "glassreg",
    [GLASS_REG.x, GLASS_REG.y, GLASS_REG.z].map((v) => v.toFixed(3)).join(",")
  );
  // v3.8 — lighting rides the URL so a dialled-in look is reproducible
  // in the Playwright capture exactly like the pose is.
  params.set(
    "light",
    [
      LIGHT.amb,
      LIGHT.key,
      LIGHT.fill,
      LIGHT.env,
      LIGHT.exp,
      ...LIGHT.keyPosition,
      LIGHT.keyTemperature,
      ...LIGHT.fillPosition,
      LIGHT.fillTemperature,
    ]
      .map((v) => v.toFixed(3))
      .join(",")
  );
  params.set(
    "bezel",
    [BEZEL.env, BEZEL.rough, BEZEL.offset].map((v) => v.toFixed(2)).join(",")
  );
  params.set(
    "oled",
    `${OLED.faceCut.toFixed(2)},${OLED.showRim ? 1 : 0},${OLED.luminance.toFixed(3)}`
  );
  params.set(
    "glass",
    [GLASS.rough, GLASS.env, GLASS.opacity, GLASS.clearcoat, GLASS.ccRough]
      .map((v) => v.toFixed(3))
      .join(",")
  );
  params.set(
    "glassfx",
    [
      SHINE.progress,
      SHINE.sweepStrength,
      SHINE.broadWidth,
      SHINE.stripWidth,
      SHINE.angleDeg,
      SHINE.persistent,
      SHINE.glint ? 1 : 0,
      SHINE.glintStrength,
      SHINE.glintSize,
      SHINE.glintAt,
      SHINE.glintSpread,
      SHINE.glintX,
      SHINE.glintY,
      SHINE.customEnv ? 1 : 0,
      SHINE.envBroad,
      SHINE.envStrip,
      SHINE.envRim,
      SHINE.range[0],
      SHINE.range[1],
      SHINE.speed,
      SHINE.envLeft,
    ]
      .map((v) => Number(v).toFixed(4))
      .join(",")
  );
  params.set("envp", LIGHT.preset);
  params.set("envb", LIGHT.blur.toFixed(2));
  // v4.2, on, effectiveX, effectiveY, severity, sharpness,
  // defaultX, defaultY, useDefault.
  params.set(
    "crack",
    [
      4.2,
      CRACK.on ? 1 : 0,
      CRACK.exit[0],
      CRACK.exit[1],
      CRACK.severity,
      CRACK.sharpness,
      CRACK.defaultExit[0],
      CRACK.defaultExit[1],
      CRACK.useDefault ? 1 : 0,
    ]
      .map((v) => v.toFixed(2))
      .join(",")
  );
}

function buildTuningURL() {
  const params = new URLSearchParams(window.location.search);
  serialiseParams(params);
  params.set("dev", "1");
  params.set("p", DEV.lastP.toFixed(3));
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

function buildCaptureBaseURL() {
  const params = new URLSearchParams();
  serialiseParams(params);
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

function copyManifest() {
  const manifest = {
    type: "iglass-capture-manifest",
    version: 1,
    baseURL: buildCaptureBaseURL(),
    sweepParam: "p",
    startValue: 0.0,
    endValue: 1.0,
    totalFrames: 90,
    viewport: { width: 1600, height: 900, deviceScaleFactor: 2 },
    captureSelector: "canvas",
  };
  const json = JSON.stringify(manifest, null, 2);
  if (navigator.clipboard) navigator.clipboard.writeText(json);
}

function buildMotionPathBaseURL(path, slots) {
  const compiled = compileMotionPath(path, slots);
  if (compiled.nodes.length < 2) return null;
  const params = new URLSearchParams();
  serialiseParams(params);
  params.set("motion", encodeMotionPath(compiled));
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

async function copyMotionPreviewURL(path, slots) {
  const base = buildMotionPathBaseURL(path, slots);
  if (!base) return false;
  const url = new URL(base);
  url.searchParams.set("mode", "autoplay");
  if (!navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(url.toString());
    return true;
  } catch (e) {
    return false;
  }
}

async function copyMotionManifest(path, slots) {
  const baseURL = buildMotionPathBaseURL(path, slots);
  if (!baseURL) return false;
  const manifest = {
    type: "iglass-capture-manifest",
    version: 1,
    baseURL,
    sweepParam: "mp",
    startValue: 0,
    endValue: 1,
    totalFrames: 90,
    viewport: { width: 1600, height: 900, deviceScaleFactor: 2 },
    captureSelector: "canvas",
  };
  if (!navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(JSON.stringify(manifest, null, 2));
    return true;
  } catch (e) {
    return false;
  }
}

// ---------------------------------------------------------
// SAVE CARD
// ---------------------------------------------------------
function saveCard() {
  const src = DEV.canvasEl;
  if (!src) return;

  const fw = src.width;
  const fh = src.height;
  const k = Math.max(1, fw / 1200);

  const deg = (r) => Math.round((r * 180) / Math.PI);
  const lines = [
    `p ${DEV.lastP.toFixed(3)}    tilt ${((START.tilt * 180) / Math.PI).toFixed(1)}    size ${MODEL.targetSize.toFixed(2)}`,
    `settle ${SETTLE.targetEuler.map(deg).join(", ")}    pscale ${SETTLE.scale.toFixed(2)}`,
    `shift ${SETTLE.xShiftFraction.toFixed(3)}    vshift ${SETTLE.yShiftFraction.toFixed(3)}    lift ${SETTLE.arcLift.toFixed(3)}`,
    `stage pos ${STAGE.position.map((v) => v.toFixed(2)).join(", ")}    rot ${STAGE.rotationEuler.map(deg).join(", ")}    scl ${STAGE.scale.toFixed(2)}`,
    `glassreg ${[GLASS_REG.x, GLASS_REG.y, GLASS_REG.z].map((v) => v.toFixed(3)).join(", ")}`,
    `light amb ${LIGHT.amb.toFixed(2)}  key ${LIGHT.key.toFixed(2)}  fill ${LIGHT.fill.toFixed(2)}  env ${LIGHT.env.toFixed(2)}  exp ${LIGHT.exp.toFixed(2)}`,
    `bezel env ${BEZEL.env.toFixed(2)}  rough ${BEZEL.rough.toFixed(2)}  offset ${BEZEL.offset.toFixed(2)}    oled cut ${OLED.faceCut.toFixed(2)}  rim ${OLED.showRim ? "on" : "off"}`,
    `glass rough ${GLASS.rough.toFixed(3)}  env ${GLASS.env.toFixed(2)}  opac ${GLASS.opacity.toFixed(2)}  clearcoat ${GLASS.clearcoat.toFixed(2)} / ${GLASS.ccRough.toFixed(3)}`,
    `ibl ${LIGHT.preset}  blur ${LIGHT.blur.toFixed(2)}  envLeft ${SHINE.envLeft.toFixed(2)}    crack ${CRACK.on ? "ON" : "OFF"}  reg ${CRACK.exit.map((v) => v.toFixed(2)).join(", ")}`,
  ];
  const url = buildTuningURL();

  const fsMono = Math.round(24 * k);
  const fsSmall = Math.round(14 * k);
  const fsHead = Math.round(18 * k);
  const lh = Math.round(fsMono * 1.55);
  const lhSmall = Math.round(fsSmall * 1.4);
  const pad = Math.round(28 * k);

  const card = document.createElement("canvas");
  const ctx = card.getContext("2d");

  ctx.font = `${fsSmall}px monospace`;
  const maxW = fw - pad * 2;
  const urlLines = [];
  let lineBuf = "";
  for (const ch of url) {
    if (ctx.measureText(lineBuf + ch).width > maxW) {
      urlLines.push(lineBuf);
      lineBuf = ch;
    } else {
      lineBuf += ch;
    }
  }
  if (lineBuf) urlLines.push(lineBuf);

  const footerH =
    pad +
    fsHead +
    Math.round(12 * k) +
    lines.length * lh +
    Math.round(10 * k) +
    urlLines.length * lhSmall +
    pad;

  card.width = fw;
  card.height = fh + footerH;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, card.width, card.height);
  ctx.drawImage(src, 0, 0);

  ctx.fillStyle = "#e2ece5";
  ctx.fillRect(0, fh, fw, Math.max(2, Math.round(2 * k)));

  let y = fh + pad + fsHead;
  ctx.fillStyle = "#2e7d52";
  ctx.font = `bold ${fsHead}px monospace`;
  ctx.fillText("iGLASS POSE CARD", pad, y);
  const dateStr = new Date().toISOString().slice(0, 16).replace("T", " ");
  ctx.fillText(dateStr, fw - pad - ctx.measureText(dateStr).width, y);

  y += Math.round(12 * k);
  ctx.fillStyle = "#0d1512";
  ctx.font = `${fsMono}px monospace`;
  for (const l of lines) {
    y += lh;
    ctx.fillText(l, pad, y);
  }

  y += Math.round(10 * k);
  ctx.fillStyle = "#5a6b60";
  ctx.font = `${fsSmall}px monospace`;
  for (const l of urlLines) {
    y += lhSmall;
    ctx.fillText(l, pad, y);
  }

  card.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `iglass-pose_p${DEV.lastP.toFixed(2)}_${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, "image/png");
}

// ---------------------------------------------------------
// BACK-SOLVE / CAPTURE
// ---------------------------------------------------------
function captureSettleFromObject(viewport) {
  const obj = DEV.modelGroup;
  if (!obj) return;

  obj.position.z = 0;
  obj.scale.setScalar(obj.scale.x);

  SETTLE.scale = obj.scale.x;
  SETTLE.xShiftFraction = viewport.width
    ? obj.position.x / viewport.width
    : 0;
  SETTLE.yShiftFraction = viewport.height
    ? obj.position.y / viewport.height
    : 0;

  const e = new THREE.Euler().setFromQuaternion(obj.quaternion, "XYZ");
  SETTLE.targetEuler = [e.x, e.y, e.z];
  DEV.dirtyQuat = true;

  if (DEV.setLeva) {
    DEV.setLeva({
      pscale: Number(SETTLE.scale.toFixed(2)),
      shift: Number(SETTLE.xShiftFraction.toFixed(3)),
      vshift: Number(SETTLE.yShiftFraction.toFixed(3)),
      settleX: wrapDeg(e.x),
      settleY: wrapDeg(e.y),
      settleZ: wrapDeg(e.z),
    });
  }
}

function captureStageFromObject() {
  const obj = DEV.stageGroup;
  if (!obj) return;

  obj.scale.setScalar(obj.scale.x);

  STAGE.position = [obj.position.x, obj.position.y, obj.position.z];
  const e = new THREE.Euler().setFromQuaternion(obj.quaternion, "XYZ");
  STAGE.rotationEuler = [e.x, e.y, e.z];
  STAGE.scale = obj.scale.x;

  if (DEV.setLeva) {
    DEV.setLeva({
      sposX: Number(STAGE.position[0].toFixed(2)),
      sposY: Number(STAGE.position[1].toFixed(2)),
      sposZ: Number(STAGE.position[2].toFixed(2)),
      srotX: wrapDeg(e.x),
      srotY: wrapDeg(e.y),
      srotZ: wrapDeg(e.z),
      sscale: Number(STAGE.scale.toFixed(2)),
    });
  }
}

function jumpToP(v) {
  DEV.lastP = v;
  if (DEV.applyProgress) DEV.applyProgress(v);
  if (DEV.setLeva) DEV.setLeva({ drive: driveLabel() });
}

const LEVA_LIGHT = {
  colors: {
    elevation1: "#eef3ef",
    elevation2: "#ffffff",
    elevation3: "#e2ece5",
    accent1: "#2e7d52",
    accent2: "#3c9a68",
    accent3: "#57b981",
    highlight1: "#5a6b60",
    highlight2: "#25332b",
    highlight3: "#0d1512",
  },
  sizes: {
    rootWidth: "340px",
    controlWidth: "180px",
    numberInputMinWidth: "64px",
  },
};

function DevControls({ initialP }) {
  const eulDeg = SETTLE.targetEuler.map((r) => (r * 180) / Math.PI);
  const stageDeg = STAGE.rotationEuler.map((r) => (r * 180) / Math.PI);

  const [, set] = useControls(() => ({
    drive: { value: driveLabel(), editable: false },

    "🔲 glass registration (±35 — drives the pane OUT of shot)": folder(
      {
        glassRegX: {
          value: GLASS_REG.x,
          min: -GLASS_REG_RANGE,
          max: GLASS_REG_RANGE,
          step: 0.05,
          label: "glass ← → (X)",
          onChange: (v) => {
            GLASS_REG.x = v;
            wireTap("glassRegX", v);
          },
        },
        glassRegY: {
          value: GLASS_REG.y,
          min: -GLASS_REG_RANGE,
          max: GLASS_REG_RANGE,
          step: 0.05,
          label: "glass ↑ ↓ (Y)",
          onChange: (v) => {
            GLASS_REG.y = v;
            wireTap("glassRegY", v);
          },
        },
        glassRegZ: {
          value: GLASS_REG.z,
          min: -GLASS_REG_RANGE,
          max: GLASS_REG_RANGE,
          step: 0.05,
          label: "glass depth (Z)",
          onChange: (v) => {
            GLASS_REG.z = v;
            wireTap("glassRegZ", v);
          },
        },
        "bond glass to OLED at current P": button(bondGlassToOLED),
      },
      { collapsed: false }
    ),
    "🎬 stage (whole scene, works at any time)": folder(
      {
        sposX: {
          value: STAGE.position[0],
          min: -3,
          max: 3,
          step: 0.01,
          label: "stage ← → (X)",
          onChange: (v) => {
            STAGE.position[0] = v;
            DEV.dirtyStage = true;
            wireTap("sposX", v);
          },
        },
        sposY: {
          value: STAGE.position[1],
          min: -3,
          max: 3,
          step: 0.01,
          label: "stage ↑ ↓ (Y)",
          onChange: (v) => {
            STAGE.position[1] = v;
            DEV.dirtyStage = true;
            wireTap("sposY", v);
          },
        },
        sposZ: {
          value: STAGE.position[2],
          min: -3,
          max: 3,
          step: 0.01,
          label: "stage depth (Z)",
          onChange: (v) => {
            STAGE.position[2] = v;
            DEV.dirtyStage = true;
            wireTap("sposZ", v);
          },
        },
        srotX: {
          value: stageDeg[0],
          min: -180,
          max: 180,
          step: 1,
          label: "stage pitch °",
          onChange: (v) => {
            STAGE.rotationEuler[0] = (v * Math.PI) / 180;
            DEV.dirtyStage = true;
            wireTap("srotX", v);
          },
        },
        srotY: {
          value: stageDeg[1],
          min: -180,
          max: 180,
          step: 1,
          label: "stage yaw °",
          onChange: (v) => {
            STAGE.rotationEuler[1] = (v * Math.PI) / 180;
            DEV.dirtyStage = true;
            wireTap("srotY", v);
          },
        },
        srotZ: {
          value: stageDeg[2],
          min: -180,
          max: 180,
          step: 1,
          label: "stage roll °",
          onChange: (v) => {
            STAGE.rotationEuler[2] = (v * Math.PI) / 180;
            DEV.dirtyStage = true;
            wireTap("srotZ", v);
          },
        },
        sscale: {
          value: STAGE.scale,
          min: 0.2,
          max: 3,
          step: 0.01,
          label: "stage zoom",
          onChange: (v) => {
            STAGE.scale = v;
            DEV.dirtyStage = true;
            wireTap("sscale", v);
          },
        },
      },
      { collapsed: false }
    ),
    "💥 cracked pane": folder(
      {
        crackOn: {
          value: CRACK.on,
          label: "CRACK  (saved in the pose slot)",
          onChange: (v) => {
            setCrackOn(v);
          },
        },
        crackDefaultX: {
          value: CRACK.defaultExit[0],
          min: -4,
          max: 4,
          step: 0.01,
          label: "default crack X",
          onChange: (v) => {
            CRACK.defaultExit[0] = v;
            persistCrackDefaultPosition(CRACK.defaultExit);
            if (CRACK.useDefault) CRACK.exit[0] = v;
          },
        },
        crackDefaultY: {
          value: CRACK.defaultExit[1],
          min: -4,
          max: 4,
          step: 0.01,
          label: "default crack Y",
          onChange: (v) => {
            CRACK.defaultExit[1] = v;
            persistCrackDefaultPosition(CRACK.defaultExit);
            if (CRACK.useDefault) CRACK.exit[1] = v;
          },
        },
        crackUseDefault: {
          value: CRACK.useDefault,
          label: "use default position  (saved in pose)",
          onChange: (v) => {
            CRACK.useDefault = v;
            if (v) CRACK.exit = [...CRACK.defaultExit];
          },
        },
        crackExitX: {
          value: CRACK.exit[0],
          min: -4,
          max: 4,
          step: 0.01,
          label: "manual crack ← → (X)",
          onChange: (v) => {
            if (!CRACK.useDefault) {
              CRACK.exit[0] = v;
              wireTap("crackExitX", v);
            }
          },
        },
        crackExitY: {
          value: CRACK.exit[1],
          min: -4,
          max: 4,
          step: 0.01,
          label: "manual crack ↑ ↓ (Y)",
          onChange: (v) => {
            if (!CRACK.useDefault) {
              CRACK.exit[1] = v;
              wireTap("crackExitY", v);
            }
          },
        },
        crackSeverity: {
          value: CRACK.severity,
          min: 0,
          max: 1,
          step: 0.01,
          label: "crack severity",
          onChange: (v) => {
            CRACK.severity = v;
            syncCrackAppearance();
            wireTap("crackSeverity", v);
          },
        },
        crackSharpness: {
          value: CRACK.sharpness,
          min: 0.35,
          max: 3,
          step: 0.05,
          label: "crack sharpness",
          onChange: (v) => {
            CRACK.sharpness = v;
            syncCrackAppearance();
            wireTap("crackSharpness", v);
          },
        },
        "underside view": folder(
          {
            crackUndersideEnabled: {
              value: CRACK_UNDERSIDE.enabled,
              label: "show crack from underneath",
              onChange: (v) => {
                CRACK_UNDERSIDE.enabled = !!v;
                syncCrackUndersideMaterial();
              },
            },
            crackUndersideShade: {
              value: CRACK_UNDERSIDE.shade,
              min: 0,
              max: 1,
              step: 0.01,
              label: "underside shade  dark → light",
              onChange: (v) => {
                CRACK_UNDERSIDE.shade = v;
                syncCrackUndersideMaterial();
              },
            },
            crackUndersideOpacity: {
              value: CRACK_UNDERSIDE.opacity,
              min: 0,
              max: 1,
              step: 0.01,
              label: "underside opacity",
              onChange: (v) => {
                CRACK_UNDERSIDE.opacity = v;
                syncCrackUndersideMaterial();
              },
            },
            crackUndersideReflection: {
              value: CRACK_UNDERSIDE.reflection,
              min: 0,
              max: 3,
              step: 0.05,
              label: "underside reflection",
              onChange: (v) => {
                CRACK_UNDERSIDE.reflection = v;
                syncCrackUndersideMaterial();
              },
            },
            crackUndersideRoughness: {
              value: CRACK_UNDERSIDE.roughness,
              min: 0,
              max: 1,
              step: 0.01,
              label: "underside roughness",
              onChange: (v) => {
                CRACK_UNDERSIDE.roughness = v;
                syncCrackUndersideMaterial();
              },
            },
          },
          { collapsed: false }
        ),
      },
      { collapsed: false }
    ),

    // ---- v7.5.3 PREMIUM LIGHTING. Direct, environment and landing-shadow
    // values are exposed independently so exposure is only the final trim. ----
    "💡 lighting": folder(
      {
        lightAmbient: {
          value: LIGHT.amb,
          min: 0,
          max: 1,
          step: 0.01,
          label: "ambient fill",
          onChange: (v) => {
            LIGHT.amb = v;
          },
        },
        lightKey: {
          value: LIGHT.key,
          min: 0,
          max: 5,
          step: 0.05,
          label: "shadow key",
          onChange: (v) => {
            LIGHT.key = v;
          },
        },
        lightKeyX: {
          value: LIGHT.keyPosition[0],
          min: -20,
          max: 20,
          step: 0.1,
          label: "key position X",
          onChange: (v) => {
            LIGHT.keyPosition[0] = clampLightPosition(v);
          },
        },
        lightKeyY: {
          value: LIGHT.keyPosition[1],
          min: -20,
          max: 20,
          step: 0.1,
          label: "key position Y",
          onChange: (v) => {
            LIGHT.keyPosition[1] = clampLightPosition(v);
          },
        },
        lightKeyZ: {
          value: LIGHT.keyPosition[2],
          min: -20,
          max: 20,
          step: 0.1,
          label: "key position Z",
          onChange: (v) => {
            LIGHT.keyPosition[2] = clampLightPosition(v);
          },
        },
        lightKeyTemperature: {
          value: LIGHT.keyTemperature,
          min: LIGHT_TEMPERATURE_MIN,
          max: LIGHT_TEMPERATURE_MAX,
          step: 100,
          label: "key temperature K",
          onChange: (v) => {
            LIGHT.keyTemperature = clampLightTemperature(v);
          },
        },
        lightFill: {
          value: LIGHT.fill,
          min: 0,
          max: 3,
          step: 0.05,
          label: "cool fill",
          onChange: (v) => {
            LIGHT.fill = v;
          },
        },
        lightFillX: {
          value: LIGHT.fillPosition[0],
          min: -20,
          max: 20,
          step: 0.1,
          label: "fill position X",
          onChange: (v) => {
            LIGHT.fillPosition[0] = clampLightPosition(v);
          },
        },
        lightFillY: {
          value: LIGHT.fillPosition[1],
          min: -20,
          max: 20,
          step: 0.1,
          label: "fill position Y",
          onChange: (v) => {
            LIGHT.fillPosition[1] = clampLightPosition(v);
          },
        },
        lightFillZ: {
          value: LIGHT.fillPosition[2],
          min: -20,
          max: 20,
          step: 0.1,
          label: "fill position Z",
          onChange: (v) => {
            LIGHT.fillPosition[2] = clampLightPosition(v);
          },
        },
        lightFillTemperature: {
          value: LIGHT.fillTemperature,
          min: LIGHT_TEMPERATURE_MIN,
          max: LIGHT_TEMPERATURE_MAX,
          step: 100,
          label: "fill temperature K",
          onChange: (v) => {
            LIGHT.fillTemperature = clampLightTemperature(v);
          },
        },
        lightEnvironment: {
          value: LIGHT.env,
          min: 0,
          max: 3,
          step: 0.05,
          label: "environment intensity",
          onChange: (v) => {
            LIGHT.env = v;
            DEV.dirtyLight = true;
          },
        },
        exp: {
          value: LIGHT.exp,
          min: 0.1,
          max: 3,
          step: 0.01,
          label: "exposure (highlight rolloff)",
          onChange: (v) => {
            LIGHT.exp = v;
            DEV.dirtyLight = true;
          },
        },
        envPreset: {
          value: LIGHT.preset,
          options: ENV_PRESETS,
          label: "reflected world (the circle's shape)",
          onChange: (v) => {
            LIGHT.preset = v;
            if (DEV.setEnv) DEV.setEnv(LIGHT.preset, LIGHT.blur);
          },
        },
      },
      { collapsed: false }
    ),

    // ---- v3.9 FRONT GLASS. "spread" is the dial for the hard circle: it
    // blurs the reflection instead of dimming it. "brightness" is separate.
    // clearcoat is the shine — a second specular layer over the base. ----
    "✨ front glass": folder(
      {
        glassRough: {
          value: GLASS.rough,
          min: 0,
          max: 0.6,
          step: 0.005,
          label: "spread (0 = mirror-hard circle)",
          onChange: (v) => {
            GLASS.rough = v;
            if (DEV.glassMat) DEV.glassMat.roughness = v;
          },
        },
        glassEnv: {
          value: GLASS.env,
          min: 0,
          max: 4,
          step: 0.05,
          label: "reflection brightness",
          onChange: (v) => {
            GLASS.env = v;
            if (DEV.glassMat) DEV.glassMat.envMapIntensity = v;
            if (DEV.crackMat) {
              DEV.crackMat.envMapIntensity = crackReflectionIntensity();
            }
          },
        },
        glassOpacity: {
          value: GLASS.opacity,
          min: 0,
          max: 1,
          step: 0.01,
          label: "neutral pane opacity",
          onChange: (v) => {
            GLASS.opacity = v;
            applyPremiumGlassMaterial();
          },
        },
        glassClearcoat: {
          value: GLASS.clearcoat,
          min: 0,
          max: 1,
          step: 0.01,
          label: "clearcoat (the shine)",
          onChange: (v) => {
            GLASS.clearcoat = v;
            if (DEV.glassMat) DEV.glassMat.clearcoat = v;
          },
        },
        glassCCRough: {
          value: GLASS.ccRough,
          min: 0,
          max: 0.5,
          step: 0.005,
          label: "clearcoat softness",
          onChange: (v) => {
            GLASS.ccRough = v;
            if (DEV.glassMat) DEV.glassMat.clearcoatRoughness = v;
          },
        },
      },
      { collapsed: false }
    ),

    // ---- v6 PREMIUM GLASS LAB. `shine` is part of every saved pose and
    // motion path. All other values define the look and ride copy URL / the
    // capture manifest through ?glassfx. ----
    "💎 premium glass lab": folder(
      {
        "reflection sweep": folder(
          {
            shineRange: {
              value: SHINE.range,
              min: 0,
              max: 1,
              step: 0.001,
              label: "automatic range (start → end)",
              onChange: (v) => {
                if (!Array.isArray(v) || v.length !== 2) return;
                SHINE.range = v.map((value) =>
                  Math.max(0, Math.min(1, Number(value) || 0))
                );
              },
            },
            shineSpeed: {
              value: SHINE.speed,
              min: 0.05,
              max: 4,
              step: 0.05,
              label: "automatic speed (progress / sec)",
              onChange: (v) => {
                SHINE.speed = Math.max(0.05, Number(v) || 0.5);
              },
            },
            shine: {
              value: SHINE.progress,
              min: 0,
              max: 1,
              step: 0.001,
              label: "shine progress (SAVED IN POSE)",
              onChange: (v) => {
                SHINE.progress = v;
                wireTap("shine", v);
              },
            },
            shineStrength: {
              value: SHINE.sweepStrength,
              min: 0,
              max: 1.5,
              step: 0.005,
              label: "sweep brightness",
              onChange: (v) => {
                SHINE.sweepStrength = v;
              },
            },
            shineBroadWidth: {
              value: SHINE.broadWidth,
              min: 0.03,
              max: 0.8,
              step: 0.005,
              label: "broad panel width",
              onChange: (v) => {
                SHINE.broadWidth = v;
              },
            },
            shineStripWidth: {
              value: SHINE.stripWidth,
              min: 0.005,
              max: 0.25,
              step: 0.0025,
              label: "bright strip width",
              onChange: (v) => {
                SHINE.stripWidth = v;
              },
            },
            shineAngle: {
              value: SHINE.angleDeg,
              min: -90,
              max: 90,
              step: 1,
              label: "sweep angle °",
              onChange: (v) => {
                SHINE.angleDeg = v;
              },
            },
            shinePersistent: {
              value: SHINE.persistent,
              min: 0,
              max: 0.4,
              step: 0.0025,
              label: "settled panel sheen",
              onChange: (v) => {
                SHINE.persistent = v;
              },
            },
          },
          { collapsed: false }
        ),
        // ---- v7.5.33 TERMINAL LIGHT SWEEP. Tuning only. These are the
        // dials for the phases appended after the sweep above; none of
        // them is a pose value and none of them is saved into a path.
        // Changing one re-times playback on the next sample, because
        // motionPlaybackTiming() reads them every time. ----
        "terminal light sweep (after the shine)": folder(
          {
            terminalLightEnabled: {
              value: activeTerminalLightFx().enabled,
              label: "travelling lights on",
              onChange: (v) => {
                activeTerminalLightFx().enabled = !!v;
              },
            },
            terminalGap: {
              value: activeTerminalLightFx().afterShineGap,
              min: 0,
              max: 0.5,
              step: 0.01,
              label: "gap after glass sweep (s)",
              onChange: (v) => {
                activeTerminalLightFx().afterShineGap = v;
              },
            },
            terminalKeySetup: {
              value: activeTerminalLightFx().key.setup,
              min: 0,
              max: 1.5,
              step: 0.01,
              label: "KEY entry glide min (s)",
              onChange: (v) => {
                activeTerminalLightFx().key.setup = v;
              },
            },
            terminalKeyFrom: {
              value: activeTerminalLightFx().key.fromX,
              min: -20,
              max: 20,
              step: 0.5,
              label: "KEY start X",
              onChange: (v) => {
                activeTerminalLightFx().key.fromX = v;
              },
            },
            terminalKeyTo: {
              value: activeTerminalLightFx().key.toX,
              min: -20,
              max: 20,
              step: 0.5,
              label: "KEY end X",
              onChange: (v) => {
                activeTerminalLightFx().key.toX = v;
              },
            },
            terminalKeyDuration: {
              value: activeTerminalLightFx().key.duration,
              min: 0.05,
              max: 4,
              step: 0.05,
              label: "KEY sweep (s)",
              onChange: (v) => {
                activeTerminalLightFx().key.duration = v;
              },
            },
            terminalFillSetup: {
              value: activeTerminalLightFx().fill.setup,
              min: 0,
              max: 1.5,
              step: 0.01,
              label: "FILL entry glide min (s)",
              onChange: (v) => {
                activeTerminalLightFx().fill.setup = v;
              },
            },
            terminalFillFrom: {
              value: activeTerminalLightFx().fill.fromX,
              min: -20,
              max: 20,
              step: 0.5,
              label: "FILL start X",
              onChange: (v) => {
                activeTerminalLightFx().fill.fromX = v;
              },
            },
            terminalFillTo: {
              value: activeTerminalLightFx().fill.toX,
              min: -20,
              max: 20,
              step: 0.5,
              label: "FILL end X",
              onChange: (v) => {
                activeTerminalLightFx().fill.toX = v;
              },
            },
            terminalFillDuration: {
              value: activeTerminalLightFx().fill.duration,
              min: 0.05,
              max: 4,
              step: 0.05,
              label: "FILL sweep (s)",
              onChange: (v) => {
                activeTerminalLightFx().fill.duration = v;
              },
            },
          },
          { collapsed: false }
        ),
        "controlled glint / halo": folder(
          {
            shineGlint: {
              value: SHINE.glint,
              label: "hero sparkle on",
              onChange: (v) => {
                SHINE.glint = v;
              },
            },
            shineGlintStrength: {
              value: SHINE.glintStrength,
              min: 0,
              max: 3,
              step: 0.01,
              label: "sparkle + halo strength",
              onChange: (v) => {
                SHINE.glintStrength = v;
              },
            },
            shineGlintSize: {
              value: SHINE.glintSize,
              min: 0.02,
              max: 0.4,
              step: 0.005,
              label: "sparkle size",
              onChange: (v) => {
                SHINE.glintSize = v;
              },
            },
            shineGlintAt: {
              value: SHINE.glintAt,
              min: 0,
              max: 1,
              step: 0.005,
              label: "sparkle at progress",
              onChange: (v) => {
                SHINE.glintAt = v;
              },
            },
            shineGlintSpread: {
              value: SHINE.glintSpread,
              min: 0.005,
              max: 0.3,
              step: 0.005,
              label: "sparkle duration",
              onChange: (v) => {
                SHINE.glintSpread = v;
              },
            },
            shineGlintX: {
              value: SHINE.glintX,
              min: 0,
              max: 1,
              step: 0.005,
              label: "sparkle X",
              onChange: (v) => {
                SHINE.glintX = v;
              },
            },
            shineGlintY: {
              value: SHINE.glintY,
              min: 0,
              max: 1,
              step: 0.005,
              label: "sparkle Y",
              onChange: (v) => {
                SHINE.glintY = v;
              },
            },
          },
          { collapsed: true }
        ),
        "studio reflection cards": folder(
          {
            shineCustomEnv: {
              value: SHINE.customEnv,
              label: "custom softbox environment",
              onChange: (v) => {
                SHINE.customEnv = v;
                if (DEV.refreshEnvironment) DEV.refreshEnvironment();
              },
            },
            shineEnvBroad: {
              value: SHINE.envBroad,
              min: 0,
              max: 10,
              step: 0.05,
              label: "broad softbox",
              onChange: (v) => {
                SHINE.envBroad = v;
                if (DEV.refreshEnvironment) DEV.refreshEnvironment();
              },
            },
            shineEnvStrip: {
              value: SHINE.envStrip,
              min: 0,
              max: 15,
              step: 0.05,
              label: "narrow strip card",
              onChange: (v) => {
                SHINE.envStrip = v;
                if (DEV.refreshEnvironment) DEV.refreshEnvironment();
              },
            },
            shineEnvRim: {
              value: SHINE.envRim,
              min: 0,
              max: 10,
              step: 0.05,
              label: "cool rim card",
              onChange: (v) => {
                SHINE.envRim = v;
                if (DEV.refreshEnvironment) DEV.refreshEnvironment();
              },
            },
            shineEnvTop: {
              value: SHINE.envTop,
              min: 0,
              max: 12,
              step: 0.05,
              label: "OVERHEAD reflection bank",
              onChange: (v) => {
                SHINE.envTop = v;
                if (DEV.refreshEnvironment) DEV.refreshEnvironment();
              },
            },
            shineEnvLeft: {
              value: SHINE.envLeft,
              min: 0,
              max: 4,
              step: 0.05,
              label: "LEFT card bank (0 = old rig)",
              onChange: (v) => {
                SHINE.envLeft = v;
                if (DEV.refreshEnvironment) DEV.refreshEnvironment();
              },
            },
          },
          { collapsed: true }
        ),
      },
      { collapsed: false }
    ),

    // ---- CRACKED PANE. Presence, pane registration, and the requested
    // severity/sharpness controls. Values save into pose slots. Shortcut: C. ----

    // ---- GLASS REGISTRATION (±35, v7.5.26). 1 unit ≈ 0.1 world
    // units; the frame is ~3.1 world units across, so ±35 carries the whole
    // glass unit (pane + bezel + crack) clean out of shot and back — that is
    // the swap move. Saved in pose slots, interpolated by motion paths, and
    // wireable in compound motion for fine work on a range this wide. ----

    // ---- v3.8.1 BEZEL — the black-rim cause is UNRESOLVED, so this is a
    // dial set, not a guess. depth push -> 0 tests one hypothesis;
    // black level off 0 tests the other. ----
    "🖤 bezel": folder(
      {
        bezelEnv: {
          value: BEZEL.env,
          min: 0,
          max: 2,
          step: 0.05,
          label: "black level (0 = dead black)",
          onChange: (v) => {
            BEZEL.env = v;
            if (DEV.bezelMat) DEV.bezelMat.envMapIntensity = v;
          },
        },
        bezelRough: {
          value: BEZEL.rough,
          min: 0,
          max: 1,
          step: 0.01,
          label: "gloss (1 = matte)",
          onChange: (v) => {
            BEZEL.rough = v;
            if (DEV.bezelMat) DEV.bezelMat.roughness = v;
          },
        },
        bezelOffset: {
          value: BEZEL.offset,
          min: -10,
          max: 0,
          step: 0.5,
          label: "depth push (0 = none)",
          onChange: (v) => {
            BEZEL.offset = v;
            if (DEV.bezelMat) {
              DEV.bezelMat.polygonOffset = v !== 0;
              DEV.bezelMat.polygonOffsetFactor = v;
              DEV.bezelMat.polygonOffsetUnits = v;
              DEV.bezelMat.needsUpdate = true;
            }
          },
        },
      },
      { collapsed: false }
    ),

    // ---- v3.8.4 OLED — the face-split cut. Drag toward 0 and the jagged
    // rainbow lip returns at the corners: that IS the v3.8 bug, on demand.
    // Drag toward -1 and the rim goes black long before the cap starves. ----
    "📺 oled": folder(
      {
        oledLuminance: {
          value: OLED.luminance,
          min: 0,
          max: 1,
          step: 0.01,
          label: "screen luminance / reveal",
          onChange: (v) => {
            OLED.luminance = Math.max(0, Math.min(1, v));
            syncOledLuminance();
          },
        },
        oledCut: {
          value: OLED.faceCut,
          min: -1,
          max: 0,
          step: 0.01,
          label: "screen face cut (0 = the bug)",
          onChange: (v) => {
            OLED.faceCut = v;
            applyOledCut(v);
          },
        },
        // The OLED slab's side wall. This is the INNER of the two black
        // trims. Off = gone. On = v3.8.4 behaviour, for comparison.
        oledRim: {
          value: OLED.showRim,
          label: "show OLED rim (trim 2)",
          onChange: (v) => {
            OLED.showRim = v;
            if (DEV.oledRimMat) DEV.oledRimMat.visible = v;
          },
        },
        // The OUTER trim. Toggle it to confirm the attribution by eye:
        // whichever black line vanishes is the one this owns.
        hideBezel: {
          value: false,
          label: "hide bezel (trim 1) — isolate",
          onChange: (v) => {
            for (const m of DEV.bezelMeshes) m.visible = !v;
          },
        },
      },
      { collapsed: false }
    ),

    // ---- v3.8.7 KEYBOARD — this dial scales the HOLD glide only. A tap is
    // always one exact grain step and is never affected by it. ----
    "⌨ keyboard": folder(
      {
        holdGain: {
          value: KEYS.gain,
          min: 0.25,
          max: 6,
          step: 0.05,
          label: "hold speed (taps unaffected)",
          onChange: (v) => {
            KEYS.gain = v;
          },
        },
        holdDelay: {
          value: KEYS.delay,
          min: 0,
          max: 600,
          step: 10,
          label: "hold kick-in (ms)",
          onChange: (v) => {
            KEYS.delay = v;
          },
        },
      },
      { collapsed: true }
    ),

    "🔗 triple compound motion": folder(
      {
        wire: {
          value: false,
          label: "wire on",
          onChange: (v) => {
            WIRE.enabled = v;
            if (v) wireAnchors();
          },
        },
        master: {
          value: WIRE.master,
          options: WIREABLE_OPTIONS,
          onChange: (v) => {
            WIRE.master = v;
            if (WIRE.enabled) wireAnchors();
          },
        },
        drivenA: {
          value: WIRE.drivenA,
          options: WIREABLE_OPTIONS,
          label: "driven A",
          onChange: (v) => {
            WIRE.drivenA = v;
            if (WIRE.enabled) wireAnchors();
          },
        },
        ratioA: {
          value: 1.0,
          min: -20,
          max: 20,
          step: 0.05,
          label: "ratio A",
          onChange: (v) => {
            WIRE.ratioA = v;
          },
        },
        drivenBOn: {
          value: WIRE.drivenBEnabled,
          label: "driven B on (triple)",
          onChange: (v) => {
            WIRE.drivenBEnabled = v;
            if (WIRE.enabled) wireAnchors();
          },
        },
        drivenB: {
          value: WIRE.drivenB,
          options: WIREABLE_OPTIONS,
          label: "driven B",
          onChange: (v) => {
            WIRE.drivenB = v;
            if (WIRE.enabled) wireAnchors();
          },
        },
        ratioB: {
          value: WIRE.ratioB,
          min: -180,
          max: 180,
          step: 0.05,
          label: "ratio B",
          onChange: (v) => {
            WIRE.ratioB = v;
          },
        },
        "↺ reset run": button(wireResetRun),
      },
      { collapsed: false }
    ),
    "📐 phone final pose (end of timeline)": folder(
      {
        tilt: {
          value: (START.tilt * 180) / Math.PI,
          min: -45,
          max: 45,
          step: 0.5,
          label: "start tilt °",
          onChange: (v) => {
            START.tilt = (v * Math.PI) / 180;
            DEV.dirtyQuat = true;
            wireTap("tilt", v);
          },
        },
        settleX: {
          value: eulDeg[0],
          min: -180,
          max: 180,
          step: 1,
          label: "final pitch °",
          onChange: (v) => {
            SETTLE.targetEuler[0] = (v * Math.PI) / 180;
            DEV.dirtyQuat = true;
            wireTap("settleX", v);
          },
        },
        settleY: {
          value: eulDeg[1],
          min: -180,
          max: 180,
          step: 1,
          label: "final yaw °",
          onChange: (v) => {
            SETTLE.targetEuler[1] = (v * Math.PI) / 180;
            DEV.dirtyQuat = true;
            wireTap("settleY", v);
          },
        },
        settleZ: {
          value: eulDeg[2],
          min: -180,
          max: 180,
          step: 1,
          label: "final roll °",
          onChange: (v) => {
            SETTLE.targetEuler[2] = (v * Math.PI) / 180;
            DEV.dirtyQuat = true;
            wireTap("settleZ", v);
          },
        },
        shift: {
          value: SETTLE.xShiftFraction,
          min: -0.5,
          max: 0.5,
          step: 0.005,
          label: "final pos ← → (vw)",
          onChange: (v) => {
            SETTLE.xShiftFraction = v;
            wireTap("shift", v);
          },
        },
        vshift: {
          value: SETTLE.yShiftFraction,
          min: -1,
          max: 1,
          step: 0.005,
          label: "final pos ↑ ↓ (vh)",
          onChange: (v) => {
            SETTLE.yShiftFraction = v;
            wireTap("vshift", v);
          },
        },
        lift: {
          value: SETTLE.arcLift,
          min: -0.5,
          max: 0.5,
          step: 0.005,
          label: "travel arc lift",
          onChange: (v) => {
            SETTLE.arcLift = v;
            wireTap("lift", v);
          },
        },
        pscale: {
          value: SETTLE.scale,
          min: 0.2,
          max: 1.5,
          step: 0.01,
          label: "final size",
          onChange: (v) => {
            SETTLE.scale = v;
            wireTap("pscale", v);
          },
        },
      },
      { collapsed: false }
    ),
    "📦 model": folder(
      {
        size: {
          value: MODEL.targetSize,
          min: 0.5,
          max: 6,
          step: 0.05,
          label: "phone fit size",
          onChange: (v) => {
            MODEL.targetSize = v;
            DEV.dirtyFit = true;
            wireTap("size", v);
          },
        },
      },
      { collapsed: true }
    ),
  }));

  useEffect(() => {
    DEV.setLeva = set;
    if (!SNAPSHOTS.origin) takeSnapshot("origin");
    return () => {
      DEV.setLeva = null;
    };
  }, [set]);

  useEffect(() => {
    const onKey = (ev) => {
      const tag = ev.target && ev.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (ev.key === "Tab") {
        ev.preventDefault();
        DEV.driveMode = (DEV.driveMode + 1) % 3;
        set({ drive: driveLabel() });
        return;
      }
      // ---- ARROWS: tap = one exact step, hold = 60 fps ramped glide ----
      if (ARROWS[ev.key]) {
        ev.preventDefault();

        // Discard the OS's own repeat events. The rAF loop owns the hold;
        // if both ran, they would stack and the glide would double.
        if (ev.repeat) return;
        if (HOLD.keys.has(ev.key)) return;

        const [axis, dir] = ARROWS[ev.key];
        driveNudge(set, axis, dir); // the TAP — full grain step, always
        HOLD.keys.add(ev.key);

        if (!HOLD.raf) {
          HOLD.t0 = performance.now();
          const loop = (now) => {
            if (!HOLD.keys.size) {
              HOLD.raf = 0;
              return;
            }
            const scale = holdScale(now - HOLD.t0);
            if (scale > 0) {
              for (const k of HOLD.keys) {
                const [a, d] = ARROWS[k];
                driveNudge(set, a, d, scale);
              }
            }
            HOLD.raf = requestAnimationFrame(loop);
          };
          HOLD.raf = requestAnimationFrame(loop);
        }
        return;
      }

      const k = ev.key.toLowerCase();
      if (k === "g") {
        DEV.driveGrain = (DEV.driveGrain + 1) % 3;
        set({ drive: driveLabel() });
        return;
      }
      if (k === "c") {
        setCrackOn(!CRACK.on);
        return;
      }
      if (k === "[" || k === "]") {
        const step = GRAIN_STEPS.p[DEV.driveGrain] * (k === "]" ? 1 : -1);
        jumpToP(Math.min(1, Math.max(0, DEV.lastP + step)));
        return;
      }

      if (k === "t") {
        changeGizmoContext(DEV.gizmoTarget === "settle" ? "stage" : "settle");
        return;
      }
      const map = { w: "translate", e: "rotate", r: "scale", q: "off" };
      if (map[k]) setGizmoMode(map[k]);
    };
    const onKeyUp = (ev) => {
      if (!ARROWS[ev.key]) return;
      HOLD.keys.delete(ev.key);
      if (!HOLD.keys.size && HOLD.raf) {
        cancelAnimationFrame(HOLD.raf);
        HOLD.raf = 0;
      }
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    // A key held while the tab loses focus never fires keyup — without this
    // the glide would run forever in the background.
    window.addEventListener("blur", stopHold);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", stopHold);
      stopHold();
    };
  }, [set]);

  return null;
}

// ---------------------------------------------------------
// DEV DASHBOARD
// ---------------------------------------------------------
const UI = {
  panel: {
    position: "fixed",
    top: 12,
    left: 12,
    width: 390,
    zIndex: 1000,
    background: "rgba(255,255,255,0.95)",
    border: "1px solid #dde8e0",
    borderRadius: 12,
    boxShadow: "0 6px 24px rgba(20,60,40,0.14)",
    padding: 10,
    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
    fontSize: 11,
    color: "#0d1512",
    maxHeight: "94vh",
    overflowY: "auto",
    userSelect: "none",
  },
  panelCollapsed: {
    position: "fixed",
    top: 12,
    left: 12,
    width: "auto",
    zIndex: 1000,
    background: "rgba(255,255,255,0.95)",
    border: "1px solid #dde8e0",
    borderRadius: 12,
    boxShadow: "0 6px 24px rgba(20,60,40,0.14)",
    padding: "6px 10px",
    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
    color: "#0d1512",
    userSelect: "none",
  },
  head: {
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: 1,
    color: "#2e7d52",
    margin: "10px 0 4px",
    textTransform: "uppercase",
  },
  row: { display: "flex", flexWrap: "wrap", alignItems: "center" },
  hint: { fontSize: 9, color: "#8aa094", lineHeight: 1.5, marginTop: 8 },
};

const chipStyle = (active, wide) => ({
  padding: wide ? "4px 9px" : "3px 6px",
  margin: 2,
  borderRadius: 6,
  border: "1px solid " + (active ? "#2e7d52" : "#d5e2d9"),
  background: active ? "#2e7d52" : "#f4f8f5",
  color: active ? "#ffffff" : "#25332b",
  cursor: "pointer",
  fontSize: 10,
  lineHeight: 1.4,
  display: "inline-block",
});

const SEL_STYLE = {
  fontFamily: "ui-monospace, Menlo, Consolas, monospace",
  fontSize: 10,
  color: "#25332b",
  background: "#f4f8f5",
  border: "1px solid #d5e2d9",
  borderRadius: 6,
  padding: "3px 4px",
  maxWidth: 96,
};

function DevDashboard() {
  const [, force] = useState(0);
  const panelRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);
  const [motionPath, setMotionPath] = useState(loadMotionPath);
  const [slots, setSlots] = useState(loadSlots);
  const [slotMeta, setSlotMeta] = useState(() => loadSlotRecord(SLOT_META_KEY, {}));
  const [slotThumbs, setSlotThumbs] = useState(() => loadSlotRecord(SLOT_THUMB_KEY, {}));
  const [selectedSlot, setSelectedSlot] = useState(-1);
  const [slotSearch, setSlotSearch] = useState("");
  const [selectedPathNode, setSelectedPathNode] = useState(-1);
  const [pathProgress, setPathProgress] = useState(0);
  const [pathPlaying, setPathPlaying] = useState(false);
  const [status, setStatus] = useState("v7.5.26 — overhead reflections · glass registration ±35");
  const [library, setLibrary] = useState(loadMotionLibrary);
  const [libraryId, setLibraryId] = useState(loadMotionPathLink);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [bulkDuration, setBulkDuration] = useState(1.25);
  const [bulkHold, setBulkHold] = useState(0);
  const [bulkEase, setBulkEase] = useState("cinematic");
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(2);
  const [bridgeFrom, setBridgeFrom] = useState(0);
  const [bridgeTo, setBridgeTo] = useState(1);
  const [bridgeCount, setBridgeCount] = useState(2);
  const [bridgeStyle, setBridgeStyle] = useState("tangent");
  const [bridgeStrength, setBridgeStrength] = useState(1);
  const [bridgeArc, setBridgeArc] = useState(0.35);
  const pathProgressRef = useRef(0);
  const pathPlaybackRef = useRef({ raf: 0, lastUi: 0, lastPose: null });
  const historyRef = useRef({ undo: [], redo: [] });
  const handleHistoryStartRef = useRef(null);
  const nodeChipRefs = useRef([]);
  const nodeStripRef = useRef(null);
  const slotsRef = useRef(slots);
  const slotRevisionRef = useRef(0);
  const libraryRef = useRef(library);
  const thumbnailCaptureTokenRef = useRef(0);

  const commitSlots = (nextSlots) => {
    slotsRef.current = nextSlots;
    slotRevisionRef.current += 1;
    setSlots(nextSlots);
    persistSlots(nextSlots);
    return nextSlots;
  };

  const compiledPath = useMemo(
    () => compileMotionPath(motionPath, slots),
    [motionPath, slots]
  );

  // v7.5.23 — which pose slots are spoken for, and by what. Recomputed from
  // the working path and the library on every change to either, so a slot
  // marks the instant it is appended to the loaded path and unmarks the
  // instant its last reference goes away.
  const slotUsage = useMemo(() => {
    const map = new Map();
    const add = (slot, label) => {
      if (!Number.isInteger(slot) || slot < 0 || slot >= SLOT_COUNT) return;
      if (!map.has(slot)) map.set(slot, new Set());
      map.get(slot).add(label);
    };
    const currentLabel = `${motionPath.name || "Untitled path"} (loaded)`;
    for (const node of motionPath.nodes || []) add(node.slot, currentLabel);
    for (const entry of library) {
      for (const version of entry.versions || []) {
        for (const node of version.path?.nodes || []) add(node.slot, entry.name);
      }
    }
    return map;
  }, [motionPath, library]);
  const activePathNode = useMemo(
    () => nearestMotionNode(compiledPath, pathProgress),
    [compiledPath, pathProgress]
  );
  const velocityDiagnostics = useMemo(
    () => spatialVelocityDiagnostics(compiledPath),
    [compiledPath]
  );
  const velocityGraphPoints = useMemo(() => {
    const width = 276;
    const height = 48;
    const maximum = velocityDiagnostics.maximum;
    const last = velocityDiagnostics.values.length - 1;
    if (last < 1) return "";
    return velocityDiagnostics.values
      .map((value, i) => {
        const x = (i / last) * width;
        const y = height - (maximum > 0 ? (value / maximum) * (height - 4) : 0);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [velocityDiagnostics]);

  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => persistMotionPath(motionPath), [motionPath]);

  // v7.5.21 — persist the link, and drop it if it points at an entry that
  // no longer exists (deleted path, cleared library, imported backup).
  useEffect(() => {
    if (libraryId && !libraryRef.current.some((entry) => entry.id === libraryId)) {
      setLibraryId("");
      return;
    }
    persistMotionPathLink(libraryId);
  }, [libraryId, library]);

  useEffect(() => {
    MOTION_DEV.path = compiledPath;
    MOTION_DEV.progress = pathProgress;
    MOTION_DEV.selectedNode = selectedPathNode;
    MOTION_DEV.activeNode = activePathNode;
    MOTION_DEV.showPath = motionPath.showPath;
    MOTION_DEV.showGhosts = motionPath.showGhosts;
    MOTION_DEV.editHandles = motionPath.editHandles;
    MOTION_DEV.progress = pathProgress;
    MOTION_DEV.version++;
  }, [compiledPath, selectedPathNode, activePathNode, motionPath.showPath, motionPath.showGhosts, motionPath.editHandles]);

  useEffect(() => {
    const chip = nodeChipRefs.current[activePathNode];
    const strip = nodeStripRef.current;
    if (chip && strip) {
      const left = chip.offsetLeft - strip.clientWidth / 2 + chip.offsetWidth / 2;
      strip.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    }
  }, [activePathNode]);

  useEffect(() => {
    MOTION_DEV.moveHandle = (index, position, finished) => {
      setMotionPath((current) => {
        if (!current.nodes[index]) return current;
        if (!handleHistoryStartRef.current) handleHistoryStartRef.current = current;
        const nodes = current.nodes.map((node, i) =>
          i === index ? { ...node, position: position.map((v) => Number(v.toFixed(4))) } : node
        );
        const next = { ...current, nodes };
        if (finished) {
          historyRef.current.undo.push(handleHistoryStartRef.current || current);
          historyRef.current.undo = historyRef.current.undo.slice(-60);
          historyRef.current.redo = [];
          handleHistoryStartRef.current = null;
        }
        return next;
      });
    };
    MOTION_DEV.selectNode = (index) => {
      setSelectedPathNode(index);
      setBridgeFrom(index);
      setBridgeTo(index + 1);
    };
    return () => {
      MOTION_DEV.moveHandle = null;
      MOTION_DEV.selectNode = null;
    };
  }, []);

  useEffect(() => {
    const cw = (DEV.canvasEl && DEV.canvasEl.clientWidth) || window.innerWidth || 1600;
    const pw = collapsed ? 0 : panelRef.current ? panelRef.current.offsetWidth : 390;
    DEV.leftClampNDC = Math.max(-0.9, Math.min(-0.15, -1 + (2 * (22 + pw)) / cw));
  });

  useEffect(() => () => {
    if (pathPlaybackRef.current.raf) cancelAnimationFrame(pathPlaybackRef.current.raf);
    thumbnailCaptureTokenRef.current += 1;
  }, []);

  const pauseMotionPath = (syncControls = true) => {
    if (pathPlaybackRef.current.raf) cancelAnimationFrame(pathPlaybackRef.current.raf);
    pathPlaybackRef.current.raf = 0;
    setPathPlaying(false);
    if (syncControls) {
      syncPoseControls(
        pathPlaybackRef.current.lastPose ||
          sampleMotionPath(compiledPath, pathProgressRef.current)
      );
    }
  };

  const commitMotionPath = (next, record = true) => {
    pauseMotionPath(false);
    if (record) {
      historyRef.current.undo.push(motionPath);
      historyRef.current.undo = historyRef.current.undo.slice(-60);
      historyRef.current.redo = [];
    }
    setMotionPath(normaliseMotionPath(next));
  };

  const undoPath = () => {
    const previous = historyRef.current.undo.pop();
    if (!previous) return;
    pauseMotionPath(false);
    historyRef.current.redo.push(motionPath);
    setMotionPath(previous);
  };

  const redoPath = () => {
    const next = historyRef.current.redo.pop();
    if (!next) return;
    pauseMotionPath(false);
    historyRef.current.undo.push(motionPath);
    setMotionPath(next);
  };

  const applyPathAt = (progress, syncControls = false) => {
    const pose = sampleMotionPath(compiledPath, progress);
    if (!pose) return false;
    const p = Math.max(0, Math.min(1, progress));
    pathProgressRef.current = p;
    MOTION_DEV.progress = p;
    setPathProgress(p);
    applyPoseParamsDirect(pose);
    pathPlaybackRef.current.lastPose = pose;
    if (syncControls) syncPoseControls(pose);
    return true;
  };

  const playMotionPath = (
    pathToPlay = compiledPath,
    settings = motionPath,
    restart = false
  ) => {
    pauseMotionPath(false);
    const pathSpeed = Math.max(0.1, Number(settings.speed) || 1);
    const timing = motionPlaybackTiming(pathToPlay, pathSpeed);
    const total = timing.totalDuration;
    if (pathToPlay.nodes.length < 2 || total <= 0) return;
    let startProgress =
      restart || pathProgressRef.current >= 0.999
        ? 0
        : pathProgressRef.current;
    const startSeconds = startProgress * timing.pathDuration;
    const startedAt = performance.now();
    pathProgressRef.current = startProgress;
    setPathProgress(startProgress);
    setPathPlaying(true);
    const tick = (now) => {
      const seconds = startSeconds + (now - startedAt) / 1000;
      const done = seconds >= total;
      const playbackProgress = settings.loop
        ? (seconds % total) / total
        : Math.min(1, seconds / total);
      const sample = sampleMotionPlayback(
        pathToPlay,
        playbackProgress,
        pathSpeed
      );
      const progress = sample.pathProgress;
      const pose = sample.pose;
      if (pose) {
        pathProgressRef.current = progress;
        MOTION_DEV.progress = progress;
        pathPlaybackRef.current.lastPose = pose;
        if (now - pathPlaybackRef.current.lastUi >= 50 || done) {
          pathPlaybackRef.current.lastUi = now;
          setPathProgress(progress);
        }
        applyPoseParamsDirect(pose);
      }
      if (done && !settings.loop) {
        pathPlaybackRef.current.raf = 0;
        setPathPlaying(false);
        syncPoseControls(pathPlaybackRef.current.lastPose);
        return;
      }
      pathPlaybackRef.current.raf = requestAnimationFrame(tick);
    };
    pathPlaybackRef.current.raf = requestAnimationFrame(tick);
  };

  const addPathNode = (slot) => {
    if (!slotsRef.current[slot]) return;
    const i = motionPath.nodes.length;
    commitMotionPath({
      ...motionPath,
      nodes: [...motionPath.nodes, {
        slot,
        position: null,
        duration: i === 0 ? 0 : 1.25,
        hold: 0,
        motionMode: "inherit",
        ease: "cinematic",
        easeStrength: 1,
        departureEase: "accelerate",
        departureEaseStrength: 1,
      }],
    });
    setSelectedPathNode(i);
  };

  const updateSelectedPathNode = (patch) => {
    if (selectedPathNode < 0 || !motionPath.nodes[selectedPathNode]) return;
    const nodes = motionPath.nodes.map((node, i) =>
      i === selectedPathNode ? { ...node, ...patch } : node
    );
    if (nodes[0]) nodes[0] = { ...nodes[0], duration: 0 };
    commitMotionPath({ ...motionPath, nodes });
  };

  const updateSelectedPathDeparture = (patch) => {
    if (selectedPathNode < 0 || !motionPath.nodes[selectedPathNode]) return;
    const outgoingNode = selectedPathNode + 1;
    if (outgoingNode >= motionPath.nodes.length) return;
    const nodes = motionPath.nodes.map((node, i) =>
      i === selectedPathNode ? { ...node, ...patch } : node
    );
    const startsAtPath = selectedPathNode === 0;
    const startsAfterHold = nodeHoldDuration(nodes[selectedPathNode]) > 0;
    const nextMode = effectiveNodeMotionMode({ ...motionPath, nodes }, outgoingNode);
    if (!startsAtPath && !startsAfterHold && nextMode !== "custom") {
      nodes[outgoingNode] = { ...nodes[outgoingNode], motionMode: "custom" };
    }
    commitMotionPath({ ...motionPath, nodes });
  };

  const movePathNode = (direction) => {
    const to = selectedPathNode + direction;
    if (selectedPathNode < 0 || to < 0 || to >= motionPath.nodes.length) return;
    const nodes = [...motionPath.nodes];
    [nodes[selectedPathNode], nodes[to]] = [nodes[to], nodes[selectedPathNode]];
    if (nodes[0]) nodes[0] = { ...nodes[0], duration: 0 };
    if (nodes[1] && nodes[1].duration <= 0) nodes[1] = { ...nodes[1], duration: 1.25 };
    commitMotionPath({ ...motionPath, nodes });
    setSelectedPathNode(to);
  };

  const removePathNode = () => {
    if (selectedPathNode < 0) return;
    const nodes = motionPath.nodes.filter((_, i) => i !== selectedPathNode);
    if (nodes[0]) nodes[0] = { ...nodes[0], duration: 0 };
    commitMotionPath({ ...motionPath, nodes });
    setSelectedPathNode(Math.min(selectedPathNode, nodes.length - 1));
  };

  const saveSlot = (i) => {
    pauseMotionPath(false);
    const currentSlots = slotsRef.current;
    if (currentSlots[i] && !window.confirm(`Replace pose slot ${i + 1}?`)) return;
    const next = [...currentSlots];
    const savedPose = readPoseParams();
    next[i] = savedPose;
    const meta = {
      ...slotMeta,
      [i]: {
        ...(slotMeta[i] || {}),
        name: slotMeta[i]?.name || `Pose ${i + 1}`,
        updatedAt: new Date().toISOString(),
      },
    };
    const thumb = capturePoseThumbnail();
    const thumbs = thumb ? { ...slotThumbs, [i]: thumb } : slotThumbs;
    commitSlots(next);
    setSlotMeta(meta);
    setSlotThumbs(thumbs);
    setSelectedSlot(i);
    persistSlotRecord(SLOT_META_KEY, meta);
    persistSlotRecord(SLOT_THUMB_KEY, thumbs);
    setStatus(`saved S${i + 1} · Glass Y ${Number(savedPose.glassRegY).toFixed(2)}`);
  };

  const captureMissingSlotThumbnail = (i, token) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (
          token !== thumbnailCaptureTokenRef.current ||
          !slotsRef.current[i]
        ) return;
        const thumb = capturePoseThumbnail();
        if (!thumb) return;
        setSlotThumbs((current) => {
          if (current[i]) return current;
          const thumbs = { ...current, [i]: thumb };
          persistSlotRecord(SLOT_THUMB_KEY, thumbs);
          return thumbs;
        });
        setStatus(`rendered pose slot ${i + 1}`);
      });
    });
  };

  const slotClick = (i, ev) => {
    const currentSlots = slotsRef.current;
    const thumbnailToken = ++thumbnailCaptureTokenRef.current;
    setSelectedSlot(i);
    if (ev.shiftKey) saveSlot(i);
    else if ((ev.ctrlKey || ev.metaKey) && currentSlots[i]) addPathNode(i);
    else if (currentSlots[i]) {
      pauseMotionPath(false);
      warpToParams(currentSlots[i]);
      if (!slotThumbs[i]) {
        // Thumbnail backfills must capture the authored pose, not a damped
        // intermediate frame while glass/material controls are settling.
        DEV.pathPreview = true;
        captureMissingSlotThumbnail(i, thumbnailToken);
      }
    }
  };

  const clearSlot = (i, ev) => {
    if (ev) ev.preventDefault();
    const currentSlots = slotsRef.current;
    if (!currentSlots[i] || !window.confirm(`Delete pose slot ${i + 1}?`)) return;
    pauseMotionPath(false);
    const next = [...currentSlots];
    next[i] = null;
    const meta = { ...slotMeta };
    const thumbs = { ...slotThumbs };
    delete meta[i];
    delete thumbs[i];
    commitSlots(next);
    setSlotMeta(meta);
    setSlotThumbs(thumbs);
    persistSlotRecord(SLOT_META_KEY, meta);
    persistSlotRecord(SLOT_THUMB_KEY, thumbs);
    if (selectedSlot === i) setSelectedSlot(-1);
    setStatus(`deleted slot ${i + 1}; path references are shown red`);
  };

  const applyBulk = (scope) => {
    let lo = 0;
    let hi = motionPath.nodes.length - 1;
    if (scope === "range") {
      lo = Math.max(0, Math.min(hi, Number(rangeStart) - 1));
      hi = Math.max(lo, Math.min(motionPath.nodes.length - 1, Number(rangeEnd) - 1));
    }
    const nodes = motionPath.nodes.map((node, i) =>
      i >= lo && i <= hi
        ? {
            ...node,
            duration: i === 0 ? 0 : Number(bulkDuration),
            hold: Number(bulkHold),
            ease: bulkEase,
            motionMode: i === 0 ? node.motionMode : "custom",
          }
        : node
    );
    commitMotionPath({ ...motionPath, nodes });
    setStatus(`bulk timing applied to ${scope}`);
  };

  const generateBridge = () => {
    const currentSlots = slotsRef.current;
    const from = Number(bridgeFrom);
    const to = Number(bridgeTo);
    if (compiledPath.nodes.length !== motionPath.nodes.length) {
      setStatus("bridge blocked: restore or remove red missing-slot path nodes first");
      return;
    }
    if (to !== from + 1 || from < 0 || to >= compiledPath.nodes.length) {
      setStatus("bridge endpoints must be two adjacent path nodes");
      return;
    }
    const count = Math.max(1, Math.min(6, Number(bridgeCount) || 1));
    const free = currentSlots.map((s, i) => (!s ? i : -1)).filter((i) => i >= 0).slice(0, count);
    if (free.length < count) {
      setStatus(`bridge needs ${count} empty pose slots`);
      return;
    }
    const p0 = new THREE.Vector3(...compiledPath.nodes[from].position);
    const p1 = new THREE.Vector3(...compiledPath.nodes[to].position);
    const prev = new THREE.Vector3(...compiledPath.nodes[Math.max(0, from - 1)].position);
    const nextPoint = new THREE.Vector3(...compiledPath.nodes[Math.min(compiledPath.nodes.length - 1, to + 1)].position);
    const m0 = p0.clone().sub(prev).multiplyScalar(Number(bridgeStrength) || 1);
    const m1 = nextPoint.clone().sub(p1).multiplyScalar(Number(bridgeStrength) || 1);
    const chord = p1.clone().sub(p0);
    let side = chord.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
    if (side.lengthSq() < 1e-8) side = new THREE.Vector3(1, 0, 0);
    const created = [];
    for (let j = 1; j <= count; j++) {
      const t = j / (count + 1);
      const t2 = t * t;
      const t3 = t2 * t;
      const point = p0.clone().multiplyScalar(2 * t3 - 3 * t2 + 1)
        .add(m0.clone().multiplyScalar(t3 - 2 * t2 + t))
        .add(p1.clone().multiplyScalar(-2 * t3 + 3 * t2))
        .add(m1.clone().multiplyScalar(t3 - t2));
      const tangent = p0.clone().multiplyScalar(6 * t2 - 6 * t)
        .add(m0.clone().multiplyScalar(3 * t2 - 4 * t + 1))
        .add(p1.clone().multiplyScalar(-6 * t2 + 6 * t))
        .add(m1.clone().multiplyScalar(3 * t2 - 2 * t))
        .normalize();
      if (bridgeStyle === "rise") point.y += Math.sin(Math.PI * t) * Number(bridgeArc);
      if (bridgeStyle === "orbit") point.add(side.clone().multiplyScalar(Math.sin(Math.PI * t) * Number(bridgeArc)));
      const trackT = (from + t) / (compiledPath.nodes.length - 1);
      const pose = interpolateMotionPose(compiledPath, trackT, { point, tangent });
      pose.sposX = point.x;
      pose.sposY = point.y;
      pose.sposZ = point.z;
      created.push({ slot: free[j - 1], pose, position: point.toArray() });
    }
    const nextSlots = [...currentSlots];
    const meta = { ...slotMeta };
    created.forEach((item, i) => {
      nextSlots[item.slot] = item.pose;
      meta[item.slot] = {
        name: `Bridge ${from + 1}→${to + 1} ${i + 1}`,
        updatedAt: new Date().toISOString(),
      };
    });
    const leg = Math.max(0.1, Number(motionPath.nodes[to].duration) || 1.25) / (count + 1);
    const bridgeNodes = created.map((item) => ({
      slot: item.slot,
      position: item.position,
      duration: leg,
      hold: 0,
      motionMode: "inherit",
      ease: motionPath.continuous ? "linear" : "cinematic",
      easeStrength: 1,
      departureEase: "accelerate",
      departureEaseStrength: 1,
    }));
    const nodes = [...motionPath.nodes];
    nodes.splice(to, 0, ...bridgeNodes);
    nodes[to + count] = { ...nodes[to + count], duration: leg };
    commitSlots(nextSlots);
    setSlotMeta(meta);
    persistSlotRecord(SLOT_META_KEY, meta);
    commitMotionPath({ ...motionPath, nodes });
    setSelectedPathNode(to);
    setStatus(`generated ${count} ${bridgeStyle} bridge poses in slots ${free.map((i) => i + 1).join(", ")}`);
  };

  const persistLibrary = (next) => {
    libraryRef.current = next;
    setLibrary(next);
    persistSlotRecord(MOTION_LIBRARY_KEY, next);
  };

  const embedMotionPath = (path, sourceSlots = slotsRef.current) => ({
    ...normaliseMotionPath(path),
    nodes: path.nodes.map((node) => {
      const pose = resolveMotionNodePose(node, sourceSlots);
      return { ...node, pose: pose ? { ...pose } : null };
    }),
  });

  const savePathVersion = (asNew = false, targetId = libraryId) => {
    const sourceSlots = slotsRef.current;
    const currentLibrary = libraryRef.current;
    const id = asNew || !targetId ? `path-${Date.now()}` : targetId;
    const existing = currentLibrary.find((entry) => entry.id === id);
    const embeddedPath = {
      ...embedMotionPath(motionPath, sourceSlots),
      // v7.5.21 — the name box is authoritative. Previously an existing
      // entry's old name won, so renaming a loaded path then saving it
      // silently discarded the rename.
      name: motionPath.name || existing?.name || "Untitled path",
    };
    const errors = validateMotionPathSnapshot(embeddedPath, sourceSlots);
    if (errors.length) {
      setStatus(`PATH SAVE BLOCKED — ${errors[0]}`);
      return;
    }
    const savedAt = new Date().toISOString();
    const slotThumbnails = {};
    embeddedPath.nodes.forEach((node) => {
      if (slotThumbs[node.slot]) slotThumbnails[node.slot] = slotThumbs[node.slot];
    });
    const version = {
      savedAt,
      appVersion: IGLASS_APP_VERSION,
      snapshotSource: "authoritative-slots",
      slotRevision: slotRevisionRef.current,
      slotThumbnails,
      path: embeddedPath,
    };
    let next;
    if (existing) {
      next = currentLibrary.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              name: motionPath.name || entry.name,
              versions: [...entry.versions, version],
            }
          : entry
      );
    } else {
      next = [...currentLibrary, { id, name: motionPath.name, versions: [version] }];
    }
    persistLibrary(next);
    setLibraryId(id);
    const selectedAudit = embeddedPath.nodes[selectedPathNode];
    const glassAudit = Number.isFinite(selectedAudit?.pose?.glassRegY)
      ? ` · node ${selectedPathNode + 1} S${selectedAudit.slot + 1} Glass Y ${selectedAudit.pose.glassRegY}`
      : "";
    setStatus(`${existing ? "saved new path version" : "saved new named path"} · ${embeddedPath.nodes.length} node poses verified${glassAudit}`);
  };

  // v7.5.20 — OVERWRITE. Replaces one existing version of a saved path
  // with the path currently loaded, instead of appending yet another
  // version or creating yet another path entry.
  const overwritePathVersion = (targetId = libraryId, versionIndex = null) => {
    const sourceSlots = slotsRef.current;
    const currentLibrary = libraryRef.current;
    const entry = currentLibrary.find((item) => item.id === targetId);
    // v7.5.21 — nothing linked (fresh session, cleared path, deleted entry)
    // is not an error. Save the working path as a new library entry and
    // link it, so the very next press overwrites in place.
    if (!entry) {
      savePathVersion(true);
      return;
    }
    const embeddedPath = embedMotionPath(motionPath, sourceSlots);
    if (!embeddedPath.nodes.length) {
      setStatus("PATH UPDATE BLOCKED — the loaded path has no nodes");
      return;
    }
    const errors = validateMotionPathSnapshot(embeddedPath, sourceSlots);
    if (errors.length) {
      setStatus(`PATH UPDATE BLOCKED — ${errors[0]}`);
      return;
    }
    const slotThumbnails = {};
    embeddedPath.nodes.forEach((node) => {
      if (slotThumbs[node.slot]) slotThumbnails[node.slot] = slotThumbs[node.slot];
    });
    const target =
      versionIndex === null
        ? Math.max(0, entry.versions.length - 1)
        : versionIndex;
    const replacement = {
      savedAt: new Date().toISOString(),
      appVersion: IGLASS_APP_VERSION,
      snapshotSource: "authoritative-slots",
      slotRevision: slotRevisionRef.current,
      slotThumbnails,
      path: embeddedPath,
    };
    const next = currentLibrary.map((item) =>
      item.id === targetId
        ? {
            ...item,
            name: motionPath.name || item.name,
            versions: item.versions.length
              ? item.versions.map((v, i) => (i === target ? replacement : v))
              : [replacement],
          }
        : item
    );
    persistLibrary(next);
    setLibraryId(targetId);
    setStatus(`updated “${motionPath.name}” in place · v${target + 1} overwritten · ${embeddedPath.nodes.length} node poses verified`);
  };

  const restoreSavedPathSnapshot = (path) => {
    const restored = slotsWithSavedPathSnapshot(path, slotsRef.current);
    commitSlots(restored.slots);
    return restored;
  };

  const loadLibraryVersion = (entry, versionIndex = entry.versions.length - 1) => {
    const version = entry.versions[versionIndex];
    if (!version) return;
    const path = normaliseMotionPath(version.path);
    const restored = restoreSavedPathSnapshot(path);
    if (
      version.slotThumbnails &&
      typeof version.slotThumbnails === "object" &&
      Object.keys(version.slotThumbnails).length
    ) {
      setSlotThumbs((current) => {
        const thumbs = { ...current, ...version.slotThumbnails };
        persistSlotRecord(SLOT_THUMB_KEY, thumbs);
        return thumbs;
      });
    }
    commitMotionPath(path);
    setLibraryId(entry.id);
    setStatus(`loaded ${entry.name} v${versionIndex + 1} · restored ${restored.restored} node poses`);
  };

  const playLibraryVersion = (
    entry,
    versionIndex = entry.versions.length - 1
  ) => {
    const version = entry.versions[versionIndex];
    if (!version) return;

    // v7.5.20 — PLAY on the path that is ALREADY loaded runs the LIVE
    // slots. Restoring the saved snapshot here overwrote every slot edit
    // made since the load, so a crack switched off on a node reappeared
    // the moment PLAY was pressed. Use "load" to deliberately revert.
    if (libraryId === entry.id && versionIndex === entry.versions.length - 1) {
      if (compiledPath.nodes.length < 2) {
        setStatus(`${entry.name} needs at least two valid nodes`);
        return;
      }
      pauseMotionPath(false);
      setStatus(`playing ${entry.name} · LIVE edits (saved snapshot untouched)`);
      playMotionPath(compiledPath, motionPath, true);
      return;
    }

    const path = normaliseMotionPath(version.path);
    const restored = slotsWithSavedPathSnapshot(path, slotsRef.current);
    const playable = compileMotionPath(path, restored.slots);
    if (playable.nodes.length < 2) {
      setStatus(`${entry.name} needs at least two valid nodes`);
      return;
    }
    pauseMotionPath(false);
    commitSlots(restored.slots);
    historyRef.current.undo.push(motionPath);
    historyRef.current.undo = historyRef.current.undo.slice(-60);
    historyRef.current.redo = [];
    setMotionPath(path);
    setLibraryId(entry.id);
    setStatus(`playing ${entry.name} v${versionIndex + 1} · restored ${restored.restored} node poses`);
    playMotionPath(playable, path, true);
  };

  const resolvedCurrentPathForExport = () => {
    const sourceSlots = slotsRef.current;
    const embeddedPath = embedMotionPath(motionPath, sourceSlots);
    const errors = validateMotionPathSnapshot(embeddedPath, sourceSlots);
    return { sourceSlots, embeddedPath, errors };
  };

  const exportCurrentPath = () => {
    const { embeddedPath, errors } = resolvedCurrentPathForExport();
    if (!embeddedPath.nodes.length) {
      setStatus("CURRENT PATH EXPORT BLOCKED — the loaded path has no nodes");
      return;
    }
    if (errors.length) {
      setStatus(`CURRENT PATH EXPORT BLOCKED — ${errors[0]}`);
      return;
    }
    const { nodes, name, ...settings } = embeddedPath;
    const analysisNodes = nodes.map((node, index) => ({
      nodeNumber: index + 1,
      nodeIndex: index,
      slotNumber: node.slot + 1,
      slotIndex: node.slot,
      slotId: `S${node.slot + 1}`,
      timing: {
        duration: node.duration,
        hold: node.hold,
        motionMode: node.motionMode,
        arrivalEase: node.ease,
        arrivalEaseStrength: node.easeStrength,
        departureEase: node.departureEase,
        departureEaseStrength: node.departureEaseStrength,
      },
      positionOverride: node.position,
      pose: node.pose ? { ...node.pose } : null,
    }));
    const safeName = (motionPath.name || "motion-path").replace(/[^a-z0-9-_]+/gi, "-");
    downloadJSON(`${safeName}-CURRENT-PATH.json`, {
      type: "iglass-current-path",
      schemaVersion: 1,
      appVersion: IGLASS_APP_VERSION,
      scope: "currently-loaded-path-only",
      exportedAt: new Date().toISOString(),
      snapshotSource: "authoritative-slots",
      slotRevision: slotRevisionRef.current,
      numbering: {
        nodeNumber: "one-based UI path order",
        nodeIndex: "zero-based array index",
        slotNumber: "one-based UI pose-slot number",
        slotIndex: "zero-based internal slot index",
      },
      excludes: [
        "saved-path-library",
        "unreferenced-pose-slots",
        "slot-metadata",
        "slot-thumbnails",
      ],
      path: {
        name,
        nodeCount: analysisNodes.length,
        settings,
        nodes: analysisNodes,
      },
    });
    setStatus(`downloaded CURRENT PATH only · ${analysisNodes.length} verified nodes`);
  };

  const exportFullStudioBackup = () => {
    const { sourceSlots, embeddedPath, errors } = resolvedCurrentPathForExport();
    if (errors.length) {
      setStatus(`FULL BACKUP EXPORT BLOCKED — ${errors[0]}`);
      return;
    }
    const safeName = (motionPath.name || "motion-path").replace(/[^a-z0-9-_]+/gi, "-");
    downloadJSON(`${safeName}-FULL-STUDIO-BACKUP.json`, {
      type: "iglass-motion-studio",
      version: 3,
      appVersion: IGLASS_APP_VERSION,
      exportedAt: new Date().toISOString(),
      snapshotSource: "authoritative-slots",
      slotRevision: slotRevisionRef.current,
      crackPositionDefaults: {
        x: CRACK.defaultExit[0],
        y: CRACK.defaultExit[1],
      },
      slots: sourceSlots,
      slotMeta,
      slotThumbs,
      path: embeddedPath,
      library: libraryRef.current,
    });
    setStatus(`downloaded FULL STUDIO BACKUP · ${embeddedPath.nodes.length} active nodes · ${libraryRef.current.length} saved paths`);
  };

  const importStudio = () => {
    try {
      const parsed = JSON.parse(importText);
      let successStatus = "import complete";
      if (parsed.type === "iglass-current-path") {
        const path = motionPathFromCurrentPathExport(parsed);
        const restored = slotsWithSavedPathSnapshot(path, slotsRef.current);
        commitSlots(restored.slots);
        commitMotionPath(path);
        setLibraryId("");
        setSelectedPathNode(-1);
        successStatus = `imported CURRENT PATH · ${path.nodes.length} nodes · restored ${restored.restored} referenced poses`;
      } else if (parsed.type === "iglass-motion-studio" && parsed.path) {
        if (
          Number.isFinite(parsed.crackPositionDefaults?.x) &&
          Number.isFinite(parsed.crackPositionDefaults?.y)
        ) {
          CRACK.defaultExit = [
            Math.max(-4, Math.min(4, parsed.crackPositionDefaults.x)),
            Math.max(-4, Math.min(4, parsed.crackPositionDefaults.y)),
          ];
          persistCrackDefaultPosition(CRACK.defaultExit);
          if (CRACK.useDefault) CRACK.exit = [...CRACK.defaultExit];
          if (DEV.setLeva) {
            DEV.setLeva({
              crackDefaultX: CRACK.defaultExit[0],
              crackDefaultY: CRACK.defaultExit[1],
            });
          }
        }
        const nextSlots = Array(SLOT_COUNT).fill(null);
        (parsed.slots || []).slice(0, SLOT_COUNT).forEach((pose, i) => {
          nextSlots[i] = pose && typeof pose === "object"
            ? {
                ...withAnimatedLightingDefaults(pose),
                shine: Number.isFinite(pose.shine) ? pose.shine : 0,
              }
            : null;
        });
        const meta = parsed.slotMeta || {};
        const thumbs = parsed.slotThumbs || {};
        commitSlots(nextSlots);
        setSlotMeta(meta);
        setSlotThumbs(thumbs);
        persistSlotRecord(SLOT_META_KEY, meta);
        persistSlotRecord(SLOT_THUMB_KEY, thumbs);
        if (Array.isArray(parsed.library)) persistLibrary(parsed.library);
        commitMotionPath(normaliseMotionPath(parsed.path));
        successStatus = "imported FULL STUDIO BACKUP";
      } else if (Array.isArray(parsed.nodes) && parsed.nodes.every((n) => Number.isInteger(n.slot))) {
        commitMotionPath(normaliseMotionPath(parsed));
        successStatus = `imported editable path · ${parsed.nodes.length} nodes`;
      } else {
        throw new Error("not an editable studio/path JSON file");
      }
      setShowImport(false);
      setImportText("");
      setStatus(successStatus);
    } catch (e) {
      setStatus(`import failed: ${e.message}`);
    }
  };

  const primaryFilledCount = slots.slice(0, PRIMARY_SLOT_COUNT).filter(Boolean).length;
  const legacySlotIndexes = slots
    .map((pose, i) => (i >= PRIMARY_SLOT_COUNT && pose ? i : -1))
    .filter((i) => i >= PRIMARY_SLOT_COUNT);
  const visibleSlotIndexes = [
    ...Array.from({ length: PRIMARY_SLOT_COUNT }, (_, i) => i),
    ...legacySlotIndexes,
  ];
  const selectedNode = motionPath.nodes[selectedPathNode] || null;
  const selectedPose = selectedNode
    ? resolveMotionNodePose(selectedNode, slots)
    : null;
  const selectedPosition = selectedNode
    ? selectedNode.position || (selectedPose
        ? [selectedPose.sposX, selectedPose.sposY, selectedPose.sposZ]
        : [0, 0, 0])
    : null;
  const linkedEntry = library.find((entry) => entry.id === libraryId) || null;
  const pathReady = compiledPath.nodes.length >= 2;
  const pathDuration = motionPlaybackTiming(
    compiledPath,
    motionPath.speed
  ).totalDuration;
  const isStage = DEV.gizmoTarget === "stage";
  const routed = effectiveTarget() !== DEV.gizmoTarget;
  const smallNumber = {
    width: 54,
    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
    fontSize: 9,
    border: "1px solid #d5e2d9",
    borderRadius: 4,
    padding: 3,
  };
  const xyzNumber = {
    ...smallNumber,
    width: 72,
    fontSize: 10,
    padding: "4px 7px 4px 4px",
  };

  if (collapsed) {
    return (
      <div ref={panelRef} style={UI.panelCollapsed}>
        <b style={{ color: "#2e7d52", letterSpacing: 1 }}>iGLASS v{IGLASS_APP_VERSION}</b>
        <span style={chipStyle(false)} onClick={() => setCollapsed(false)}>▸ open</span>
      </div>
    );
  }

  return (
    <div ref={panelRef} style={UI.panel}>
      <style>{`
        input[type="number"] {
          min-height: 28px;
        }
        input[type="number"]::-webkit-inner-spin-button {
          opacity: 1;
          width: 18px;
          height: 26px;
          margin: 0;
          cursor: pointer;
        }
      `}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <b style={{ color: "#2e7d52", letterSpacing: 1 }}>iGLASS PRODUCTION STUDIO v{IGLASS_APP_VERSION}</b>
        <span style={chipStyle(false)} onClick={() => setCollapsed(true)}>▾ hide</span>
      </div>
      <div style={{ ...UI.hint, marginTop: 3, color: /failed|BLOCKED/.test(status) ? "#a02b2b" : "#5a6b60" }}>{status}</div>

      <div style={{ marginTop: 6, padding: 6, border: "1px solid #a9cfba", borderRadius: 7, background: "#f6fbf8" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, fontWeight: 700, color: "#2e7d52" }}>
          <span>TIMELINE PLAYHEAD</span>
          <span style={{ display: "flex", alignItems: "center" }}>
            <span>p = {DEV.lastP.toFixed(3)}</span>
            <input
              aria-label="Timeline playhead whole number"
              title="Enter 0–1000; 500 equals p = 0.500"
              type="number"
              min={0}
              max={1000}
              step={1}
              value={Math.round(DEV.lastP * 1000)}
              style={{
                width: 58,
                marginLeft: 6,
                padding: "2px 4px",
                border: "1px solid #a9cfba",
                borderRadius: 4,
                background: "#ffffff",
                color: "#2e7d52",
                fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                fontSize: 9,
                fontWeight: 700,
              }}
              onChange={(e) => {
                const whole = Math.round(Number(e.target.value));
                if (!Number.isFinite(whole)) return;
                const clamped = Math.max(0, Math.min(1000, whole));
                pauseMotionPath(false);
                jumpToP(clamped / 1000);
                force((n) => n + 1);
              }}
            />
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={DEV.lastP}
          style={{ width: "100%", accentColor: "#2e7d52" }}
          onChange={(e) => {
            const value = Number(e.target.value);
            pauseMotionPath(false);
            jumpToP(value);
            force((n) => n + 1);
          }}
        />
        <div style={{ ...UI.hint, marginTop: 2 }}>front-glass teardown / reassembly timeline</div>
      </div>

      <div style={UI.row}>
        <span
          style={chipStyle(CRACK.on, true)}
          title="Explicit crack state; saved into pose slots. Shortcut: C"
          onClick={() => {
            setCrackOn(!CRACK.on);
            force((n) => n + 1);
          }}
        >
          {CRACK.on ? "● cracked" : "○ clean"}
        </span>
      </div>

      <details open>
        <summary style={UI.head}>rig navigation</summary>
        <div style={UI.row}>
          <span style={chipStyle(!isStage, true)} onClick={() => changeGizmoContext("settle")}>📱 phone</span>
          <span style={chipStyle(isStage, true)} onClick={() => changeGizmoContext("stage")}>🎬 stage</span>
          <span style={chipStyle(false)} onClick={squareUpPhone}>⊞ phone</span>
          <span style={chipStyle(false)} onClick={squareUpStage}>⊞ stage</span>
        </div>
        {routed && <div style={{ ...UI.hint, color: "#2e7d52" }}>mid-timeline: phone controls route to stage</div>}
        <div style={UI.row}>
          {["move", "rotate", "off"].map((v) => (
            <span key={v} style={chipStyle(DEV.hudMode === v)} onClick={() => { DEV.hudMode = v; }}>{v}</span>
          ))}
          {GRAIN_LABELS.map((v, i) => (
            <span key={v} style={chipStyle(DEV.driveGrain === i)} onClick={() => { DEV.driveGrain = i; if (DEV.setLeva) DEV.setLeva({ drive: driveLabel() }); }}>{v}</span>
          ))}
        </div>
        <div style={UI.row}>
          {[["W move", "translate"], ["E rotate", "rotate"], ["R scale", "scale"], ["Q off", "off"]].map(([label, v]) => (
            <span key={v} style={chipStyle(DEV.gizmo === v)} onClick={() => setGizmoMode(v)}>{label}</span>
          ))}
        </div>
      </details>

      <details open>
        <summary style={UI.head}>💾 named pose library ({primaryFilledCount}/{PRIMARY_SLOT_COUNT}{legacySlotIndexes.length ? ` + ${legacySlotIndexes.length} legacy` : ""})</summary>
        <div style={{ ...UI.row, flexWrap: "nowrap", gap: 4 }}>
          <input value={slotSearch} placeholder="filter by slot name…" style={{ ...SEL_STYLE, maxWidth: "none", minWidth: 0, flex: 1 }} onChange={(e) => setSlotSearch(e.target.value)} />
          <span
            aria-disabled={selectedSlot < 0 || !slots[selectedSlot]}
            style={{
              ...chipStyle(false, true),
              margin: 0,
              opacity: selectedSlot >= 0 && slots[selectedSlot] ? 1 : 0.4,
              cursor: selectedSlot >= 0 && slots[selectedSlot] ? "pointer" : "default",
            }}
            onClick={(e) => {
              if (selectedSlot >= 0 && slots[selectedSlot]) clearSlot(selectedSlot, e);
            }}
          >Delete</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6, marginTop: 6 }}>
          {visibleSlotIndexes.map((i) => {
            const pose = slots[i];
            const name = slotMeta[i]?.name || `Pose ${i + 1}`;
            const match = !slotSearch || name.toLowerCase().includes(slotSearch.toLowerCase()) || String(i + 1).includes(slotSearch);
            const selected = selectedSlot === i;
            const usedBy = pose ? slotUsage.get(i) : null;
            const inUse = !!(usedBy && usedBy.size);
            return (
              <div
                key={i}
                style={{
                  position: "relative",
                  aspectRatio: "30 / 17",
                  overflow: "hidden",
                  borderRadius: 6,
                  // Orange = referenced by a path. Selection is carried by
                  // the ring instead of the border so it cannot mask usage.
                  border: `2px solid ${pose ? (inUse ? "#e07b1f" : "#2e7d52") : "#d5e2d9"}`,
                  background: pose ? "#e8f0eb" : "#fbfdfb",
                  boxShadow: selected ? "0 0 0 3px rgba(23,61,42,.45)" : "none",
                  cursor: "pointer",
                  opacity: match ? 1 : 0.18,
                  boxSizing: "border-box",
                }}
                title={pose
                  ? `S${i + 1}: ${name}\n${inUse ? `IN USE by ${usedBy.size} path${usedBy.size === 1 ? "" : "s"}: ${[...usedBy].join(", ")}` : "not referenced by any path — safe to overwrite"}\nclick warp · Ctrl-click add to path`
                  : `S${i + 1}: Shift-click to save`}
                onClick={(e) => slotClick(i, e)}
              >
                {pose && slotThumbs[i] ? (
                  <img
                    src={slotThumbs[i]}
                    alt={`Pose ${i + 1}: ${name}`}
                    draggable={false}
                    style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }}
                  />
                ) : (
                  <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: pose ? "#6f8879" : "#9ab0a2", fontSize: 8 }}>
                    {pose ? "click to render" : "empty"}
                  </span>
                )}
                <span style={{ position: "absolute", top: 3, left: 3, padding: "1px 3px", borderRadius: 3, background: pose ? "rgba(9,20,14,.72)" : "rgba(238,244,240,.9)", color: pose ? "#ffffff" : "#708579", fontSize: 8, lineHeight: 1.25 }}>
                  {i + 1}
                </span>
                {pose && (
                  <span style={{ position: "absolute", right: 0, bottom: 0, left: 0, padding: "8px 3px 2px", overflow: "hidden", background: "linear-gradient(transparent, rgba(5,14,9,.72))", color: "#ffffff", fontSize: 7, lineHeight: 1.2, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {name}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ ...UI.hint, marginTop: 4 }}>
          <span style={{ color: "#e07b1f", fontWeight: 700 }}>orange</span> = used by the loaded path or a saved path (hover for which) ·{" "}
          <span style={{ color: "#2e7d52", fontWeight: 700 }}>green</span> = filled, unreferenced, safe to overwrite
        </div>
        <div style={{ ...UI.hint, marginTop: 2 }}>Shift-click saves · Ctrl-click appends · click previews. Use the filter box to reach a slot by name or number.</div>
      </details>

      <details open>
        <summary style={UI.head}>🎬 motion path ({compiledPath.nodes.length}/{motionPath.nodes.length}) · {pathDuration.toFixed(2)}s</summary>
        <input value={motionPath.name} style={{ ...SEL_STYLE, maxWidth: "100%", width: 276 }} onChange={(e) => commitMotionPath({ ...motionPath, name: e.target.value }, false)} />
        <div ref={nodeStripRef} style={{ ...UI.row, minHeight: 28, flexWrap: "nowrap", overflowX: "auto", scrollBehavior: "smooth" }}>
          {!motionPath.nodes.length && <span style={UI.hint}>Ctrl-click named pose slots in travel order.</span>}
          {motionPath.nodes.map((node, i) => {
            const valid = !!slots[node.slot] || !!node.pose;
            const active = i === activePathNode;
            const selected = i === selectedPathNode;
            const held = nodeHoldDuration(node) > 0;
            const overridden = node.motionMode === "custom" || node.motionMode === "continuous";
            return (
              <span
                ref={(el) => { nodeChipRefs.current[i] = el; }}
                key={`${node.slot}-${i}`}
                title={`node ${i + 1} · ${held ? `${nodeHoldDuration(node).toFixed(2)}s hold · ` : ""}${i === 0 ? "start" : `${effectiveNodeMotionMode(motionPath, i)} incoming leg${node.motionMode === "inherit" ? " (inherited)" : " (override)"}`}`}
                style={{
                  ...chipStyle(active),
                  flex: "0 0 auto",
                  borderColor: valid ? (selected ? "#173d2a" : held ? "#b56a16" : overridden ? "#4779a8" : undefined) : "#bd3f3f",
                  boxShadow: selected ? "0 0 0 1px #173d2a" : active ? "0 0 0 2px rgba(46,125,82,.22)" : "none",
                  background: valid ? chipStyle(active).background : "#fff0f0",
                  color: valid ? chipStyle(active).color : "#8b2020",
                }}
                onClick={() => { setSelectedPathNode(i); setBridgeFrom(i); setBridgeTo(i + 1); }}
              >
                {active ? "▶" : ""}{held ? "⏸" : node.motionMode === "custom" ? "◆" : node.motionMode === "continuous" ? "●" : ""}{i + 1}:S{node.slot + 1}
              </span>
            );
          })}
        </div>
        {selectedNode && (
          <div style={{ padding: 5, border: "1px solid #d5e2d9", borderRadius: 6 }}>
            <div style={{ ...UI.row, justifyContent: "space-between" }}>
              <span>node {selectedPathNode + 1} · {slotMeta[selectedNode.slot]?.name || `slot ${selectedNode.slot + 1}`}</span>
              <span>
                <span style={chipStyle(false)} onClick={() => movePathNode(-1)}>←</span>
                <span style={chipStyle(false)} onClick={() => movePathNode(1)}>→</span>
                <span style={chipStyle(false)} onClick={removePathNode}>×</span>
              </span>
            </div>
            <div style={{ marginTop: 4, padding: "5px 6px", borderRadius: 6, background: "#f5faf7", border: "1px solid #c7ddcf" }}>
              <div style={{ ...UI.row, justifyContent: "space-between" }}>
                <b style={{ fontSize: 9, color: "#2e7d52" }}>NODE MOTION</b>
                <span style={{ fontSize: 9 }}>
                  active: {selectedPathNode === 0 ? "start" : effectiveNodeMotionMode(motionPath, selectedPathNode)}
                  {selectedNode.motionMode === "inherit" && selectedPathNode > 0 ? " (inherited)" : ""}
                </span>
              </div>

              {selectedPathNode > 0 && (
                <>
                  <div style={{ ...UI.row, marginTop: 4 }}>
                    <span style={{ fontSize: 9, width: 55 }}>incoming leg</span>
                    {["inherit", "continuous", "custom"].map((mode) => (
                      <span
                        key={mode}
                        style={chipStyle(selectedNode.motionMode === mode, true)}
                        title={mode === "inherit" ? `use path default (${motionPath.continuous ? "continuous" : "custom"})` : `${mode} override for this incoming leg`}
                        onClick={() => updateSelectedPathNode({ motionMode: mode })}
                      >
                        {mode}
                      </span>
                    ))}
                  </div>
                  <div style={{ ...UI.row, marginTop: 3, opacity: effectiveNodeMotionMode(motionPath, selectedPathNode) === "custom" || nodeHoldDuration(selectedNode) > 0 ? 1 : 0.45 }}>
                    <label style={{ fontSize: 9 }}>
                      travel <input type="number" min={0.1} step={0.05} value={selectedNode.duration} style={smallNumber} onChange={(e) => updateSelectedPathNode({ duration: Number(e.target.value) })} />s
                    </label>
                    <span style={{ fontSize: 9, width: 42 }}>arrival</span>
                    <select disabled={effectiveNodeMotionMode(motionPath, selectedPathNode) !== "custom" && nodeHoldDuration(selectedNode) <= 0} style={SEL_STYLE} value={selectedNode.ease} onChange={(e) => updateSelectedPathNode({ ease: e.target.value })}>{Object.entries(MOTION_EASE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                  </div>
                  <div style={{ ...UI.row, marginTop: 2, opacity: effectiveNodeMotionMode(motionPath, selectedPathNode) === "custom" || nodeHoldDuration(selectedNode) > 0 ? 1 : 0.45 }}>
                    <span style={{ fontSize: 9, width: 83 }}>arrival amount</span>
                    <input disabled={effectiveNodeMotionMode(motionPath, selectedPathNode) !== "custom" && nodeHoldDuration(selectedNode) <= 0} type="range" min={0} max={1} step={0.01} value={selectedNode.easeStrength} style={{ width: 132, accentColor: "#2e7d52" }} onChange={(e) => updateSelectedPathNode({ easeStrength: Number(e.target.value) })} />
                    <span style={{ fontSize: 9 }}>{Math.round(selectedNode.easeStrength * 100)}%</span>
                  </div>
                </>
              )}

              <div style={{ ...UI.row, marginTop: 5 }}>
                <span
                  style={chipStyle(nodeHoldDuration(selectedNode) > 0, true)}
                  onClick={() => {
                    const enabled = nodeHoldDuration(selectedNode) <= 0;
                    updateSelectedPathNode({
                      hold: enabled ? 0.25 : 0,
                      ...(enabled && selectedPathNode > 0 ? { motionMode: "custom", ease: "decelerate", easeStrength: 1 } : {}),
                      ...(enabled ? { departureEase: "accelerate", departureEaseStrength: 1 } : {}),
                    });
                  }}
                >
                  {nodeHoldDuration(selectedNode) > 0 ? "hold on" : "hold off"}
                </span>
                <label style={{ fontSize: 9 }}>
                  duration <input type="number" min={0} step={0.05} value={selectedNode.hold} style={smallNumber} onChange={(e) => {
                    const hold = Math.max(0, Number(e.target.value) || 0);
                    const enabling = nodeHoldDuration(selectedNode) <= 0 && hold > 0;
                    updateSelectedPathNode({
                      hold,
                      ...(enabling && selectedPathNode > 0 ? { motionMode: "custom", ease: "decelerate", easeStrength: 1 } : {}),
                      ...(enabling ? { departureEase: "accelerate", departureEaseStrength: 1 } : {}),
                    });
                  }} />s
                </label>
                {selectedPathNode < motionPath.nodes.length - 1 && (
                  <>
                    <span style={{ fontSize: 9, marginLeft: 4 }}>departure</span>
                    <select style={{ ...SEL_STYLE, maxWidth: 86 }} value={selectedNode.departureEase} onChange={(e) => updateSelectedPathDeparture({ departureEase: e.target.value })}>{Object.entries(MOTION_EASE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                  </>
                )}
              </div>

              {selectedPathNode < motionPath.nodes.length - 1 && (
                <div style={{ ...UI.row, marginTop: 3, flexWrap: "nowrap" }}>
                  <span style={{ fontSize: 9, width: 72 }}>depart amount</span>
                  <input type="range" min={0} max={1} step={0.01} value={selectedNode.departureEaseStrength} style={{ width: 108, accentColor: "#2e7d52" }} onChange={(e) => updateSelectedPathDeparture({ departureEaseStrength: Number(e.target.value) })} />
                  <span style={{ fontSize: 9, width: 30 }}>{Math.round(selectedNode.departureEaseStrength * 100)}%</span>
                  <span style={chipStyle(false)} title="reset this node's motion (leg mode, travel, hold, arrival and departure)" onClick={() => updateSelectedPathNode({
                    motionMode: "inherit",
                    duration: selectedPathNode === 0 ? 0 : 1.25,
                    hold: 0,
                    ease: "cinematic",
                    easeStrength: 1,
                    departureEase: "accelerate",
                    departureEaseStrength: 1,
                  })}>reset</span>
                </div>
              )}

              {selectedPathNode >= motionPath.nodes.length - 1 && (
                <div style={{ ...UI.row, marginTop: 3 }}>
                  <span style={chipStyle(false)} title="reset this node's motion" onClick={() => updateSelectedPathNode({
                    motionMode: "inherit",
                    duration: selectedPathNode === 0 ? 0 : 1.25,
                    hold: 0,
                    ease: "cinematic",
                    easeStrength: 1,
                    departureEase: "accelerate",
                    departureEaseStrength: 1,
                  })}>reset</span>
                </div>
              )}
            </div>

            <details style={{ marginTop: 4 }}>
              <summary style={{ ...UI.hint, cursor: "pointer" }}>position override (XYZ)</summary>
              <div style={{ ...UI.row, marginTop: 3 }}>
                {["x", "y", "z"].map((axis, j) => (
                  <label key={axis} style={{ fontSize: 10, marginRight: 4 }}>{axis.toUpperCase()} <input type="number" step={0.01} value={Number(selectedPosition[j]).toFixed(3)} style={xyzNumber} onChange={(e) => { const p = [...selectedPosition]; p[j] = Number(e.target.value); updateSelectedPathNode({ position: p }); }} /></label>
                ))}
                <span style={chipStyle(false)} title="return this handle to its pose position" onClick={() => updateSelectedPathNode({ position: null })}>reset xyz</span>
              </div>
            </details>
          </div>
        )}

        <div style={{ marginTop: 5, padding: "5px 6px", border: "1px solid #d5e2d9", borderRadius: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#2e7d52" }}>
            <b>MOTION PATH PREVIEW</b>
            <span>{activePathNode >= 0 ? `node ${activePathNode + 1}/${compiledPath.nodes.length} · ` : ""}{pathProgress.toFixed(3)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={pathProgress}
            disabled={!pathReady}
            style={{ width: "100%", accentColor: "#2e7d52" }}
            onChange={(e) => {
              pauseMotionPath(false);
              applyPathAt(Number(e.target.value));
            }}
            onPointerUp={() => syncPoseControls(sampleMotionPath(compiledPath, pathProgressRef.current))}
          />
          <div style={{ marginTop: 2 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#6f8879" }}>
              <span>spatial velocity |v|(t)</span>
              <span>avg {velocityDiagnostics.average.toFixed(3)} · max {velocityDiagnostics.maximum.toFixed(3)} u/s</span>
            </div>
            <svg
              width="100%"
              height={52}
              viewBox="0 0 276 52"
              preserveAspectRatio="none"
              role="img"
              aria-label="Spatial velocity over motion-path time"
              style={{ display: "block", marginTop: 1, border: "1px solid #d5e2d9", borderRadius: 4, background: "#fbfdfb" }}
            >
              <line x1="0" y1="48" x2="276" y2="48" stroke="#d5e2d9" strokeWidth="1" />
              <line x1="0" y1="26" x2="276" y2="26" stroke="#edf3ef" strokeWidth="1" />
              {velocityGraphPoints && (
                <polyline
                  points={velocityGraphPoints}
                  fill="none"
                  stroke="#2e7d52"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              <line
                x1={(pathProgress * 276).toFixed(2)}
                y1="0"
                x2={(pathProgress * 276).toFixed(2)}
                y2="52"
                stroke="#d62828"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
          <div style={UI.row}>
            <span style={chipStyle(pathPlaying, true)} onClick={() => pathPlaying ? pauseMotionPath(true) : playMotionPath()}>
              {pathPlaying ? "❚❚ pause" : "▶ preview"}
            </span>
            <span style={chipStyle(false)} onClick={() => { pauseMotionPath(false); applyPathAt(0, true); }}>↺ start</span>
            {/* v7.5.25 — collapsing only swaps this panel's markup. The
                dashboard stays mounted, so playback continues from here
                without dropping a frame or a node. */}
            <span
              style={chipStyle(false)}
              title="collapse the dashboard — playback keeps running"
              onClick={() => setCollapsed(true)}
            >
              ▾ hide
            </span>
          </div>
        </div>

        <details>
          <summary style={{ ...UI.head, marginTop: 5 }}>advanced path settings</summary>
        <div style={{ ...UI.row, marginTop: 5 }}>
          <select style={SEL_STYLE} value={motionPath.trajectory} onChange={(e) => commitMotionPath({ ...motionPath, trajectory: e.target.value })}>
            <option value="curve">Catmull-Rom</option><option value="line">straight</option>
          </select>
          {motionPath.trajectory === "curve" && <select style={SEL_STYLE} value={motionPath.curveType} onChange={(e) => commitMotionPath({ ...motionPath, curveType: e.target.value })}><option value="centripetal">centripetal</option><option value="chordal">chordal</option><option value="catmullrom">uniform</option></select>}
          <span style={chipStyle(motionPath.arcLength)} onClick={() => commitMotionPath({ ...motionPath, arcLength: !motionPath.arcLength })}>arc length</span>
        </div>
        <div style={UI.row}>
          <span style={{ fontSize: 9, width: 56 }}>path default</span>
          <span style={chipStyle(motionPath.continuous, true)} onClick={() => commitMotionPath({ ...motionPath, continuous: true })}>continuous</span>
          <span style={chipStyle(!motionPath.continuous, true)} onClick={() => commitMotionPath({ ...motionPath, continuous: false })}>custom</span>
          <span style={chipStyle(motionPath.loop)} onClick={() => commitMotionPath({ ...motionPath, loop: !motionPath.loop })}>loop</span>
        </div>
        <div style={UI.row}>
          <span style={{ fontSize: 9, width: 78 }}>continuous ease</span>
          <select style={SEL_STYLE} value={motionPath.globalEase} onChange={(e) => commitMotionPath({ ...motionPath, globalEase: e.target.value })}>{Object.entries(MOTION_EASE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </div>
        <div style={UI.row}>
          <span style={{ fontSize: 9, width: 78 }}>ease amount</span>
          <input type="range" min={0} max={1} step={0.01} value={motionPath.globalEaseStrength} style={{ width: 145, accentColor: "#2e7d52" }} onChange={(e) => commitMotionPath({ ...motionPath, globalEaseStrength: Number(e.target.value) }, false)} />
          <span style={{ fontSize: 9 }}>{Math.round(motionPath.globalEaseStrength * 100)}%</span>
        </div>
        <div style={{ ...UI.hint, marginTop: 2 }}>The default applies only to nodes set to inherit. Click any node above to override its incoming leg or add a hold.</div>
        <div style={{ marginTop: 5, padding: "5px 6px", border: "1px solid #a9cfba", borderRadius: 6, background: "#f6fbf8" }}>
          <b style={{ fontSize: 9, color: "#2e7d52" }}>GLASS REGISTRATION MOTION</b>
          <div style={{ ...UI.row, marginTop: 3 }}>
            <span style={{ fontSize: 9, width: 42 }}>OUT</span>
            <select style={SEL_STYLE} value={motionPath.glassOutEase} onChange={(e) => commitMotionPath({ ...motionPath, glassOutEase: e.target.value })}>{Object.entries(MOTION_EASE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <input type="range" min={0} max={1} step={0.01} value={motionPath.glassOutEaseStrength} style={{ width: 92, accentColor: "#2e7d52" }} onChange={(e) => commitMotionPath({ ...motionPath, glassOutEaseStrength: Number(e.target.value) }, false)} />
            <span style={{ fontSize: 9 }}>{Math.round(motionPath.glassOutEaseStrength * 100)}%</span>
          </div>
          <div style={UI.row}>
            <span style={{ fontSize: 9, width: 42 }}>RETURN</span>
            <select style={SEL_STYLE} value={motionPath.glassReturnEase} onChange={(e) => commitMotionPath({ ...motionPath, glassReturnEase: e.target.value })}>{Object.entries(MOTION_EASE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <input type="range" min={0} max={1} step={0.01} value={motionPath.glassReturnEaseStrength} style={{ width: 92, accentColor: "#2e7d52" }} onChange={(e) => commitMotionPath({ ...motionPath, glassReturnEaseStrength: Number(e.target.value) }, false)} />
            <span style={{ fontSize: 9 }}>{Math.round(motionPath.glassReturnEaseStrength * 100)}%</span>
          </div>
          <div style={UI.row}>
            <span style={{ fontSize: 9, width: 95 }}>return duration</span>
            <input type="range" min={0.1} max={1} step={0.01} value={motionPath.glassReturnSpan} style={{ width: 130, accentColor: "#2e7d52" }} onChange={(e) => commitMotionPath({ ...motionPath, glassReturnSpan: Number(e.target.value) }, false)} />
            <span style={{ fontSize: 9 }}>{Math.round(motionPath.glassReturnSpan * 100)}% leg</span>
          </div>
          <div style={{ ...UI.hint, marginTop: 2 }}>OUT/RETURN affect only glass registration XYZ. Lower return duration finishes the glass movement earlier within that camera leg.</div>
        </div>
        <div style={{ ...UI.row, alignItems: "center" }}>
          <span style={{ fontSize: 9, width: 38 }}>speed</span>
          <input type="range" min={0.1} max={3} step={0.05} value={motionPath.speed} style={{ width: 190, accentColor: "#2e7d52" }} onChange={(e) => commitMotionPath({ ...motionPath, speed: Number(e.target.value) }, false)} />
          <span style={{ fontSize: 9 }}>×{motionPath.speed.toFixed(2)}</span>
        </div>
        <div style={UI.row}>
          <select style={{ ...SEL_STYLE, maxWidth: 126 }} value={motionPath.orientationMode} onChange={(e) => commitMotionPath({ ...motionPath, orientationMode: e.target.value })}>
            <option value="quaternion">quaternion track</option><option value="tangent">face tangent</option><option value="lookAt">look at target</option>
          </select>
          <label style={{ fontSize: 9 }}>bank° <input type="number" step={1} value={motionPath.bank} style={smallNumber} onChange={(e) => commitMotionPath({ ...motionPath, bank: Number(e.target.value) })} /></label>
        </div>
        {motionPath.orientationMode === "lookAt" && <div style={UI.row}>{["x", "y", "z"].map((axis, i) => <label key={axis} style={{ fontSize: 9 }}>{axis}<input type="number" step={0.05} value={motionPath.lookAt[i]} style={smallNumber} onChange={(e) => { const lookAt = [...motionPath.lookAt]; lookAt[i] = Number(e.target.value); commitMotionPath({ ...motionPath, lookAt }); }} /></label>)}</div>}
        {motionPath.orientationMode !== "quaternion" && <div style={UI.row}><span style={{ fontSize: 9 }}>orientation offset°</span>{["x", "y", "z"].map((axis, i) => <label key={axis} style={{ fontSize: 9 }}>{axis}<input type="number" step={1} value={motionPath.orientationOffset[i]} style={smallNumber} onChange={(e) => { const orientationOffset = [...motionPath.orientationOffset]; orientationOffset[i] = Number(e.target.value); commitMotionPath({ ...motionPath, orientationOffset }); }} /></label>)}</div>}
        </details>
        <div style={UI.row}>
          <span style={chipStyle(false)} onClick={undoPath}>undo</span>
          <span style={chipStyle(false)} onClick={redoPath}>redo</span>
          <span style={chipStyle(false)} onClick={() => { commitMotionPath(defaultMotionPath()); setSelectedPathNode(-1); }}>clear</span>
          <span style={chipStyle(false)} title="self-contained preview URL" onClick={async () => setStatus(await copyMotionPreviewURL(motionPath, slots) ? "self-contained preview URL copied" : "preview URL needs at least two valid nodes and clipboard permission")}>🔗 preview</span>
          <span style={chipStyle(false)} title="deterministic mp capture manifest" onClick={async () => setStatus(await copyMotionManifest(motionPath, slots) ? "deterministic mp manifest copied" : "manifest needs at least two valid nodes and clipboard permission")}>🎞 manifest</span>
        </div>
      </details>

      <details open>
        <summary style={UI.head}>🧪 path comparison / saved paths ({library.length})</summary>
        <div style={UI.row}>
          <span
            title="Overwrite the linked saved path with what is on screen now, including the name in the box above. Nothing linked? It saves a new path and links it."
            style={chipStyle(true, true)}
            onClick={() => overwritePathVersion(libraryId)}
          >
            ⤓ update path{linkedEntry ? ` — ${linkedEntry.name}` : " (creates + links)"}
          </span>
          <span style={chipStyle(false, true)} onClick={() => savePathVersion(true)}>+ save as new path</span>
        </div>
        <div style={UI.hint}>
          linked: {linkedEntry
            ? `${linkedEntry.name} · ${linkedEntry.versions.length}v · UPDATE overwrites v${linkedEntry.versions.length}`
            : "nothing linked — UPDATE will create and link a new path"}
        </div>
        {!library.length && <div style={UI.hint}>No saved paths yet.</div>}
        {library.map((entry, entryIndex) => {
          const latestIndex = entry.versions.length - 1;
          const latestVersion = entry.versions[latestIndex];
          const latestPath = latestVersion
            ? normaliseMotionPath(latestVersion.path)
            : defaultMotionPath();
          const latestSnapshot = slotsWithSavedPathSnapshot(latestPath, slots);
          const latestCompiled = compileMotionPath(latestPath, latestSnapshot.slots);
          const duration = motionPathDuration(latestCompiled);
          const active = libraryId === entry.id;
          return (
            <div
              key={entry.id}
              style={{ marginTop: 5, padding: "4px 5px", border: `1px solid ${active ? "#2e7d52" : "#d5e2d9"}`, borderRadius: 7, background: active ? "#f2f8f4" : "#ffffff" }}
            >
              <div style={{ ...UI.row, flexWrap: "nowrap" }}>
                <b style={{ width: 20, fontSize: 9, color: "#2e7d52" }}>{entryIndex + 1}</b>
                <span style={{ flex: 1, fontSize: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={entry.name}>
                  {entry.name} · {latestCompiled.nodes.length} nodes · {duration.toFixed(2)}s · {entry.versions.length}v
                </span>
                <span style={chipStyle(false)} onClick={() => loadLibraryVersion(entry)}>load</span>
                <span style={chipStyle(false)} title="overwrite this path's latest version with the loaded path" onClick={() => overwritePathVersion(entry.id)}>update</span>
                <span style={chipStyle(false)} onClick={() => savePathVersion(false, entry.id)}>+ version</span>
                <span style={chipStyle(false)} onClick={() => { if (window.confirm("Delete this saved path and all versions?")) { persistLibrary(library.filter((item) => item.id !== entry.id)); if (libraryId === entry.id) setLibraryId(""); } }}>×</span>
                <span style={chipStyle(true, true)} onClick={() => playLibraryVersion(entry)}>▶ PLAY</span>
              </div>
              <div style={{ display: "flex", flexWrap: "nowrap", gap: 5, marginTop: 5, marginLeft: 18, paddingBottom: 3, overflowX: "auto" }}>
                {latestPath.nodes.map((node, nodeIndex) => {
                  const thumbnail =
                    latestVersion?.slotThumbnails?.[node.slot] ||
                    slotThumbs[node.slot];
                  return (
                    <div
                      key={`${node.slot}-${nodeIndex}`}
                      title={`node ${nodeIndex + 1} · slot ${node.slot + 1}`}
                      style={{ position: "relative", flex: "0 0 78px", aspectRatio: "30 / 17", overflow: "hidden", border: `1px solid ${thumbnail ? "#a9cfba" : "#d5e2d9"}`, borderRadius: 5, background: "#eef4f0" }}
                    >
                      {thumbnail ? (
                        <img src={thumbnail} alt={`Node ${nodeIndex + 1}, pose slot ${node.slot + 1}`} draggable={false} style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }} />
                      ) : (
                        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#8aa094", fontSize: 7 }}>no render</span>
                      )}
                      <span style={{ position: "absolute", top: 2, left: 2, padding: "1px 3px", borderRadius: 3, background: "rgba(9,20,14,.72)", color: "#ffffff", fontSize: 7, lineHeight: 1.2 }}>
                        {nodeIndex + 1}:S{node.slot + 1}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ ...UI.row, marginLeft: 18 }}>
                {entry.versions.map((version, versionIndex) => (
                  <span
                    key={`${version.savedAt}-${versionIndex}`}
                    style={chipStyle(false)}
                    title={`Load ${entry.name} version ${versionIndex + 1}`}
                    onClick={() => loadLibraryVersion(entry, versionIndex)}
                  >
                    v{versionIndex + 1}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        <div style={UI.row}>
          <span style={chipStyle(false, true)} title="Only the currently loaded path; excludes saved paths, unrelated slots and thumbnails" onClick={exportCurrentPath}>download CURRENT PATH</span>
          <span style={chipStyle(false)} title="Complete restorable workspace including all saved paths, slots and thumbnails" onClick={exportFullStudioBackup}>full studio backup</span>
          <span style={chipStyle(showImport)} onClick={() => setShowImport(!showImport)}>import JSON</span>
        </div>
        <div style={UI.hint}>CURRENT PATH is the AI-analysis file. Full studio backup is the restorable workspace containing every saved path.</div>
        {showImport && <div><textarea value={importText} placeholder="Paste CURRENT PATH, full studio backup, or legacy editable path JSON" style={{ width: 276, height: 90, fontSize: 9 }} onChange={(e) => setImportText(e.target.value)} /><div><span style={chipStyle(false, true)} onClick={importStudio}>apply import</span></div><div style={UI.hint}>CURRENT PATH import updates only its referenced pose slots; unrelated slots and saved paths remain unchanged.</div></div>}
      </details>

      <details>
        <summary style={UI.head}>⏱ bulk timing</summary>
        <div style={UI.hint}>Applying bulk timing marks the affected incoming legs as custom; holds remain independently editable afterward.</div>
        <div style={UI.row}>
          <label style={{ fontSize: 9 }}>travel <input type="number" min={0.1} step={0.05} value={bulkDuration} style={smallNumber} onChange={(e) => setBulkDuration(e.target.value)} /></label>
          <label style={{ fontSize: 9 }}>hold <input type="number" min={0} step={0.05} value={bulkHold} style={smallNumber} onChange={(e) => setBulkHold(e.target.value)} /></label>
          <select style={SEL_STYLE} value={bulkEase} onChange={(e) => setBulkEase(e.target.value)}>{Object.entries(MOTION_EASE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </div>
        <div style={UI.row}>
          <span style={chipStyle(false)} onClick={() => applyBulk("all")}>apply all</span>
          <input type="number" min={1} value={rangeStart} style={smallNumber} onChange={(e) => setRangeStart(e.target.value)} />
          <span>→</span>
          <input type="number" min={1} value={rangeEnd} style={smallNumber} onChange={(e) => setRangeEnd(e.target.value)} />
          <span style={chipStyle(false)} onClick={() => applyBulk("range")}>apply range</span>
        </div>
      </details>

      <details open>
        <summary style={UI.head}>🌉 bridge generator</summary>
        <div style={UI.row}>
          <label style={{ fontSize: 9 }}>from node <input type="number" min={1} value={bridgeFrom + 1} style={smallNumber} onChange={(e) => { const v = Number(e.target.value) - 1; setBridgeFrom(v); setBridgeTo(v + 1); }} /></label>
          <label style={{ fontSize: 9 }}>to <input type="number" min={2} value={bridgeTo + 1} style={smallNumber} onChange={(e) => setBridgeTo(Number(e.target.value) - 1)} /></label>
          <label style={{ fontSize: 9 }}>poses <input type="number" min={1} max={6} value={bridgeCount} style={smallNumber} onChange={(e) => setBridgeCount(e.target.value)} /></label>
        </div>
        <div style={UI.row}>
          <select style={SEL_STYLE} value={bridgeStyle} onChange={(e) => setBridgeStyle(e.target.value)}><option value="tangent">tangent</option><option value="rise">rise arc</option><option value="orbit">side orbit</option></select>
          <label style={{ fontSize: 9 }}>tangent× <input type="number" step={0.1} value={bridgeStrength} style={smallNumber} onChange={(e) => setBridgeStrength(e.target.value)} /></label>
          <label style={{ fontSize: 9 }}>arc <input type="number" step={0.05} value={bridgeArc} style={smallNumber} onChange={(e) => setBridgeArc(e.target.value)} /></label>
          <span style={chipStyle(false, true)} onClick={generateBridge}>generate</span>
        </div>
        <div style={UI.hint}>Uses the incoming and outgoing neighbours to preserve tangents; generated bridge poses occupy the first free slots.</div>
      </details>

      <details>
        <summary style={UI.head}>🛠 original actions</summary>
        <div style={UI.row}>
          <span style={chipStyle(false)} onClick={() => takeSnapshot("origin")}>set origin</span>
          <span style={chipStyle(false)} onClick={() => warpToSnapshot("origin")}>⏪ origin</span>
          <span style={chipStyle(false)} onClick={() => { const url = buildTuningURL(); window.history.replaceState(null, "", url); if (navigator.clipboard) navigator.clipboard.writeText(url); }}>📋 rig URL</span>
          <span style={chipStyle(false)} onClick={saveCard}>📸 card</span>
          <span style={chipStyle(false)} onClick={copyManifest}>🎞 base manifest</span>
        </div>
      </details>
    </div>
  );
}

// ---------------------------------------------------------
// SAT-NAV STEERING RING
// ---------------------------------------------------------
function SatNavHUD() {
  const [, force] = useState(0);
  const drag = useRef(null);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 120);
    return () => clearInterval(id);
  }, []);

  const active = DEV.hudMode === "rotate" && DEV.gizmo === "off";

  const cw = (DEV.canvasEl && DEV.canvasEl.clientWidth) || window.innerWidth;
  const ch = (DEV.canvasEl && DEV.canvasEl.clientHeight) || window.innerHeight;
  const cx = cw / 2;
  const cy = ch / 2;
  const R = Math.min(cx, cy) * 0.72;
  const rInner = R * 0.62;

  const onDown = (e) => {
    if (!active || !DEV.setLeva) return;
    const rect = DEV.canvasEl.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const dx = px - cx;
    const dy = py - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > R * 1.15) return;

    cancelSquareAnim();

    const eff = effectiveTarget();
    const isStage = eff === "stage";

    const workQ = isStage
      ? new THREE.Quaternion().setFromEuler(
          new THREE.Euler(
            STAGE.rotationEuler[0],
            STAGE.rotationEuler[1],
            STAGE.rotationEuler[2]
          )
        )
      : new THREE.Quaternion().setFromEuler(
          new THREE.Euler(
            SETTLE.targetEuler[0],
            SETTLE.targetEuler[1],
            SETTLE.targetEuler[2]
          )
        );
    const Rs = stageQuat();
    const mode = dist <= rInner ? "yawpitch" : "roll";

    const state = {
      mode,
      isStage,
      workQ,
      Rs,
      lastX: px,
      lastY: py,
      lastAng: Math.atan2(dy, dx),
    };

    const writeOut = () => {
      const e2 = new THREE.Euler().setFromQuaternion(state.workQ, "XYZ");
      if (state.isStage) {
        DEV.setLeva({
          srotX: wrapDeg(e2.x),
          srotY: wrapDeg(e2.y),
          srotZ: wrapDeg(e2.z),
        });
      } else {
        DEV.setLeva({
          settleX: wrapDeg(e2.x),
          settleY: wrapDeg(e2.y),
          settleZ: wrapDeg(e2.z),
        });
      }
    };

    const move = (ev) => {
      const r2 = DEV.canvasEl.getBoundingClientRect();
      const mx = ev.clientX - r2.left;
      const my = ev.clientY - r2.top;

      const dW = new THREE.Quaternion();

      if (state.mode === "roll") {
        const ang = Math.atan2(my - cy, mx - cx);
        let dAng = ang - state.lastAng;
        if (dAng > Math.PI) dAng -= 2 * Math.PI;
        else if (dAng < -Math.PI) dAng += 2 * Math.PI;
        state.lastAng = ang;
        const delta = dAng * SCREEN_ROT_SIGNS.roll * HUD_ROT_SIGNS.roll;
        dW.setFromAxisAngle(new THREE.Vector3(0, 0, 1), delta);
      } else {
        const gain = 0.006;
        const dxp = mx - state.lastX;
        const dyp = my - state.lastY;
        state.lastX = mx;
        state.lastY = my;
        const yaw = dxp * gain * SCREEN_ROT_SIGNS.yaw * HUD_ROT_SIGNS.yaw;
        const pitch = dyp * gain * SCREEN_ROT_SIGNS.pitch * HUD_ROT_SIGNS.pitch;
        const Qyaw = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          yaw
        );
        const Qpitch = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, 0),
          pitch
        );
        dW.multiplyQuaternions(Qyaw, Qpitch);
      }

      if (state.isStage) {
        state.workQ.premultiply(dW);
      } else {
        const localdW = state.Rs.clone().invert().multiply(dW).multiply(state.Rs);
        state.workQ.premultiply(localdW);
      }
      writeOut();
    };

    const up = () => {
      drag.current = null;
      DEV.lastDragEnd = performance.now();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    drag.current = state;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    e.preventDefault();
  };

  const ringOpacity = active ? 0.5 : 0.14;
  const discFill = active ? "rgba(46,125,82,0.05)" : "rgba(46,125,82,0.02)";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 850,
        pointerEvents: "none",
      }}
    >
      <svg
        width={cw}
        height={ch}
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        <circle
          cx={cx}
          cy={cy}
          r={rInner}
          fill={discFill}
          stroke="#2e7d52"
          strokeOpacity={ringOpacity * 0.5}
          strokeDasharray="4 6"
        />
        <line
          x1={cx - rInner * 0.5}
          y1={cy}
          x2={cx + rInner * 0.5}
          y2={cy}
          stroke="#2e7d52"
          strokeOpacity={ringOpacity * 0.6}
        />
        <line
          x1={cx}
          y1={cy - rInner * 0.5}
          x2={cx}
          y2={cy + rInner * 0.5}
          stroke="#2e7d52"
          strokeOpacity={ringOpacity * 0.6}
        />
        <circle
          cx={cx}
          cy={cy}
          r={R}
          fill="none"
          stroke="#2e7d52"
          strokeOpacity={ringOpacity}
          strokeWidth={active ? 3 : 2}
        />
        <circle
          cx={cx}
          cy={cy}
          r={R * 0.9}
          fill="none"
          stroke="#3c9a68"
          strokeOpacity={ringOpacity * 0.5}
          strokeWidth={1}
        />
        {active &&
          [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const a = (deg * Math.PI) / 180;
            const x1 = cx + Math.cos(a) * R * 0.9;
            const y1 = cy + Math.sin(a) * R * 0.9;
            const x2 = cx + Math.cos(a) * R;
            const y2 = cy + Math.sin(a) * R;
            return (
              <line
                key={deg}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#2e7d52"
                strokeOpacity={0.5}
                strokeWidth={2}
              />
            );
          })}
        <circle
          cx={cx}
          cy={cy}
          r={R * 1.15}
          fill="transparent"
          style={{
            pointerEvents: active ? "auto" : "none",
            cursor: active ? "grab" : "default",
          }}
          onPointerDown={onDown}
        />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------
// DevGizmo
// ---------------------------------------------------------
function PathHandleGizmo({ path, index }) {
  const ctrlRef = useRef();
  const dragging = useRef(false);
  const proxy = useMemo(() => new THREE.Object3D(), []);
  const node = path && path.nodes[index];

  useFrame(() => {
    if (!dragging.current && node && Array.isArray(node.position)) {
      proxy.position.set(node.position[0], node.position[1], node.position[2]);
    }
  });

  useEffect(() => () => {
    DEV.gizmoDragging = false;
  }, []);

  if (!node || !MOTION_DEV.editHandles) return null;
  return (
    <>
      <primitive object={proxy} />
      <TransformControls
        ref={ctrlRef}
        object={proxy}
        mode="translate"
        space="world"
        size={0.75}
        onMouseDown={() => {
          dragging.current = true;
          DEV.gizmoDragging = true;
        }}
        onObjectChange={() => {
          if (MOTION_DEV.moveHandle) MOTION_DEV.moveHandle(index, proxy.position.toArray(), false);
        }}
        onMouseUp={() => {
          dragging.current = false;
          DEV.gizmoDragging = false;
          DEV.lastDragEnd = performance.now();
          if (MOTION_DEV.moveHandle) MOTION_DEV.moveHandle(index, proxy.position.toArray(), true);
        }}
      />
    </>
  );
}

function PathPlayhead({ path }) {
  const ref = useRef();
  useFrame(() => {
    if (!ref.current) return;
    const pose = sampleMotionPath(path, MOTION_DEV.progress);
    if (pose) ref.current.position.set(pose.sposX, pose.sposY, pose.sposZ);
  });
  return (
    <mesh ref={ref} renderOrder={9002}>
      <sphereGeometry args={[0.06, 18, 14]} />
      <meshBasicMaterial color="#ff4f7b" depthTest={false} />
    </mesh>
  );
}

function MotionPathOverlay() {
  const [revision, setRevision] = useState(MOTION_DEV.version);
  const seen = useRef(MOTION_DEV.version);
  useFrame(() => {
    if (seen.current !== MOTION_DEV.version) {
      seen.current = MOTION_DEV.version;
      setRevision(MOTION_DEV.version);
    }
  });

  const path = MOTION_DEV.path;
  const line = useMemo(() => {
    if (!path || path.nodes.length < 2 || !MOTION_DEV.showPath) return null;
    const points = Array.from({ length: 121 }, (_, i) => {
      const pose = sampleMotionPath(path, i / 120);
      return new THREE.Vector3(pose.sposX, pose.sposY, pose.sposZ);
    });
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x24a66a, transparent: true, opacity: 0.9, depthTest: false });
    const object = new THREE.Line(geometry, material);
    object.renderOrder = 9000;
    return object;
  }, [revision, path]);

  useEffect(() => () => {
    if (line) {
      line.geometry.dispose();
      line.material.dispose();
    }
  }, [line]);

  if (!path || !MOTION_DEV.showPath || path.nodes.length < 2) return null;
  const ghostProgress = [0, 0.25, 0.5, 0.75, 1];

  return (
    <group name="iglass-motion-path-overlay">
      {line && <primitive object={line} />}
      {path.nodes.map((node, i) => (
        <group key={`${i}-${node.slot ?? "embedded"}`} position={node.position}>
          <mesh renderOrder={9001} onClick={(e) => { e.stopPropagation(); if (MOTION_DEV.selectNode) MOTION_DEV.selectNode(i); }}>
            <sphereGeometry args={[i === MOTION_DEV.activeNode ? 0.065 : i === MOTION_DEV.selectedNode ? 0.052 : 0.038, 16, 12]} />
            <meshBasicMaterial color={i === MOTION_DEV.activeNode ? "#ff4f7b" : i === MOTION_DEV.selectedNode ? "#ffb020" : "#2e7d52"} depthTest={false} transparent opacity={0.95} />
          </mesh>
          <Html center distanceFactor={6} style={{ pointerEvents: "none", font: "700 10px ui-monospace", color: i === MOTION_DEV.activeNode ? "#ffffff" : "#173d2a", background: i === MOTION_DEV.activeNode ? "#ff4f7b" : "rgba(255,255,255,.85)", borderRadius: 8, padding: "1px 4px" }}>
            {i + 1}
          </Html>
        </group>
      ))}
      {MOTION_DEV.showGhosts && ghostProgress.map((p) => {
        const pose = sampleMotionPath(path, p);
        return (
          <mesh key={p} position={[pose.sposX, pose.sposY, pose.sposZ]} rotation={[pose.srotX * Math.PI / 180, pose.srotY * Math.PI / 180, pose.srotZ * Math.PI / 180]} renderOrder={8999}>
            <boxGeometry args={[0.28, 0.56, 0.025]} />
            <meshBasicMaterial color="#58b887" wireframe transparent opacity={0.22} depthTest={false} />
          </mesh>
        );
      })}
      <PathPlayhead path={path} />
      <PathHandleGizmo path={path} index={MOTION_DEV.selectedNode} />
    </group>
  );
}

function DevGizmo() {
  const { viewport, camera } = useThree();
  const ctrlRef = useRef();
  const dragRef = useRef(null);
  const [mode, setMode] = useState("off");
  const [target, setTarget] = useState(effectiveTarget());
  const [space, setSpace] = useState(DEV.gizmoSpace);
  const [ready, setReady] = useState(false);
  const [snap, setSnap] = useState(false);

  const proxy = useMemo(() => {
    const o = new THREE.Object3D();
    o.name = "iglass-gizmo-proxy";
    return o;
  }, []);

  const tmp = useMemo(
    () => ({ v: new THREE.Vector3(), c: new THREE.Vector3() }),
    []
  );

  useFrame(() => {
    DEV.viewport = { width: viewport.width, height: viewport.height };

    const eff = DEV.gizmoDragging && dragRef.current
      ? dragRef.current.eff
      : effectiveTarget();
    DEV.gizmoSpace = eff === "stage" ? "world" : "local";

    if (DEV.gizmo !== mode) setMode(DEV.gizmo);
    if (eff !== target) setTarget(eff);
    if (DEV.gizmoSpace !== space) setSpace(DEV.gizmoSpace);
    const obj = eff === "stage" ? DEV.stageGroup : DEV.modelGroup;
    const has = !!obj;
    if (has !== ready) setReady(has);

    if (obj && !DEV.gizmoDragging) {
      obj.getWorldPosition(tmp.v);

      tmp.c.copy(tmp.v).applyMatrix4(camera.matrixWorldInverse);
      if (tmp.c.z > -0.25) {
        tmp.c.z = -0.25;
        tmp.v.copy(tmp.c).applyMatrix4(camera.matrixWorld);
      }

      const ndc = tmp.c.copy(tmp.v).project(camera);
      const cx = Math.max(DEV.leftClampNDC, Math.min(0.85, ndc.x));
      const cy = Math.max(-0.78, Math.min(0.78, ndc.y));
      if (cx !== ndc.x || cy !== ndc.y) {
        proxy.position.set(cx, cy, ndc.z).unproject(camera);
      } else {
        proxy.position.copy(tmp.v);
      }
      obj.getWorldQuaternion(proxy.quaternion);
      proxy.scale.setScalar(obj.scale.x || 1);
    }
  });

  useEffect(() => {
    const canvas = DEV.canvasEl;
    const writeSnap = (enabled) => {
      const next = !!enabled;
      setSnap(next);
      const ctrl = ctrlRef.current;
      if (!ctrl) return;
      ctrl.translationSnap = next ? 0.1 : null;
      ctrl.rotationSnap = next ? Math.PI / 12 : null;
      ctrl.scaleSnap = next ? 0.05 : null;
    };
    const pointerDown = (ev) => writeSnap(ev.shiftKey);
    const pointerUp = () => writeSnap(false);
    const keyDown = (ev) => {
      if (ev.key === "Shift" && DEV.gizmoDragging) writeSnap(true);
    };
    const keyUp = (ev) => {
      if (ev.key === "Shift") writeSnap(false);
    };
    const visibilityChange = () => {
      if (document.hidden) writeSnap(false);
    };

    canvas?.addEventListener("pointerdown", pointerDown, true);
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", pointerUp);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", pointerUp);
    document.addEventListener("visibilitychange", visibilityChange);
    return () => {
      canvas?.removeEventListener("pointerdown", pointerDown, true);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerUp);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", pointerUp);
      document.removeEventListener("visibilitychange", visibilityChange);
      writeSnap(false);
    };
  }, [mode, target, ready]);

  useEffect(() => {
    const ctrl = ctrlRef.current;
    if (!ctrl) return;
    const root =
      typeof ctrl.getHelper === "function" ? ctrl.getHelper() : ctrl;
    if (!root || typeof root.traverse !== "function") return;
    root.traverse((child) => {
      child.frustumCulled = false;
      child.renderOrder = 10000;
      if (child.material) {
        child.material.depthTest = false;
        child.material.depthWrite = false;
        child.material.transparent = true;
      }
      if (child.userData.__iglassFat) return;
      child.userData.__iglassFat = true;
      const geoType =
        child.geometry && child.geometry.type ? child.geometry.type : "";
      if (child.isMesh && child.material && child.material.visible === false) {
        if (geoType === "CylinderGeometry") {
          child.scale.x *= 2.4;
          child.scale.z *= 2.4;
        } else if (geoType !== "TorusGeometry") {
          child.scale.multiplyScalar(1.6);
        }
      } else if (child.isMesh && geoType === "CylinderGeometry") {
        child.scale.x *= 2.2;
        child.scale.z *= 2.2;
      }
    });
  }, [mode, target, ready]);

  const applyDrag = () => {
    const d = dragRef.current;
    if (!d) return;
    const obj = d.eff === "stage" ? DEV.stageGroup : DEV.modelGroup;
    if (!obj) return;

    if (DEV.gizmo === "translate") {
      const delta = proxy.position.clone().sub(d.proxyPos);
      if (d.eff === "settle") {
        delta
          .applyQuaternion(d.stageQuatInv)
          .divideScalar(d.stageScale || 1);
      }
      obj.position.copy(d.targetPos).add(delta);
    } else if (DEV.gizmo === "rotate") {
      const dq = proxy.quaternion.clone().multiply(d.proxyQuatInv);
      let localDelta = dq;
      if (d.eff === "settle") {
        localDelta = d.stageQuatInv.clone().multiply(dq).multiply(d.stageQuat);
      }
      obj.quaternion.copy(localDelta.multiply(d.targetQuat));
    } else if (DEV.gizmo === "scale") {
      const k =
        (proxy.scale.x + proxy.scale.y + proxy.scale.z) /
        (3 * (d.proxyScale || 1));
      obj.scale.setScalar(d.targetScale * k);
    }
  };

  const onDown = () => {
    cancelSquareAnim();
    DEV.gizmoDragging = true;
    const eff = effectiveTarget();
    const obj = eff === "stage" ? DEV.stageGroup : DEV.modelGroup;
    if (!obj) return;
    const rs = DEV.stageGroup
      ? DEV.stageGroup.quaternion.clone()
      : new THREE.Quaternion();
    dragRef.current = {
      eff,
      proxyPos: proxy.position.clone(),
      proxyQuatInv: proxy.quaternion.clone().invert(),
      proxyScale: proxy.scale.x || 1,
      targetPos: obj.position.clone(),
      targetQuat: obj.quaternion.clone(),
      targetScale: obj.scale.x || 1,
      stageQuat: rs,
      stageQuatInv: rs.clone().invert(),
      stageScale: DEV.stageGroup ? DEV.stageGroup.scale.x || 1 : 1,
    };
  };

  const onUp = () => {
    DEV.gizmoDragging = false;
    DEV.lastDragEnd = performance.now();
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.eff === "stage") captureStageFromObject();
    else captureSettleFromObject(viewport);
  };

  return (
    <>
      <primitive object={proxy} />
      {mode !== "off" && ready && !MOTION_DEV.editHandles && (
        <TransformControls
          key={`${mode}-${target}`}
          ref={ctrlRef}
          object={proxy}
          mode={mode}
          space={space}
          size={1.35}
          translationSnap={snap ? 0.1 : null}
          rotationSnap={snap ? Math.PI / 12 : null}
          scaleSnap={snap ? 0.05 : null}
          onMouseDown={onDown}
          onObjectChange={applyDrag}
          onMouseUp={onUp}
        />
      )}
    </>
  );
}

// ============================================
// Mode & tuning resolution
//
//   ?mode=scroll|autoplay|standalone
//   ?bg=%230a0a0c              opaque background; default transparent
//   ?p=0.85                    freeze the timeline at a fixed progress
//   ?settle=0,180,0            SETTLE.targetEuler, degrees
//   ?tilt=18                   START.tilt, degrees
//   ?lift=0.08                 SETTLE.arcLift
//   ?size=1.6                  MODEL.targetSize
//   ?pscale=0.8                SETTLE.scale
//   ?spos / ?srot / ?sscale    STAGE transform
//   ?glassreg=x,y,z            glass-unit registration (clamped to ±35)
//   ?light=amb,key,fill,env,exp,keyX,keyY,keyZ,keyK,fillX,fillY,fillZ,fillK
//   ?bezel=env,rough,offset       v3.8.1 bezel dials
//   ?oled=-0.5,0,1                OLED face-split, rim, luminance
//   ?glass=rough,env,opac,cc,ccr  v3.9 front-glass material
//   ?glassfx=...                   deterministic sweep/glint/environment
//   ?envp=studio   ?envb=0        reflected world + IBL blur
//   ?crack=4.2,on,exX,exY,severity,sharpness,defaultX,defaultY,useDefault
//   ?motion=<base64url-json>       self-contained slot-based motion path
//   ?mp=0.5                       freeze motion-path progress for capture
//   ?snap=1                    deterministic capture (Playwright)
//   ?dev=1                     Pose Studio
// ============================================
function resolveRuntimeConfig() {
  const params = new URLSearchParams(window.location.search);
  const forced = params.get("mode");
  const isEmbedded = window.self !== window.top;
  const mode =
    forced === "scroll" || forced === "autoplay" || forced === "standalone"
      ? forced
      : isEmbedded
      ? "scroll"
      : "standalone";
  const bg = params.get("bg") || "transparent";

  const settleParam = params.get("settle");
  if (settleParam) {
    const parts = settleParam.split(",").map((v) => parseFloat(v));
    if (parts.length === 3 && parts.every((v) => !isNaN(v))) {
      SETTLE.targetEuler = parts.map((deg) => (deg * Math.PI) / 180);
    }
  }
  const tiltParam = parseFloat(params.get("tilt"));
  if (!isNaN(tiltParam)) {
    START.tilt = (tiltParam * Math.PI) / 180;
  }
  const liftParam = parseFloat(params.get("lift"));
  if (!isNaN(liftParam)) {
    SETTLE.arcLift = liftParam;
  }
  const shiftParam = parseFloat(params.get("shift"));
  if (!isNaN(shiftParam)) {
    SETTLE.xShiftFraction = shiftParam;
  }
  const vShiftParam = parseFloat(params.get("vshift"));
  if (!isNaN(vShiftParam)) {
    SETTLE.yShiftFraction = vShiftParam;
  }
  const sizeParam = parseFloat(params.get("size"));
  if (!isNaN(sizeParam) && sizeParam > 0) {
    MODEL.targetSize = sizeParam;
  }
  const pscaleParam = parseFloat(params.get("pscale"));
  if (!isNaN(pscaleParam) && pscaleParam > 0) {
    SETTLE.scale = pscaleParam;
  }

  const sposParam = params.get("spos");
  if (sposParam) {
    const parts = sposParam.split(",").map((v) => parseFloat(v));
    if (parts.length === 3 && parts.every((v) => !isNaN(v))) {
      STAGE.position = parts;
    }
  }
  const srotParam = params.get("srot");
  if (srotParam) {
    const parts = srotParam.split(",").map((v) => parseFloat(v));
    if (parts.length === 3 && parts.every((v) => !isNaN(v))) {
      STAGE.rotationEuler = parts.map((deg) => (deg * Math.PI) / 180);
    }
  }
  const sscaleParam = parseFloat(params.get("sscale"));
  if (!isNaN(sscaleParam) && sscaleParam > 0) {
    STAGE.scale = sscaleParam;
  }
  DEV.dirtyStage = true;

  const glassregParam = params.get("glassreg");
  if (glassregParam) {
    const parts = glassregParam.split(",").map((v) => parseFloat(v));
    if (parts.length === 3 && parts.every((v) => !isNaN(v))) {
      const clampReg = (v) =>
        Math.max(-GLASS_REG_RANGE, Math.min(GLASS_REG_RANGE, v));
      GLASS_REG.x = clampReg(parts[0]);
      GLASS_REG.y = clampReg(parts[1]);
      GLASS_REG.z = clampReg(parts[2]);
    }
  }

  // ---- BEZEL channel (v3.8.1) ----
  const bezelParam = params.get("bezel");
  if (bezelParam) {
    const parts = bezelParam.split(",").map((v) => parseFloat(v));
    if (parts.length === 3 && parts.every((v) => !isNaN(v))) {
      BEZEL.env = parts[0];
      BEZEL.rough = parts[1];
      BEZEL.offset = parts[2];
    }
  }

  // ---- OLED channel (v3.8.4) ----
  const oledParam = params.get("oled");
  if (oledParam) {
    const parts = oledParam.split(",").map((v) => parseFloat(v));
    if (!isNaN(parts[0]) && parts[0] >= -1 && parts[0] <= 0) {
      OLED.faceCut = parts[0];
    }
    if (parts.length > 1 && !isNaN(parts[1])) {
      OLED.showRim = parts[1] === 1;
    }
    if (parts.length > 2 && !isNaN(parts[2])) {
      OLED.luminance = Math.max(0, Math.min(1, parts[2]));
    }
  }

  // ---- GLASS / ENV / CRACK channels (v3.9) ----
  const glassParam = params.get("glass");
  if (glassParam) {
    const q = glassParam.split(",").map((v) => parseFloat(v));
    if (q.length === 5 && q.every((v) => !isNaN(v))) {
      GLASS.rough = q[0];
      GLASS.env = q[1];
      GLASS.opacity = q[2];
      GLASS.clearcoat = q[3];
      GLASS.ccRough = q[4];
    }
  }
  const glassFxParam = params.get("glassfx");
  if (glassFxParam) {
    const q = glassFxParam.split(",").map((v) => parseFloat(v));
    if ((q.length === 21 || q.length === 20) && q.every((v) => !isNaN(v))) {
      SHINE.progress = q[0];
      SHINE.sweepStrength = q[1];
      SHINE.broadWidth = q[2];
      SHINE.stripWidth = q[3];
      SHINE.angleDeg = q[4];
      SHINE.persistent = q[5];
      SHINE.glint = q[6] === 1;
      SHINE.glintStrength = q[7];
      SHINE.glintSize = q[8];
      SHINE.glintAt = q[9];
      SHINE.glintSpread = q[10];
      SHINE.glintX = q[11];
      SHINE.glintY = q[12];
      SHINE.customEnv = q[13] === 1;
      SHINE.envBroad = q[14];
      SHINE.envStrip = q[15];
      SHINE.envRim = q[16];
      SHINE.range = [
        Math.max(0, Math.min(1, q[17])),
        Math.max(0, Math.min(1, q[18])),
      ];
      SHINE.speed = Math.max(0.05, q[19]);
      // v7.5.20 field. Absent on pre-v7.5.20 links -> authored default.
      if (q.length === 21) SHINE.envLeft = Math.max(0, Math.min(4, q[20]));
    } else if (q.length === 17 && q.every((v) => !isNaN(v))) {
      SHINE.progress = q[0];
      SHINE.sweepStrength = q[1];
      SHINE.broadWidth = q[2];
      SHINE.stripWidth = q[3];
      SHINE.angleDeg = q[4];
      SHINE.persistent = q[5];
      SHINE.glint = q[6] === 1;
      SHINE.glintStrength = q[7];
      SHINE.glintSize = q[8];
      SHINE.glintAt = q[9];
      SHINE.glintSpread = q[10];
      SHINE.glintX = q[11];
      SHINE.glintY = q[12];
      SHINE.customEnv = q[13] === 1;
      SHINE.envBroad = q[14];
      SHINE.envStrip = q[15];
      SHINE.envRim = q[16];
    } else if (q.length === 18 && q.every((v) => !isNaN(v))) {
      // v7 compatibility: ignore its removed master enable value.
      SHINE.progress = q[1];
      SHINE.sweepStrength = q[2];
      SHINE.broadWidth = q[3];
      SHINE.stripWidth = q[4];
      SHINE.angleDeg = q[5];
      SHINE.persistent = q[6];
      SHINE.glint = q[7] === 1;
      SHINE.glintStrength = q[8];
      SHINE.glintSize = q[9];
      SHINE.glintAt = q[10];
      SHINE.glintSpread = q[11];
      SHINE.glintX = q[12];
      SHINE.glintY = q[13];
      SHINE.customEnv = q[14] === 1;
      SHINE.envBroad = q[15];
      SHINE.envStrip = q[16];
      SHINE.envRim = q[17];
    } else if (q.length === 23 && q.every((v) => !isNaN(v))) {
      // v6 compatibility: deliberately skip removed coating/Fresnel fields.
      SHINE.progress = q[1];
      SHINE.sweepStrength = q[2];
      SHINE.broadWidth = q[3];
      SHINE.stripWidth = q[4];
      SHINE.angleDeg = q[5];
      SHINE.persistent = q[6];
      SHINE.glint = q[12] === 1;
      SHINE.glintStrength = q[13];
      SHINE.glintSize = q[14];
      SHINE.glintAt = q[15];
      SHINE.glintSpread = q[16];
      SHINE.glintX = q[17];
      SHINE.glintY = q[18];
      SHINE.customEnv = q[19] === 1;
      SHINE.envBroad = q[20];
      SHINE.envStrip = q[21];
      SHINE.envRim = q[22];
    }
  }
  const envpParam = params.get("envp");
  if (envpParam && ENV_PRESETS.includes(envpParam)) {
    LIGHT.preset = envpParam;
  }
  const envbParam = parseFloat(params.get("envb"));
  if (!isNaN(envbParam) && envbParam >= 0 && envbParam <= 1) {
    LIGHT.blur = envbParam;
  }
  const crackParam = params.get("crack");
  if (crackParam) {
    const q = crackParam.split(",").map((v) => parseFloat(v));
    if (q.length === 9 && q.every((v) => !isNaN(v)) && Math.abs(q[0] - 4.2) < 0.001) {
      // v7.4.2 format: version, on, effective X/Y, appearance,
      // default X/Y, and default/manual state.
      CRACK.on = q[1] > 0.5;
      CRACK.severity = Math.max(0, Math.min(1, q[4]));
      CRACK.sharpness = Math.max(0.35, Math.min(3, q[5]));
      CRACK.defaultExit = [
        Math.max(-4, Math.min(4, q[6])),
        Math.max(-4, Math.min(4, q[7])),
      ];
      CRACK.useDefault = q[8] > 0.5;
      CRACK.exit = CRACK.useDefault ? [...CRACK.defaultExit] : [q[2], q[3]];
      persistCrackDefaultPosition(CRACK.defaultExit);
    } else if (q.length === 6 && q.every((v) => !isNaN(v)) && Math.abs(q[0] - 4.1) < 0.001) {
      // v7.4.1 format: version, on, exitX, exitY, severity, sharpness.
      CRACK.on = q[1] > 0.5;
      CRACK.exit = [q[2], q[3]];
      CRACK.useDefault = false;
      CRACK.severity = Math.max(0, Math.min(1, q[4]));
      CRACK.sharpness = Math.max(0.35, Math.min(3, q[5]));
    } else if (q.length === 3 && q.every((v) => !isNaN(v))) {
      // v7.3 / v3.11 format: on, exitX, exitY.
      CRACK.on = q[0] > 0.5;
      CRACK.exit = [q[1], q[2]];
      CRACK.useDefault = false;
    } else if (q.length === 5 && q.every((v) => !isNaN(v))) {
      // v7.2 legacy: on, opacity, X, Y, Z. Opacity ≤ 0 meant invisible.
      CRACK.on = q[0] > 0.5 && q[1] > 0.001;
      CRACK.exit = [q[2], q[3]];
      CRACK.useDefault = false;
    } else if (q.length === 4 && q.every((v) => !isNaN(v))) {
      // v7.1 legacy: opacity, X, Y, Z.
      CRACK.on = q[0] > 0;
      CRACK.exit = [q[1], q[2]];
      CRACK.useDefault = false;
    }
  }
  CRACK.mix = CRACK.on ? 1 : 0;

  // ---- LIGHT channel (v3.8) — applies in production too ----
  const lightParam = params.get("light");
  if (lightParam) {
    const parts = lightParam.split(",").map((v) => parseFloat(v));
    if (
      (parts.length === 5 || parts.length === 13) &&
      parts.every((v) => !isNaN(v))
    ) {
      LIGHT.amb = parts[0];
      LIGHT.key = parts[1];
      LIGHT.fill = parts[2];
      LIGHT.env = parts[3];
      LIGHT.exp = parts[4];
      if (parts.length === 13) {
        LIGHT.keyPosition = parts.slice(5, 8).map(clampLightPosition);
        LIGHT.keyTemperature = clampLightTemperature(parts[8]);
        LIGHT.fillPosition = parts.slice(9, 12).map(clampLightPosition);
        LIGHT.fillTemperature = clampLightTemperature(parts[12]);
      }
    }
  }
  DEV.dirtyLight = true;

  const dev = params.get("dev") === "1" || params.get("dev") === "true";
  DEV.enabled = dev;
  DEV.gizmoSpace = effectiveTarget() === "stage" ? "world" : "local";

  CAPTURE_SNAP = params.get("snap") === "1" || params.get("snap") === "true";

  const motionPath = params.get("motion")
    ? decodeMotionPath(params.get("motion"))
    : null;
  const mpParam = parseFloat(params.get("mp"));
  const motionFreezeP =
    motionPath && !isNaN(mpParam)
      ? Math.max(0, Math.min(1, mpParam))
      : null;

  const pParam = parseFloat(params.get("p"));
  let freezeP = !isNaN(pParam) ? Math.max(0, Math.min(1, pParam)) : null;
  if (dev && freezeP === null) freezeP = 0.5;

  // The capability gate is skipped for deterministic capture and for the
  // studio. ?webglgate=0 forces it off for diagnosis.
  const webglGate = !dev && !CAPTURE_SNAP && params.get("webglgate") !== "0";
  // ?reducedmotion=1 forces the reduced state on; =0 forces it off.
  const reducedMotion =
    params.get("reducedmotion") === "1" ||
    (params.get("reducedmotion") !== "0" && prefersReducedMotion());

  return {
    mode,
    bg,
    freezeP,
    dev,
    motionPath,
    motionFreezeP,
    webglGate,
    reducedMotion,
  };
}

function phaseMap(p) {
  const { explodeEnd, holdEnd, reassembleEnd } = TIMELINE;
  let explode;
  if (p < explodeEnd) {
    explode = p / explodeEnd;
  } else if (p < holdEnd) {
    explode = 1;
  } else if (p < reassembleEnd) {
    explode = 1 - (p - holdEnd) / (reassembleEnd - holdEnd);
  } else {
    explode = 0;
  }
  const rotate =
    p <= reassembleEnd
      ? 0
      : smoothstep((p - reassembleEnd) / (1 - reassembleEnd));

  // No swap channel. The glass swap is pose choreography — crack ON/OFF
  // saved in slots plus glass registration driven by a motion path — not
  // a timeline phase. (v3.11 law; v7.2's reinstated swap fed nothing.)
  return { explode, rotate };
}

// ============================================
// Default props
// ============================================
const defaultProps = {
  explodeDistance: 1.2,
  scrollDistance: 4,
  glassStagger: [0, 0.6],
  oledStagger: [0.15, 0.75],
  phoneStagger: [0.3, 0.9],
  modelPath: "/14_pro_oled_repaired.glb",
  screenTexture: screenImg,
  internalsTexture: internalsImg,
  // White/grey crack lines on a TRANSPARENT background, same aspect as
  // the screen. A caller can still override this prop with another asset.
  crackTexture: crackImg,
};

// ============================================
// Global scroll progress
// ============================================
const scrollState = {
  explosion: 0,
  glassOffset: 0,
  oledOffset: 0,
  phoneOffset: 0,
  rotate: 0,
  // v7.5.9 — the parent page's scroll progress in embedded scroll mode.
  // Carried on the glass-edge payload for diagnostics; never drives motion.
  parentProgress: 0,
};

function bondGlassToOLED() {
  const distance = Math.max(0, Number(DEV.explodeDistance) || 0);
  const z =
    GLASS_REG_HOME.z +
    distance * (scrollState.glassOffset * 2.0 - scrollState.oledOffset);
  const clamped = Math.max(-GLASS_REG_RANGE, Math.min(GLASS_REG_RANGE, z));
  GLASS_REG.z = clamped;
  if (DEV.setLeva) {
    DEV.setLeva({ glassRegZ: Number(clamped.toFixed(4)) });
  }
}

// ---------------------------------------------------------
// OLED BACK-FACE SPLIT (v3.8)
//
// Display_OLED is a solid slab: the GLB carries 118.62 units of face area
// pointing at the phone's FRONT and 118.63 pointing at its BACK. Both caps
// are front-facing when viewed from their own side, so THREE.FrontSide
// renders both of them — which is why the single screen material painted
// the UI on the back of the phone.
//
// You cannot solve this with `side`. FrontSide/BackSide select by facing
// relative to the CAMERA, and each cap is "front" from where it's seen.
// The split has to be by GEOMETRY.
//
// So: partition the index by the sign of each triangle's winding-normal Z,
// reorder it front-first, and declare two geometry GROUPS. three.js then
// accepts a MATERIAL ARRAY — [screen, black] — and shades each group with
// its own material in a single draw pair, no extra mesh, no extra memory.
//
// Front is -Z. Verified against the deployed GLB: Glass_Front sits at
// z = -0.0051 and Back Glass at z = +0.005, so the phone faces -Z, and the
// screen is therefore the cap whose normals point that way (nz < 0).
// ---------------------------------------------------------
const OLED_SCREEN_GROUP = 0;
const OLED_BLACK_GROUP = 1;
const OLED_RIM_GROUP = 2;

// Cached per-triangle classification data. Filled once by splitOledGeometry;
// applyOledCut then rebuilds ONLY the index buffer + groups from it. This is
// why the dial is live: nothing re-traverses the scene graph, and the meshes
// have already been re-parented out of clonedScene by <primitive>, so a
// second traverse would find nothing and destroy the model.
const OLED_CACHE = { geo: null, tri: null, nz: null };

// THREE-way partition (v3.8.5). The cut is symmetric: faceCut for the front
// cap, -faceCut for the back cap, and everything in between is the slab's
// side wall — the rim — which gets its own group so it can be switched off
// without taking the back cap (and the slab's solidity) with it.
function applyOledCut(cut) {
  const { geo, tri, nz } = OLED_CACHE;
  if (!geo || !tri || !nz) return;

  const back = -cut;
  const front = [];
  const rear = [];
  const rim = [];

  for (let t = 0; t < nz.length; t++) {
    const o = t * 3;
    const bucket = nz[t] < cut ? front : nz[t] > back ? rear : rim;
    bucket.push(tri[o], tri[o + 1], tri[o + 2]);
  }

  const merged = new tri.constructor(front.length + rear.length + rim.length);
  merged.set(front, 0);
  merged.set(rear, front.length);
  merged.set(rim, front.length + rear.length);
  geo.setIndex(new THREE.BufferAttribute(merged, 1));

  geo.clearGroups();
  geo.addGroup(0, front.length, OLED_SCREEN_GROUP);
  geo.addGroup(front.length, rear.length, OLED_BLACK_GROUP);
  geo.addGroup(front.length + rear.length, rim.length, OLED_RIM_GROUP);
}

function splitOledGeometry(geometry) {
  const geo = geometry.clone(); // never mutate the useGLTF cache
  const pos = geo.attributes.position;
  const idx = geo.index;
  if (!pos || !idx) return geo;

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const n = new THREE.Vector3();

  const src = idx.array;
  const triCount = src.length / 3;
  const tri = new src.constructor(src.length);
  tri.set(src);
  const nz = new Float32Array(triCount);

  for (let t = 0; t < triCount; t++) {
    const o = t * 3;
    a.fromBufferAttribute(pos, src[o]);
    b.fromBufferAttribute(pos, src[o + 1]);
    c.fromBufferAttribute(pos, src[o + 2]);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    n.crossVectors(ab, ac);

    // NORMALISE. v3.8 compared the RAW cross product's z against 0, which
    // made the classification a function of triangle AREA as well as
    // facing — and put the threshold exactly where the rim's normals live.
    // A unit normal puts the front cap at nz ~ -1 and the rim at nz ~ 0,
    // so a cut at -0.5 has half a unit of margin on both sides.
    const len2 = n.lengthSq();
    nz[t] = len2 > 1e-20 ? n.z / Math.sqrt(len2) : 0; // degenerate -> black
  }

  OLED_CACHE.geo = geo;
  OLED_CACHE.tri = tri;
  OLED_CACHE.nz = nz;

  applyOledCut(OLED.faceCut);
  return geo;
}

// ============================================
// iPhone Exploded Model
// ============================================
function IPhoneExploded({
  modelPath,
  screenTexture,
  internalsTexture,
  crackTexture,
  explodeDistance,
}) {
  const hasCrack = !!crackTexture;
  const { scene } = useGLTF(modelPath);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  const { gl, scene: rootScene } = useThree();
  const maxAniso = gl.capabilities.getMaxAnisotropy();
  const oledTexture = useTexture(screenTexture);
  oledTexture.flipY = false;
  oledTexture.colorSpace = THREE.SRGBColorSpace;
  oledTexture.generateMipmaps = true;
  oledTexture.minFilter = THREE.LinearMipmapLinearFilter;
  oledTexture.magFilter = THREE.LinearFilter;
  oledTexture.anisotropy = maxAniso;
  oledTexture.wrapS = THREE.ClampToEdgeWrapping;
  oledTexture.wrapT = THREE.ClampToEdgeWrapping;
  oledTexture.needsUpdate = true;

  // Hooks cannot be conditional — BLANK_PX stands in when there is no
  // crack PNG, and hasCrack gates the mount instead.
  const crackTex = useTexture(crackTexture || BLANK_PX);
  crackTex.flipY = false; // matches the OLED/UV convention for this asset
  crackTex.colorSpace = THREE.SRGBColorSpace;
  crackTex.anisotropy = maxAniso;
  crackTex.generateMipmaps = true;
  crackTex.minFilter = THREE.LinearMipmapLinearFilter;
  crackTex.magFilter = THREE.LinearFilter;
  crackTex.wrapS = THREE.ClampToEdgeWrapping;
  crackTex.wrapT = THREE.ClampToEdgeWrapping;
  crackTex.needsUpdate = true;

  const internTex = useTexture(internalsTexture);
  internTex.colorSpace = THREE.SRGBColorSpace;
  internTex.generateMipmaps = true;
  internTex.minFilter = THREE.LinearMipmapLinearFilter;
  internTex.magFilter = THREE.LinearFilter;
  internTex.anisotropy = maxAniso;
  internTex.wrapS = THREE.ClampToEdgeWrapping;
  internTex.wrapT = THREE.ClampToEdgeWrapping;
  internTex.needsUpdate = true;

  const internalsGeo = useMemo(() => {
    const w = 7.0;
    const h = 15.2;
    const r = 0.8;
    const hw = w / 2,
      hh = h / 2;

    const shape = new THREE.Shape();
    shape.moveTo(-hw + r, -hh);
    shape.lineTo(hw - r, -hh);
    shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
    shape.lineTo(hw, hh - r);
    shape.quadraticCurveTo(hw, hh, hw - r, hh);
    shape.lineTo(-hw + r, hh);
    shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
    shape.lineTo(-hw, -hh + r);
    shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

    const geo = new THREE.ShapeGeometry(shape, 12);

    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, 1.0 - (pos.getX(i) + hw) / w, (pos.getY(i) + hh) / h);
    }
    uv.needsUpdate = true;
    return geo;
  }, []);

  const glassGroupRef = useRef();
  const oledGroupRef = useRef();
  const bodyGroupRef = useRef();
  const modelGroupRef = useRef();
  const stageGroupRef = useRef();

  // ---------------------------------------------------------
  // SORTING + HIERARCHY BAKE
  //
  // Selection is by MESH NAME for the glass/OLED families. The pill and
  // the camera prims get NO special handling — they fall through to the
  // body group, which is where they lived before v3.8 and where they
  // belong again (v3.8.2 revert).
  //
  // Bezel rides WITH the glass — pane + bezel + crack are one glass unit
  // and leave the frame together (the parenting it has always had;
  // v7.1's decoupling is reverted).
  // Render order: Body 0 → coats 1 → OLED 1 → Glass Front 3 → Bezel 5
  // ---------------------------------------------------------
  const {
    glassMeshes,
    oledMeshes,
    bodyMeshes,
    bezelMeshes,
    crackGeo,
    crackTransform,
    crackUvScale,
  } = useMemo(() => {
    const glass = [];
    const oled = [];
    const body = [];
    const bezel = [];
    let crack = null;
    let crackSourceMesh = null;
    let crackUvScale = [0, 0];
    DEV.bezelMeshes = [];
    DEV.oledScreenMats = [];

    // World matrices for the INTACT graph — ground truth for the rebase.
    // MUST run before any mesh is re-parented by <primitive>.
    clonedScene.updateMatrixWorld(true);

    clonedScene.traverse((child) => {
      if (!child.isMesh) return;

      const name = child.name.toLowerCase();

      // ---- 1. BEZEL ----
      // depthTest:true is RESTORED and non-negotiable: depthTest:false made
      // the bezel draw through the body from behind, exactly as the v3.2
      // comment predicted once the choreography showed the phone's back.
      // Everything else here is a live dial (BEZEL) because the residual
      // black-rim cause is unresolved — see the BEZEL block at the top.
      if (name.includes("bezel") || name.includes("glass_bezel")) {
        const bezelMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(0x000000),
          roughness: BEZEL.rough,
          metalness: 0.0,
          envMapIntensity: BEZEL.env,
          transparent: false,
          depthWrite: false,
          depthTest: true,
          polygonOffset: BEZEL.offset !== 0,
          polygonOffsetFactor: BEZEL.offset,
          polygonOffsetUnits: BEZEL.offset,
        });
        child.material = bezelMat;
        DEV.bezelMat = bezelMat; // live handle for the Leva folder
        DEV.bezelMeshes.push(child); // live handle for the isolate toggle
        child.renderOrder = 5; // above the crack overlay (4)
        bezel.push(child);
        return;
      }

      // ---- 2. GLASS FRONT ----
      // Exact front-glass names only (v7.1's genuine fix, kept): "Back
      // Glass" must never be caught by a generic glass test. The Dynamic
      // Island cutout is authored into this geometry. Nothing here fills
      // it, in any version — it stays a true hole.
      const isFrontGlass =
        name.includes("glass_front") ||
        name.includes("glass front") ||
        name.includes("front_glass") ||
        name.includes("front glass");
      if (isFrontGlass) {
        // MeshPHYSICAL, not Standard. The clearcoat is the whole point: a
        // second specular layer with its own roughness. Constructed with a
        // non-zero clearcoat so the shader compiles the chunk in — dialling
        // it to 0 later is then a uniform write, not a recompile.
        const glassMat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(GLASS.color),
          roughness: GLASS.rough,
          metalness: 0.0,
          transparent: true,
          opacity: GLASS.opacity,
          depthWrite: false,
          // The authored pane sits fractionally behind the OLED when docked.
          // Keep its optical controls live at every timeline P, including 0.
          depthTest: false,
          envMapIntensity: GLASS.env,
          clearcoat: GLASS.clearcoat,
          clearcoatRoughness: GLASS.ccRough,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        });
        child.material = glassMat;
        DEV.glassMat = glassMat;
        // v7.5.9 — the edge reporter projects THIS mesh's world-space
        // bounding corners through the live camera. Held as a live handle
        // so the reporter never has to re-traverse the scene graph.
        DEV.glassPaneMesh = child;
        child.renderOrder = 3;
        glass.push(child);

        // ---- THE CRACKED PANE'S GEOMETRY ----
        // Cloned from the clean pane, so it is the same plane, at the same
        // place, at the same size, forever — it cannot drift. Its UVs are
        // regenerated planar from the bounding box rather than trusting the
        // GLB's TEXCOORD_0, so the crack PNG maps predictably.
        const cg = child.geometry.clone();
        const cpos = cg.attributes.position;
        if (cpos) {
          let minX = Infinity, maxX = -Infinity;
          let minY = Infinity, maxY = -Infinity;
          for (let i = 0; i < cpos.count; i++) {
            const x = cpos.getX(i), y = cpos.getY(i);
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
          const rx = maxX - minX || 1;
          const ry = maxY - minY || 1;
          crackUvScale = [1 / rx, 1 / ry];
          const uv = new Float32Array(cpos.count * 2);
          for (let i = 0; i < cpos.count; i++) {
            uv[i * 2] = 1.0 - (cpos.getX(i) - minX) / rx;
            uv[i * 2 + 1] = 1.0 - (cpos.getY(i) - minY) / ry;
          }
          cg.setAttribute("uv", new THREE.BufferAttribute(uv, 2));

          // ---- BACK-FACE STRIP (v7.3.1) ----
          // PROBED FROM THE DEPLOYED GLB: the pane is a ZERO-THICKNESS
          // TWO-SIDED sheet — 816 triangles, exactly half wound facing
          // -Z (the camera) and half facing +Z (into the phone),
          // 108.2477 local area each way. That is why no `side` setting
          // could hide the crack from the phone's back: the +Z half is
          // front-facing from behind. Strip it. nz < 0 = phone front is
          // the same local-space convention the OLED split has run in
          // production since v3.8 (node transform is pure uniform scale,
          // verified). The shine overlay shares this geometry, so this
          // also stops the sweep double-drawing on two coincident layers.
          const cidx = cg.index;
          if (cidx) {
            const csrc = cidx.array;
            const kept = [];
            const va = new THREE.Vector3();
            const vb = new THREE.Vector3();
            const vc = new THREE.Vector3();
            const e1 = new THREE.Vector3();
            const e2 = new THREE.Vector3();
            const nrm = new THREE.Vector3();
            for (let t = 0; t < csrc.length; t += 3) {
              va.fromBufferAttribute(cpos, csrc[t]);
              vb.fromBufferAttribute(cpos, csrc[t + 1]);
              vc.fromBufferAttribute(cpos, csrc[t + 2]);
              nrm.crossVectors(e1.subVectors(vb, va), e2.subVectors(vc, va));
              if (nrm.z < 0) kept.push(csrc[t], csrc[t + 1], csrc[t + 2]);
            }
            if (kept.length) cg.setIndex(kept);
          }
        }
        crack = cg;
        crackSourceMesh = child;
        return;
      }

      // ---- 3. OLED — solid slab, split front/back ----
      if (name.includes("display") || name.includes("oled")) {
        child.geometry = splitOledGeometry(child.geometry);

        const posAttr = child.geometry.attributes.position;
        const uvAttr = child.geometry.attributes.uv;

        if (posAttr && uvAttr) {
          let minX = Infinity,
            maxX = -Infinity;
          let minY = Infinity,
            maxY = -Infinity;
          for (let i = 0; i < posAttr.count; i++) {
            const x = posAttr.getX(i);
            const y = posAttr.getY(i);
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }

          const rangeX = maxX - minX || 1;
          const rangeY = maxY - minY || 1;

          for (let i = 0; i < posAttr.count; i++) {
            // U flipped — unflipped U rendered the screen mirror-imaged.
            const u = 1.0 - (posAttr.getX(i) - minX) / rangeX;
            const v = 1.0 - (posAttr.getY(i) - minY) / rangeY;
            uvAttr.setXY(i, u, v);
          }
          uvAttr.needsUpdate = true;
        }

        // Material ARRAY — index matches the geometry groups declared in
        // splitOledGeometry. [0] screen, [1] back cap, [2] the slab RIM.
        // The rim is the second of the two black trims; it is off.
        const oledRimMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(0x000000),
          toneMapped: false,
        });
        oledRimMat.visible = OLED.showRim;
        DEV.oledRimMat = oledRimMat;

        const oledScreenMat = new THREE.MeshBasicMaterial({
          map: oledTexture,
          color: new THREE.Color().setScalar(OLED.luminance),
          toneMapped: false,
        });
        DEV.oledScreenMats.push(oledScreenMat);

        child.material = [
          oledScreenMat,
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(0x000000),
            toneMapped: false,
          }),
          oledRimMat,
        ];
        child.renderOrder = 1;
        oled.push(child);
        return;
      }

      // ---- 4. BODY ----
      // Includes the Dynamic Island pill and the front-camera prims. No
      // special routing, no hiding — v3.8.2 reverts both.
      child.material = child.material.clone();
      const mat = child.material;

      // Kill baked emission. Body materials carry 0.13–0.45 emissive from
      // the source asset; nothing on the chassis should self-illuminate.
      if (mat.emissive) mat.emissive.setRGB(0, 0, 0);
      if ("emissiveIntensity" in mat) mat.emissiveIntensity = 0;
      mat.emissiveMap = null;

      // ---- TRANSLUCENT COATS (v3.8.1 — RETAINED) ----
      //
      // The old rule was `if (opacity < 1) color.setHex(0x0a0a0a)` — it
      // painted EVERY translucent body material near-black. That is why the
      // Rear Camera Island rendered black: the island itself is opaque white
      // and perfectly fine, but "Rear Camera Island + Apple Logo" is a
      // 10%-alpha WHITE gloss coat lying on top of it, and the rule turned
      // that coat into an opaque black slab. Same for "Display Camera Hole
      // (Center Bright)" (white, alpha 0.175) and "Flash Bright" (alpha 0.20
      // — a FLASH, painted black).
      //
      // Coats now render as AUTHORED — real colour, real alpha — with
      // depthWrite off so they cannot fight the surface they sit on.
      //
      //   alpha ≤ 0.05 — effectively-invisible film → still hidden
      //   alpha <  1   — gloss coat → keep colour, keep transparency
      if (mat.opacity <= 0.05) {
        child.visible = false;
      } else if (mat.opacity < 1) {
        mat.transparent = true;
        mat.depthWrite = false; // sits ON the surface, doesn't occlude it
      } else {
        mat.transparent = false;
        mat.depthWrite = true;
      }

      [
        mat.map,
        mat.normalMap,
        mat.roughnessMap,
        mat.metalnessMap,
        mat.aoMap,
      ].forEach((tex) => {
        if (tex) {
          tex.anisotropy = maxAniso;
          tex.generateMipmaps = true;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.needsUpdate = true;
        }
      });

      // Coats draw after the opaque body they sit on.
      const isCoat = mat.transparent && child.visible;
      child.renderOrder = isCoat ? 1 : 0;
      body.push(child);
    });

    // ---- ANCHORED REBASE ----
    // newLocal = anchorOldLocal · anchorWorld⁻¹ · meshWorld
    // Anchor = first primary body primitive. Every mesh lands at its TRUE
    // pose relative to the body, expressed in the exact frame the body
    // already rendered in — so pivot fit, rest quaternion, internals plane
    // and explode distances need no retune.
    const allMeshes = [...glass, ...oled, ...body, ...bezel];
    const anchorMesh = body[0] || allMeshes[0];
    if (anchorMesh) {
      const anchorLocal = anchorMesh.matrix.clone();
      const anchorWorldInv = anchorMesh.matrixWorld.clone().invert();
      const rebased = new THREE.Matrix4();
      for (const m of allMeshes) {
        rebased.multiplyMatrices(anchorWorldInv, m.matrixWorld);
        rebased.premultiply(anchorLocal);
        rebased.decompose(m.position, m.quaternion, m.scale);
      }
    }

    // The overlay uses cloned local-space pane geometry, so it must also use
    // the pane mesh's rebased local transform. Geometry alone is insufficient.
    const crackTransform = crackSourceMesh
      ? {
          position: crackSourceMesh.position.clone(),
          quaternion: crackSourceMesh.quaternion.clone(),
          scale: crackSourceMesh.scale.clone(),
        }
      : null;

    return {
      glassMeshes: glass,
      oledMeshes: oled,
      bodyMeshes: body,
      bezelMeshes: bezel,
      crackGeo: crack,
      crackTransform,
      crackUvScale,
    };
  }, [clonedScene, oledTexture, maxAniso]);

  // ---------------------------------------------------------
  // CRACKED-PANE MATERIAL (v3.9 / v3.11)
  //
  // The PNG is white/grey crack lines on TRANSPARENT. transparent:true
  // means the PNG's own alpha carves the shape, so the pane is invisible
  // everywhere except along the fractures — which sit ON TOP of the clean
  // glass beneath. depthWrite off so it cannot fight the pane it lies on.
  // crackOn remains binary in saved poses. CRACK.mix is a runtime-only path
  // interpolation value. Severity and sharpness reshape the texture alpha;
  // presence fades the complete result without changing registration.
  // ---------------------------------------------------------
  const crackMat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      map: crackTex,
      transparent: true,
      opacity: 1,
      roughness: 0.06,
      metalness: 0.0,
      depthWrite: false,
      // v7.5.15: the carrier now inherits the pane transform and receives a
      // tiny local-normal surface bias. Real depth occlusion can therefore
      // be restored: crack pixels must never draw through the rim/chassis.
      depthTest: true,
      envMapIntensity: crackReflectionIntensity(),
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      // FrontSide + the back-face strip above. The pane geometry shipped
      // TWO-SIDED (duplicated flipped triangles), so FrontSide alone was
      // powerless — the strip makes it genuinely one-sided, and culling
      // then hides the front crack whenever the phone shows its back.
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uCrackPresence = { value: CRACK.mix };
      shader.uniforms.uCrackSeverity = { value: CRACK.severity };
      shader.uniforms.uCrackSharpness = { value: CRACK.sharpness };
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
         vec2 crackUvFeather = max(fwidth(vMapUv) * 1.5, vec2(0.00001));
         vec2 crackUvInside =
           smoothstep(vec2(0.0), crackUvFeather, vMapUv) *
           (vec2(1.0) - smoothstep(
             vec2(1.0) - crackUvFeather,
             vec2(1.0),
             vMapUv
           ));
         float crackUvMask = crackUvInside.x * crackUvInside.y;
         diffuseColor.a = clamp(
           pow(clamp(diffuseColor.a, 0.0, 1.0), uCrackSharpness)
             * uCrackSeverity * uCrackPresence * crackUvMask,
           0.0,
           1.0
         );`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "void main() {",
        `uniform float uCrackPresence;
         uniform float uCrackSeverity;
         uniform float uCrackSharpness;
         void main() {`
      );
      m.userData.crackAppearanceUniforms = shader.uniforms;
      syncCrackAppearance();
    };
    m.customProgramCacheKey = () => "iglass-crack-appearance-v3-uv-clip";
    m.visible = CRACK.mix > 0.0001;
    DEV.crackMat = m;
    return m;
  }, [crackTex]);

  // ---------------------------------------------------------
  // UNDERSIDE CRACK — separate inner-face material.
  //
  // The existing front material remains FrontSide/depthTest:false. This
  // second material renders only the reverse face and keeps depth testing,
  // so it is visible from the glass/OLED gap but cannot draw through the
  // chassis when the phone is viewed from behind.
  // ---------------------------------------------------------
  const crackUndersideMat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      map: crackTex,
      color: new THREE.Color().setScalar(CRACK_UNDERSIDE.shade),
      transparent: true,
      opacity: CRACK_UNDERSIDE.opacity,
      roughness: CRACK_UNDERSIDE.roughness,
      metalness: 0,
      depthWrite: false,
      depthTest: true,
      envMapIntensity: CRACK_UNDERSIDE.reflection,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      side: THREE.BackSide,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uCrackPresence = { value: CRACK.mix };
      shader.uniforms.uCrackSeverity = { value: CRACK.severity };
      shader.uniforms.uCrackSharpness = { value: CRACK.sharpness };
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
         vec2 crackUvFeather = max(fwidth(vMapUv) * 1.5, vec2(0.00001));
         vec2 crackUvInside =
           smoothstep(vec2(0.0), crackUvFeather, vMapUv) *
           (vec2(1.0) - smoothstep(
             vec2(1.0) - crackUvFeather,
             vec2(1.0),
             vMapUv
           ));
         float crackUvMask = crackUvInside.x * crackUvInside.y;
         diffuseColor.a = clamp(
           pow(clamp(diffuseColor.a, 0.0, 1.0), uCrackSharpness)
             * uCrackSeverity * uCrackPresence * crackUvMask,
           0.0,
           1.0
         );`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "void main() {",
        `uniform float uCrackPresence;
         uniform float uCrackSeverity;
         uniform float uCrackSharpness;
         void main() {`
      );
      m.userData.crackAppearanceUniforms = shader.uniforms;
      syncCrackAppearance();
    };
    m.customProgramCacheKey = () => "iglass-crack-underside-v2-uv-clip";
    m.visible = CRACK_UNDERSIDE.enabled && CRACK.mix > 0.0001;
    DEV.crackUndersideMat = m;
    syncCrackUndersideMaterial();
    return m;
  }, [crackTex]);

  useEffect(() => {
    return () => {
      crackUndersideMat.dispose();
      if (DEV.crackUndersideMat === crackUndersideMat) {
        DEV.crackUndersideMat = null;
      }
    };
  }, [crackUndersideMat]);

  // ---------------------------------------------------------
  // PREMIUM CLEAN-GLASS OPTICS (v6)
  //
  // The material is intentionally a pure function of SHINE + scrollState.
  // It never reads the render clock. Consequently a fresh page at
  // ?snap=1&mp=0.5000 renders the same highlight as the editor preview.
  // ---------------------------------------------------------
  const shineMat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uCleanMix: { value: 1 },
        uProgress: { value: SHINE.progress },
        uSweepStrength: { value: SHINE.sweepStrength },
        uBroadWidth: { value: SHINE.broadWidth },
        uStripWidth: { value: SHINE.stripWidth },
        uAngle: { value: THREE.MathUtils.degToRad(SHINE.angleDeg) },
        uPersistent: { value: SHINE.persistent },
        uGlint: { value: SHINE.glint ? 1 : 0 },
        uGlintStrength: { value: SHINE.glintStrength },
        uGlintSize: { value: SHINE.glintSize },
        uGlintAt: { value: SHINE.glintAt },
        uGlintSpread: { value: SHINE.glintSpread },
        uGlintPoint: { value: new THREE.Vector2(SHINE.glintX, SHINE.glintY) },
      },
      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        precision highp float;

        uniform float uCleanMix;
        uniform float uProgress;
        uniform float uSweepStrength;
        uniform float uBroadWidth;
        uniform float uStripWidth;
        uniform float uAngle;
        uniform float uPersistent;
        uniform float uGlint;
        uniform float uGlintStrength;
        uniform float uGlintSize;
        uniform float uGlintAt;
        uniform float uGlintSpread;
        uniform vec2 uGlintPoint;
        varying vec2 vUv;

        float gaussian(float x, float width) {
          float q = x / max(width, 0.0001);
          return exp(-0.5 * q * q);
        }

        void main() {
          vec2 p = vUv - 0.5;
          float c = cos(uAngle);
          float s = sin(uAngle);
          vec2 rp = mat2(c, -s, s, c) * p;

          // Travel beyond both pane edges, but exact progress zero must be
          // physically blank. Without this launch gate the live strip sits on
          // the pane's left edge even when the authored shine value is 0.
          float safeProgress = clamp(uProgress, 0.0, 1.0);
          float launchGate = smoothstep(0.0, 0.03, safeProgress);
          float centre = mix(-0.62, 0.62, safeProgress);
          float broad = gaussian(rp.x - centre, uBroadWidth);
          float strip = gaussian(rp.x - centre, uStripWidth);
          float sweep = (0.32 * broad + strip) * uSweepStrength;

          // A quiet stationary panel reflection remains after the sweep.
          float settled = smoothstep(0.04, 0.22, uProgress);
          float panel = gaussian(rp.x + 0.24, 0.42) * uPersistent * settled;

          // One art-directed sparkle with a soft halo and four restrained
          // rays. Its envelope is keyed to progress, not time.
          vec2 gd = (vUv - uGlintPoint) / max(0.001, uGlintSize);
          float radial2 = dot(gd, gd);
          float core = exp(-radial2 * 18.0);
          float halo = exp(-radial2 * 2.2) * 0.22;
          float rayH = exp(-abs(gd.y) * 34.0) * exp(-abs(gd.x) * 2.2);
          float rayV = exp(-abs(gd.x) * 34.0) * exp(-abs(gd.y) * 2.2);
          vec2 diag = vec2(gd.x + gd.y, gd.x - gd.y) * 0.70710678;
          float rayD = (exp(-abs(diag.x) * 40.0) * exp(-abs(diag.y) * 3.8)
                      + exp(-abs(diag.y) * 40.0) * exp(-abs(diag.x) * 3.8)) * 0.22;
          float glintEnvelope = gaussian(uProgress - uGlintAt, uGlintSpread);
          float glint = (core + halo + 0.24 * (rayH + rayV) + rayD)
                      * uGlint * uGlintStrength * glintEnvelope;

          vec3 warmWhite = vec3(1.0, 0.975, 0.92);
          vec3 coolWhite = vec3(0.76, 0.90, 1.0);
          vec3 rgb = (warmWhite * (sweep + panel + glint)
                    + coolWhite * (0.18 * broad * uSweepStrength))
                   * launchGate;
          float gate = clamp(uCleanMix, 0.0, 1.0);
          float intensity = max(max(rgb.r, rgb.g), rgb.b) * gate;

          // Never cover the pane with RGB 0 / alpha 1. Only actual reflected
          // light writes alpha; every untouched pixel remains transparent.
          if (intensity <= 0.0001) discard;
          vec3 highlightColour = rgb / max(max(max(rgb.r, rgb.g), rgb.b), 0.0001);
          gl_FragColor = vec4(highlightColour, clamp(intensity, 0.0, 1.0));
        }
      `,
      transparent: true,
      depthWrite: false,
      // v7.5.36: the overlay now inherits the real pane transform, so normal
      // chassis/rim depth occlusion is both safe and required. depthTest:false
      // allowed the displaced sweep to leak through the bottom-left body edge.
      depthTest: true,
      blending: THREE.NormalBlending,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    DEV.shineMat = m;
    return m;
  }, []);

  useEffect(() => {
    return () => {
      shineMat.dispose();
      if (DEV.shineMat === shineMat) DEV.shineMat = null;
    };
  }, [shineMat]);

  // ---------------------------------------------------------
  // MEASURED PIVOT — render-frame Box3 measurement.
  // ---------------------------------------------------------
  const pivotRef = useRef();
  const measuredRef = useRef(false);
  const fitRef = useRef({ maxDim: 1, cLocal: new THREE.Vector3() });

  useLayoutEffect(() => {
    const g = pivotRef.current;
    if (measuredRef.current || !g) return;
    if (modelGroupRef.current) {
      modelGroupRef.current.quaternion.copy(quatsRef.current.qStart);
      DEV.modelGroup = modelGroupRef.current;
    }
    if (stageGroupRef.current) {
      DEV.stageGroup = stageGroupRef.current;
    }
    g.position.set(0, 0, 0);
    g.scale.setScalar(1);
    g.updateWorldMatrix(true, true);

    const box = new THREE.Box3().setFromObject(g);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s = MODEL.targetSize / maxDim;

    const cLocal = g.worldToLocal(center.clone());
    fitRef.current.maxDim = maxDim;
    fitRef.current.cLocal.copy(cLocal);
    g.scale.setScalar(s);
    g.position.set(-cLocal.x * s, -cLocal.y * s, -cLocal.z * s);
    measuredRef.current = true;
  }, []);

  useEffect(() => {
    return () => {
      if (DEV.modelGroup === modelGroupRef.current) DEV.modelGroup = null;
      if (DEV.stageGroup === stageGroupRef.current) DEV.stageGroup = null;
      if (DEV.glassPaneMesh && !DEV.glassPaneMesh.parent) {
        DEV.glassPaneMesh = null;
      }
    };
  }, []);

  // ---------------------------------------------------------
  // SETTLE rotation endpoints — SINGLE geodesic slerp.
  // ---------------------------------------------------------
  const computeQuats = () => {
    const rest = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(Math.PI / 2, 0, -Math.PI / 2)
    );
    const tiltQ = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      START.tilt
    );
    const start = tiltQ.multiply(rest);
    const end = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(...SETTLE.targetEuler)
    );
    return { qStart: start, qEnd: end };
  };
  const quatsRef = useRef(null);
  if (quatsRef.current === null) quatsRef.current = computeQuats();
  const qTarget = useMemo(() => new THREE.Quaternion(), []);

  // ---------------------------------------------------------
  // ANIMATION
  // ---------------------------------------------------------
  useFrame((state) => {
    // pathPreview is a ONE-FRAME flag. The path engine re-arms it on every
    // pose write it makes, so damping stays bypassed for the whole playback
    // or scrub — but the moment the engine stops writing, damping is
    // restored. (The v7.2 defect: set once, never cleared — one path scrub
    // killed render damping for the rest of the session.)
    const damp = CAPTURE_SNAP || DEV.pathPreview ? 1 : 0.1;
    DEV.pathPreview = false;

    // ---- v3.8 LIGHT apply. Runs in production too (URL-driven look
    // channel). scene.environmentIntensity scales the IBL contribution;
    // toneMappingExposure scales everything BEFORE the ACES curve, which
    // is what actually rolls the highlights off instead of clipping. ----
    if (DEV.dirtyLight) {
      gl.toneMappingExposure = LIGHT.exp;
      if ("environmentIntensity" in rootScene) {
        rootScene.environmentIntensity = LIGHT.env;
      }
      DEV.dirtyLight = false;
    }

    if (DEV.dirtyQuat) {
      quatsRef.current = computeQuats();
      DEV.dirtyQuat = false;
    }
    if (DEV.dirtyFit && measuredRef.current && pivotRef.current) {
      const { maxDim, cLocal } = fitRef.current;
      const sFit = MODEL.targetSize / maxDim;
      pivotRef.current.scale.setScalar(sFit);
      pivotRef.current.position.set(
        -cLocal.x * sFit,
        -cLocal.y * sFit,
        -cLocal.z * sFit
      );
      DEV.dirtyFit = false;
    }

    if (
      DEV.dirtyStage &&
      stageGroupRef.current &&
      !(
        DEV.gizmoDragging &&
        (DEV.gizmoTarget === "stage" || !atEndpoint())
      )
    ) {
      const g = stageGroupRef.current;
      g.position.set(STAGE.position[0], STAGE.position[1], STAGE.position[2]);
      g.rotation.set(
        STAGE.rotationEuler[0],
        STAGE.rotationEuler[1],
        STAGE.rotationEuler[2]
      );
      g.scale.setScalar(STAGE.scale);
      DEV.dirtyStage = false;
    }

    // ---- v6 PREMIUM GLASS. Pure state writes: no clock, no random seed. ----
    if (shineMat) {
      const u = shineMat.uniforms;
      const shineProgress = Math.max(0, Math.min(1, Number(SHINE.progress) || 0));
      // Fail closed at exact zero. The GLSL smoothstep launch gate controls
      // the continuous 0.00 -> 0.03 onset without changing authored timing.
      const cleanMix = shineProgress > 0 ? 1 : 0;
      u.uCleanMix.value = cleanMix;
      u.uProgress.value = shineProgress;
      u.uSweepStrength.value = SHINE.sweepStrength;
      u.uBroadWidth.value = SHINE.broadWidth;
      u.uStripWidth.value = SHINE.stripWidth;
      u.uAngle.value = THREE.MathUtils.degToRad(SHINE.angleDeg);
      u.uPersistent.value = SHINE.persistent;
      u.uGlint.value = SHINE.glint ? 1 : 0;
      u.uGlintStrength.value = SHINE.glintStrength;
      u.uGlintSize.value = SHINE.glintSize;
      u.uGlintAt.value = SHINE.glintAt;
      u.uGlintSpread.value = SHINE.glintSpread;
      u.uGlintPoint.value.set(SHINE.glintX, SHINE.glintY);
      shineMat.visible = cleanMix > 0.001;
    }

    if (glassGroupRef.current) {
      // THE GLASS UNIT: pane + bezel + crack, one assembly. ±35 on the
      // registration is enough to carry it clean out of frame and back —
      // that is the swap move. X/Y are written directly (a swap is a move
      // you are DRIVING, not a spring); Z keeps its lerp so the explode
      // still eases.
      const target = -(scrollState.glassOffset * explodeDistance * 2.0);
      glassGroupRef.current.position.z = THREE.MathUtils.lerp(
        glassGroupRef.current.position.z,
        target + GLASS_REG.z,
        damp
      );
      glassGroupRef.current.position.x = GLASS_REG.x;
      glassGroupRef.current.position.y = GLASS_REG.y;
    }

    // ---- CRACKED PANE (v3.11 law) ----
    // A child of the moving glass unit. It has no travel of its own — its
    // only transform is where the fracture pattern sits on the pane, and
    // its only other truth is whether it is there at all.
    if (hasCrack) {
      // Registration moves only the PNG within the fixed pane carrier.
      // Because the geometry no longer moves, the real pane boundary clips
      // every crack fragment at every viewing angle.
      crackTex.offset.set(
        CRACK.exit[0] * crackUvScale[0],
        CRACK.exit[1] * crackUvScale[1]
      );
      crackTex.updateMatrix();
      if (DEV.crackMat) {
        DEV.crackMat.visible = CRACK.mix > 0.0001;
        syncCrackAppearance();
      }
      if (DEV.crackUndersideMat) {
        DEV.crackUndersideMat.visible =
          CRACK_UNDERSIDE.enabled && CRACK.mix > 0.0001;
      }
    }

    if (oledGroupRef.current) {
      const target = -(scrollState.oledOffset * explodeDistance * 1.0);
      oledGroupRef.current.position.z = THREE.MathUtils.lerp(
        oledGroupRef.current.position.z,
        target,
        damp
      );
    }

    if (bodyGroupRef.current) {
      bodyGroupRef.current.position.z = 0;
    }

    const settleDrag =
      DEV.gizmoDragging && DEV.gizmoTarget === "settle" && atEndpoint();
    if (modelGroupRef.current && !settleDrag) {
      const t = scrollState.rotate;

      qTarget.slerpQuaternions(quatsRef.current.qStart, quatsRef.current.qEnd, t);
      modelGroupRef.current.quaternion.slerp(qTarget, damp);

      const targetScale = 1 - (1 - SETTLE.scale) * t;
      const s = THREE.MathUtils.lerp(
        modelGroupRef.current.scale.x,
        targetScale,
        damp
      );
      modelGroupRef.current.scale.setScalar(s);

      const isDesktop = state.size.width >= SETTLE.desktopMinWidth;
      const targetX = isDesktop
        ? state.viewport.width * SETTLE.xShiftFraction * t
        : 0;
      const targetY =
        SETTLE.arcLift * state.viewport.height * Math.sin(Math.PI * t) +
        SETTLE.yShiftFraction * state.viewport.height * t;
      modelGroupRef.current.position.x = THREE.MathUtils.lerp(
        modelGroupRef.current.position.x,
        targetX,
        damp
      );
      modelGroupRef.current.position.y = THREE.MathUtils.lerp(
        modelGroupRef.current.position.y,
        targetY,
        damp
      );
    }

    if (CAPTURE_SNAP && !window.__iglassCaptureReady) {
      if (++SNAP_FRAMES >= 3) window.__iglassCaptureReady = true;
    }
  });

  return (
    <group ref={stageGroupRef}>
      <group
        ref={modelGroupRef}
        onClick={(e) => {
          if (!DEV.enabled) return;
          if (e.delta > 4) return;
          e.stopPropagation();
          changeGizmoContext("settle");
        }}
      >
        <group ref={pivotRef}>
          {/* MOVING GLASS UNIT — Front Window + Bezel + the crack riding on
              it. A real screen assembly includes its bezel; they leave the
              frame together. That is the swap. */}
          <group ref={glassGroupRef}>
            {glassMeshes.map((m, i) => (
              <primitive key={`glass-${i}`} object={m} />
            ))}
            {bezelMeshes.map((m, i) => (
              <primitive key={`bezel-${i}`} object={m} />
            ))}
            {crackGeo && crackTransform && (
              <group
                position={crackTransform.position}
                quaternion={crackTransform.quaternion}
                scale={crackTransform.scale}
              >
                <mesh
                  geometry={crackGeo}
                  material={shineMat}
                  renderOrder={6}
                />
              </group>
            )}

            {/* CRACKED PANE — child of the actual moving front glass. */}
            {hasCrack && crackGeo && crackTransform && (
              <group
                position={crackTransform.position}
                quaternion={crackTransform.quaternion}
                scale={crackTransform.scale}
              >
                <mesh
                  geometry={crackGeo}
                  material={crackMat}
                  position={[0, 0, -CRACK_SURFACE_EPSILON]}
                  renderOrder={4}
                />
                <mesh
                  geometry={crackGeo}
                  material={crackUndersideMat}
                  position={[0, 0, -CRACK_SURFACE_EPSILON]}
                  renderOrder={4}
                />
              </group>
            )}
          </group>

          {/* OLED */}
          <group ref={oledGroupRef}>
            {oledMeshes.map((m, i) => (
              <primitive key={`oled-${i}`} object={m} />
            ))}
          </group>

          {/* BODY — includes the Dynamic Island pill and camera prims */}
          <group ref={bodyGroupRef}>
            {bodyMeshes.map((m, i) => (
              <primitive key={`body-${i}`} object={m} />
            ))}

            {/* Internals teardown texture */}
            <mesh
              position={[0, 8.06, -0.33]}
              renderOrder={0}
              geometry={internalsGeo}
            >
              <meshBasicMaterial
                map={internTex}
                toneMapped={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

// ============================================
// GLASS EDGE FEED (v7.5.9)
//
// THE PROBLEM THIS SOLVES: the parent Framer driver was clipping the
// "just the glass" headline on a TIMED polygon — a guess at where the
// descending pane's edge would be at a given p. It could never lock to
// the physical edge, because the parent has no idea where the glass
// actually is on screen; it only knows p.
//
// THE FIX: this reporter projects the front pane's real world-space
// bounding corners through the LIVE camera every frame. It reports both
// actual LONG edges: local corner pairs 0→3 (x-min) and 1→2 (x-max).
// Their camera-space depth identifies the nearside and far-side edges.
// No diagonal, short edge or changing pair can enter the feed.
//
// WHY IT IS A DUMB EMITTER: no arming threshold, no hysteresis, no
// knowledge of headlines. It reports geometry. Every reveal decision —
// when the clip starts mattering, what counts as "entered" — belongs to
// the parent, where the text lives and its box is known.
// ============================================
const GLASS_EDGE_FEED = {
  // Movement below this (in normalized viewport units) is not worth a
  // postMessage — it is sub-pixel on any realistic viewport.
  epsilon: 0.0008,
};

function GlassEdgeReporter() {
  const { camera } = useThree();

  // Resolved once. The parent's origin comes from document.referrer, so
  // the message is never broadcast to "*" in production. If the referrer
  // is unavailable (some privacy configurations strip it), the feed stays
  // silent rather than posting cross-origin blind. The parent keeps H3
  // hidden until a calibrated edge feed is available.
  const targetOrigin = useMemo(() => {
    if (typeof window === "undefined" || window.self === window.top) return null;
    try {
      if (document.referrer) return new URL(document.referrer).origin;
    } catch (e) {
      /* malformed referrer -> no feed */
    }
    return null;
  }, []);

  // Four bounding corners of the pane in ITS OWN local space, measured
  // once from the geometry. The pane is a flat sheet, so the mid-Z plane
  // is the sheet itself; taking the box's four XY corners at zMid gives
  // the pane's actual rectangle, not an inflated 3D box.
  const cornersRef = useRef(null);
  const scratchRef = useRef({
    v: new THREE.Vector3(),
    view: new THREE.Vector3(),
    world: [
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
    ],
    viewDepth: [0, 0, 0, 0],
    projected: [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ],
  });
  const lastSentRef = useRef(null);

  useFrame(() => {
    if (!targetOrigin) return;
    const mesh = DEV.glassPaneMesh;
    if (!mesh || !mesh.geometry) return;

    if (!cornersRef.current) {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox;
      if (!box) return;
      const zMid = (box.min.z + box.max.z) * 0.5;
      cornersRef.current = [
        new THREE.Vector3(box.min.x, box.min.y, zMid),
        new THREE.Vector3(box.max.x, box.min.y, zMid),
        new THREE.Vector3(box.max.x, box.max.y, zMid),
        new THREE.Vector3(box.min.x, box.max.y, zMid),
      ];
    }

    // The glass group is written in the same useFrame pass that runs
    // above this one, so the matrices need an explicit refresh — R3F's
    // own world-matrix update happens before the frame callbacks.
    mesh.updateWorldMatrix(true, false);

    const { v, view, world, viewDepth, projected } = scratchRef.current;
    for (let i = 0; i < 4; i++) {
      world[i].copy(cornersRef.current[i]).applyMatrix4(mesh.matrixWorld);
      view.copy(world[i]).applyMatrix4(camera.matrixWorldInverse);
      viewDepth[i] = -view.z;
      v.copy(world[i]).project(camera);
      // NDC (-1..1, y-up) -> normalized viewport (0..1, y-DOWN), which is
      // the convention the DOM uses on the other side.
      projected[i].x = (v.x + 1) * 0.5;
      projected[i].y = (1 - v.y) * 0.5;
    }

    const makeEdge = (id, i0, i1) => {
      let a = projected[i0];
      let b = projected[i1];
      if (a.x > b.x) {
        const swap = a;
        a = b;
        b = swap;
      }
      return {
        id,
        depth: (viewDepth[i0] + viewDepth[i1]) * 0.5,
        a: { x: a.x, y: a.y },
        b: { x: b.x, y: b.y },
      };
    };

    const xMinEdge = makeEdge("x-min", 0, 3);
    const xMaxEdge = makeEdge("x-max", 1, 2);
    const near = xMinEdge.depth <= xMaxEdge.depth ? xMinEdge : xMaxEdge;
    const far = near === xMinEdge ? xMaxEdge : xMinEdge;
    const p = scrollState.parentProgress;

    const last = lastSentRef.current;
    if (
      last &&
      last.nearId === near.id &&
      last.farId === far.id &&
      Math.abs(last.nax - near.a.x) < GLASS_EDGE_FEED.epsilon &&
      Math.abs(last.nay - near.a.y) < GLASS_EDGE_FEED.epsilon &&
      Math.abs(last.nbx - near.b.x) < GLASS_EDGE_FEED.epsilon &&
      Math.abs(last.nby - near.b.y) < GLASS_EDGE_FEED.epsilon &&
      Math.abs(last.fax - far.a.x) < GLASS_EDGE_FEED.epsilon &&
      Math.abs(last.fay - far.a.y) < GLASS_EDGE_FEED.epsilon &&
      Math.abs(last.fbx - far.b.x) < GLASS_EDGE_FEED.epsilon &&
      Math.abs(last.fby - far.b.y) < GLASS_EDGE_FEED.epsilon &&
      Math.abs(last.p - p) < GLASS_EDGE_FEED.epsilon
    ) return;

    lastSentRef.current = {
      nearId: near.id,
      farId: far.id,
      nax: near.a.x,
      nay: near.a.y,
      nbx: near.b.x,
      nby: near.b.y,
      fax: far.a.x,
      fay: far.a.y,
      fbx: far.b.x,
      fby: far.b.y,
      p,
    };

    window.parent.postMessage(
      {
        type: "glass-edge",
        p,
        // Legacy single-line fields now carry the stable far-side edge.
        a: far.a,
        b: far.b,
        edges: { near, far },
      },
      targetOrigin
    );
  });

  return null;
}

// ============================================
// Scene
//
// LIGHTING (v3.8). The old rig ran FIVE sources at once — ambient 0.8, two
// directionals, a point light, AND a studio IBL, which is itself an
// ambient source. Ambient light has no direction, so stacking it is what
// destroyed the form gradient. Then NoToneMapping clipped everything over
// 1.0 flat to white, and the chassis and buttons are metalness 1.0, i.e.
// mirrors of all of it. Result: the cream blowout.
//
// Now: one key (the gradient), one fill (the rim), a low ambient, and the
// IBL scaled by scene.environmentIntensity — every one of them on a dial.
// ============================================
function PremiumReflectionEnvironment({ preset, blur, revision }) {
  if (!SHINE.customEnv) {
    return <Environment preset={preset} blur={blur} />;
  }

  // Static studio cards are recaptured only when a control changes. The
  // moving hero sweep lives on Glass_Front itself, so there is no expensive
  // environment-cube render on every animation frame.
  return (
    <Environment
      key={`premium-env-${revision}`}
      preset={preset}
      resolution={256}
      frames={1}
      blur={blur}
    >
      <color attach="background" args={["#dfe5e8"]} />
      <Lightformer
        form="rect"
        intensity={SHINE.envBroad}
        color="#eef6ff"
        position={[0, 5, -9]}
        rotation-x={Math.PI / 2}
        scale={[10, 10, 1]}
      />
      <Lightformer
        form="rect"
        intensity={SHINE.envStrip}
        color="#fff4df"
        position={[-3.5, 1.5, -5]}
        rotation-y={Math.PI / 2}
        scale={[10, 0.2, 1]}
      />
      <Lightformer
        form="rect"
        intensity={SHINE.envRim}
        color="#bad8ff"
        position={[4.5, 1, -2]}
        rotation-y={-Math.PI / 2}
        scale={[6, 2.5, 1]}
      />
      <Lightformer
        form="ring"
        intensity={SHINE.envRim * 0.35}
        color="#ffffff"
        position={[0, -4, -6]}
        rotation-x={-Math.PI / 2}
        scale={[3, 3, 1]}
      />
      {/* v7.5.26 — CEILING REFLECTION BANK. The broad card gives the pane
          a continuous overhead gradient; the thin kicker creates a second
          moving streak that catches the crack facets as the glass crosses
          the OLED. Both remain part of the one static environment capture. */}
      <Lightformer
        form="rect"
        intensity={SHINE.envTop}
        color="#f7fbff"
        position={[0, 8, -1.5]}
        scale={[9, 4.5, 1]}
        onUpdate={(self) => self.lookAt(0, 0, 0)}
      />
      <Lightformer
        form="rect"
        intensity={SHINE.envTop * 1.25}
        color="#fff4e6"
        position={[2.5, 7, 2]}
        scale={[6, 0.3, 1]}
        onUpdate={(self) => self.lookAt(0, 0, 0)}
      />
      {/* v7.5.14 — restrained positive-Z coverage. These cards use the
          existing broad/strip/rim families, remain static, and are captured
          in the same single environment render as the original rig. */}
      <Lightformer
        form="rect"
        intensity={SHINE.envBroad * 0.42}
        color="#f3f8ff"
        position={[0, 1.8, 8]}
        scale={[8, 4.5, 1]}
        onUpdate={(self) => self.lookAt(0, 0, 0)}
      />
      <Lightformer
        form="rect"
        intensity={SHINE.envStrip * 0.22}
        color="#fff1dd"
        position={[6.5, -0.4, 3.5]}
        scale={[6.5, 0.18, 1]}
        onUpdate={(self) => self.lookAt(0, 0, 0)}
      />
      <Lightformer
        form="rect"
        intensity={SHINE.envRim * 0.6}
        color="#c8ddff"
        position={[-6, 4.5, 2.5]}
        scale={[5, 1.1, 1]}
        onUpdate={(self) => self.lookAt(0, 0, 0)}
      />

      {/* v7.5.20 — LEFT-HAND CARD BANK. Every bright card in the rig above
          sits at +X or behind, which is why the specular band lives in the
          top right and the left chassis flank and left-facing crack facets
          have nothing to reflect and read black. These three mirror the
          camera-side cards onto -X. They are STATIC in world space like the
          rest, so they still cost one environment capture, not a per-frame
          render. One dial scales the whole bank: envLeft 0 restores the
          v7.5.19 rig byte-for-byte. */}
      <Lightformer
        form="rect"
        intensity={SHINE.envStrip * 0.55 * SHINE.envLeft}
        color="#fff6e8"
        position={[-6.5, 0.4, 3.5]}
        scale={[7, 0.22, 1]}
        onUpdate={(self) => self.lookAt(0, 0, 0)}
      />
      <Lightformer
        form="rect"
        intensity={SHINE.envBroad * 0.5 * SHINE.envLeft}
        color="#eef4ff"
        position={[-7.5, 1.2, 4.5]}
        scale={[5.5, 6, 1]}
        onUpdate={(self) => self.lookAt(0, 0, 0)}
      />
      <Lightformer
        form="rect"
        intensity={SHINE.envRim * 0.8 * SHINE.envLeft}
        color="#dbe9ff"
        position={[-5, -3.5, 1.5]}
        scale={[6, 1.4, 1]}
        onUpdate={(self) => self.lookAt(0, 0, 0)}
      />
    </Environment>
  );
}

// The iframe's load event only means its HTML loaded. This reporter waits
// until the actual phone mesh exists and then allows two R3F render passes
// before declaring the scene visible to the parent.
function SceneReadyReporter({ onReady }) {
  const renderedFramesRef = useRef(0);
  const sentRef = useRef(false);

  useFrame(() => {
    if (sentRef.current || !DEV.glassPaneMesh) return;
    renderedFramesRef.current += 1;
    // Top of the first frame that will draw the phone: everything is
    // decoded and uploaded, nothing has been rasterised yet.
    if (renderedFramesRef.current === 1) markTiming("assets");
    if (renderedFramesRef.current < 2) return;
    sentRef.current = true;
    onReady();
  });

  return null;
}

// Counts down the post-completion settle frames, then parks the render loop.
// Mounted inside the Canvas so it shares R3F's clock.
function RenderGovernor() {
  const { invalidate } = useThree();

  useEffect(() => {
    RENDER_GOV.invalidate = invalidate;
    return () => {
      if (RENDER_GOV.invalidate === invalidate) RENDER_GOV.invalidate = null;
    };
  }, [invalidate]);

  useFrame(() => {
    if (RENDER_GOV.idleCountdown < 0) return;
    if (RENDER_GOV.idleCountdown > 0) {
      RENDER_GOV.idleCountdown -= 1;
      return;
    }
    renderGovernorIdle();
  });

  return null;
}

function Scene({
  modelPath,
  screenTexture,
  internalsTexture,
  crackTexture,
  explodeDistance,
  dev,
  glassEdgeFeed,
  onReady,
}) {
  const [envPreset, setEnvPreset] = useState(LIGHT.preset);
  const [envBlur, setEnvBlur] = useState(LIGHT.blur);
  const [envRevision, setEnvRevision] = useState(0);

  useEffect(() => {
    DEV.explodeDistance = explodeDistance;
  }, [explodeDistance]);

  // preset and blur are React PROPS on <Environment>, not uniforms — they
  // need a re-render, so Leva writes through this setter rather than
  // mutating LIGHT and waiting for a frame that will never notice.
  useEffect(() => {
    DEV.setEnv = (pr, b) => {
      setEnvPreset(pr);
      setEnvBlur(b);
      setEnvRevision((v) => v + 1);
    };
    DEV.refreshEnvironment = () => setEnvRevision((v) => v + 1);
    return () => {
      DEV.setEnv = null;
      DEV.refreshEnvironment = null;
    };
  }, []);

  const ambRef = useRef();
  const keyRef = useRef();
  const fillRef = useRef();

  useFrame(() => {
    // Lights read LIGHT live — no dirty flag needed, these are 3 float
    // writes per frame and it keeps the Leva drag perfectly smooth.
    if (ambRef.current) ambRef.current.intensity = LIGHT.amb;
    if (keyRef.current) {
      keyRef.current.intensity = LIGHT.key;
      keyRef.current.position.fromArray(LIGHT.keyPosition);
      setTemperatureTint(
        keyRef.current.color,
        LIGHT.keyTemperature,
        6500,
        LIGHT_KEY_BASE_SRGB
      );
    }
    if (fillRef.current) {
      fillRef.current.intensity = LIGHT.fill;
      fillRef.current.position.fromArray(LIGHT.fillPosition);
      setTemperatureTint(
        fillRef.current.color,
        LIGHT.fillTemperature,
        9000,
        LIGHT_FILL_BASE_SRGB
      );
    }
  });

  return (
    <>
      <ambientLight ref={ambRef} intensity={LIGHT.amb} />
      <directionalLight
        ref={keyRef}
        position={LIGHT.keyPosition}
        intensity={LIGHT.key}
      />
      <directionalLight
        ref={fillRef}
        position={LIGHT.fillPosition}
        intensity={LIGHT.fill}
        color="#e8f0ff"
      />

      {/* The IBL. Its STRENGTH is scene.environmentIntensity, driven from
          LIGHT.env in the useFrame above — not a prop, so that part works on
          every drei/three version.
          `preset` swaps WHICH WORLD gets reflected — this is what changes the
          SHAPE of the highlight on the glass. "studio" is the one with hard
          softbox panels in it; that circle IS this preset.
          `blur` softens the IBL itself. Version-dependent: on an older drei
          the prop is ignored — no error, no effect. GLASS.rough is the
          guaranteed softener. */}
      <PremiumReflectionEnvironment
        preset={envPreset}
        blur={envBlur}
        revision={envRevision}
      />

      <IPhoneExploded
        modelPath={modelPath}
        screenTexture={screenTexture}
        internalsTexture={internalsTexture}
        crackTexture={crackTexture}
        explodeDistance={explodeDistance}
      />

      {/* v7.5.11 — mounted in embedded scroll and autoplay modes. Mounted AFTER
          IPhoneExploded so its useFrame runs after the glass group has
          been written this frame; it therefore reports the pose the
          viewer is actually about to see, not the previous one. */}
      {glassEdgeFeed && <GlassEdgeReporter />}

      <SceneReadyReporter onReady={onReady} />

      <RenderGovernor />

      {dev && <DevGizmo />}
    </>
  );
}

// ============================================
// Exact Framer viewport simulator for Vercel authoring
// ============================================
function resolveViewportSimulation() {
  if (typeof window === "undefined") return null;

  const raw = new URLSearchParams(window.location.search).get("simulate");
  if (!raw) return null;

  const match = raw
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s*[x,]\s*(\d+(?:\.\d+)?)$/i);
  if (!match) return null;

  return {
    width: Math.max(1, Number(match[1])),
    height: Math.max(1, Number(match[2])),
  };
}

function ExactViewportSimulator({ config }) {
  const readWorkbench = () => ({
    width: typeof window === "undefined" ? config.width : window.innerWidth,
    height: typeof window === "undefined" ? config.height : window.innerHeight,
  });
  const [workbench, setWorkbench] = useState(readWorkbench);

  useEffect(() => {
    const update = () => setWorkbench(readWorkbench());
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  const childURL = useMemo(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("simulate");
    return url.toString();
  }, []);

  const gutter = window.self === window.top ? 32 : 0;
  const scale = Math.max(
    0.05,
    Math.min(
      1,
      (workbench.width - gutter) / config.width,
      (workbench.height - gutter) / config.height
    )
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: "#d9dde2",
      }}
    >
      <iframe
        src={childURL}
        title={`Exact ${config.width} by ${config.height} Framer viewport`}
        loading="eager"
        scrolling="no"
        allow="fullscreen"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          display: "block",
          width: config.width,
          height: config.height,
          border: 0,
          background: "#ffffff",
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center center",
          boxShadow: "0 18px 60px rgba(0, 0, 0, 0.24)",
        }}
      />
    </div>
  );
}

// ============================================
// Main Component
// ============================================
function CrossSection3DScrollGLBScene(props) {
  const merged = { ...defaultProps, ...props };
  const {
    explodeDistance,
    scrollDistance,
    glassStagger,
    oledStagger,
    phoneStagger,
    modelPath,
    screenTexture,
    internalsTexture,
    crackTexture,
  } = merged;

  const {
    mode,
    bg,
    freezeP,
    dev,
    motionPath: runtimeMotionPath,
    motionFreezeP,
    webglGate,
    reducedMotion,
  } = useMemo(resolveRuntimeConfig, []);

  const introEnd = useMemo(() => {
    if (!runtimeMotionPath) return 0.2;
    return (
      playbackProgressAtFirstHold(
        runtimeMotionPath,
        runtimeMotionPath.speed
      ) ?? 0.2
    );
  }, [runtimeMotionPath]);

  const containerRef = useRef(null);
  const stickyRef = useRef(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [frameloop, setFrameloop] = useState("always");
  // Probe once, during the first render, before the Canvas is constructed.
  const [webglAvailable] = useState(() => {
    if (!webglGate) return true;
    const probe = webglCapabilityProbe();
    RENDER_GOV.probeFailure = probe.ok ? null : probe.reason;
    return probe.ok;
  });
  const parentTargetOrigin = useMemo(() => {
    if (typeof document === "undefined") return "*";
    try {
      if (document.referrer) return new URL(document.referrer).origin;
    } catch (e) {
      /* malformed referrer -> guarded wildcard fallback */
    }
    return "*";
  }, []);

  // Cache the resolved origin for the low-level canvas handlers.
  useEffect(() => {
    IFRAME.parentOrigin = parentTargetOrigin;
  }, [parentTargetOrigin]);

  useEffect(() => {
    RENDER_GOV.setFrameloop = setFrameloop;
    return () => {
      if (RENDER_GOV.setFrameloop === setFrameloop) {
        RENDER_GOV.setFrameloop = null;
      }
    };
  }, []);

  // A blocked capability gate must not leave the parent waiting for a
  // scene-ready that will never arrive.
  useEffect(() => {
    if (webglAvailable) return;
    postToParent({
      type: "iglass-webgl-unavailable",
      reason: RENDER_GOV.probeFailure,
    });
  }, [webglAvailable]);

  // Stop rendering while the document is hidden. The parent may also send
  // { type: 'iglass-visibility', visible: boolean } when the hero scrolls
  // out of the page viewport; the iframe cannot observe that itself.
  useEffect(() => {
    if (typeof document === "undefined") return;

    const resume = () => {
      RENDER_GOV.suspended = false;
      if (RENDER_GOV.finished) {
        if (RENDER_GOV.invalidate) RENDER_GOV.invalidate();
      } else {
        renderGovernorActivate();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (RENDER_GOV.suspended) resume();
      } else {
        RENDER_GOV.suspended = true;
        renderGovernorIdle();
      }
    };

    const onParentVisibility = (event) => {
      const data = event.data;
      if (!data || data.type !== "iglass-visibility") return;
      if (data.visible === false) {
        RENDER_GOV.suspended = true;
        renderGovernorIdle();
      } else if (RENDER_GOV.suspended) {
        resume();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("message", onParentVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("message", onParentVisibility);
    };
  }, []);

  useEffect(() => {
    if (!sceneReady || window.self === window.top) return;
    window.parent.postMessage(
      {
        type: "iglass-scene-ready",
        version: IGLASS_APP_VERSION,
        progress: scrollState.parentProgress,
        introEnd,
      },
      parentTargetOrigin
    );
  }, [sceneReady, introEnd, parentTargetOrigin]);

  useEffect(() => {
    const applyProgress = (p) => {
      const { explode, rotate } = phaseMap(p);
      scrollState.explosion = explode;
      scrollState.rotate = rotate;
      scrollState.glassOffset = mapRange(
        explode,
        glassStagger[0],
        glassStagger[1],
        0,
        1
      );
      scrollState.oledOffset = mapRange(
        explode,
        oledStagger[0],
        oledStagger[1],
        0,
        1
      );
      scrollState.phoneOffset = mapRange(
        explode,
        phoneStagger[0],
        phoneStagger[1],
        0,
        1
      );
    };

    DEV.applyProgress = applyProgress;

    const applyRuntimeProgress = (progress) => {
      const clamped = Math.max(0, Math.min(1, progress));
      // v7.5.9 — record the driving progress so the glass-edge payload can
      // carry it. Diagnostic only; it never feeds back into the motion.
      scrollState.parentProgress = clamped;
      if (runtimeMotionPath) {
        const sample = sampleMotionPlayback(
          runtimeMotionPath,
          clamped,
          runtimeMotionPath.speed
        );
        if (sample.pose) applyPoseParamsDirect(sample.pose);
      } else {
        applyProgress(clamped);
      }
      if (
        mode === "autoplay" &&
        sceneReady &&
        window.self !== window.top
      ) {
        window.parent.postMessage(
          { type: "iglass-autoplay-progress", progress: clamped },
          parentTargetOrigin
        );
      }
    };

    if (runtimeMotionPath && motionFreezeP !== null) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      applyRuntimeProgress(motionFreezeP);
      return;
    }

    if (!runtimeMotionPath && freezeP !== null) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      DEV.lastP = freezeP;
      applyProgress(freezeP);
      return;
    }

    if (runtimeMotionPath) applyRuntimeProgress(0);

    if (mode === "autoplay" && !sceneReady) {
      applyRuntimeProgress(0);
      return;
    }

    if (mode === "scroll") {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";

      const onMessage = (event) => {
        if (
          event.data &&
          event.data.type === "scroll-progress" &&
          typeof event.data.progress === "number"
        ) {
          applyRuntimeProgress(Math.max(0, Math.min(1, event.data.progress)));
        }
      };

      window.addEventListener("message", onMessage);
      return () => window.removeEventListener("message", onMessage);
    }

    if (mode === "autoplay") {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";

      const proxy = { p: 0 };
      const runtimeDuration = runtimeMotionPath
        ? Math.max(
            0.1,
            motionPlaybackTiming(runtimeMotionPath, runtimeMotionPath.speed)
              .totalDuration
          )
        : 7;
      let tween = null;

      const postAutoplay = (type, progress) => {
        if (window.self === window.top) return;
        window.parent.postMessage(
          { type, progress, version: IGLASS_APP_VERSION },
          parentTargetOrigin
        );
      };
      applyRuntimeProgress(0);

      // Reduced motion is served the finished composition immediately. It is
      // the assembled final state, not a frozen first frame.
      if (reducedMotion) {
        applyRuntimeProgress(1);
        markTiming("complete");
        postAutoplay("iglass-autoplay-complete", 1);
        renderGovernorFinish();
        return;
      }

      tween = gsap.to(proxy, {
        p: 1,
        duration: runtimeDuration,
        ease: runtimeMotionPath ? "none" : "power2.inOut",
        delay: 0,
        repeat: 0,
        yoyo: false,
        onUpdate: () => applyRuntimeProgress(proxy.p),
        onComplete: () => {
          applyRuntimeProgress(1);
          markTiming("complete");
          postAutoplay("iglass-autoplay-complete", 1);
          // Settle at the existing damping, then park the loop.
          renderGovernorFinish();
        },
      });
      return () => {
        tween?.kill();
      };
    }

    if (!containerRef.current || !stickyRef.current) return;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top top",
        end: `+=${scrollDistance * 100}vh`,
        pin: stickyRef.current,
        scrub: 1,
        onUpdate: (self) => applyRuntimeProgress(self.progress),
      });
    }, containerRef);

    return () => ctx.revert();
  }, [
    mode,
    freezeP,
    runtimeMotionPath,
    motionFreezeP,
    sceneReady,
    parentTargetOrigin,
    reducedMotion,
    scrollDistance,
    glassStagger,
    oledStagger,
    phoneStagger,
  ]);

  const onWrapPointerDown = (e) => {
    if (!dev || !DEV.setLeva) return;
    if (DEV.hudMode !== "move" || DEV.gizmo !== "off" || DEV.gizmoDragging) return;

    cancelSquareAnim();

    const eff = effectiveTarget();
    const isStage = eff === "stage";
    const base = isStage
      ? { a: STAGE.position[0], b: STAGE.position[1] }
      : { a: SETTLE.xShiftFraction, b: SETTLE.yShiftFraction };
    const Rs = stageQuat();
    const vp = DEV.viewport || { width: 4, height: 2.4 };
    const cw = DEV.canvasEl ? DEV.canvasEl.clientWidth : window.innerWidth;
    const ch = DEV.canvasEl ? DEV.canvasEl.clientHeight : window.innerHeight;
    const aspect = cw / ch;
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;

    const move = (ev) => {
      const dxPx = ev.clientX - startX;
      const dyPx = ev.clientY - startY;
      if (Math.hypot(dxPx, dyPx) > 3) moved = true;
      const fx = dxPx / cw;
      const fy = dyPx / ch;
      if (isStage) {
        const wdx = fx * vp.width;
        const wdy = -fy * vp.height;
        DEV.setLeva({
          sposX: Number((base.a + wdx).toFixed(4)),
          sposY: Number((base.b + wdy).toFixed(4)),
        });
      } else {
        const world = new THREE.Vector3(fx * aspect, -fy, 0);
        const local = world
          .applyQuaternion(Rs.clone().invert())
          .divideScalar(STAGE.scale || 1);
        const dShift = local.x / aspect;
        const dVshift = local.y;
        DEV.setLeva({
          shift: Number((base.a + dShift).toFixed(4)),
          vshift: Number((base.b + dVshift).toFixed(4)),
        });
      }
    };

    const up = () => {
      if (moved) DEV.lastDragEnd = performance.now();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const onWrapWheel = (e) => {
    if (!dev || !DEV.setLeva) return;
    const step = GRAIN_STEPS.size[DEV.driveGrain] * (e.deltaY < 0 ? 1 : -1);
    const [lo, hi] = DRIVE_CLAMPS.sscale;
    const next = Math.min(hi, Math.max(lo, STAGE.scale + step));
    DEV.setLeva({ sscale: Number(next.toFixed(4)) });
  };

  const containerHeight =
    mode === "standalone" ? `${(scrollDistance + 1) * 100}vh` : "100vh";

  return (
    <div
      ref={containerRef}
      style={{
        height: containerHeight,
        background: bg,
      }}
    >
      {dev && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483646,
            border: "3px solid #00a86b",
            boxShadow:
              "inset 6vw 0 0 rgba(0,168,107,0.08), inset -6vw 0 0 rgba(0,168,107,0.08), inset 0 6.7vh 0 rgba(0,168,107,0.08), inset 0 -6.7vh 0 rgba(0,168,107,0.08)",
            boxSizing: "border-box",
            pointerEvents: "none",
          }}
        />
      )}
      {dev && (
        <Leva
          collapsed={true}
          theme={LEVA_LIGHT}
          titleBar={{ title: "numeric sliders" }}
        />
      )}
      {dev && <DevControls initialP={freezeP ?? 0} />}
      {dev && <DevDashboard />}
      {dev && <SatNavHUD />}
      <div
        ref={stickyRef}
        style={{
          position: "relative",
          height: "100vh",
          width: "100vw",
          overflow: "hidden",
        }}
        onPointerDown={dev ? onWrapPointerDown : undefined}
        onWheel={dev ? onWrapWheel : undefined}
      >
        {webglAvailable && (
        <Canvas
          camera={{ position: [0, 0, 2.8], fov: 35, near: 0.01 }}
          dpr={[1, 2]}
          frameloop={frameloop}
          gl={{
            antialias: true,
            powerPreference: "high-performance",
            alpha: true,
            preserveDrawingBuffer: dev,
          }}
          onCreated={({ gl, scene, invalidate }) => {
            RENDER_GOV.invalidate = invalidate;
            attachContextGuards(gl);
            // v3.8: ACES Filmic, NOT NoToneMapping. Without a tone curve,
            // every value over 1.0 clips flat to white — which is exactly
            // what the metal chassis and the studio IBL were doing.
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = LIGHT.exp;
            if ("environmentIntensity" in scene) {
              scene.environmentIntensity = LIGHT.env;
            }
            gl.setClearColor(0x000000, 0);
            DEV.canvasEl = gl.domElement;
          }}
          onPointerMissed={() => {
            if (!DEV.enabled) return;
            if (
              DEV.gizmoDragging ||
              performance.now() - DEV.lastDragEnd < 250
            )
              return;
            changeGizmoContext("stage");
          }}
          style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            height: "100%",
          }}
        >
          <Scene
            modelPath={modelPath}
            screenTexture={screenTexture}
            internalsTexture={internalsTexture}
            crackTexture={crackTexture}
            explodeDistance={explodeDistance}
            dev={dev}
            glassEdgeFeed={mode === "scroll" || mode === "autoplay"}
            onReady={() => {
              markTiming("ready");
              // Dismissed BEFORE the gate releases, so the fade overlaps
              // the opening beat rather than delaying it.
              posterDismiss();
              setSceneReady(true);
            }}
          />
        </Canvas>
        )}
      </div>
    </div>
  );
}

export default function CrossSection3DScrollGLB(props) {
  const simulation = useMemo(resolveViewportSimulation, []);

  return simulation ? (
    <ExactViewportSimulator config={simulation} />
  ) : (
    <CrossSection3DScrollGLBScene {...props} />
  );
}

useGLTF.preload(defaultProps.modelPath);
useTexture.preload(defaultProps.screenTexture);
useTexture.preload(defaultProps.internalsTexture);
// Crack.webp participates in the same suspense as the other two; preloading
// it here starts its fetch at module eval instead of at first component
// render, which is a free head start on the critical path.
useTexture.preload(defaultProps.crackTexture);

markTiming("boot");
