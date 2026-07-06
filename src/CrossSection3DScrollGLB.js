import screenImg from "./Screen.png";
import internalsImg from "./internals.jpg";
import { useRef, useMemo, useEffect, useLayoutEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  ContactShadows,
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
// v3.1 — ANCHORED GIZMO + VISUAL DASHBOARD
// (production maths untouched — dev rig only)
//
//   PROXY GIZMO      TransformControls no longer attaches to the phone.
//                    It attaches to an invisible PROXY object that
//                    follows the target but is CLAMPED to the visible
//                    frame every frame. Drag deltas are relayed to the
//                    real target (world → stage-local conversion for
//                    settle). The gizmo therefore CANNOT leave the
//                    screen. The v3.0 frustumCulled fix only covered
//                    origins barely out of frame — an origin far
//                    off-screen is geometrically unreachable by any
//                    handle size; the anchor itself had to move.
//                    Capture on release is unchanged: it reads the real
//                    target, exactly as before.
//   FAT HANDLES      size 1.35 (was 0.8), arrow shafts/heads 2.2×
//                    radial, and the INVISIBLE picker meshes (the
//                    actual hit zones) fattened 1.6–2.4×. The
//                    thin-line grab problem was mostly pickers, not
//                    visuals.
//   CLICK-TO-TARGET  click the phone → settle target + LOCAL space;
//                    click empty background → stage target + WORLD
//                    space (predictive space binding). The Leva
//                    gizmo/target/space dropdowns are gone. T still
//                    toggles targets; W/E/R/Q still set gizmo mode.
//                    Click-distance + drag-timestamp guards stop drags
//                    from retargeting mid-gesture.
//   EULER SANITISE   capture + screen-rotate writes wrap to
//                    (-180, 180] at 0.01° precision before touching
//                    the sliders — kills the release snatch (Leva
//                    clamp → onChange → dirty-apply feedback loop).
//   DASHBOARD        custom light-theme overlay (left side):
//                    · target / mode / space chips
//                    · PRIMITIVES — clean baseline positions (L/C/R,
//                      T/M/B, near/mid/far) and rotations
//                      (−90/−45/0/45/90/180 per axis), target-aware
//                    · 60 PERSISTENT SLOTS (localStorage — click =
//                      warp, Shift+click = save, right-click = clear;
//                      green when occupied; survives tab close/reboot)
//                    · origin / spirit-level / copy-URL / save-card /
//                      manifest actions
//                    Leva stays MOUNTED but boots COLLAPSED — its
//                    onChange handlers are the single write path (URL
//                    serialisation, wiring, snapshots, arrow drive and
//                    gizmo capture all route through them). The
//                    numbers are hidden, not removed.
//
// v3.0 recap: world/local space toggle, driven-key wiring, origin +
// A/B/C snapshots (A/B/C superseded by the 60-slot grid), spirit level,
// panel regroup. v2.9 recap: screen-space arrow drive (SCREEN_ROT_SIGNS
// is the only sign surface). v2.8 recap: ?snap=1 deterministic capture.
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

// Radians → degrees wrapped to (-180, 180], 0.01° precision.
// EVERY rotation value that goes back into a Leva slider passes through
// this. An extracted euler that lands outside the slider range gets
// CLAMPED by Leva, the clamp fires onChange, onChange marks the rig
// dirty, and the next frame warps the phone to the corrupted value —
// that was the release "snatch". Wrapped values can never clamp.
function wrapDeg(rad) {
  let d = (rad * 180) / Math.PI;
  d = ((((d + 180) % 360) + 360) % 360) - 180;
  if (d === -180) d = 180;
  return Number(d.toFixed(2));
}

// ============================================
// Timeline phases (fractions of total scroll progress)
//
//   0.00 – 0.35  EXPLODE      staggered glass → OLED separation
//   0.35 – 0.45  HOLD         fully exploded beat (headline lands here)
//   0.45 – 0.70  REASSEMBLE   mirror of explode
//   0.70 – 1.00  SETTLE       rotation to upright face-on,
//                             desktop drifts right to the rest slot
// ============================================
const TIMELINE = {
  explodeEnd: 0.35,
  holdEnd: 0.45,
  reassembleEnd: 0.7,
};

const START = {
  // Rest-pose tilt toward the viewer, radians. Overridable: ?tilt=deg
  tilt: Math.PI / 10, // 18°
};

const SETTLE = {
  // Final pose. [0, PI, 0] = upright portrait, front face to camera.
  // Overridable: ?settle=x,y,z (degrees)
  targetEuler: [0, Math.PI, 0],
  scale: 0.8, // upright phone scales down to stay inside the frame
  xShiftFraction: 0.22, // desktop rest slot: fraction of viewport width
  yShiftFraction: 0,
  arcLift: 0.08, // fraction of viewport height — subtle swoop on the path
  desktopMinWidth: 810, // px — below this, no drift (mobile stays centred)
};

// STAGE — constant world transform on the OUTERMOST group. Identity by
// default. NOT gated by the timeline: applies at every p, so the exploded
// phone can be posed anywhere in frame. useFrame never writes this group —
// the gizmo (target: stage), the Leva stage folder, and the arrow drive
// are its only writers. Overridable: ?spos=x,y,z ?srot=x,y,z (deg) ?sscale=s
const STAGE = {
  position: [0, 0, 0],
  rotationEuler: [0, 0, 0], // radians, XYZ order
  scale: 1,
};

const MODEL = {
  targetSize: 1.6, // world units — largest model dimension after fit
};

// ============================================
// DEV RIG — additive instrumentation only.
// Writes to the SAME config objects the animation already reads.
// Active only with ?dev=1.
// ============================================
const DEV = {
  enabled: false,
  dirtyQuat: false, // tilt / settle changed → recompute qStart/qEnd
  dirtyFit: false, // size changed → re-derive pivot scale/offset
  dirtyStage: true, // STAGE changed → re-apply to stage group (true at
  //                   boot so URL-parsed stage values apply on frame 1 —
  //                   this one runs in production too)
  applyProgress: null, // registered by the driver effect
  lastP: 0,
  gizmo: "off", // "off" | "translate" | "rotate" | "scale"
  gizmoTarget: "settle", // "settle" (p=1 endpoint, back-solved) | "stage"
  gizmoSpace: "local", // "world" | "local" — auto-bound by target (v3.1)
  gizmoDragging: false, // true while dragging — settle-target drags
  //                       suppress whole-model useFrame writes
  lastDragEnd: 0, // performance.now() at drag release — guards
  //                pointerMissed against retargeting after a drag
  modelGroup: null, // live Object3D — settle gizmo target
  stageGroup: null, // live Object3D — stage gizmo target
  canvasEl: null, // WebGL canvas element — save-card frame source
  setLeva: null, // Leva set() — bi-directional slider sync
  driveMode: 0, // 0 MOVE · 1 ROTATE · 2 ROLL·ZOOM (Tab cycles)
  driveGrain: 0, // 0 fine · 1 mid · 2 coarse (G cycles)
  viewport: null, // { width, height } world units — stashed by DevGizmo,
  //                 used by the screen-space MOVE compensation
};

// ---------------------------------------------------------
// KEYBOARD DRIVE — arrow-key nudging.
// Tab cycles mode, G cycles granularity, T toggles the target.
// Nudges route through Leva set() → the same onChange writers the
// sliders use, so config objects, dirty flags, and the panel stay in
// sync with zero new write paths.
// ---------------------------------------------------------
const MODE_LABELS = ["MOVE", "ROTATE", "ROLL·ZOOM"];
const GRAIN_LABELS = ["fine", "mid", "coarse"];

const GRAIN_STEPS = {
  frac: [0.002, 0.01, 0.05], // shift / vshift (viewport fractions)
  deg: [0.5, 2, 10], // all rotation params (degrees)
  unit: [0.005, 0.02, 0.1], // stage position (world units)
  size: [0.01, 0.05, 0.25], // size / sscale
  p: [0.002, 0.01, 0.05], // timeline progress
};

// Screen-rotation direction conventions. Flip a SINGLE value here if any
// direction feels backwards — this is the only sign surface in v2.9.
//   yaw   +1 → ArrowRight turns the front face to the viewer's right
//   pitch -1 → ArrowUp tips the front face upward
//   roll  -1 → ArrowRight rolls clockwise on screen
const SCREEN_ROT_SIGNS = { yaw: 1, pitch: -1, roll: -1 };

// Plain-channel map — consulted ONLY for the paths that are already
// screen-pure: stage MOVE (world position = screen axes) and the two
// zooms. ROTATE / ROLL and settle MOVE route through the screen-space
// helpers below instead. x = ←/→, y = ↑/↓
const DRIVE_MAP = {
  settle: [
    { x: null, y: null },                                 // MOVE      — screen-space path
    { x: null, y: null },                                 // ROTATE    — screen-space path
    { x: null, y: ["size", "size", -1] },                 // ROLL·ZOOM — roll screen-space; ↑ zooms in
  ],
  stage: [
    { x: ["sposX", "unit", 1], y: ["sposY", "unit", 1] }, // MOVE      — world = screen-pure
    { x: null, y: null },                                 // ROTATE    — screen-space path
    { x: null, y: ["sscale", "size", 1] },                // ROLL·ZOOM — roll screen-space
  ],
};

// Current values read from the config objects (single source of truth).
// Snapshots, slots, and wiring read every pose param here.
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

// Match the slider ranges — Leva clamps anyway; this keeps maths honest
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

// ---------------------------------------------------------
// GIZMO CONTEXT (v3.1) — click-to-target + predictive space binding.
// One function owns the 2×2 matrix:
//   stage  → world space (framing tracks the screen edges)
//   settle → local space (component work tracks the phone's own axes)
// Called by: clicking the phone (→settle), clicking the background
// (→stage), the T key, and the dashboard chips.
// ---------------------------------------------------------
function changeGizmoContext(targetMode) {
  if (DEV.gizmoDragging) return; // never retarget mid-drag
  DEV.gizmoTarget = targetMode;
  DEV.gizmoSpace = targetMode === "stage" ? "world" : "local";
  if (targetMode === "settle" && DEV.gizmo !== "off" && DEV.lastP !== 1) {
    jumpToP(1); // settle params are defined at the endpoint only
  }
  if (DEV.setLeva) DEV.setLeva({ drive: driveLabel() });
}

function setGizmoMode(v) {
  // v: "off" | "translate" | "rotate" | "scale"
  DEV.gizmo = v;
  if (v !== "off" && DEV.gizmoTarget === "settle" && DEV.lastP !== 1) {
    jumpToP(1);
  }
}

// ---------------------------------------------------------
// PARAMETER WIRING — driven-key coupling.
// One master, one driven, linear ratio, anchored at enable time:
//   driven = drivenAnchor + (master − masterAnchor) × ratio
// Fires on every Leva onChange of the master: slider drags, arrow-key
// nudges, and gizmo-release captures all route through it. During a
// gizmo drag nothing fires (capture is mouseUp-only) — the coupling
// applies once on release. Ratio is a raw-unit multiplier (degrees,
// world units, and viewport fractions mix freely — e.g. sposZ→srotX
// ratio 20 means 20° per world unit). Changing ratio mid-run re-slopes
// the path from the ORIGINAL anchors on the next master change; the
// intended loop is: run → reset run → adjust ratio → run again.
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
  suspended: false, // reentrancy guard (warp + programmatic driven writes)
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
  // "Back to where I started": restores BOTH ends of the wire to their
  // anchors. Adjust ratio, then run the master again — clean re-test.
  if (!DEV.setLeva) return;
  WIRE.suspended = true;
  DEV.setLeva({
    [WIRE.master]: Number(WIRE.masterAnchor.toFixed(4)),
    [WIRE.driven]: Number(WIRE.drivenAnchor.toFixed(4)),
  });
  WIRE.suspended = false;
}

// ---------------------------------------------------------
// SNAPSHOT / SLOT ENGINE — a snapshot is a complete pose-parameter
// record (all readers + p). Warps route through DEV.setLeva → the
// sliders' own onChange writers — no new write path.
// v3.1: the A/B/C bookmark slots are superseded by the 60-slot
// persistent grid on the dashboard (localStorage). The explicit start
// origin remains — auto-captured at boot from the URL-loaded pose.
// ---------------------------------------------------------
const SNAPSHOTS = { origin: null };

const SLOT_KEY = "iglass_pose_slots_v1";
const SLOT_COUNT = 60;

function loadSlots() {
  try {
    const raw = window.localStorage.getItem(SLOT_KEY);
    const arr = raw ? JSON.parse(raw) : null;
    if (Array.isArray(arr) && arr.length === SLOT_COUNT) return arr;
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

// Spirit level — snaps each euler channel to the nearest 90°.
// Channel-wise rounding is not a true nearest-orientation snap for
// arbitrary coupled euler triples, but at tuning poses it behaves as
// the level.
function snapLevel(which) {
  if (!DEV.setLeva) return;
  const n90 = (deg) => Math.round(deg / 90) * 90;
  if (which === "stage") {
    DEV.setLeva({
      srotX: n90(DRIVE_READERS.srotX()),
      srotY: n90(DRIVE_READERS.srotY()),
      srotZ: n90(DRIVE_READERS.srotZ()),
    });
  } else {
    if (DEV.lastP !== 1) jumpToP(1); // settle params inert below endpoint
    DEV.setLeva({
      settleX: n90(DRIVE_READERS.settleX()),
      settleY: n90(DRIVE_READERS.settleY()),
      settleZ: n90(DRIVE_READERS.settleZ()),
    });
  }
}

function driveLabel() {
  return `${MODE_LABELS[DEV.driveMode]} · ${GRAIN_LABELS[DEV.driveGrain]} (${DEV.gizmoTarget})`;
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

// ---------------------------------------------------------
// MOVE (settle) — screen-space slide.
// shift/vshift live in STAGE-LOCAL space; a rotated stage turns a plain
// channel nudge into a diagonal. Compensation: express the step as a
// world (screen) delta, rotate it through the INVERSE stage frame,
// divide by stage scale, land it back in viewport fractions.
// local.z is dropped — the channels can't express stage-local depth
// (at extreme stage rotations the slide weakens accordingly).
// ---------------------------------------------------------
function nudgeSettleMoveScreen(set, axis, dir) {
  const step = GRAIN_STEPS.frac[DEV.driveGrain] * dir;
  const aspect = DEV.viewport
    ? DEV.viewport.width / DEV.viewport.height
    : window.innerWidth / window.innerHeight;

  // World delta in vh units (x steps are vw fractions → ×aspect)
  const world =
    axis === "x"
      ? new THREE.Vector3(step * aspect, 0, 0)
      : new THREE.Vector3(0, step, 0);

  const local = world
    .applyQuaternion(stageQuat().invert())
    .divideScalar(STAGE.scale || 1);

  const dShift = local.x / aspect; // vh units → vw fraction
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

// ---------------------------------------------------------
// ROTATE / ROLL — screen-space rotation.
// World-axis quaternion PREMULTIPLIED onto the pose, then extracted back
// to euler channels through the sliders (the gizmo's capture pattern).
// Settle pose lives INSIDE the stage frame: world rotation W maps to the
// stage-local rotation Rs⁻¹·W·Rs before premultiplying.
// ---------------------------------------------------------
function nudgeRotateScreen(set, axis, dir, isRoll) {
  const stepRad = (GRAIN_STEPS.deg[DEV.driveGrain] * Math.PI) / 180;
  let axisVec, sign;
  if (isRoll) {
    axisVec = new THREE.Vector3(0, 0, 1);
    sign = SCREEN_ROT_SIGNS.roll;
  } else if (axis === "x") {
    axisVec = new THREE.Vector3(0, 1, 0); // ←/→ = yaw about screen-vertical
    sign = SCREEN_ROT_SIGNS.yaw;
  } else {
    axisVec = new THREE.Vector3(1, 0, 0); // ↑/↓ = pitch about screen-horizontal
    sign = SCREEN_ROT_SIGNS.pitch;
  }
  const W = new THREE.Quaternion().setFromAxisAngle(
    axisVec,
    stepRad * dir * sign
  );

  if (DEV.gizmoTarget === "stage") {
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

function driveNudge(set, axis, dir) {
  // Settle params are inert below the endpoint — snap there first
  // (same rule as the gizmo)
  if (DEV.gizmoTarget === "settle" && DEV.lastP !== 1) jumpToP(1);
  const mode = DEV.driveMode;

  // Screen-space paths (v2.9)
  if (mode === 0 && DEV.gizmoTarget === "settle")
    return nudgeSettleMoveScreen(set, axis, dir);
  if (mode === 1) return nudgeRotateScreen(set, axis, dir, false);
  if (mode === 2 && axis === "x") return nudgeRotateScreen(set, axis, dir, true);

  // Plain channels: stage MOVE + the two zooms
  const [param, cls, sign] = DRIVE_MAP[DEV.gizmoTarget][mode][axis];
  const step = GRAIN_STEPS[cls][DEV.driveGrain] * dir * sign;
  const [lo, hi] = DRIVE_CLAMPS[param];
  const next = Math.min(hi, Math.max(lo, DRIVE_READERS[param]() + step));
  set({ [param]: Number(next.toFixed(4)) });
}

// ---------------------------------------------------------
// URL / manifest serialisation — single source of truth for the
// parameter → querystring mapping (copy URL, save card, manifest).
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
}

function buildTuningURL() {
  const params = new URLSearchParams(window.location.search);
  serialiseParams(params);
  params.set("dev", "1");
  params.set("p", DEV.lastP.toFixed(3));
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

// Capture base URL: constants only — no dev (no panel/gizmo in frames),
// no p (the Playwright script appends &p=<value> per frame).
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
    sweepParam: "p", // script visits `${baseURL}&p=${value}` per frame
    startValue: 0.0, // edit to target a sub-range (e.g. explode = 0→0.35)
    endValue: 1.0,
    totalFrames: 90, // 60–120 = mobile image-sequence budget
    viewport: { width: 1600, height: 900, deviceScaleFactor: 2 },
    captureSelector: "canvas", // screenshot the WebGL canvas only
  };
  const json = JSON.stringify(manifest, null, 2);
  if (navigator.clipboard) navigator.clipboard.writeText(json);
}

// ---------------------------------------------------------
// SAVE CARD — rendered frame + decoded parameter table + URL in one
// downloaded PNG. The decoded table is the authoritative machine-read
// channel when a card is pasted back to an AI. Requires
// preserveDrawingBuffer (enabled in dev mode only).
// ---------------------------------------------------------
function saveCard() {
  const src = DEV.canvasEl;
  if (!src) return;

  const fw = src.width;
  const fh = src.height;
  const k = Math.max(1, fw / 1200); // text scale relative to frame width

  const deg = (r) => Math.round((r * 180) / Math.PI);
  const lines = [
    `p ${DEV.lastP.toFixed(3)}    tilt ${((START.tilt * 180) / Math.PI).toFixed(1)}    size ${MODEL.targetSize.toFixed(2)}`,
    `settle ${SETTLE.targetEuler.map(deg).join(", ")}    pscale ${SETTLE.scale.toFixed(2)}`,
    `shift ${SETTLE.xShiftFraction.toFixed(3)}    vshift ${SETTLE.yShiftFraction.toFixed(3)}    lift ${SETTLE.arcLift.toFixed(3)}`,
    `stage pos ${STAGE.position.map((v) => v.toFixed(2)).join(", ")}    rot ${STAGE.rotationEuler.map(deg).join(", ")}    scl ${STAGE.scale.toFixed(2)}`,
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

  // Measuring pass: wrap the URL to the card width (font metrics are
  // valid before the resize; resizing resets ctx state — refont below)
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

  // Light card — white behind the transparent WebGL clear
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
// BACK-SOLVE (settle target): gizmo pose → SETTLE parameters.
// Valid at p=1 (t=1) only, where the production maths reduces to:
//   position.x = viewport.width  * xShiftFraction
//   position.y = viewport.height * yShiftFraction   (lift term is 0: sin(π)=0)
//   scale      = SETTLE.scale
//   quaternion = qEnd  →  Euler(XYZ) = targetEuler
// z is zeroed and scale forced uniform — production settle has no z term
// and only uniform scale, so the gizmo can't record an unreproducible pose.
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

  // Sync the Leva sliders (their onChange re-writes the same values —
  // idempotent). Angles wrapped to (-180,180] at 0.01° — outside-range
  // values would be CLAMPED by Leva and the clamp's onChange would warp
  // the phone (the release snatch). Note: euler extraction may express
  // the same rotation with different channel numbers than you typed
  // (e.g. [180,0,180] ≡ [0,180,0]); the quaternion — and therefore the
  // motion — is identical.
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

// ---------------------------------------------------------
// CAPTURE (stage target): direct read — no back-solve, no t maths.
// The stage transform IS the parameter. Works at any p.
// ---------------------------------------------------------
function captureStageFromObject() {
  const obj = DEV.stageGroup;
  if (!obj) return;

  obj.scale.setScalar(obj.scale.x); // uniform only (URL carries one value)

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
  if (DEV.setLeva) DEV.setLeva({ p: v });
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
          min: -5,
          max: 5,
          step: 0.01,
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
          },
        },
      },
      { collapsed: false }
    ),
    "📐 settle endpoint (p=1)": folder(
      {
        tilt: {
          value: (START.tilt * 180) / Math.PI,
          min: -45,
          max: 45,
          step: 0.5,
          label: "rest tilt °",
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
          label: "euler X °",
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
          label: "euler Y °",
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
          label: "euler Z °",
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
          label: "rest slot X (vw)",
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
          label: "rest slot Y (vh)",
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
          label: "arc lift (vh)",
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
          label: "settle scale",
          onChange: (v) => {
            SETTLE.scale = v;
            wireTap("pscale", v);
          },
        },
      },
      { collapsed: false }
    ),
    "🎬 stage (world frame)": folder(
      {
        sposX: {
          value: STAGE.position[0],
          min: -3,
          max: 3,
          step: 0.01,
          label: "pos X (wu)",
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
          label: "pos Y (wu)",
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
          label: "pos Z / depth (wu)",
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
          label: "euler X °",
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
          label: "euler Y °",
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
          label: "euler Z °",
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
          label: "scale",
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
          label: "fit size (wu)",
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

  // Expose set() so gizmo captures, phase jumps, warps, wiring, slots,
  // primitives, and the arrow drive can push values back into the
  // sliders. The URL-loaded pose becomes the initial start origin.
  useEffect(() => {
    DEV.setLeva = set;
    if (!SNAPSHOTS.origin) takeSnapshot("origin");
    return () => {
      DEV.setLeva = null;
    };
  }, [set]);

  // Keyboard surface:
  //   W/E/R  gizmo translate/rotate/scale     Q  gizmo off
  //   T      target toggle (settle | stage) — space auto-binds
  //   Tab    arrow mode cycle                 G  granularity cycle
  //   Arrows nudge (hold = glide)             [ ] timeline p nudge
  useEffect(() => {
    const onKey = (ev) => {
      const tag = ev.target && ev.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return; // don't hijack Leva typing

      // ---- arrow drive ----
      if (ev.key === "Tab") {
        ev.preventDefault(); // keep focus out of the browser tab cycle
        DEV.driveMode = (DEV.driveMode + 1) % 3;
        set({ drive: driveLabel() });
        return;
      }
      if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
        ev.preventDefault(); // stop page scroll
        driveNudge(set, "x", ev.key === "ArrowRight" ? 1 : -1);
        return;
      }
      if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
        ev.preventDefault();
        driveNudge(set, "y", ev.key === "ArrowUp" ? 1 : -1);
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

      // ---- gizmo / target ----
      if (k === "t") {
        changeGizmoContext(DEV.gizmoTarget === "settle" ? "stage" : "settle");
        return;
      }
      const map = { w: "translate", e: "rotate", r: "scale", q: "off" };
      if (map[k]) setGizmoMode(map[k]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [set]);

  return null;
}

// ---------------------------------------------------------
// DEV DASHBOARD (v3.1) — custom overlay, left side. The primary visual
// surface: target/mode chips, transformation primitives, 60 persistent
// pose slots (localStorage), and the global actions. All writes route
// through DEV.setLeva → the sliders' own onChange writers, so the URL /
// manifest / wiring machinery is untouched.
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
  axisLabel: {
    width: 26,
    fontSize: 9,
    color: "#5a6b60",
    display: "inline-block",
  },
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

const PRIM_ROT_VALUES = [-90, -45, 0, 45, 90, 180];

function DevDashboard() {
  // Poll the plain-mutable DEV state — dashboard is dev-only, a 150ms
  // tick is invisible and avoids threading React state through the rig.
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 150);
    return () => clearInterval(id);
  }, []);

  const [slots, setSlots] = useState(loadSlots);

  const isStage = DEV.gizmoTarget === "stage";

  // Primitives write through the same Leva pipeline as everything else.
  const prim = (vals) => {
    if (!isStage && DEV.lastP !== 1) jumpToP(1); // settle params inert below p=1
    if (!DEV.setLeva) return;
    WIRE.suspended = true;
    DEV.setLeva(vals);
    WIRE.suspended = false;
  };

  const rotParam = (axis) => (isStage ? `srot${axis}` : `settle${axis}`);

  const slotClick = (i, ev) => {
    if (ev.shiftKey) {
      const next = [...slots];
      next[i] = readPoseParams();
      setSlots(next);
      persistSlots(next);
    } else if (slots[i]) {
      warpToParams(slots[i]);
    }
  };

  const slotClear = (i, ev) => {
    ev.preventDefault();
    if (!slots[i]) return;
    const next = [...slots];
    next[i] = null;
    setSlots(next);
    persistSlots(next);
  };

  // Position primitives — target-aware. Stage moves in world units;
  // settle moves in viewport fractions (+ settle scale as the zoom).
  const posPrims = isStage
    ? {
        x: [
          ["L", { sposX: -1.2 }],
          ["C", { sposX: 0 }],
          ["R", { sposX: 1.2 }],
        ],
        y: [
          ["T", { sposY: 0.7 }],
          ["M", { sposY: 0 }],
          ["B", { sposY: -0.7 }],
        ],
        z: [
          ["near", { sposZ: 1.2 }],
          ["mid", { sposZ: 0 }],
          ["far", { sposZ: -1.2 }],
        ],
      }
    : {
        x: [
          ["L", { shift: -0.25 }],
          ["C", { shift: 0 }],
          ["R", { shift: 0.25 }],
        ],
        y: [
          ["T", { vshift: 0.35 }],
          ["M", { vshift: 0 }],
          ["B", { vshift: -0.35 }],
        ],
        z: [
          ["near", { pscale: 1.2 }],
          ["mid", { pscale: 0.8 }],
          ["far", { pscale: 0.5 }],
        ],
      };

  const filledCount = slots.filter(Boolean).length;

  return (
    <div style={UI.panel}>
      <div
        style={{
          fontWeight: 700,
          fontSize: 11,
          color: "#2e7d52",
          letterSpacing: 1,
        }}
      >
        iGLASS POSE STUDIO
      </div>

      {/* ---- target / space / mode ---- */}
      <div style={UI.head}>target</div>
      <div style={UI.row}>
        <span
          style={chipStyle(!isStage, true)}
          onClick={() => changeGizmoContext("settle")}
        >
          📱 phone (settle)
        </span>
        <span
          style={chipStyle(isStage, true)}
          onClick={() => changeGizmoContext("stage")}
        >
          🎬 stage
        </span>
        <span
          style={chipStyle(false)}
          title="space auto-binds to target — click to override"
          onClick={() => {
            DEV.gizmoSpace = DEV.gizmoSpace === "world" ? "local" : "world";
          }}
        >
          {DEV.gizmoSpace}
        </span>
      </div>

      <div style={UI.head}>gizmo</div>
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
        <span style={{ fontSize: 9, color: "#8aa094", marginLeft: 4 }}>
          {MODE_LABELS[DEV.driveMode]} · {GRAIN_LABELS[DEV.driveGrain]}
        </span>
      </div>

      {/* ---- primitives ---- */}
      <div style={UI.head}>📐 primitives — position</div>
      {[
        ["↔", posPrims.x],
        ["↕", posPrims.y],
        ["🔍", posPrims.z],
      ].map(([icon, entries]) => (
        <div style={UI.row} key={icon}>
          <span style={UI.axisLabel}>{icon}</span>
          {entries.map(([label, vals]) => (
            <span key={label} style={chipStyle(false)} onClick={() => prim(vals)}>
              {label}
            </span>
          ))}
        </div>
      ))}

      <div style={UI.head}>📐 primitives — rotation °</div>
      {["X", "Y", "Z"].map((axis) => (
        <div style={UI.row} key={axis}>
          <span style={UI.axisLabel}>
            {axis === "X" ? "🔄X" : axis === "Y" ? "↺Y" : "⤾Z"}
          </span>
          {PRIM_ROT_VALUES.map((deg) => (
            <span
              key={deg}
              style={chipStyle(false)}
              onClick={() => prim({ [rotParam(axis)]: deg })}
            >
              {deg}
            </span>
          ))}
        </div>
      ))}

      {/* ---- 60 persistent slots ---- */}
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
                ? `slot ${i + 1} — click: warp · right-click: clear`
                : `slot ${i + 1} — shift+click: save`
            }
            onClick={(ev) => slotClick(i, ev)}
            onContextMenu={(ev) => slotClear(i, ev)}
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* ---- actions ---- */}
      <div style={UI.head}>🛠 actions</div>
      <div style={UI.row}>
        <span style={chipStyle(false)} onClick={() => takeSnapshot("origin")}>
          set origin
        </span>
        <span style={chipStyle(false)} onClick={() => warpToSnapshot("origin")}>
          ⏪ origin
        </span>
        <span style={chipStyle(false)} onClick={() => snapLevel("stage")}>
          level stage
        </span>
        <span style={chipStyle(false)} onClick={() => snapLevel("settle")}>
          level settle
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
        click phone = phone target · click background = stage
        <br />
        slots: shift+click save · click warp · right-click clear
        <br />
        keys: W/E/R/Q gizmo · T target · Tab/G arrow drive · [ ] playhead
        <br />
        numeric sliders: Leva panel (top-right, collapsed)
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// DevGizmo (v3.1) — PROXY-ANCHORED TransformControls.
//
// The controls attach to an invisible proxy Object3D, never to the
// phone. Every frame (when not dragging) the proxy is placed at the
// target's world position CLAMPED to the visible frame (NDC ±0.85 x,
// ±0.78 y, behind-camera rescue), and copies the target's world
// quaternion + scale so local-space handles align with the phone.
// During a drag, the proxy's transform deltas are relayed to the real
// target (world → stage-local conversion for the settle target). On
// release, the existing capture functions read the real target —
// back-solve contract unchanged.
//
// Hold Shift while dragging to snap (0.1 units / 15° / 0.05 scale).
// Also stashes the world-unit viewport for the screen-space MOVE maths.
// ---------------------------------------------------------
function DevGizmo() {
  const { viewport, camera } = useThree();
  const ctrlRef = useRef();
  const dragRef = useRef(null);
  const [mode, setMode] = useState("off");
  const [target, setTarget] = useState(DEV.gizmoTarget);
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
    if (DEV.gizmo !== mode) setMode(DEV.gizmo);
    if (DEV.gizmoTarget !== target) setTarget(DEV.gizmoTarget);
    if (DEV.gizmoSpace !== space) setSpace(DEV.gizmoSpace);
    const obj = DEV.gizmoTarget === "stage" ? DEV.stageGroup : DEV.modelGroup;
    const has = !!obj;
    if (has !== ready) setReady(has);

    // ---- proxy anchor: follow the target, clamped to the frame ----
    if (obj && !DEV.gizmoDragging) {
      obj.getWorldPosition(tmp.v);

      // Behind-camera rescue: pull the anchor to just in front of the
      // lens so projection stays meaningful.
      tmp.c.copy(tmp.v).applyMatrix4(camera.matrixWorldInverse);
      if (tmp.c.z > -0.25) {
        tmp.c.z = -0.25;
        tmp.v.copy(tmp.c).applyMatrix4(camera.matrixWorld);
      }

      const ndc = tmp.c.copy(tmp.v).project(camera);
      const cx = Math.max(-0.85, Math.min(0.85, ndc.x));
      const cy = Math.max(-0.78, Math.min(0.78, ndc.y));
      if (cx !== ndc.x || cy !== ndc.y) {
        // Origin outside the frame → park the gizmo at the nearest
        // on-screen point, at the target's own depth.
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

  // Visibility hardening + FATTENING. frustumCulled=false keeps handles
  // rendering; depth flags keep them on top. Fattening: the invisible
  // picker meshes (material.visible === false) are the real hit zones —
  // cylinders get 2.4× radial, other shapes 1.6× uniform (torus pickers
  // excluded: uniform scaling would move the hit ring off the visual
  // ring). Visible arrow shafts/heads (CylinderGeometry) get 2.2×
  // radial. three r169+ moved the scene-graph part behind getHelper()
  // — feature-detect both shapes.
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
        // Invisible picker — the actual grab zone
        if (geoType === "CylinderGeometry") {
          child.scale.x *= 2.4;
          child.scale.z *= 2.4;
        } else if (geoType !== "TorusGeometry") {
          child.scale.multiplyScalar(1.6);
        }
      } else if (child.isMesh && geoType === "CylinderGeometry") {
        // Visible arrow shaft / head — fatten radially, keep length
        child.scale.x *= 2.2;
        child.scale.z *= 2.2;
      }
    });
  }, [mode, target, ready]);

  // Relay proxy deltas to the real target, live during the drag.
  const applyDrag = () => {
    const d = dragRef.current;
    const obj = DEV.gizmoTarget === "stage" ? DEV.stageGroup : DEV.modelGroup;
    if (!d || !obj) return;

    if (DEV.gizmo === "translate") {
      const delta = proxy.position.clone().sub(d.proxyPos);
      if (DEV.gizmoTarget === "settle") {
        // World delta → stage-local (model group lives inside the stage)
        delta
          .applyQuaternion(d.stageQuatInv)
          .divideScalar(d.stageScale || 1);
      }
      obj.position.copy(d.targetPos).add(delta);
    } else if (DEV.gizmo === "rotate") {
      // World-frame rotation delta of the proxy
      const dq = proxy.quaternion.clone().multiply(d.proxyQuatInv);
      let localDelta = dq;
      if (DEV.gizmoTarget === "settle") {
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
    DEV.gizmoDragging = true;
    // Guard: settle capture maths is only valid at the endpoint
    if (DEV.gizmoTarget === "settle" && DEV.lastP !== 1) {
      DEV.lastP = 1;
      if (DEV.applyProgress) DEV.applyProgress(1);
      if (DEV.setLeva) DEV.setLeva({ p: 1 });
    }
    const obj = DEV.gizmoTarget === "stage" ? DEV.stageGroup : DEV.modelGroup;
    if (!obj) return;
    const rs = DEV.stageGroup
      ? DEV.stageGroup.quaternion.clone()
      : new THREE.Quaternion();
    dragRef.current = {
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
    dragRef.current = null;
    // Capture BEFORE the next frame's lerp runs — the lerp target then
    // equals the pose just set, so there is no snap-back.
    if (DEV.gizmoTarget === "stage") captureStageFromObject();
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
// Mode & tuning resolution (contract §5.2 — URL params for static config)
//
//   ?mode=scroll|autoplay|standalone   (unchanged tri-mode driver)
//   ?bg=%230a0a0c                      opaque background; default transparent
//   ?p=0.85          freeze the timeline at a fixed progress (tuning/capture)
//   ?settle=0,180,0  override SETTLE.targetEuler, degrees
//   ?tilt=18         override START.tilt, degrees
//   ?lift=0.08       override SETTLE.arcLift, viewport-height fraction
//   ?size=1.6        override MODEL.targetSize
//   ?pscale=0.8      override SETTLE.scale
//   ?spos=x,y,z      STAGE position, world units
//   ?srot=x,y,z      STAGE rotation, degrees
//   ?sscale=1        STAGE uniform scale
//   ?snap=1          deterministic capture: damp→1 (exact pose per frozen
//                    p) + window.__iglassCaptureReady flag for Playwright
//   ?dev=1           Pose Studio (dashboard + gizmo W/E/R/Q, T target,
//                    Shift snap, Tab arrow-mode, G grain, arrows nudge,
//                    [ ] p nudge, click-to-target, 60 pose slots)
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

  // ---- STAGE channel (applies in production too — per-page framing) ----
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

  const dev = params.get("dev") === "1" || params.get("dev") === "true";
  DEV.enabled = dev;
  // Predictive space binding boot state: default target is settle → local
  DEV.gizmoSpace = DEV.gizmoTarget === "stage" ? "world" : "local";

  // Deterministic capture flag (Playwright frame-baking). damp→1 in the
  // useFrame + window.__iglassCaptureReady signal once settled.
  CAPTURE_SNAP = params.get("snap") === "1" || params.get("snap") === "true";

  const pParam = parseFloat(params.get("p"));
  let freezeP = !isNaN(pParam) ? Math.max(0, Math.min(1, pParam)) : null;
  // Dev rig with no explicit p: freeze mid-timeline so the slider owns progress
  if (dev && freezeP === null) freezeP = 0.5;

  return { mode, bg, freezeP, dev };
}

// Global 0→1 scroll progress → per-phase amounts
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
  return { explode, rotate };
}

// ============================================
// Default props (animation parameters only — no text, no UI)
// ============================================
const defaultProps = {
  explodeDistance: 1.2,
  scrollDistance: 4,
  glassStagger: [0, 0.6],
  oledStagger: [0.15, 0.75],
  phoneStagger: [0.3, 0.9],
  modelPath: "/14_Pro_Model.glb",
  screenTexture: screenImg,
  internalsTexture: internalsImg,
};

// ============================================
// Global scroll progress
// (contract §3.1 — plain mutable object; the driver writes,
//  useFrame reads, React is never in the loop)
// ============================================
const scrollState = {
  explosion: 0, // explode AMOUNT (0 assembled → 1 exploded), post-phase-map
  glassOffset: 0,
  oledOffset: 0,
  phoneOffset: 0,
  rotate: 0, // settle amount (0 flat → 1 upright/docked)
};

// ============================================
// iPhone Exploded Model
// ============================================
function IPhoneExploded({
  modelPath,
  screenTexture,
  internalsTexture,
  explodeDistance,
}) {
  const { scene } = useGLTF(modelPath);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  const { gl } = useThree();
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

  const internTex = useTexture(internalsTexture);
  internTex.colorSpace = THREE.SRGBColorSpace;
  internTex.generateMipmaps = true;
  internTex.minFilter = THREE.LinearMipmapLinearFilter;
  internTex.magFilter = THREE.LinearFilter;
  internTex.anisotropy = maxAniso;
  internTex.wrapS = THREE.ClampToEdgeWrapping;
  internTex.wrapT = THREE.ClampToEdgeWrapping;
  internTex.needsUpdate = true;

  // Rounded rect geometry for internals plane
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
  const modelGroupRef = useRef(); // whole-model group — settle rotation + drift
  const stageGroupRef = useRef(); // constant world transform, timeline-free

  // ---------------------------------------------------------
  // SORTING: layers by node name (unchanged from v1).
  // Render order: Body 0 → OLED 1 → Glass Front 3 → Bezel 4 
  // NOTE: GLB duplicated hierarchy still pending Blender cleanup.
  // ---------------------------------------------------------
  const { glassMeshes, oledMeshes, bodyMeshes } = useMemo(() => {
    const glass = [];
    const oled = [];
    const body = [];

    clonedScene.traverse((child) => {
      if (child.isMesh) {
        const name = child.name.toLowerCase();

        if (name.includes("bezel") || name.includes("glass_bezel")) {
  child.material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x000000),
    roughness: 0.7,
    metalness: 0.0,
    transparent: false,
    depthWrite: false,
    depthTest: false, // bezel opts out of depth entirely — no test, no fight, no flicker.
                      // SAFE for this timeline only: front face never leaves the camera.
                      // If the choreography ever shows the phone's back, revisit.
  });
  child.renderOrder = 4;
  glass.push(child);
} else if (
          name.includes("glass_front") ||
          name.includes("glass front") ||
          (name.includes("glass") && !name.includes("bezel"))
        ) {
          child.material = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0x000000), // black base: diffuse veil gone, specular unaffected
  roughness: 0.04,
  metalness: 0.0,
  transparent: true,
  opacity: 0.15,          // keep — OLED glow must survive the glass
  depthWrite: false,
  envMapIntensity: 1.2,   // ← was 2.0: reflections stay, blowout doesn't
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
});
child.renderOrder = 3;
          glass.push(child);
        } else if (name.includes("display") || name.includes("oled")) {
          // Programmatic UV fix — remove once UVs corrected in Blender.
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
              // U flipped — unflipped U rendered the screen mirror-imaged
              // (a rigid rotation can never mirror a texture; this is the
              // texture-domain fix).
              const u = 1.0 - (posAttr.getX(i) - minX) / rangeX;
              const v = 1.0 - (posAttr.getY(i) - minY) / rangeY;
              uvAttr.setXY(i, u, v);
            }
            uvAttr.needsUpdate = true;
          }

          child.material = new THREE.MeshBasicMaterial({
            map: oledTexture,
            toneMapped: false,
          });
          child.renderOrder = 1;
          oled.push(child);
        } else {
          child.material = child.material.clone();
          const mat = child.material;

          // GLB body materials include semi-transparent glass covers
          // (Dynamic Island / sensor windows / camera glass). Forcing
          // transparent=false alone turns these into opaque MID-GREY —
          // the "bright island" defect. Property-based rule (mesh names
          // in this GLB are obfuscated):
          //   alpha ≤ 0.05 — effectively-invisible coating films → hide
          //   alpha <  1   — translucent covers → solid near-black glass
          if (mat.opacity <= 0.05) {
            child.visible = false;
          } else if (mat.opacity < 1) {
            mat.color.setHex(0x0a0a0a);
            if ("metalness" in mat) mat.metalness = 0.1;
            if ("roughness" in mat) mat.roughness = 0.5;
            if ("envMapIntensity" in mat) mat.envMapIntensity = 0.2;
            mat.opacity = 1;
          }

          mat.transparent = false;
          mat.depthWrite = true;
          child.renderOrder = 0;
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

          body.push(child);
        }
      }
    });

    return { glassMeshes: glass, oledMeshes: oled, bodyMeshes: body };
  }, [clonedScene, oledTexture, maxAniso]);

  // ---------------------------------------------------------
  // MEASURED PIVOT (contract §2.13) — render-frame Box3 measurement.
  // Runs before the stage transform is applied (dirtyStage applies in
  // the first useFrame, after this layout effect), so the Box3 is
  // measured in the identity stage frame — exact.
  // ---------------------------------------------------------
  const pivotRef = useRef();
  const measuredRef = useRef(false);
  const fitRef = useRef({ maxDim: 1, cLocal: new THREE.Vector3() });

  useLayoutEffect(() => {
    const g = pivotRef.current;
    if (measuredRef.current || !g) return;
    // Initial pose set from qStart directly — the rotation prop can't
    // express the world-frame tilt composition.
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

  // Unregister on unmount so the gizmo never holds a dead object
  useEffect(() => {
    return () => {
      if (DEV.modelGroup === modelGroupRef.current) DEV.modelGroup = null;
      if (DEV.stageGroup === stageGroupRef.current) DEV.stageGroup = null;
    };
  }, []);

  // ---------------------------------------------------------
  // SETTLE rotation endpoints — SINGLE geodesic slerp (contract §3.3).
  // Rest pose untouched; viewer tilt applied as a WORLD-X rotation on
  // top of it (premultiply). Held in a ref so the dev rig can re-derive
  // when Leva controls touch START.tilt / SETTLE.targetEuler.
  // ---------------------------------------------------------
  const computeQuats = () => {
    const rest = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(Math.PI / 2, 0, -Math.PI / 2)
    );
    const tiltQ = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      START.tilt
    );
    const start = tiltQ.multiply(rest); // rest first, then world tilt
    const end = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(...SETTLE.targetEuler)
    );
    return { qStart: start, qEnd: end };
  };
  const quatsRef = useRef(null);
  if (quatsRef.current === null) quatsRef.current = computeQuats();
  const qTarget = useMemo(() => new THREE.Quaternion(), []);

  // ---------------------------------------------------------
  // ANIMATION: driven by scrollState regardless of the writing mode.
  // lerp smoothing (contract §3.1) — damping lives here.
  // ---------------------------------------------------------
  useFrame((state) => {
    // ?snap=1 → damp 1: each frozen p renders its exact pose in one frame.
    const damp = CAPTURE_SNAP ? 1 : 0.1;

    // Dev rig: re-derive mount-time values when Leva touched them
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

    // STAGE apply — runs in production too (URL-driven framing channel).
    // Only the dirty flag triggers it, and never mid-drag when the
    // gizmo owns the transform.
    if (
      DEV.dirtyStage &&
      stageGroupRef.current &&
      !(DEV.gizmoDragging && DEV.gizmoTarget === "stage")
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
      const target = -(scrollState.glassOffset * explodeDistance * 2.0);
      glassGroupRef.current.position.z = THREE.MathUtils.lerp(
        glassGroupRef.current.position.z,
        target,
        damp
      );
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

    // Whole-model writes are suppressed while the SETTLE-target gizmo is
    // being dragged. On release, capture has already made the params
    // equal the pose, so the lerp target matches — no snap-back.
    // Stage-target drags don't touch this group — no suppression needed.
    const settleDrag = DEV.gizmoDragging && DEV.gizmoTarget === "settle";
    if (modelGroupRef.current && !settleDrag) {
      const t = scrollState.rotate;

      // Single geodesic — smooth continuous rotation about one fixed axis
      qTarget.slerpQuaternions(quatsRef.current.qStart, quatsRef.current.qEnd, t);
      modelGroupRef.current.quaternion.slerp(qTarget, damp);

      // Settle scale-down
      const targetScale = 1 - (1 - SETTLE.scale) * t;
      const s = THREE.MathUtils.lerp(
        modelGroupRef.current.scale.x,
        targetScale,
        damp
      );
      modelGroupRef.current.scale.setScalar(s);

      // Path: eased drift to the desktop rest slot + a subtle arc lift.
      // sin(π·t): bump peaks mid-transition, returns to 0 at the
      // approved p=1 resting height.
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

    // Snap-capture readiness signal — Playwright waits on this flag.
    // damp=1 means the pose is exact after the first write; a few frames
    // of margin cover the STAGE dirty-apply and texture upload.
    if (CAPTURE_SNAP && !window.__iglassCaptureReady) {
      if (++SNAP_FRAMES >= 3) window.__iglassCaptureReady = true;
    }
  });

  return (
    <group ref={stageGroupRef}>
      <group
        ref={modelGroupRef}
        // Click-to-target (v3.1): tapping any part of the phone selects
        // the settle target (+ local space). event.delta filters out
        // gizmo drags and camera gestures — only clean clicks retarget.
        onClick={(e) => {
          if (!DEV.enabled) return;
          if (e.delta > 4) return;
          e.stopPropagation();
          changeGizmoContext("settle");
        }}
      >
        <group ref={pivotRef}>
          {/* GLASS (Front Window + Bezel) */}
          <group ref={glassGroupRef}>
            {glassMeshes.map((m, i) => (
              <primitive key={`glass-${i}`} object={m} />
            ))}
          </group>

          {/* OLED */}
          <group ref={oledGroupRef}>
            {oledMeshes.map((m, i) => (
              <primitive key={`oled-${i}`} object={m} />
            ))}
          </group>

          {/* BODY */}
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
// ============================================
function Scene({
  modelPath,
  screenTexture,
  internalsTexture,
  explodeDistance,
  dev,
}) {
  const shadowRef = useRef();

  // Contact shadow fades out through the settle — the docked, face-on
  // phone reads as UI, not object (matches the Apple reference).
  useFrame(() => {
    if (shadowRef.current) {
      shadowRef.current.traverse((o) => {
        if (o.material && "opacity" in o.material) {
          o.material.opacity = 0.5 * (1 - scrollState.rotate);
        }
      });
    }
  });

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow />
      <directionalLight position={[-5, 5, 2]} intensity={0.8} color="#e8f0ff" />
      <pointLight position={[0, 2, 2]} intensity={0.5} color="#4080ff" />

      <Environment preset="studio" />

      <IPhoneExploded
        modelPath={modelPath}
        screenTexture={screenTexture}
        internalsTexture={internalsTexture}
        explodeDistance={explodeDistance}
      />

      {dev && <DevGizmo />}

      <ContactShadows
        ref={shadowRef}
        position={[0, -0.7, 0]}
        opacity={0.5}
        scale={5}
        blur={2.5}
      />
    </>
  );
}

// ============================================
// Main Component — headless canvas, no DOM UI (dashboard is dev-only)
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
  } = merged;

  const { mode, bg, freezeP, dev } = useMemo(resolveRuntimeConfig, []);

  const containerRef = useRef(null);
  const stickyRef = useRef(null);

  // ============================================
  // Progress driver — one applyProgress used by all modes
  // ============================================
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

    // Dev rig: expose the driver so the Leva p slider can scrub the timeline
    DEV.applyProgress = applyProgress;

    // ---- TUNING FREEZE: ?p=0.85 pins the timeline at fixed progress ----
    if (freezeP !== null) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      DEV.lastP = freezeP;
      applyProgress(freezeP);
      return;
    }

    // ---- MODE: scroll (Framer postMessage bridge — contract §5.2) ----
    if (mode === "scroll") {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";

      const onMessage = (event) => {
        if (
          event.data &&
          event.data.type === "scroll-progress" &&
          typeof event.data.progress === "number"
        ) {
          applyProgress(Math.max(0, Math.min(1, event.data.progress)));
        }
      };

      window.addEventListener("message", onMessage);
      // Handshake — payload is a non-sensitive readiness flag only.
      if (window.parent) {
        window.parent.postMessage({ type: "iglass-3d-ready" }, "*");
      }
      return () => window.removeEventListener("message", onMessage);
    }

    // ---- MODE: autoplay (self-driving loop — contract §5.3) ----
    if (mode === "autoplay") {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";

      const proxy = { p: 0 };
      const tween = gsap.to(proxy, {
        p: 1,
        duration: 7, // covers explode + hold + reassemble + settle legibly
        ease: "power2.inOut",
        delay: 1,
        repeat: -1,
        yoyo: true,
        repeatDelay: 1.2,
        onUpdate: () => applyProgress(proxy.p),
      });
      return () => tween.kill();
    }

    // ---- MODE: standalone (internal ScrollTrigger — direct URL / QA) ----
    if (!containerRef.current || !stickyRef.current) return;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top top",
        end: `+=${scrollDistance * 100}vh`,
        pin: stickyRef.current,
        scrub: 1,
        onUpdate: (self) => applyProgress(self.progress),
      });
    }, containerRef);

    return () => ctx.revert();
  }, [mode, freezeP, scrollDistance, glassStagger, oledStagger, phoneStagger]);

  // Standalone mode owns its own scroll track; embedded modes are a
  // single fixed viewport — the Framer page owns the scroll.
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
      <div
        ref={stickyRef}
        style={{
          height: "100vh",
          width: "100vw",
          overflow: "hidden",
        }}
      >
        <Canvas
          camera={{ position: [0, 0, 2.8], fov: 35, near: 0.01 }}
          shadows
          dpr={[1, 2]}
          gl={{
            antialias: true,
            powerPreference: "high-performance",
            alpha: true,
            // Dev only: lets save-card read the framebuffer after present.
            preserveDrawingBuffer: dev,
          }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.NoToneMapping;
            gl.setClearColor(0x000000, 0); // fully transparent clear
            DEV.canvasEl = gl.domElement; // save-card frame source
          }}
          // Click-to-target (v3.1): a click that hits nothing = the
          // background = the stage. Guards: never mid-drag, never within
          // 250ms of a drag release (a drag that ends over empty space
          // must not retarget).
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
