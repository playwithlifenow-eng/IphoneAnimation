import screenImg from "./Screen.png";
import internalsImg from "./internals.jpg";
import { useRef, useMemo, useEffect, useLayoutEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  useGLTF,
  useTexture,
  TransformControls,
} from "@react-three/drei";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Leva, useControls, button, folder } from "leva";

gsap.registerPlugin(ScrollTrigger);

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
// v3.9 — GLASS MATERIAL, IBL SOFTNESS, AND THE CRACKED-GLASS LAYER
//
//   THE HARD CIRCLE     It is not a light. It is a REFLECTION. Glass_Front
//                       ran roughness 0.04 — that is a mirror — and
//                       Environment preset="studio" is a virtual photo
//                       studio whose HDRI contains actual softbox panels.
//                       A mirror reflects a softbox as a hard-edged bright
//                       shape. That is the circle.
//
//                       Two independent softeners, both now dials:
//                         GLASS.rough   blurs what the GLASS reflects.
//                                       This is the local one. Roughness
//                                       convolves the env map through its
//                                       prefiltered mips, so raising it
//                                       spreads the highlight instead of
//                                       dimming it. THE dial for this.
//                         LIGHT.blur    blurs the IBL ITSELF, so every
//                                       reflective surface softens at
//                                       once. Version-dependent: drei's
//                                       Environment gained `blur` at some
//                                       point; on an older build the prop
//                                       is simply ignored, no error. If
//                                       nothing happens when you drag it,
//                                       that is why — use GLASS.rough.
//                         LIGHT.preset  changes the reflected SHAPES
//                                       outright. "studio" has the hard
//                                       boxes; "apartment"/"city"/"lobby"
//                                       reflect softer, messier worlds.
//
//   SHINIER GLASS       Glass_Front is now MeshPhysicalMaterial, not
//                       MeshStandardMaterial. That buys a CLEARCOAT: a
//                       second specular layer over the base, with its own
//                       roughness. It is the lacquer-over-paint model, and
//                       it is what separates "a dark surface" from "glass".
//                       clearcoat is constructed non-zero so the shader
//                       compiles the chunk in; dialling it afterwards is a
//                       free uniform write, not a recompile.
//
//   CRACKED GLASS       No Blender. No second GLB. Probed the deployed
//                       asset: Glass_Front is a FLAT 1216-vert plane and
//                       it already carries TEXCOORD_0. So the cracked pane
//                       is its geometry, cloned in code, with a crack PNG
//                       on it — the identical pattern to Screen.png and
//                       internals.jpg, which already work.
//
//                       Coexistence, which you flagged as the hard part,
//                       is not a problem at all: it is just a third group
//                       under the pivot. It rides GLASS_REG and the glass
//                       explode by default, so it looks welded to the
//                       pane; CRACK.exit then sends it off on its OWN path
//                       as it goes. The crossfade is scrollState.swap,
//                       which runs across the existing HOLD phase — so the
//                       choreography is already the repair story: the
//                       cracked pane lifts off during the explode, is
//                       discarded across the hold, and the clean pane
//                       re-seats on the reassemble. No new timeline.
//
//                       crackTexture is an OPTIONAL prop. Absent, the
//                       whole layer costs nothing and renders nothing.
//
// ============================================
// v3.8.7 — KEYBOARD DRIVE: TAP vs HOLD
//
//   The arrow keys felt slow because the repeat was coming from the
//   OPERATING SYSTEM: a ~500 ms dead pause, then a fixed ~30/sec chatter,
//   every step the same size. That is a text-entry repeat curve, not a
//   navigation one.
//
//   Split the two gestures, because they want opposite things:
//
//     TAP   one keydown -> exactly ONE nudge at the full grain step.
//           Unchanged. This is the precision gesture and it stays exact.
//
//     HOLD  after KEYS.delay ms, a rAF loop takes over at 60 fps and
//           ramps the per-frame step from 0.25x grain up to 1.5x grain
//           over KEYS.ramp ms. No OS pause, no chatter, and it lands
//           roughly 3-6x faster than the old repeat at full glide while
//           still starting gently enough to stop where you meant to.
//
//   OS key-repeat events (ev.repeat) are now DISCARDED — the rAF loop owns
//   the hold, so the two cannot fight each other.
//
//   Speed is therefore controlled on two axes, both of them reachable:
//     GRAIN  fine / mid / coarse — the size of one tap. G key, and now
//            three clickable chips in the dashboard.
//     GAIN   the "hold speed" dial — scales the hold ramp only. Taps are
//            untouched by it.
//
// ============================================
// v3.8.6 — compound-motion ratio range widened to +/-20 (was +/-5), in
//          BOTH clamps: the Leva "ratio" control and the dashboard's range
//          slider. Step coarsened 0.01 -> 0.05 so a full sweep is still one
//          drag rather than 800 of them. WIRE.ratio itself was never
//          clamped in code — only the two UI widgets were.
//
// ============================================
// v3.8.5 — THE TWO BLACK RIM TRIMS
//
//   PROBED FROM THE DEPLOYED GLB, not inferred. Three prims stack at the
//   front face (metres):
//
//     Glass_Front        z -0.0051 (FLAT PLANE, 0 thick)   71 x 155 mm
//     Glass_Bezel        z -0.0051 -> -0.0046  (0.5 mm)    75 x 159 mm
//     Display_OLED.001   z -0.0042 -> -0.0038  (0.4 mm)    75 x 159 mm
//
//   The bezel and the OLED carry IDENTICAL footprints, both 2 mm larger
//   per side than the front glass, and they sit 0.4 mm apart in Z. Neither
//   is a plane — both are SLABS, so both have a side-wall RIM running the
//   whole perimeter. Both rims render black (the bezel by design; the OLED
//   rim because v3.8's two-way split sent everything that was not the
//   front cap to the black material). Two black slab rims, 0.4 mm apart,
//   only visible at a grazing angle. That is the doubled trim, exactly.
//
//   The BEZEL band is wanted — it is the phone's real black border, and
//   2 mm is dimensionally right for a 14 Pro. The OLED rim is pure
//   artefact: on a real panel that manufacturing edge is buried under the
//   bezel, and here it is being drawn as a second line.
//
//   Fix: THREE-way split, not two.
//     nz <  faceCut   -> screen  (front cap)
//     nz > -faceCut   -> black   (back cap; still occludes from behind)
//     otherwise       -> RIM     -> its own material, visible = false
//
//   The rim now renders nothing at all. The back cap survives, so the slab
//   is still solid from the rear. Rim visibility is a dial ("show OLED
//   rim") in case anything unexpected shows through, and there is a "hide
//   bezel" toggle beside it so each trim can be isolated on demand and the
//   attribution confirmed by eye rather than by argument.
//
// ============================================
// v3.8.4 — OLED FACE-SPLIT THRESHOLD (the jagged corner lip)
//
//   The jagged, alternating rainbow edge on the OLED's top corners —
//   visible ONLY from a grazing angle, never from above — was not the
//   mesh. It was v3.8's own face classifier.
//
//   splitOledGeometry sorted the slab's triangles by the RAW SIGN of the
//   face normal's Z:
//
//       front cap   nz ~ -1   -> screen      correct
//       back cap    nz ~ +1   -> black       correct
//       the RIM     nz ~  0   -> COIN TOSS   <-- the bug
//
//   The cut sat at exactly 0. The slab's rim is perpendicular to Z, so its
//   normals land ON the boundary — and around a rounded corner the rim
//   tilts, so half of those triangles wobble a hair negative and were
//   handed the SCREEN TEXTURE. That is the jagged lip. It hides from a
//   face-on view because the rim is the one surface you cannot see from
//   straight on, and it concentrates at the corners because that is where
//   the rim sweeps through the threshold.
//
//   Fix: normalise the face normal and cut in the EMPTY half of the
//   distribution (OLED.faceCut = -0.5) instead of on the boundary. The cap
//   clears it by 0.5; the rim misses it by 0.5. No rim triangle can take
//   the screen material at any corner radius.
//
//   Live dial. The index buffer and groups are rebuilt in place from a
//   cached per-triangle nz table — the scene graph is never re-traversed,
//   so this is safe to drag at runtime. Slide it to 0 to reproduce the
//   v3.8 bug on demand; that IS the proof. (?oled=-0.5)
//
//   RESIDUAL: if a stepped SILHOUETTE survives at faceCut -0.9, that part
//   is the mesh's corner tessellation and no shader can fix it — that is a
//   Blender bevel/segment-count job on the OLED slab, same drawer as the
//   Glass_Bezel flank.
//
// ============================================
// v3.8.3 — CONTACT SHADOW REMOVED
//
//   The horizontal line running clean across the screen AND out past the
//   phone's silhouette on both sides was never a shadow ON the phone — it
//   was ContactShadows itself. It is a ground plane at y = -0.7 and the
//   camera sits at y = 0, so it was being viewed almost perfectly edge-on:
//   a plane seen edge-on collapses to a line. Its opacity ran
//   0.5 * (1 - rotate), so it was at FULL strength at the start of the
//   timeline (the hero pose being captured) and faded out by the settle —
//   which is why it only ever showed up here.
//
//   Nothing is lost by deleting it: the background is transparent, the
//   phone is floating, and there is no ground for it to contact. The
//   shadowRef and its per-frame opacity write go with it.
//
// ============================================
// v3.8.2 — REVERT: PILL ROUTING + CAMERA HIDING
//
//   Two v3.8 interventions are withdrawn on request. Everything else
//   from v3.8 / v3.8.1 stands untouched.
//
//   PILL ROUTING       WITHDRAWN. "Display Dynamic Island" no longer
//     (reverted)       mounts in the glass group. It falls through the
//                      traverse to body.push() exactly as it did before
//                      v3.8 — so it carries NO GLASS_REG, NO 2.0×
//                      explode, and sits in the body's frame. The
//                      GLASS_GROUP_MATERIALS set and the 5b routing
//                      block are gone.
//
//   STRAY CAMERA       WITHDRAWN. HIDDEN_MATERIALS and the hide branch
//     (reverted)       are gone. "Front Camera (Center + Outer Ring)"
//                      and "Display Camera Hole (Outer Bright)" render
//                      again, in the body group, as they did before.
//
//   normMat            Removed with them — it existed only to feed those
//     (removed)        two Sets and had no other caller.
//
//   Glass_Front cutout is UNAFFECTED by this revert. The pill hole is
//   authored in the GLB geometry; no code path ever filled it, in any
//   version. It stays hollow.
//
// ============================================
// v3.8.1 — RETAINED
//
//   BEZEL DIALS        depthTest restored to true; anti-flicker handed to
//                      polygonOffset. env / rough / offset are live dials
//                      (?bezel=env,rough,offset).
//
//   TRANSLUCENT COATS  The old `opacity < 1 → paint it black` rule is gone.
//                      Gloss coats (Rear Camera Island + Apple Logo, Flash
//                      Bright, the camera-hole brights) render as AUTHORED
//                      — real colour, real alpha, depthWrite off so they
//                      cannot fight the surface they sit on. Only
//                      alpha ≤ 0.05 films are still hidden.
//
// ============================================
// v3.8 — RETAINED
//
//   LIGHTING RIG       Five stacked sources + NoToneMapping was the cream
//                      blowout. Now one key, one fill, a low ambient, and
//                      the IBL scaled by scene.environmentIntensity —
//                      every one on a Leva dial, ACES Filmic tone mapping
//                      with an exposure dial. (?light=amb,key,fill,env,exp)
//
//   OLED BACK FACE     Display_OLED is a SOLID SLAB (118.62 units of front-
//                      facing area, 118.63 back-facing), so FrontSide drew
//                      the UI on the phone's back too. Fixed by splitting
//                      the index by face-normal Z into two geometry groups
//                      and handing the mesh a MATERIAL ARRAY [screen, black].
//                      Front is -Z (Glass_Front z -0.0051, Back Glass +0.005).
//
// ============================================
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

const GLASS_REG = { x: -0.03, y: 0.09, z: 0.07 };

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
  amb: 0.1,
  key: 1.2,
  fill: 0.35,
  env: 0.4,
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
  rough: 0.12,
  env: 1.4,
  opacity: 0.15,
  clearcoat: 1.0,
  ccRough: 0.06,
};

// ---------------------------------------------------------
// CRACK (v3.9) — the cracked pane that gets removed and replaced.
//
//   The cracked pane is a CLONE of Glass_Front's geometry (a flat plane,
//   1216 verts, already UV'd) carrying a crack PNG. It is a sibling group
//   of the glass, so by default it inherits the same GLASS_REG and the
//   same explode multiplier and looks welded to the pane it sits on.
//
//   swap 0 -> 1 across the HOLD phase (TIMELINE.explodeEnd -> holdEnd).
//     opacity  fades CRACK.opacity -> 0
//     exit     an EXTRA translation, scaled by swap, that sends the broken
//              pane off on its own path while the clean one stays put.
//              Leave at 0,0,0 and it simply dissolves in place.
// Overridable: ?crack=opacity,exitX,exitY,exitZ
// ---------------------------------------------------------
const CRACK = {
  opacity: 1.0,
  explodeMul: 2.0, // 2.0 == the glass group's multiplier: welded
  exit: [0, 0, 0],
};

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
  crackMat: null, // live handle — the cracked-pane folder
  setEnv: null, // Scene's setter — preset/blur need a React re-render
  pathPreview: false, // path engine already owns easing; bypass render damping
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
};

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
  "settleX", "settleY", "settleZ", "tilt",
];

const WIRE = {
  enabled: false,
  master: "sposZ",
  driven: "sposY",
  ratio: 1.0,
  masterAnchor: 0,
  drivenAnchor: 0,
  suspended: false,
};

function wireAnchors() {
  WIRE.masterAnchor = DRIVE_READERS[WIRE.master]();
  WIRE.drivenAnchor = DRIVE_READERS[WIRE.driven]();
}

function wireTap(param, value) {
  if (!WIRE.enabled || WIRE.suspended) return;
  if (param !== WIRE.master || WIRE.master === WIRE.driven) return;
  if (!DEV.setLeva) return;
  const t = WIRE.drivenAnchor + (value - WIRE.masterAnchor) * WIRE.ratio;
  const [lo, hi] = DRIVE_CLAMPS[WIRE.driven] || [-Infinity, Infinity];
  WIRE.suspended = true;
  DEV.setLeva({
    [WIRE.driven]: Number(Math.min(hi, Math.max(lo, t)).toFixed(4)),
  });
  WIRE.suspended = false;
}

function wireResetRun() {
  if (!DEV.setLeva) return;
  WIRE.suspended = true;
  DEV.setLeva({
    [WIRE.master]: Number(WIRE.masterAnchor.toFixed(4)),
    [WIRE.driven]: Number(WIRE.drivenAnchor.toFixed(4)),
  });
  WIRE.suspended = false;
}

// ---------------------------------------------------------
// SNAPSHOT / SLOT ENGINE
// ---------------------------------------------------------
const SNAPSHOTS = { origin: null };

const SLOT_KEY = "iglass_pose_slots_v1";
const SLOT_COUNT = 100;
const MOTION_PATH_KEY = "iglass_motion_path_v1";

const MOTION_EASES = {
  linear: (t) => t,
  smooth: (t) => t * t * (3 - 2 * t),
  cinematic: (t) => t * t * t * (t * (t * 6 - 15) + 10),
  sine: (t) => 0.5 - 0.5 * Math.cos(Math.PI * t),
  accelerate: (t) => t * t * t,
  decelerate: (t) => 1 - Math.pow(1 - t, 3),
};

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

function defaultMotionPath() {
  return {
    version: 1,
    trajectory: "curve",
    speed: 1,
    loop: true,
    nodes: [],
  };
}

function loadMotionPath() {
  try {
    const raw = window.localStorage.getItem(MOTION_PATH_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if (saved && Array.isArray(saved.nodes)) {
      return {
        ...defaultMotionPath(),
        ...saved,
        trajectory: saved.trajectory === "line" ? "line" : "curve",
        speed: Math.max(0.1, Number(saved.speed) || 1),
        loop: saved.loop !== false,
        nodes: saved.nodes
          .filter((n) => Number.isInteger(n.slot))
          .map((n, i) => ({
            slot: n.slot,
            duration: i === 0 ? 0 : Math.max(0.1, Number(n.duration) || 1.25),
            hold: Math.max(0, Number(n.hold) || 0),
            ease: MOTION_EASES[n.ease] ? n.ease : "cinematic",
          })),
      };
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

function compileMotionPath(path, slots) {
  const nodes = path.nodes
    .map((node) => ({ ...node, pose: slots[node.slot] || null }))
    .filter((node) => node.pose);
  return {
    type: "iglass-motion-path",
    version: 1,
    trajectory: path.trajectory === "line" ? "line" : "curve",
    speed: Math.max(0.1, Number(path.speed) || 1),
    loop: path.loop !== false,
    nodes,
  };
}

function motionPathDuration(path) {
  if (!path || !path.nodes || !path.nodes.length) return 0;
  return path.nodes.reduce(
    (sum, node, i) =>
      sum + (i === 0 ? 0 : Math.max(0.1, Number(node.duration) || 0)) +
      Math.max(0, Number(node.hold) || 0),
    0
  );
}

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function interpolateEulerGroup(a, b, keys, t, out) {
  const rad = Math.PI / 180;
  const qa = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(a[keys[0]] * rad, a[keys[1]] * rad, a[keys[2]] * rad)
  );
  const qb = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(b[keys[0]] * rad, b[keys[1]] * rad, b[keys[2]] * rad)
  );
  const q = new THREE.Quaternion().slerpQuaternions(qa, qb, t);
  const e = new THREE.Euler().setFromQuaternion(q, "XYZ");
  out[keys[0]] = wrapDeg(e.x);
  out[keys[1]] = wrapDeg(e.y);
  out[keys[2]] = wrapDeg(e.z);
}

function interpolateMotionPose(nodes, fromIndex, t, trajectory) {
  const a = nodes[fromIndex].pose;
  const b = nodes[fromIndex + 1].pose;
  const out = {};

  for (const key of Object.keys(a)) {
    if (POSE_ROTATION_KEYS.has(key)) continue;
    const av = a[key];
    const bv = b[key];
    if (typeof av === "number" && typeof bv === "number") {
      out[key] = av + (bv - av) * t;
    } else {
      out[key] = t < 1 ? av : bv;
    }
  }

  for (const keys of POSE_ROTATION_GROUPS) {
    if (keys.every((key) => typeof a[key] === "number" && typeof b[key] === "number")) {
      interpolateEulerGroup(a, b, keys, t, out);
    }
  }

  if (trajectory === "curve") {
    const p0 = nodes[Math.max(0, fromIndex - 1)].pose;
    const p1 = a;
    const p2 = b;
    const p3 = nodes[Math.min(nodes.length - 1, fromIndex + 2)].pose;
    for (const key of ["sposX", "sposY", "sposZ"]) {
      if ([p0[key], p1[key], p2[key], p3[key]].every(Number.isFinite)) {
        out[key] = catmullRom(p0[key], p1[key], p2[key], p3[key], t);
      }
    }
  }

  return out;
}

function sampleMotionPath(path, progress) {
  if (!path || !path.nodes || !path.nodes.length) return null;
  if (path.nodes.length === 1) return { ...path.nodes[0].pose };

  const total = motionPathDuration(path);
  if (total <= 0) return { ...path.nodes[path.nodes.length - 1].pose };

  let time = Math.max(0, Math.min(1, progress)) * total;
  const firstHold = Math.max(0, Number(path.nodes[0].hold) || 0);
  if (time <= firstHold) return { ...path.nodes[0].pose };
  time -= firstHold;

  for (let i = 1; i < path.nodes.length; i++) {
    const node = path.nodes[i];
    const duration = Math.max(0.1, Number(node.duration) || 0);
    if (time <= duration) {
      const raw = Math.max(0, Math.min(1, time / duration));
      const ease = MOTION_EASES[node.ease] || MOTION_EASES.cinematic;
      return interpolateMotionPose(path.nodes, i - 1, ease(raw), path.trajectory);
    }
    time -= duration;

    const hold = Math.max(0, Number(node.hold) || 0);
    if (time <= hold) return { ...node.pose };
    time -= hold;
  }

  return { ...path.nodes[path.nodes.length - 1].pose };
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
  DEV.setLeva({ ...pose, drive: driveLabel() });
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
          ease: MOTION_EASES[node.ease] ? node.ease : "cinematic",
          pose: node.pose,
        }));
      if (!nodes.length) return null;
      return {
        type: "iglass-motion-path",
        version: 1,
        trajectory: parsed.trajectory === "line" ? "line" : "curve",
        speed: Math.max(0.1, Number(parsed.speed) || 1),
        loop: parsed.loop !== false,
        nodes,
      };
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
      for (let i = 0; i < n; i++) out[i] = arr[i];
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

function readPoseParams() {
  const o = {};
  for (const k of Object.keys(DRIVE_READERS)) o[k] = DRIVE_READERS[k]();
  o.p = DEV.lastP;
  return o;
}

function takeSnapshot(slot) {
  SNAPSHOTS[slot] = readPoseParams();
}

function warpToParams(snap) {
  if (!snap || !DEV.setLeva) return;
  WIRE.suspended = true;
  const { p, ...rest } = snap;
  DEV.setLeva(rest);
  if (typeof p === "number") jumpToP(p);
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
  params.set("envp", LIGHT.preset);
  params.set("envb", LIGHT.blur.toFixed(2));
  params.set(
    "crack",
    [CRACK.opacity, CRACK.exit[0], CRACK.exit[1], CRACK.exit[2]]
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

function copyMotionPreviewURL(path, slots) {
  const base = buildMotionPathBaseURL(path, slots);
  if (!base) return false;
  const url = new URL(base);
  url.searchParams.set("mode", "autoplay");
  if (navigator.clipboard) navigator.clipboard.writeText(url.toString());
  return true;
}

function copyMotionManifest(path, slots) {
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
  if (navigator.clipboard) {
    navigator.clipboard.writeText(JSON.stringify(manifest, null, 2));
  }
  return true;
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
    `ibl ${LIGHT.preset}  blur ${LIGHT.blur.toFixed(2)}    crack ${CRACK.opacity.toFixed(2)}  exit ${CRACK.exit.map((v) => v.toFixed(2)).join(", ")}`,
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
  if (DEV.setLeva) DEV.setLeva({ p: v, drive: driveLabel() });
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

    // ---- v3.8 LIGHTING — open by default. This is the dial set that
    // replaces the hard-coded five-source blowout. Match the Blender
    // reference by eye, then read the numbers off 📋 copy URL / 📸 save
    // card and they get baked as the compiled LIGHT defaults. ----
    "💡 lighting": folder(
      {
        amb: {
          value: LIGHT.amb,
          min: 0,
          max: 1.5,
          step: 0.01,
          label: "ambient fill",
          onChange: (v) => {
            LIGHT.amb = v;
          },
        },
        key: {
          value: LIGHT.key,
          min: 0,
          max: 5,
          step: 0.05,
          label: "key light",
          onChange: (v) => {
            LIGHT.key = v;
          },
        },
        fill: {
          value: LIGHT.fill,
          min: 0,
          max: 3,
          step: 0.05,
          label: "fill / rim light",
          onChange: (v) => {
            LIGHT.fill = v;
          },
        },
        env: {
          value: LIGHT.env,
          min: 0,
          max: 3,
          step: 0.05,
          label: "studio reflections",
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
        envBlur: {
          value: LIGHT.blur,
          min: 0,
          max: 1,
          step: 0.01,
          label: "IBL blur (softens EVERY reflection)",
          onChange: (v) => {
            LIGHT.blur = v;
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
          label: "tint / darkness",
          onChange: (v) => {
            GLASS.opacity = v;
            if (DEV.glassMat) DEV.glassMat.opacity = v;
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

    // ---- v3.9 CRACKED PANE. Inert unless a crackTexture prop is passed. ----
    "💥 cracked pane": folder(
      {
        crackOpacity: {
          value: CRACK.opacity,
          min: 0,
          max: 1,
          step: 0.01,
          label: "crack strength",
          onChange: (v) => {
            CRACK.opacity = v;
          },
        },
        crackExitX: {
          value: CRACK.exit[0],
          min: -3,
          max: 3,
          step: 0.01,
          label: "discard ← → (X)",
          onChange: (v) => {
            CRACK.exit[0] = v;
          },
        },
        crackExitY: {
          value: CRACK.exit[1],
          min: -3,
          max: 3,
          step: 0.01,
          label: "discard ↑ ↓ (Y)",
          onChange: (v) => {
            CRACK.exit[1] = v;
          },
        },
        crackExitZ: {
          value: CRACK.exit[2],
          min: -3,
          max: 3,
          step: 0.01,
          label: "discard depth (Z)",
          onChange: (v) => {
            CRACK.exit[2] = v;
          },
        },
      },
      { collapsed: true }
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

    "🔗 wiring": folder(
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
          options: WIREABLE,
          onChange: (v) => {
            WIRE.master = v;
            if (WIRE.enabled) wireAnchors();
          },
        },
        driven: {
          value: WIRE.driven,
          options: WIREABLE,
          onChange: (v) => {
            WIRE.driven = v;
            if (WIRE.enabled) wireAnchors();
          },
        },
        ratio: {
          value: 1.0,
          min: -20,
          max: 20,
          step: 0.05,
          onChange: (v) => {
            WIRE.ratio = v;
          },
        },
        "↺ reset run": button(wireResetRun),
      },
      { collapsed: true }
    ),
    "⏱ timeline": folder(
      {
        p: {
          value: initialP,
          min: 0,
          max: 1,
          step: 0.001,
          label: "playhead p",
          onChange: (v) => {
            DEV.lastP = v;
            if (DEV.applyProgress) DEV.applyProgress(v);
            if (DEV.setLeva) DEV.setLeva({ drive: driveLabel() });
          },
        },
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
    "🔲 glass registration": folder(
      {
        glassRegY: {
          value: GLASS_REG.y,
          min: -1,
          max: 1,
          step: 0.005,
          label: "up / down (Y)",
          onChange: (v) => {
            GLASS_REG.y = v;
          },
        },
        glassRegX: {
          value: GLASS_REG.x,
          min: -1,
          max: 1,
          step: 0.005,
          label: "across (X)",
          onChange: (v) => {
            GLASS_REG.x = v;
          },
        },
        glassRegZ: {
          value: GLASS_REG.z,
          min: -1,
          max: 1,
          step: 0.005,
          label: "depth (Z)",
          onChange: (v) => {
            GLASS_REG.z = v;
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
    width: 258,
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

const HUMAN_LABELS = {
  sposX: "Stage ← →",
  sposY: "Stage ↑ ↓",
  sposZ: "Stage depth",
  srotX: "Stage pitch °",
  srotY: "Stage yaw °",
  srotZ: "Stage roll °",
  sscale: "Stage zoom",
  shift: "Phone final ← →",
  vshift: "Phone final ↑ ↓",
  lift: "Travel arc lift",
  pscale: "Final size",
  size: "Phone fit size",
  settleX: "Phone pitch °",
  settleY: "Phone yaw °",
  settleZ: "Phone roll °",
  tilt: "Start tilt °",
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

const slotStyle = (filled) => ({
  width: 20,
  height: 20,
  borderRadius: 4,
  border: "1px solid " + (filled ? "#2e7d52" : "#d5e2d9"),
  background: filled ? "#3c9a68" : "#fbfdfb",
  color: filled ? "#ffffff" : "#9ab0a2",
  fontSize: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
});

function DevDashboard() {
  const [, force] = useState(0);
  const panelRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);
  const [motionPath, setMotionPath] = useState(loadMotionPath);
  const [selectedPathNode, setSelectedPathNode] = useState(-1);
  const [pathProgress, setPathProgress] = useState(0);
  const [pathPlaying, setPathPlaying] = useState(false);
  const pathProgressRef = useRef(0);
  const pathPlaybackRef = useRef({ raf: 0 });

  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 150);
    return () => clearInterval(id);
  }, []);

  const [slots, setSlots] = useState(loadSlots);

  useEffect(() => {
    persistMotionPath(motionPath);
  }, [motionPath]);

  useEffect(() => {
    return () => {
      if (pathPlaybackRef.current.raf) {
        cancelAnimationFrame(pathPlaybackRef.current.raf);
      }
    };
  }, []);

  const isStage = DEV.gizmoTarget === "stage";
  const routed = effectiveTarget() !== DEV.gizmoTarget;

  useEffect(() => {
    const cw =
      (DEV.canvasEl && DEV.canvasEl.clientWidth) || window.innerWidth || 1600;
    const pw = collapsed
      ? 0
      : panelRef.current
      ? panelRef.current.offsetWidth
      : 258;
    const rightPx = 12 + pw + 10;
    const ndc = -1 + (2 * rightPx) / cw;
    DEV.leftClampNDC = Math.max(-0.9, Math.min(-0.15, ndc));
  });

  const applyPathAt = (progress, syncControls = false, sourcePath = motionPath) => {
    const compiled = compileMotionPath(sourcePath, slots);
    const pose = sampleMotionPath(compiled, progress);
    if (!pose) return false;
    const p = Math.max(0, Math.min(1, progress));
    pathProgressRef.current = p;
    setPathProgress(p);
    applyPoseParamsDirect(pose);
    if (syncControls) syncPoseControls(pose);
    return true;
  };

  const pauseMotionPath = (syncControls = true) => {
    if (pathPlaybackRef.current.raf) {
      cancelAnimationFrame(pathPlaybackRef.current.raf);
      pathPlaybackRef.current.raf = 0;
    }
    setPathPlaying(false);
    if (syncControls) {
      const compiled = compileMotionPath(motionPath, slots);
      syncPoseControls(sampleMotionPath(compiled, pathProgressRef.current));
    }
  };

  const playMotionPath = () => {
    pauseMotionPath(false);
    const compiled = compileMotionPath(motionPath, slots);
    const total = motionPathDuration(compiled);
    if (compiled.nodes.length < 2 || total <= 0) return;

    let startProgress = pathProgressRef.current;
    if (startProgress >= 0.999) startProgress = 0;
    const startSeconds = startProgress * total;
    const startedAt = performance.now();
    const speed = Math.max(0.1, Number(motionPath.speed) || 1);
    setPathPlaying(true);

    const tick = (now) => {
      const seconds = startSeconds + ((now - startedAt) / 1000) * speed;
      const done = seconds >= total;
      const progress = motionPath.loop
        ? (seconds % total) / total
        : Math.min(1, seconds / total);

      const pose = sampleMotionPath(compiled, progress);
      if (pose) {
        pathProgressRef.current = progress;
        setPathProgress(progress);
        applyPoseParamsDirect(pose);
      }

      if (done && !motionPath.loop) {
        pathPlaybackRef.current.raf = 0;
        setPathPlaying(false);
        syncPoseControls(sampleMotionPath(compiled, 1));
        return;
      }
      pathPlaybackRef.current.raf = requestAnimationFrame(tick);
    };

    pathPlaybackRef.current.raf = requestAnimationFrame(tick);
  };

  const commitMotionPath = (next) => {
    pauseMotionPath(false);
    setMotionPath(next);
  };

  const addPathNode = (slot) => {
    if (!slots[slot]) return;
    const index = motionPath.nodes.length;
    const next = {
      ...motionPath,
      nodes: [
        ...motionPath.nodes,
        {
          slot,
          duration: index === 0 ? 0 : 1.25,
          hold: index === 0 ? 0.35 : 0.2,
          ease: "cinematic",
        },
      ],
    };
    commitMotionPath(next);
    setSelectedPathNode(index);
  };

  const updateSelectedPathNode = (patch) => {
    if (selectedPathNode < 0 || !motionPath.nodes[selectedPathNode]) return;
    const nodes = motionPath.nodes.map((node, i) =>
      i === selectedPathNode ? { ...node, ...patch } : node
    );
    if (nodes[0]) nodes[0] = { ...nodes[0], duration: 0 };
    commitMotionPath({ ...motionPath, nodes });
  };

  const removeSelectedPathNode = () => {
    if (selectedPathNode < 0) return;
    const nodes = motionPath.nodes.filter((_, i) => i !== selectedPathNode);
    if (nodes[0]) nodes[0] = { ...nodes[0], duration: 0 };
    commitMotionPath({ ...motionPath, nodes });
    setSelectedPathNode(Math.min(selectedPathNode, nodes.length - 1));
  };

  const moveSelectedPathNode = (direction) => {
    const to = selectedPathNode + direction;
    if (selectedPathNode < 0 || to < 0 || to >= motionPath.nodes.length) return;
    const nodes = [...motionPath.nodes];
    [nodes[selectedPathNode], nodes[to]] = [nodes[to], nodes[selectedPathNode]];
    if (nodes[0]) nodes[0] = { ...nodes[0], duration: 0 };
    if (nodes[1] && nodes[1].duration <= 0) nodes[1] = { ...nodes[1], duration: 1.25 };
    commitMotionPath({ ...motionPath, nodes });
    setSelectedPathNode(to);
  };

  const slotClick = (i, ev) => {
    if (ev.shiftKey) {
      pauseMotionPath(false);
      const next = [...slots];
      next[i] = readPoseParams();
      setSlots(next);
      persistSlots(next);
    } else if ((ev.ctrlKey || ev.metaKey) && slots[i]) {
      addPathNode(i);
    } else if (slots[i]) {
      pauseMotionPath(false);
      warpToParams(slots[i]);
    }
  };

  const slotClear = (i, ev) => {
    ev.preventDefault();
    if (!slots[i]) return;
    pauseMotionPath(false);
    const next = [...slots];
    next[i] = null;
    setSlots(next);
    persistSlots(next);
  };

  const filledCount = slots.filter(Boolean).length;
  const compiledPath = compileMotionPath(motionPath, slots);
  const pathReady = compiledPath.nodes.length >= 2;
  const pathDuration = motionPathDuration(compiledPath);
  const selectedNode = motionPath.nodes[selectedPathNode] || null;

  if (collapsed) {
    return (
      <div ref={panelRef} style={UI.panelCollapsed}>
        <span
          style={{
            fontWeight: 700,
            fontSize: 11,
            color: "#2e7d52",
            letterSpacing: 1,
            marginRight: 8,
          }}
        >
          iGLASS
        </span>
        <span
          style={chipStyle(false)}
          title="expand panel"
          onClick={() => setCollapsed(false)}
        >
          ▸ open
        </span>
      </div>
    );
  }

  return (
    <div ref={panelRef} style={UI.panel}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: 11,
            color: "#2e7d52",
            letterSpacing: 1,
          }}
        >
          iGLASS POSE STUDIO
        </span>
        <span
          style={chipStyle(false)}
          title="collapse panel (frees the left edge for the gizmo)"
          onClick={() => setCollapsed(true)}
        >
          ▾ hide
        </span>
      </div>

      <div style={UI.head}>target</div>
      <div style={UI.row}>
        <span
          style={chipStyle(!isStage, true)}
          title="the phone's FINAL docked pose"
          onClick={() => changeGizmoContext("settle")}
        >
          📱 phone
        </span>
        <span
          style={chipStyle(isStage, true)}
          title="the whole scene's framing — works at any point on the timeline"
          onClick={() => changeGizmoContext("stage")}
        >
          🎬 stage
        </span>
      </div>
      {routed && (
        <div style={{ ...UI.hint, marginTop: 2, color: "#2e7d52" }}>
          mid-timeline → controls drive the stage · playhead stays put
        </div>
      )}

      <div style={UI.head}>⊞ square up (smooth)</div>
      <div style={UI.row}>
        <span
          style={chipStyle(false, true)}
          title="rotate the phone AS SEEN ON SCREEN to the nearest clean 90°"
          onClick={squareUpPhone}
        >
          ⊞ phone
        </span>
        <span
          style={chipStyle(false, true)}
          title="rotate the stage frame to the nearest clean 90° — smooth"
          onClick={squareUpStage}
        >
          ⊞ stage
        </span>
      </div>

      <div style={UI.head}>🧭 sat-nav</div>
      <div style={UI.row}>
        <span
          style={chipStyle(DEV.hudMode === "move")}
          title="drag empty canvas = move · scroll = zoom"
          onClick={() => {
            DEV.hudMode = "move";
          }}
        >
          🖐 move
        </span>
        <span
          style={chipStyle(DEV.hudMode === "rotate")}
          title="drag the ring band = roll · drag inside = yaw/pitch"
          onClick={() => {
            DEV.hudMode = "rotate";
          }}
        >
          🔄 rotate
        </span>
        <span
          style={chipStyle(DEV.hudMode === "off")}
          title="HUD off — clicks only retarget"
          onClick={() => {
            DEV.hudMode = "off";
          }}
        >
          ✋ off
        </span>
      </div>

      <div style={UI.head}>⚡ step size (G)</div>
      <div style={UI.row}>
        {GRAIN_LABELS.map((label, i) => (
          <span
            key={label}
            style={chipStyle(DEV.driveGrain === i, true)}
            title={
              i === 0
                ? "smallest arrow-key step — precision"
                : i === 1
                ? "medium arrow-key step"
                : "largest arrow-key step — fast travel"
            }
            onClick={() => {
              DEV.driveGrain = i;
              if (DEV.setLeva) DEV.setLeva({ drive: driveLabel() });
            }}
          >
            {label}
          </span>
        ))}
      </div>

      <div style={UI.head}>gizmo — precision (W/E/R/Q)</div>
      <div style={UI.row}>
        {[
          ["move", "translate"],
          ["rotate", "rotate"],
          ["scale", "scale"],
          ["off", "off"],
        ].map(([label, v]) => (
          <span
            key={v}
            style={chipStyle(DEV.gizmo === v)}
            onClick={() => setGizmoMode(v)}
          >
            {label}
          </span>
        ))}
      </div>

      <div style={UI.head}>🔗 compound motion</div>
      <div style={UI.row}>
        <span
          style={chipStyle(WIRE.enabled, true)}
          title="couple two parameters"
          onClick={() => {
            WIRE.enabled = !WIRE.enabled;
            if (WIRE.enabled) wireAnchors();
          }}
        >
          {WIRE.enabled ? "● wired" : "○ wire on"}
        </span>
        <span
          style={chipStyle(false)}
          title="restore both parameters to their anchors"
          onClick={wireResetRun}
        >
          ↺ reset run
        </span>
      </div>
      <div style={{ ...UI.row, marginTop: 3 }}>
        <select
          style={SEL_STYLE}
          value={WIRE.master}
          title="master — the parameter you drive"
          onChange={(ev) => {
            WIRE.master = ev.target.value;
            if (WIRE.enabled) wireAnchors();
          }}
        >
          {WIREABLE.map((k) => (
            <option key={k} value={k}>
              {HUMAN_LABELS[k] || k}
            </option>
          ))}
        </select>
        <span style={{ margin: "0 4px", color: "#5a6b60", fontSize: 10 }}>→</span>
        <select
          style={SEL_STYLE}
          value={WIRE.driven}
          title="driven — follows the master"
          onChange={(ev) => {
            WIRE.driven = ev.target.value;
            if (WIRE.enabled) wireAnchors();
          }}
        >
          {WIREABLE.map((k) => (
            <option key={k} value={k}>
              {HUMAN_LABELS[k] || k}
            </option>
          ))}
        </select>
      </div>
      <div style={{ ...UI.row, marginTop: 3, alignItems: "center" }}>
        <input
          type="range"
          min={-20}
          max={20}
          step={0.05}
          value={WIRE.ratio}
          style={{ width: 150, accentColor: "#2e7d52" }}
          title="ratio — driven units per master unit"
          onChange={(ev) => {
            WIRE.ratio = parseFloat(ev.target.value);
          }}
        />
        <span
          style={{
            marginLeft: 6,
            fontSize: 10,
            color: "#25332b",
            minWidth: 34,
          }}
        >
          ×{WIRE.ratio.toFixed(2)}
        </span>
      </div>

      <div style={UI.head}>
        💾 pose slots ({filledCount}/{SLOT_COUNT})
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(10, 20px)",
          gap: 3,
        }}
      >
        {slots.map((s, i) => (
          <div
            key={i}
            style={slotStyle(!!s)}
            title={
              s
                ? `slot ${i + 1} — click: warp · Ctrl/Cmd-click: add to path · right-click: clear`
                : `slot ${i + 1} — shift+click: save`
            }
            onClick={(ev) => slotClick(i, ev)}
            onContextMenu={(ev) => slotClear(i, ev)}
          >
            {i + 1}
          </div>
        ))}
      </div>

      <div style={UI.head}>
        🎬 motion path ({compiledPath.nodes.length}/{motionPath.nodes.length}) · {pathDuration.toFixed(2)}s
      </div>
      <div style={{ ...UI.row, minHeight: 24 }}>
        {motionPath.nodes.length === 0 && (
          <span style={UI.hint}>Ctrl/Cmd-click filled pose slots in travel order.</span>
        )}
        {motionPath.nodes.map((node, i) => {
          const valid = !!slots[node.slot];
          return (
            <span
              key={`${node.slot}-${i}`}
              style={{
                ...chipStyle(i === selectedPathNode),
                borderColor: valid ? undefined : "#bd3f3f",
                background: valid
                  ? chipStyle(i === selectedPathNode).background
                  : "#fff0f0",
                color: valid
                  ? chipStyle(i === selectedPathNode).color
                  : "#8b2020",
              }}
              title={valid ? `path node ${i + 1} = pose slot ${node.slot + 1}` : "source pose was cleared"}
              onClick={() => setSelectedPathNode(i)}
            >
              {i + 1}:S{node.slot + 1}
            </span>
          );
        })}
      </div>

      {selectedNode && (
        <div style={{ marginTop: 4, padding: 5, border: "1px solid #d5e2d9", borderRadius: 6 }}>
          <div style={{ ...UI.row, justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, color: "#25332b" }}>
              node {selectedPathNode + 1} · slot {selectedNode.slot + 1}
            </span>
            <span>
              <span style={chipStyle(false)} onClick={() => moveSelectedPathNode(-1)}>←</span>
              <span style={chipStyle(false)} onClick={() => moveSelectedPathNode(1)}>→</span>
              <span style={chipStyle(false)} onClick={removeSelectedPathNode}>×</span>
            </span>
          </div>

          {selectedPathNode > 0 && (
            <>
              <div style={{ ...UI.row, marginTop: 4, alignItems: "center" }}>
                <span style={{ width: 42, fontSize: 9, color: "#5a6b60" }}>travel</span>
                <input
                  type="range"
                  min={0.1}
                  max={5}
                  step={0.05}
                  value={selectedNode.duration}
                  style={{ width: 125, accentColor: "#2e7d52" }}
                  onChange={(ev) => updateSelectedPathNode({ duration: parseFloat(ev.target.value) })}
                />
                <span style={{ fontSize: 9, minWidth: 34 }}>{selectedNode.duration.toFixed(2)}s</span>
              </div>
              <div style={{ ...UI.row, marginTop: 3, alignItems: "center" }}>
                <span style={{ width: 42, fontSize: 9, color: "#5a6b60" }}>ease</span>
                <select
                  style={{ ...SEL_STYLE, maxWidth: 120 }}
                  value={selectedNode.ease}
                  onChange={(ev) => updateSelectedPathNode({ ease: ev.target.value })}
                >
                  {Object.entries(MOTION_EASE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div style={{ ...UI.row, marginTop: 3, alignItems: "center" }}>
            <span style={{ width: 42, fontSize: 9, color: "#5a6b60" }}>hold</span>
            <input
              type="range"
              min={0}
              max={3}
              step={0.05}
              value={selectedNode.hold}
              style={{ width: 125, accentColor: "#2e7d52" }}
              onChange={(ev) => updateSelectedPathNode({ hold: parseFloat(ev.target.value) })}
            />
            <span style={{ fontSize: 9, minWidth: 34 }}>{selectedNode.hold.toFixed(2)}s</span>
          </div>
        </div>
      )}

      <div style={{ ...UI.row, marginTop: 5, alignItems: "center" }}>
        <select
          style={SEL_STYLE}
          value={motionPath.trajectory}
          title="stage translation between poses"
          onChange={(ev) => commitMotionPath({ ...motionPath, trajectory: ev.target.value })}
        >
          <option value="curve">curved path</option>
          <option value="line">straight path</option>
        </select>
        <span
          style={chipStyle(motionPath.loop, true)}
          onClick={() => commitMotionPath({ ...motionPath, loop: !motionPath.loop })}
        >
          {motionPath.loop ? "loop on" : "loop off"}
        </span>
      </div>

      <div style={{ ...UI.row, marginTop: 3, alignItems: "center" }}>
        <span style={{ width: 36, fontSize: 9, color: "#5a6b60" }}>speed</span>
        <input
          type="range"
          min={0.25}
          max={2.5}
          step={0.05}
          value={motionPath.speed}
          style={{ width: 135, accentColor: "#2e7d52" }}
          onChange={(ev) => commitMotionPath({ ...motionPath, speed: parseFloat(ev.target.value) })}
        />
        <span style={{ fontSize: 9 }}>×{motionPath.speed.toFixed(2)}</span>
      </div>

      <input
        type="range"
        min={0}
        max={1}
        step={0.001}
        value={pathProgress}
        disabled={!pathReady}
        style={{ width: "100%", marginTop: 5, accentColor: "#2e7d52" }}
        title={`motion path progress ${pathProgress.toFixed(3)}`}
        onChange={(ev) => {
          pauseMotionPath(false);
          applyPathAt(parseFloat(ev.target.value));
        }}
        onPointerUp={() => {
          const pose = sampleMotionPath(compileMotionPath(motionPath, slots), pathProgressRef.current);
          syncPoseControls(pose);
        }}
      />

      <div style={UI.row}>
        <span
          style={chipStyle(pathPlaying, true)}
          onClick={() => (pathPlaying ? pauseMotionPath(true) : playMotionPath())}
        >
          {pathPlaying ? "❚❚ pause" : "▶ preview"}
        </span>
        <span
          style={chipStyle(false, true)}
          onClick={() => {
            pauseMotionPath(false);
            applyPathAt(0, true);
          }}
        >
          ↺ start
        </span>
        <span
          style={chipStyle(false)}
          onClick={() => {
            pauseMotionPath(false);
            commitMotionPath(defaultMotionPath());
            setSelectedPathNode(-1);
            pathProgressRef.current = 0;
            setPathProgress(0);
          }}
        >
          clear
        </span>
      </div>

      <div style={UI.row}>
        <span
          style={chipStyle(false, true)}
          title="copy a self-contained Vercel autoplay URL"
          onClick={() => copyMotionPreviewURL(motionPath, slots)}
        >
          🔗 preview URL
        </span>
        <span
          style={chipStyle(false, true)}
          title="copy a capture manifest that sweeps mp from 0 to 1"
          onClick={() => copyMotionManifest(motionPath, slots)}
        >
          🎞 path manifest
        </span>
      </div>

      <div style={UI.head}>🛠 actions</div>
      <div style={UI.row}>
        <span style={chipStyle(false)} onClick={() => takeSnapshot("origin")}>
          set origin
        </span>
        <span style={chipStyle(false)} onClick={() => warpToSnapshot("origin")}>
          ⏪ origin
        </span>
      </div>
      <div style={UI.row}>
        <span
          style={chipStyle(false, true)}
          onClick={() => {
            const url = buildTuningURL();
            window.history.replaceState(null, "", url);
            if (navigator.clipboard) navigator.clipboard.writeText(url);
          }}
        >
          📋 copy URL
        </span>
        <span style={chipStyle(false, true)} onClick={saveCard}>
          📸 save card
        </span>
        <span style={chipStyle(false, true)} onClick={copyManifest}>
          🎞 manifest
        </span>
      </div>

      <div style={UI.hint}>
        lighting folder (top right) = the look — match your Blender reference
        <br />
        the playhead NEVER moves unless you move it
        <br />
        move mode: drag canvas = slide · scroll = zoom
        <br />
        rotate mode: drag ring = roll · inside ring = yaw/pitch
        <br />
        gizmo (W/E/R/Q) overrides the sat-nav
        <br />
        arrows: tap = one exact step · hold = accelerating glide
        <br />
        path: Ctrl/Cmd-click filled slots in travel order
      </div>
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
    const down = (ev) => ev.key === "Shift" && setSnap(true);
    const up = (ev) => ev.key === "Shift" && setSnap(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

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
      {mode !== "off" && ready && (
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
//   ?glassreg=x,y,z            whole-glass-unit registration
//   ?light=amb,key,fill,env,exp   v3.8 lighting rig
//   ?bezel=env,rough,offset       v3.8.1 bezel dials
//   ?oled=-0.5,0                  OLED face-split cut, rim on/off
//   ?glass=rough,env,opac,cc,ccr  v3.9 front-glass material
//   ?envp=studio   ?envb=0        reflected world + IBL blur
//   ?crack=opac,exX,exY,exZ       cracked-pane strength + discard path
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
      GLASS_REG.x = parts[0];
      GLASS_REG.y = parts[1];
      GLASS_REG.z = parts[2];
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
    if (q.length === 4 && q.every((v) => !isNaN(v))) {
      CRACK.opacity = q[0];
      CRACK.exit = [q[1], q[2], q[3]];
    }
  }

  // ---- LIGHT channel (v3.8) — applies in production too ----
  const lightParam = params.get("light");
  if (lightParam) {
    const parts = lightParam.split(",").map((v) => parseFloat(v));
    if (parts.length === 5 && parts.every((v) => !isNaN(v))) {
      LIGHT.amb = parts[0];
      LIGHT.key = parts[1];
      LIGHT.fill = parts[2];
      LIGHT.env = parts[3];
      LIGHT.exp = parts[4];
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

  return { mode, bg, freezeP, dev, motionPath, motionFreezeP };
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

  // The cracked pane is discarded across the HOLD — the beat where the
  // phone is already open. 0 = still cracked, 1 = clean pane only.
  const swap =
    p <= explodeEnd
      ? 0
      : p >= holdEnd
      ? 1
      : smoothstep((p - explodeEnd) / (holdEnd - explodeEnd));

  return { explode, rotate, swap };
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
  modelPath: "/14 pro.glb",
  screenTexture: screenImg,
  internalsTexture: internalsImg,
  // OPTIONAL. White/grey crack lines on a TRANSPARENT background, same
  // aspect as the screen. Absent -> the crack layer never mounts.
  crackTexture: null,
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
  swap: 0,
};

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
  const crackGroupRef = useRef();
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
  // Render order: Body 0 → coats 1 → OLED 1 → Glass Front 3 → Bezel 4
  // ---------------------------------------------------------
  const { glassMeshes, oledMeshes, bodyMeshes, crackGeo } = useMemo(() => {
    const glass = [];
    const oled = [];
    const body = [];
    let crack = null;
    DEV.bezelMeshes = [];

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
        glass.push(child);
        return;
      }

      // ---- 2. GLASS FRONT ----
      // The Dynamic Island cutout is authored into this geometry. Nothing
      // here fills it, in any version — it stays a true hole.
      if (
        name.includes("glass_front") ||
        name.includes("glass front") ||
        (name.includes("glass") && !name.includes("bezel"))
      ) {
        // MeshPHYSICAL, not Standard. The clearcoat is the whole point: a
        // second specular layer with its own roughness. Constructed with a
        // non-zero clearcoat so the shader compiles the chunk in — dialling
        // it to 0 later is then a uniform write, not a recompile.
        const glassMat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(0x000000),
          roughness: GLASS.rough,
          metalness: 0.0,
          transparent: true,
          opacity: GLASS.opacity, // OLED glow must survive the glass
          depthWrite: false,
          envMapIntensity: GLASS.env,
          clearcoat: GLASS.clearcoat,
          clearcoatRoughness: GLASS.ccRough,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        });
        child.material = glassMat;
        DEV.glassMat = glassMat;
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
          const uv = new Float32Array(cpos.count * 2);
          for (let i = 0; i < cpos.count; i++) {
            uv[i * 2] = 1.0 - (cpos.getX(i) - minX) / rx;
            uv[i * 2 + 1] = 1.0 - (cpos.getY(i) - minY) / ry;
          }
          cg.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
        }
        crack = cg;
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

        child.material = [
          new THREE.MeshBasicMaterial({
            map: oledTexture,
            toneMapped: false,
          }),
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
    const allMeshes = [...glass, ...oled, ...body];
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

    return {
      glassMeshes: glass,
      oledMeshes: oled,
      bodyMeshes: body,
      crackGeo: crack,
    };
  }, [clonedScene, oledTexture, maxAniso]);

  // ---------------------------------------------------------
  // CRACKED-PANE MATERIAL (v3.9)
  //
  // The PNG is white/grey crack lines on TRANSPARENT. transparent:true
  // means the PNG's own alpha carves the shape, so the pane is invisible
  // everywhere except along the fractures — which sit ON TOP of the clean
  // glass beneath. depthWrite off so it cannot fight the pane it lies on;
  // polygonOffset -3 so it wins over the glass's -2 where they are exactly
  // coplanar (they are — it is the same geometry).
  // ---------------------------------------------------------
  const crackMat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      map: crackTex,
      transparent: true,
      opacity: CRACK.opacity,
      roughness: 0.06,
      metalness: 0.0,
      depthWrite: false,
      envMapIntensity: GLASS.env,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    DEV.crackMat = m;
    return m;
  }, [crackTex]);

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
    const damp = CAPTURE_SNAP || DEV.pathPreview ? 1 : 0.1;

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

    if (glassGroupRef.current) {
      // GLASS_REG rides the glass unit — Front Window + Bezel only.
      const target = -(scrollState.glassOffset * explodeDistance * 2.0);
      glassGroupRef.current.position.z = THREE.MathUtils.lerp(
        glassGroupRef.current.position.z,
        target + GLASS_REG.z,
        damp
      );
      glassGroupRef.current.position.x = GLASS_REG.x;
      glassGroupRef.current.position.y = GLASS_REG.y;
    }

    // ---- CRACKED PANE ----
    // Rides the glass's GLASS_REG and explode by default (explodeMul 2.0 ==
    // the glass group's), so it looks welded to the pane. CRACK.exit then
    // adds its OWN departure, scaled by swap, so the broken glass can be
    // thrown clear while the clean pane stays on its path.
    if (crackGroupRef.current && hasCrack) {
      const sw = scrollState.swap;
      const g = crackGroupRef.current;
      const target = -(
        scrollState.glassOffset *
        explodeDistance *
        CRACK.explodeMul
      );
      g.position.z = THREE.MathUtils.lerp(
        g.position.z,
        target + GLASS_REG.z + CRACK.exit[2] * sw,
        damp
      );
      g.position.x = GLASS_REG.x + CRACK.exit[0] * sw;
      g.position.y = GLASS_REG.y + CRACK.exit[1] * sw;

      if (DEV.crackMat) {
        DEV.crackMat.opacity = CRACK.opacity * (1 - sw);
        DEV.crackMat.visible = sw < 0.999; // stop drawing it once it is gone
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
          {/* GLASS UNIT — Front Window + Bezel. */}
          <group ref={glassGroupRef}>
            {glassMeshes.map((m, i) => (
              <primitive key={`glass-${i}`} object={m} />
            ))}
          </group>

          {/* CRACKED PANE — sibling of the glass, its own transform, so it
              can be thrown clear independently. Never mounts without a
              crackTexture prop. */}
          {hasCrack && crackGeo && (
            <group ref={crackGroupRef}>
              <mesh
                geometry={crackGeo}
                material={crackMat}
                renderOrder={4}
              />
            </group>
          )}

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
function Scene({
  modelPath,
  screenTexture,
  internalsTexture,
  crackTexture,
  explodeDistance,
  dev,
}) {
  const [envPreset, setEnvPreset] = useState(LIGHT.preset);
  const [envBlur, setEnvBlur] = useState(LIGHT.blur);

  // preset and blur are React PROPS on <Environment>, not uniforms — they
  // need a re-render, so Leva writes through this setter rather than
  // mutating LIGHT and waiting for a frame that will never notice.
  useEffect(() => {
    DEV.setEnv = (pr, b) => {
      setEnvPreset(pr);
      setEnvBlur(b);
    };
    return () => {
      DEV.setEnv = null;
    };
  }, []);

  const ambRef = useRef();
  const keyRef = useRef();
  const fillRef = useRef();

  useFrame(() => {
    // Lights read LIGHT live — no dirty flag needed, these are 3 float
    // writes per frame and it keeps the Leva drag perfectly smooth.
    if (ambRef.current) ambRef.current.intensity = LIGHT.amb;
    if (keyRef.current) keyRef.current.intensity = LIGHT.key;
    if (fillRef.current) fillRef.current.intensity = LIGHT.fill;
  });

  return (
    <>
      <ambientLight ref={ambRef} intensity={LIGHT.amb} />
      <directionalLight
        ref={keyRef}
        position={[5, 10, 5]}
        intensity={LIGHT.key}
        castShadow
      />
      <directionalLight
        ref={fillRef}
        position={[-6, 3, 4]}
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
      <Environment preset={envPreset} blur={envBlur} />

      <IPhoneExploded
        modelPath={modelPath}
        screenTexture={screenTexture}
        internalsTexture={internalsTexture}
        crackTexture={crackTexture}
        explodeDistance={explodeDistance}
      />

      {dev && <DevGizmo />}
    </>
  );
}

// ============================================
// Main Component
// ============================================
export default function CrossSection3DScrollGLB(props) {
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
  } = useMemo(resolveRuntimeConfig, []);

  const containerRef = useRef(null);
  const stickyRef = useRef(null);

  useEffect(() => {
    const applyProgress = (p) => {
      const { explode, rotate, swap } = phaseMap(p);
      scrollState.explosion = explode;
      scrollState.rotate = rotate;
      scrollState.swap = swap;
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
      if (runtimeMotionPath) {
        const pose = sampleMotionPath(runtimeMotionPath, progress);
        if (pose) applyPoseParamsDirect(pose);
      } else {
        applyProgress(progress);
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
      if (window.parent) {
        window.parent.postMessage({ type: "iglass-3d-ready" }, "*");
      }
      return () => window.removeEventListener("message", onMessage);
    }

    if (mode === "autoplay") {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";

      const proxy = { p: 0 };
      const runtimeDuration = runtimeMotionPath
        ? Math.max(
            0.1,
            motionPathDuration(runtimeMotionPath) /
              Math.max(0.1, Number(runtimeMotionPath.speed) || 1)
          )
        : 7;
      const tween = gsap.to(proxy, {
        p: 1,
        duration: runtimeDuration,
        ease: runtimeMotionPath ? "none" : "power2.inOut",
        delay: 1,
        repeat: runtimeMotionPath
          ? runtimeMotionPath.loop === false
            ? 0
            : -1
          : -1,
        yoyo: runtimeMotionPath ? false : true,
        repeatDelay: runtimeMotionPath ? 0 : 1.2,
        onUpdate: () => applyRuntimeProgress(proxy.p),
      });
      return () => tween.kill();
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
          height: "100vh",
          width: "100vw",
          overflow: "hidden",
        }}
        onPointerDown={dev ? onWrapPointerDown : undefined}
        onWheel={dev ? onWrapWheel : undefined}
      >
        <Canvas
          camera={{ position: [0, 0, 2.8], fov: 35, near: 0.01 }}
          shadows
          dpr={[1, 2]}
          gl={{
            antialias: true,
            powerPreference: "high-performance",
            alpha: true,
            preserveDrawingBuffer: dev,
          }}
          onCreated={({ gl, scene }) => {
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
          style={{ width: "100%", height: "100%" }}
        >
          <Scene
            modelPath={modelPath}
            screenTexture={screenTexture}
            internalsTexture={internalsTexture}
            crackTexture={crackTexture}
            explodeDistance={explodeDistance}
            dev={dev}
          />
        </Canvas>
      </div>
    </div>
  );
}

useGLTF.preload(defaultProps.modelPath);
useTexture.preload(defaultProps.screenTexture);
useTexture.preload(defaultProps.internalsTexture);
