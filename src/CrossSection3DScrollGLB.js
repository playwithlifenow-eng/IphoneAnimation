import screenImg from "./Screen.png";
import internalsImg from "./internals.jpg";
import crackImg from "./Crack.png";
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
// v3.11 — THE CRACK IS THE GLASS
//
//   v3.10 treated the cracked pane as an independent object that could
//   outrun, lag, tumble away from and dissolve out of the pane it is a
//   fracture IN. That is ontologically wrong. A crack has no velocity of
//   its own. It goes where the glass goes, because it IS the glass.
//
//   So the cracked pane is now a CHILD of the glass group. Not a sibling
//   with a matching multiplier — a child. It cannot travel independently
//   because there is no longer any code that could make it. Deleted:
//
//     travel ×        — welded. There is no multiplier to get wrong.
//     tumble X/Y/Z    — a crack does not somersault off the phone.
//     discard depth   — nor does it fly toward the camera.
//     departs / gone  — no swap window. The crack is ON or it is OFF.
//     dissolve        — see above.
//     mirror / flip   — discard X/Y repositions the pattern with more
//                       granularity than a 2-state UV fold ever could.
//
//   What remains is the whole honest surface of the thing:
//
//     crack ON/OFF    A boolean, saved into the pose slot with everything
//         else. THAT is the swap: pose A wears the crack, pose B does not.
//
//     discard X / Y   Where on the pane the fracture pattern sits.
//         Registration, not choreography.
//
//   THE GLASS SWAP. Glass Registration X/Y/Z now runs to ±25, not ±1.
//   One slider unit is ~0.1 world units and the visible frame is ~3.1
//   world across, so ±1 could never have taken the pane out of shot — it
//   moved it a quarter of a phone-width. At ±25 the glass unit (Front
//   Window + Bezel + the crack riding on it) leaves the frame entirely.
//   Drive it out, flip crack OFF, drive it back in clean. That is the
//   repair, told in one continuous shot with no cut.
//
//   Glass Reg X/Y/Z are also wireable now — with a ±25 range you want the
//   compound-motion rig and the number field, not a 50-unit slider drag.
//
// ---- earlier ----
// v3.9    Glass_Front -> MeshPhysicalMaterial (clearcoat). The hard circle
//         was a REFLECTION of the studio HDRI's softbox in a roughness-0.04
//         mirror, not a light. GLASS.rough spreads it; LIGHT.preset changes
//         its shape outright.
// v3.8.7  Arrow keys: tap = one exact grain step; hold = 60fps ramped glide.
// v3.8.5  THREE-way OLED split. The doubled black trim was two slab side-
//         walls 0.4mm apart (bezel + OLED). The OLED rim now renders nothing.
// v3.8.4  OLED face-split cut normalised and moved to -0.5.
// v3.8.3  ContactShadows deleted (ground plane seen edge-on IS a line).
// v3.8    Lighting rig on dials + ACES tone mapping.
// v3.7    Trackball ring, 100 pose slots.   v3.6  Auto target routing.
// v3.5    Glass-reg baked.  v3.4  Sat-nav HUD.  v3.3  Body emission kill.
// v3.2    Hierarchy bake.   v3.1  Proxy-anchored gizmo.  v3.0  Wiring.
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

const START = { tilt: Math.PI / 10 }; // 18°

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

const MODEL = { targetSize: 1.6 };

// ---------------------------------------------------------
// GLASS_REG — the registration of the ENTIRE glass unit:
// Front Window + Bezel + the crack riding on it.
//
// SCALE NOTE. These are MODEL-LOCAL units. The model measures ~15.7 local
// units tall and is fitted to MODEL.targetSize (1.6) world units, so
//
//        1 local unit  ≈  0.1 world units
//        visible frame ≈  3.1 world units across
//
// which means a ±1 range moved the pane a quarter of a phone-width and
// could never take it out of shot. To clear the frame you need ≈19 local
// units. The range is ±25 — the glass leaves, completely.
// ---------------------------------------------------------
const GLASS_REG_RANGE = 25;

const GLASS_REG = { x: -0.03, y: 0.09, z: 0.07 };

// ---------------------------------------------------------
// LIGHT — the whole rig as dials.
// Overridable: ?light=amb,key,fill,env,exp  ?envp=studio  ?envb=0
// ---------------------------------------------------------
const LIGHT = {
  amb: 0.1,
  key: 1.2,
  fill: 0.35,
  env: 0.4,
  exp: 1.0,
  preset: "studio",
  blur: 0.0,
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
// OLED — the front/back/rim face-split threshold.
//   front cap nz ~ -1.0    back cap nz ~ +1.0    rim nz ~ 0.0
// Overridable: ?oled=-0.5,0
// ---------------------------------------------------------
const OLED = {
  faceCut: -0.5,
  showRim: false,
};

// ---------------------------------------------------------
// GLASS — the front pane's material.
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
// CRACK — a boolean and a registration. Nothing else.
// `on` is saved into the pose slot, so the swap IS the pose change.
// Overridable: ?crack=on,exitX,exitY
// ---------------------------------------------------------
const CRACK = {
  on: true,
  exit: [0, 0],
};

// 1x1 transparent PNG. useTexture cannot be called conditionally (hooks
// rule), so with no crackTexture prop this loads instead and the crack
// layer is simply never mounted.
const BLANK_PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

// ---------------------------------------------------------
// BEZEL
// Overridable: ?bezel=env,rough,offset
// ---------------------------------------------------------
const BEZEL = {
  env: 0.0,
  rough: 1.0,
  offset: -4,
};

// ============================================
// DEV RIG
// ============================================
const DEV = {
  enabled: false,
  dirtyQuat: false,
  dirtyFit: false,
  dirtyStage: true,
  dirtyLight: true,
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
  bezelMat: null,
  bezelMeshes: [],
  oledRimMat: null,
  glassMat: null,
  crackMat: null,
  setEnv: null,
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
const KEYS = { delay: 200, ramp: 900, min: 0.25, max: 1.5, gain: 1.0 };

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
  // The glass unit's registration — the whole point of the ±25 range is
  // that it is now a MOVE, so it belongs on the wiring rig.
  glassRegX: () => GLASS_REG.x,
  glassRegY: () => GLASS_REG.y,
  glassRegZ: () => GLASS_REG.z,
  // Where the fracture sits ON the pane. Registration, not choreography.
  crackExitX: () => CRACK.exit[0],
  crackExitY: () => CRACK.exit[1],
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
  glassRegX: [-GLASS_REG_RANGE, GLASS_REG_RANGE],
  glassRegY: [-GLASS_REG_RANGE, GLASS_REG_RANGE],
  glassRegZ: [-GLASS_REG_RANGE, GLASS_REG_RANGE],
  crackExitX: [-4, 4],
  crackExitY: [-4, 4],
};

// Every key Leva actually owns. Pose slots written by an older build carry
// keys that no longer exist (crackSpinX, crackFade …) — they are filtered
// here rather than handed to Leva, which would warn on every warp.
const LEVA_KEYS = new Set([...Object.keys(DRIVE_READERS), "crackOn"]);

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
  "glassRegX", "glassRegY", "glassRegZ",
  "crackExitX", "crackExitY",
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
//
// crackOn rides in the slot with everything else. THAT is the glass swap:
// slot 3 = cracked pane, docked. slot 4 = same pose, crack off. Warp
// between them and the screen is replaced.
// ---------------------------------------------------------
const SNAPSHOTS = { origin: null };

const SLOT_KEY = "iglass_pose_slots_v1";
const SLOT_COUNT = 100;

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
  o.crackOn = CRACK.on;
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
  const clean = {};
  for (const k of Object.keys(rest)) {
    if (LEVA_KEYS.has(k)) clean[k] = rest[k];
  }
  DEV.setLeva(clean);
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
  const stepRad = (GRAIN_STEPS.deg[DEV.driveGrain] * scale * Math.PI) / 180;
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
  // on, exitX, exitY. That is the entire crack channel now.
  params.set(
    "crack",
    [CRACK.on ? 1 : 0, CRACK.exit[0], CRACK.exit[1]]
      .map((v) => Number(v).toFixed(3))
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
    `ibl ${LIGHT.preset}  blur ${LIGHT.blur.toFixed(2)}`,
    `crack ${CRACK.on ? "ON" : "OFF"}    reg ${CRACK.exit.map((v) => v.toFixed(2)).join(", ")}`,
  ];
  const url = buildTuningURL();

  const fsMono = Math.round(22 * k);
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
  SETTLE.xShiftFraction = viewport.width ? obj.position.x / viewport.width : 0;
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

    // ---- v3.11 CRACKED PANE. Playhead first, then the two things that
    // are actually true about a crack: it exists or it doesn't, and it
    // sits somewhere on the pane. ----
    "💥 cracked pane": folder(
      {
        p: {
          value: initialP,
          min: 0,
          max: 1,
          step: 0.001,
          label: "playhead  p =",
          onChange: (v) => {
            DEV.lastP = v;
            if (DEV.applyProgress) DEV.applyProgress(v);
            if (DEV.setLeva) DEV.setLeva({ drive: driveLabel() });
          },
        },
        crackOn: {
          value: CRACK.on,
          label: "CRACK  (saved in the pose slot)",
          onChange: (v) => {
            CRACK.on = v;
          },
        },
        crackExitX: {
          value: CRACK.exit[0],
          min: -4,
          max: 4,
          step: 0.01,
          label: "crack ← → (X)",
          onChange: (v) => {
            CRACK.exit[0] = v;
            wireTap("crackExitX", v);
          },
        },
        crackExitY: {
          value: CRACK.exit[1],
          min: -4,
          max: 4,
          step: 0.01,
          label: "crack ↑ ↓ (Y)",
          onChange: (v) => {
            CRACK.exit[1] = v;
            wireTap("crackExitY", v);
          },
        },
      },
      { collapsed: false }
    ),

    // ---- THE GLASS SWAP lives here now. ±25 drives the whole glass unit
    // clean out of frame; crack OFF; drive it back in. ----
    "🔲 glass registration  (±25 — drives the pane OUT of shot)": folder(
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
      },
      { collapsed: false }
    ),

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
      { collapsed: true }
    ),

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
      { collapsed: true }
    ),

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
      { collapsed: true }
    ),

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
        oledRim: {
          value: OLED.showRim,
          label: "show OLED rim (trim 2)",
          onChange: (v) => {
            OLED.showRim = v;
            if (DEV.oledRimMat) DEV.oledRimMat.visible = v;
          },
        },
        hideBezel: {
          value: false,
          label: "hide bezel (trim 1) — isolate",
          onChange: (v) => {
            for (const m of DEV.bezelMeshes) m.visible = !v;
          },
        },
      },
      { collapsed: true }
    ),

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
        // The swap, on one key.
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
  glassRegX: "Glass ← →",
  glassRegY: "Glass ↑ ↓",
  glassRegZ: "Glass depth",
  crackExitX: "Crack ← →",
  crackExitY: "Crack ↑ ↓",
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

  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 150);
    return () => clearInterval(id);
  }, []);

  const [slots, setSlots] = useState(loadSlots);

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

  const filledCount = slots.filter(Boolean).length;

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

      <div style={UI.head}>💥 crack (C)</div>
      <div style={UI.row}>
        <span
          style={chipStyle(CRACK.on, true)}
          title="the crack is welded to the glass — this is a state, not a motion. Saved into the pose slot."
          onClick={() => {
            if (DEV.setLeva) DEV.setLeva({ crackOn: !CRACK.on });
          }}
        >
          {CRACK.on ? "● cracked" : "○ clean"}
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
        crack is welded to the glass · it is a STATE, saved in the pose slot
        <br />
        glass reg ±25 drives the pane clean out of frame — that is the swap
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

    const eff =
      DEV.gizmoDragging && dragRef.current
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
    const root = typeof ctrl.getHelper === "function" ? ctrl.getHelper() : ctrl;
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
        delta.applyQuaternion(d.stageQuatInv).divideScalar(d.stageScale || 1);
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
//   ?lift / ?shift / ?vshift / ?size / ?pscale
//   ?spos / ?srot / ?sscale    STAGE transform
//   ?glassreg=x,y,z            whole-glass-unit registration (±25)
//   ?light=amb,key,fill,env,exp
//   ?bezel=env,rough,offset
//   ?oled=-0.5,0               face-split cut, rim on/off
//   ?glass=rough,env,opac,cc,ccr
//   ?envp=studio   ?envb=0     reflected world + IBL blur
//   ?crack=on,exitX,exitY      1/0, then where the fracture sits
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
  if (!isNaN(tiltParam)) START.tilt = (tiltParam * Math.PI) / 180;

  const liftParam = parseFloat(params.get("lift"));
  if (!isNaN(liftParam)) SETTLE.arcLift = liftParam;

  const shiftParam = parseFloat(params.get("shift"));
  if (!isNaN(shiftParam)) SETTLE.xShiftFraction = shiftParam;

  const vShiftParam = parseFloat(params.get("vshift"));
  if (!isNaN(vShiftParam)) SETTLE.yShiftFraction = vShiftParam;

  const sizeParam = parseFloat(params.get("size"));
  if (!isNaN(sizeParam) && sizeParam > 0) MODEL.targetSize = sizeParam;

  const pscaleParam = parseFloat(params.get("pscale"));
  if (!isNaN(pscaleParam) && pscaleParam > 0) SETTLE.scale = pscaleParam;

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
  if (!isNaN(sscaleParam) && sscaleParam > 0) STAGE.scale = sscaleParam;
  DEV.dirtyStage = true;

  const glassregParam = params.get("glassreg");
  if (glassregParam) {
    const parts = glassregParam.split(",").map((v) => parseFloat(v));
    if (parts.length === 3 && parts.every((v) => !isNaN(v))) {
      const cl = (v) =>
        Math.max(-GLASS_REG_RANGE, Math.min(GLASS_REG_RANGE, v));
      GLASS_REG.x = cl(parts[0]);
      GLASS_REG.y = cl(parts[1]);
      GLASS_REG.z = cl(parts[2]);
    }
  }

  const bezelParam = params.get("bezel");
  if (bezelParam) {
    const parts = bezelParam.split(",").map((v) => parseFloat(v));
    if (parts.length === 3 && parts.every((v) => !isNaN(v))) {
      BEZEL.env = parts[0];
      BEZEL.rough = parts[1];
      BEZEL.offset = parts[2];
    }
  }

  const oledParam = params.get("oled");
  if (oledParam) {
    const parts = oledParam.split(",").map((v) => parseFloat(v));
    if (!isNaN(parts[0]) && parts[0] >= -1 && parts[0] <= 0) {
      OLED.faceCut = parts[0];
    }
    if (parts.length > 1 && !isNaN(parts[1])) OLED.showRim = parts[1] === 1;
  }

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
  if (envpParam && ENV_PRESETS.includes(envpParam)) LIGHT.preset = envpParam;

  const envbParam = parseFloat(params.get("envb"));
  if (!isNaN(envbParam) && envbParam >= 0 && envbParam <= 1) {
    LIGHT.blur = envbParam;
  }

  // ---- CRACK channel — on, exitX, exitY. Tolerant of a legacy 13-value
  // ?crack= string: the first slot was opacity (1.0), which reads as ON.
  const crackParam = params.get("crack");
  if (crackParam) {
    const q = crackParam.split(",").map((v) => parseFloat(v));
    if (!isNaN(q[0])) CRACK.on = q[0] > 0.5;
    if (q.length === 3 && !isNaN(q[1]) && !isNaN(q[2])) {
      CRACK.exit = [q[1], q[2]];
    }
  }

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

  const pParam = parseFloat(params.get("p"));
  let freezeP = !isNaN(pParam) ? Math.max(0, Math.min(1, pParam)) : null;
  if (dev && freezeP === null) freezeP = 0.5;

  return { mode, bg, freezeP, dev };
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
  modelPath: "/14 pro.glb",
  screenTexture: screenImg,
  internalsTexture: internalsImg,
  // WHITE crack lines on a TRANSPARENT background, pane aspect (71:155).
  // A fracture SCATTERS light — it reads bright, not dark. Black cracks on
  // a near-black glass pane are invisible.
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
};

// ---------------------------------------------------------
// OLED FRONT / BACK / RIM SPLIT
// ---------------------------------------------------------
const OLED_SCREEN_GROUP = 0;
const OLED_BLACK_GROUP = 1;
const OLED_RIM_GROUP = 2;

const OLED_CACHE = { geo: null, tri: null, nz: null };

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
  const crackGroupRef = useRef();
  const oledGroupRef = useRef();
  const bodyGroupRef = useRef();
  const modelGroupRef = useRef();
  const stageGroupRef = useRef();

  // ---------------------------------------------------------
  // SORTING + HIERARCHY BAKE
  // Render order: Body 0 → coats 1 → OLED 1 → Glass 3 → CRACK 4 → Bezel 5
  // ---------------------------------------------------------
  const { glassMeshes, oledMeshes, bodyMeshes, crackGeo } = useMemo(() => {
    const glass = [];
    const oled = [];
    const body = [];
    let crack = null;
    DEV.bezelMeshes = [];

    clonedScene.updateMatrixWorld(true);

    clonedScene.traverse((child) => {
      if (!child.isMesh) return;

      const name = child.name.toLowerCase();

      // ---- 1. BEZEL ----
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
        DEV.bezelMat = bezelMat;
        DEV.bezelMeshes.push(child);
        child.renderOrder = 5; // above the crack overlay (4)
        glass.push(child);
        return;
      }

      // ---- 2. GLASS FRONT ----
      if (
        name.includes("glass_front") ||
        name.includes("glass front") ||
        (name.includes("glass") && !name.includes("bezel"))
      ) {
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
        // Cloned from the clean pane and mounted as its CHILD, so it is the
        // same plane, at the same place, forever. Planar UVs regenerated
        // from the bounding box rather than trusting the GLB's TEXCOORD_0.
        const cg = child.geometry.clone();
        const cpos = cg.attributes.position;
        if (cpos) {
          let minX = Infinity,
            maxX = -Infinity;
          let minY = Infinity,
            maxY = -Infinity;
          for (let i = 0; i < cpos.count; i++) {
            const x = cpos.getX(i),
              y = cpos.getY(i);
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

      // ---- 3. OLED — solid slab, split front / back / rim ----
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

        const oledRimMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(0x000000),
          toneMapped: false,
        });
        oledRimMat.visible = OLED.showRim;
        DEV.oledRimMat = oledRimMat;

        child.material = [
          new THREE.MeshBasicMaterial({ map: oledTexture, toneMapped: false }),
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
      child.material = child.material.clone();
      const mat = child.material;

      if (mat.emissive) mat.emissive.setRGB(0, 0, 0);
      if ("emissiveIntensity" in mat) mat.emissiveIntensity = 0;
      mat.emissiveMap = null;

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

      [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap, mat.aoMap].forEach(
        (tex) => {
          if (tex) {
            tex.anisotropy = maxAniso;
            tex.generateMipmaps = true;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.needsUpdate = true;
          }
        }
      );

      const isCoat = mat.transparent && child.visible;
      child.renderOrder = isCoat ? 1 : 0;
      body.push(child);
    });

    // ---- ANCHORED REBASE ----
    // newLocal = anchorOldLocal · anchorWorld⁻¹ · meshWorld
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
  // CRACKED-PANE MATERIAL
  //
  // WHITE crack lines on TRANSPARENT. transparent:true means the PNG's own
  // alpha carves the shape, so the pane is invisible everywhere except
  // along the fractures — which sit ON TOP of the clean glass beneath.
  // depthWrite off so it cannot fight the pane it lies on; polygonOffset -3
  // so it wins over the glass's -2 where they are exactly coplanar (they
  // are — it is the same geometry).
  // ---------------------------------------------------------
  const crackMat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      map: crackTex,
      transparent: true,
      opacity: 1,
      roughness: 0.06,
      metalness: 0.0,
      depthWrite: false,
      envMapIntensity: GLASS.env,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    m.visible = CRACK.on;
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
    const damp = CAPTURE_SNAP ? 1 : 0.1;

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
      !(DEV.gizmoDragging && (DEV.gizmoTarget === "stage" || !atEndpoint()))
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

    // ---- THE GLASS UNIT: Front Window + Bezel + the crack riding on it.
    // GLASS_REG now spans ±25, which is enough to carry the whole unit out
    // of frame and back. X and Y are written directly (a swap is a move you
    // are DRIVING, not a spring); Z keeps its lerp so the explode still
    // eases.
    if (glassGroupRef.current) {
      const target = -(scrollState.glassOffset * explodeDistance * 2.0);
      glassGroupRef.current.position.z = THREE.MathUtils.lerp(
        glassGroupRef.current.position.z,
        target + GLASS_REG.z,
        damp
      );
      glassGroupRef.current.position.x = GLASS_REG.x;
      glassGroupRef.current.position.y = GLASS_REG.y;
    }

    // ---- CRACKED PANE (v3.11) ----
    // A CHILD of the glass group. It has no travel of its own — it cannot,
    // there is no code that could give it any. Its only transform is where
    // the fracture pattern sits on the pane, and whether it is there at all.
    if (crackGroupRef.current && hasCrack) {
      crackGroupRef.current.position.set(CRACK.exit[0], CRACK.exit[1], 0);
      if (DEV.crackMat) DEV.crackMat.visible = CRACK.on;
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

      qTarget.slerpQuaternions(
        quatsRef.current.qStart,
        quatsRef.current.qEnd,
        t
      );
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
          {/* GLASS UNIT — Front Window + Bezel + the crack. */}
          <group ref={glassGroupRef}>
            {glassMeshes.map((m, i) => (
              <primitive key={`glass-${i}`} object={m} />
            ))}

            {/* CRACKED PANE — a CHILD of the glass, not a sibling. It goes
                where the glass goes because it IS the glass. Its transform
                carries one thing only: where on the pane the fracture sits.
                Never mounts without a crackTexture prop. */}
            {hasCrack && crackGeo && (
              <group ref={crackGroupRef}>
                <mesh geometry={crackGeo} material={crackMat} renderOrder={4} />
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
// Scene
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

  const { mode, bg, freezeP, dev } = useMemo(resolveRuntimeConfig, []);

  const containerRef = useRef(null);
  const stickyRef = useRef(null);

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

    if (freezeP !== null) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      DEV.lastP = freezeP;
      applyProgress(freezeP);
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
          applyProgress(Math.max(0, Math.min(1, event.data.progress)));
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
      const tween = gsap.to(proxy, {
        p: 1,
        duration: 7,
        ease: "power2.inOut",
        delay: 1,
        repeat: -1,
        yoyo: true,
        repeatDelay: 1.2,
        onUpdate: () => applyProgress(proxy.p),
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
        onUpdate: (self) => applyProgress(self.progress),
      });
    }, containerRef);

    return () => ctx.revert();
  }, [mode, freezeP, scrollDistance, glassStagger, oledStagger, phoneStagger]);

  const onWrapPointerDown = (e) => {
    if (!dev || !DEV.setLeva) return;
    if (DEV.hudMode !== "move" || DEV.gizmo !== "off" || DEV.gizmoDragging)
      return;

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
            if (DEV.gizmoDragging || performance.now() - DEV.lastDragEnd < 250)
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
useTexture.preload(defaultProps.crackTexture);
