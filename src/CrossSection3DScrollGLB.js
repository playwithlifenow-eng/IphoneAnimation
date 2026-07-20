import screenImg from "./Screen.png";
import internalsImg from "./internals.jpg";
import crackImg from "./Crack.png";
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

const IGLASS_APP_VERSION = "7.5.9";

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
//                    radiating upward and left, supplied as Crack.png.
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

// ±25 (v3.11, restored). The model measures ~15.7 local units tall fitted
// to 1.6 world units, so 1 slider unit ≈ 0.1 world units and the visible
// frame is ~3.1 world units across. Clearing the frame needs ≈19 units;
// ±25 carries the whole glass unit (pane + bezel + crack) clean out of
// shot and back. That is the swap move.
const GLASS_REG_RANGE = 25;

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
// Overridable: ?light=amb,key,fill,env,exp
// ============================================
const LIGHT = {
  amb: 0.05,
  key: 1.2,
  fill: 0.25,
  env: 0.5,
  exp: 1.0,
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
// Overridable: ?oled=-0.5
// ---------------------------------------------------------
const OLED = {
  faceCut: -0.5,
  showRim: false, // the slab's side wall — artefact, hidden by default
};

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
};

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
  reflection: 1.2,
  roughness: 0.2,
};

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

const BEZEL = {
  env: 0.0,     // envMapIntensity — 0 = dead black, no IBL reflection
  rough: 1.0,   // roughness — 1.0 = no specular lobe at all
  offset: -4,   // polygonOffset factor+units. Glass_Front sits at -2, so
                // the bezel must be MORE negative to win where they are
                // coplanar. 0 = no offset (chassis can occlude it).
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

function applyPremiumGlassMaterial() {
  const mat = DEV.glassMat;
  if (!mat) return;
  mat.color.setHex(GLASS.color);
  mat.roughness = GLASS.rough;
  mat.envMapIntensity = GLASS.env;
  mat.clearcoat = GLASS.clearcoat;
  mat.clearcoatRoughness = GLASS.ccRough;
  mat.opacity = GLASS.opacity;
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
const SLOT_COUNT = 150;
const PRIMARY_SLOT_COUNT = 100;
const MOTION_PATH_KEY = "iglass_motion_path_v1";
const MOTION_LIBRARY_KEY = "iglass_motion_path_library_v1";
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
          pose: n.pose && typeof n.pose === "object" ? { ...n.pose } : null,
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
      pose: node.pose && typeof node.pose === "object" ? { ...node.pose } : null,
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
      ...node.pose,
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
  const shineDuration =
    finalNodeGlassIsRegistered(path) && shineDistance > 0.000001
      ? shineDistance / Math.max(0.01, Number(SHINE.speed) || 0.5)
      : 0;
  return {
    pathDuration,
    shineStart,
    shineDuration,
    totalDuration: Math.max(pathDuration, shineStart + shineDuration),
    rangeStart,
    rangeEnd,
  };
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
  return { pose, pathProgress, ...timing };
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
  const endsAtHold = nodeHoldDuration(endNode) > 0;
  const departureEase = startsAfterHold
    ? (MOTION_EASES[startNode.departureEase] ? startNode.departureEase : "accelerate")
    : null;
  const departureStrength = startsAfterHold
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
          pose: node.pose,
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
              ...pose,
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
  o.crackOn = CRACK.on;
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
    [LIGHT.amb, LIGHT.key, LIGHT.fill, LIGHT.env, LIGHT.exp]
      .map((v) => v.toFixed(3))
      .join(",")
  );
  params.set(
    "bezel",
    [BEZEL.env, BEZEL.rough, BEZEL.offset].map((v) => v.toFixed(2)).join(",")
  );
  params.set("oled", `${OLED.faceCut.toFixed(2)},${OLED.showRim ? 1 : 0}`);
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
    `ibl ${LIGHT.preset}  blur ${LIGHT.blur.toFixed(2)}    crack ${CRACK.on ? "ON" : "OFF"}  reg ${CRACK.exit.map((v) => v.toFixed(2)).join(", ")}`,
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
            if (DEV.crackMat) DEV.crackMat.envMapIntensity = v;
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
          },
          { collapsed: true }
        ),
      },
      { collapsed: false }
    ),

    // ---- CRACKED PANE. Presence, pane registration, and the requested
    // severity/sharpness controls. Values save into pose slots. Shortcut: C. ----
    "💥 cracked pane": folder(
      {
        crackOn: {
          value: CRACK.on,
          label: "CRACK  (saved in the pose slot)",
          onChange: (v) => {
            CRACK.on = !!v;
            CRACK.mix = CRACK.on ? 1 : 0;
            syncCrackAppearance();
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
      { collapsed: true }
    ),

    // ---- GLASS REGISTRATION (±25, v3.11 restored). 1 unit ≈ 0.1 world
    // units; the frame is ~3.1 world units across, so ±25 carries the whole
    // glass unit (pane + bezel + crack) clean out of shot and back — that is
    // the swap move. Saved in pose slots, interpolated by motion paths, and
    // wireable in compound motion for fine work on a range this wide. ----
    "🔲 glass registration (±25 — drives the pane OUT of shot)": folder(
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
      { collapsed: true }
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
        set({ crackOn: !CRACK.on });
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
