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
import { Leva, useControls, button, buttonGroup, folder } from "leva";

gsap.registerPlugin(ScrollTrigger);

// ============================================
// v2.7 — KEYBOARD DRIVE MODE
//
// v2.6 recap: STAGE channel (constant world transform, timeline-free,
// gizmo target switch), phase-jump buttons, pose cards, capture manifest.
//
// v2.7 adds precision arrow-key nudging (mouse-drag acceleration at
// macro zoom is unusable for fine work):
//   Tab        cycle arrow mode: MOVE → ROTATE → ROLL·ZOOM
//   G          cycle granularity: fine → mid → coarse
//   Arrows     nudge the mode's two axes (hold = auto-repeat glide)
//   [ / ]      nudge timeline p by the current granularity
//   T          (existing) target toggle — arrows drive whichever
//              channel is targeted: settle params or stage params
// The `drive` readout in the panel always shows mode · grain (target).
// Settle-target nudges snap p to 1 first (settle params are inert
// below the endpoint — same rule as the gizmo).
// ============================================

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
  gizmoDragging: false, // true while dragging — settle-target drags
  //                       suppress whole-model useFrame writes
  modelGroup: null, // live Object3D — settle gizmo target
  stageGroup: null, // live Object3D — stage gizmo target
  canvasEl: null, // WebGL canvas element — save-card frame source
  setLeva: null, // Leva set() — bi-directional slider sync
  driveMode: 0, // 0 MOVE · 1 ROTATE · 2 ROLL·ZOOM (Tab cycles)
  driveGrain: 0, // 0 fine · 1 mid · 2 coarse (G cycles)
};

// ---------------------------------------------------------
// KEYBOARD DRIVE — arrow-key nudging.
// Tab cycles mode, G cycles granularity, T (existing) picks the channel.
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

// (target → mode → axis) → [levaKey, stepClass, sign]. x = ←/→, y = ↑/↓
// sign flips screen-space feel without touching the underlying maths.
const DRIVE_MAP = {
  settle: [
    { x: ["shift", "frac", 1], y: ["vshift", "frac", 1] },    // MOVE       — correct
    { x: ["settleY", "deg", -1], y: ["settleX", "deg", -1] }, // ROTATE     — both flipped
    { x: ["settleZ", "deg", 1], y: ["size", "size", -1] },    // ROLL·ZOOM  — ↑/↓ flipped, ←/→ kept
  ],
  stage: [
    { x: ["sposX", "unit", 1], y: ["sposY", "unit", 1] },     // MOVE
    { x: ["srotY", "deg", 1], y: ["srotX", "deg", 1] },       // ROTATE     — untested; flip to -1,-1 if reversed
    { x: ["srotZ", "deg", 1], y: ["sscale", "size", 1] },     // ROLL·ZOOM  — untested
  ],
};

// Current values read from the config objects (single source of truth)
const DRIVE_READERS = {
  shift: () => SETTLE.xShiftFraction,
  vshift: () => SETTLE.yShiftFraction,
  settleX: () => (SETTLE.targetEuler[0] * 180) / Math.PI,
  settleY: () => (SETTLE.targetEuler[1] * 180) / Math.PI,
  settleZ: () => (SETTLE.targetEuler[2] * 180) / Math.PI,
  size: () => MODEL.targetSize,
  sposX: () => STAGE.position[0],
  sposY: () => STAGE.position[1],
  srotX: () => (STAGE.rotationEuler[0] * 180) / Math.PI,
  srotY: () => (STAGE.rotationEuler[1] * 180) / Math.PI,
  srotZ: () => (STAGE.rotationEuler[2] * 180) / Math.PI,
  sscale: () => STAGE.scale,
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
  srotX: [-180, 180],
  srotY: [-180, 180],
  srotZ: [-180, 180],
  sscale: [0.2, 3],
};

function driveLabel() {
  return `${MODE_LABELS[DEV.driveMode]} · ${GRAIN_LABELS[DEV.driveGrain]} (${DEV.gizmoTarget})`;
}

function driveNudge(set, axis, dir) {
  // Settle params are inert below the endpoint — snap there first
  // (same rule as the gizmo)
  if (DEV.gizmoTarget === "settle" && DEV.lastP !== 1) jumpToP(1);
  const [param, cls, sign] = DRIVE_MAP[DEV.gizmoTarget][DEV.driveMode][axis];
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
  // idempotent). Note: Euler extraction may express the same rotation
  // with different angles than you typed (e.g. [180,0,180] ≡ [0,180,0]);
  // the quaternion — and therefore the motion — is identical.
  if (DEV.setLeva) {
    DEV.setLeva({
      pscale: Number(SETTLE.scale.toFixed(2)),
      shift: Number(SETTLE.xShiftFraction.toFixed(3)),
      vshift: Number(SETTLE.yShiftFraction.toFixed(3)),
      settleX: Math.round((e.x * 180) / Math.PI),
      settleY: Math.round((e.y * 180) / Math.PI),
      settleZ: Math.round((e.z * 180) / Math.PI),
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
      srotX: Math.round((e.x * 180) / Math.PI),
      srotY: Math.round((e.y * 180) / Math.PI),
      srotZ: Math.round((e.z * 180) / Math.PI),
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
    gizmo: {
      value: "off",
      options: ["off", "move", "rotate", "scale"],
      onChange: (v) => {
        DEV.gizmo = v === "move" ? "translate" : v;
        // Settle-target gizmo tuning is defined at the endpoint — snap
        // there. Stage target works at any p, leave progress alone.
        if (v !== "off" && DEV.gizmoTarget === "settle") {
          DEV.lastP = 1;
          if (DEV.applyProgress) DEV.applyProgress(1);
        }
      },
    },
    target: {
      value: "settle",
      options: ["settle", "stage"],
      onChange: (v) => {
        DEV.gizmoTarget = v;
        if (v === "settle" && DEV.gizmo !== "off") {
          DEV.lastP = 1;
          if (DEV.applyProgress) DEV.applyProgress(1);
        }
      },
    },
    drive: { value: "MOVE · fine (settle)", editable: false },
    jump: buttonGroup({
      "½exp": () => jumpToP(0.175),
      hold: () => jumpToP(0.4),
      "½asm": () => jumpToP(0.575),
      end: () => jumpToP(1),
    }),
    p: {
      value: initialP,
      min: 0,
      max: 1,
      step: 0.001,
      onChange: (v) => {
        DEV.lastP = v;
        if (DEV.applyProgress) DEV.applyProgress(v);
      },
    },
    tilt: {
      value: (START.tilt * 180) / Math.PI,
      min: -45,
      max: 45,
      step: 0.5,
      onChange: (v) => {
        START.tilt = (v * Math.PI) / 180;
        DEV.dirtyQuat = true;
      },
    },
    settleX: {
      value: eulDeg[0],
      min: -180,
      max: 180,
      step: 1,
      onChange: (v) => {
        SETTLE.targetEuler[0] = (v * Math.PI) / 180;
        DEV.dirtyQuat = true;
      },
    },
    settleY: {
      value: eulDeg[1],
      min: -180,
      max: 180,
      step: 1,
      onChange: (v) => {
        SETTLE.targetEuler[1] = (v * Math.PI) / 180;
        DEV.dirtyQuat = true;
      },
    },
    settleZ: {
      value: eulDeg[2],
      min: -180,
      max: 180,
      step: 1,
      onChange: (v) => {
        SETTLE.targetEuler[2] = (v * Math.PI) / 180;
        DEV.dirtyQuat = true;
      },
    },
    shift: {
      value: SETTLE.xShiftFraction,
      min: -0.5,
      max: 0.5,
      step: 0.005,
      onChange: (v) => {
        SETTLE.xShiftFraction = v;
      },
    },
    vshift: {
      value: SETTLE.yShiftFraction,
      min: -1,
      max: 1,
      step: 0.005,
      onChange: (v) => {
        SETTLE.yShiftFraction = v;
      },
    },
    lift: {
      value: SETTLE.arcLift,
      min: -0.5,
      max: 0.5,
      step: 0.005,
      onChange: (v) => {
        SETTLE.arcLift = v;
      },
    },
    pscale: {
      value: SETTLE.scale,
      min: 0.2,
      max: 1.5,
      step: 0.01,
      onChange: (v) => {
        SETTLE.scale = v;
      },
    },
    size: {
      value: MODEL.targetSize,
      min: 0.5,
      max: 6,
      step: 0.05,
      onChange: (v) => {
        MODEL.targetSize = v;
        DEV.dirtyFit = true;
      },
    },
    stage: folder(
      {
        sposX: {
          value: STAGE.position[0],
          min: -3,
          max: 3,
          step: 0.01,
          onChange: (v) => {
            STAGE.position[0] = v;
            DEV.dirtyStage = true;
          },
        },
        sposY: {
          value: STAGE.position[1],
          min: -3,
          max: 3,
          step: 0.01,
          onChange: (v) => {
            STAGE.position[1] = v;
            DEV.dirtyStage = true;
          },
        },
        sposZ: {
          value: STAGE.position[2],
          min: -3,
          max: 3,
          step: 0.01,
          onChange: (v) => {
            STAGE.position[2] = v;
            DEV.dirtyStage = true;
          },
        },
        srotX: {
          value: stageDeg[0],
          min: -180,
          max: 180,
          step: 1,
          onChange: (v) => {
            STAGE.rotationEuler[0] = (v * Math.PI) / 180;
            DEV.dirtyStage = true;
          },
        },
        srotY: {
          value: stageDeg[1],
          min: -180,
          max: 180,
          step: 1,
          onChange: (v) => {
            STAGE.rotationEuler[1] = (v * Math.PI) / 180;
            DEV.dirtyStage = true;
          },
        },
        srotZ: {
          value: stageDeg[2],
          min: -180,
          max: 180,
          step: 1,
          onChange: (v) => {
            STAGE.rotationEuler[2] = (v * Math.PI) / 180;
            DEV.dirtyStage = true;
          },
        },
        sscale: {
          value: STAGE.scale,
          min: 0.2,
          max: 3,
          step: 0.01,
          onChange: (v) => {
            STAGE.scale = v;
            DEV.dirtyStage = true;
          },
        },
      },
      { collapsed: true }
    ),
    "copy URL": button(() => {
      const url = buildTuningURL();
      window.history.replaceState(null, "", url);
      if (navigator.clipboard) navigator.clipboard.writeText(url);
    }),
    "save card": button(saveCard),
    "copy manifest": button(copyManifest),
  }));

  // Expose set() so gizmo captures, phase jumps, and the arrow drive
  // can push values back into the sliders
  useEffect(() => {
    DEV.setLeva = set;
    return () => {
      DEV.setLeva = null;
    };
  }, [set]);

  // Keyboard surface:
  //   W/E/R  gizmo translate/rotate/scale     Q  gizmo off
  //   T      target toggle (settle | stage)
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
        const next = DEV.gizmoTarget === "settle" ? "stage" : "settle";
        set({ target: next });
        set({ drive: `${MODE_LABELS[DEV.driveMode]} · ${GRAIN_LABELS[DEV.driveGrain]} (${next})` });
        return;
      }
      const map = { w: "move", e: "rotate", r: "scale", q: "off" };
      if (map[k]) set({ gizmo: map[k] });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [set]);

  return null;
}

// ---------------------------------------------------------
// DevGizmo — lives inside <Canvas>. Polls the plain-mutable DEV state
// once per frame (setState only on change). Targets: settle (whole-model
// group, p forced to 1, back-solved on release) or stage (outermost
// group, any p, direct read on release).
// Hold Shift while dragging to snap (0.1 units / 15° / 0.05 scale).
// ---------------------------------------------------------
function DevGizmo() {
  const { viewport } = useThree();
  const [mode, setMode] = useState("off");
  const [target, setTarget] = useState("settle");
  const [ready, setReady] = useState(false);
  const [snap, setSnap] = useState(false);

  useFrame(() => {
    if (DEV.gizmo !== mode) setMode(DEV.gizmo);
    if (DEV.gizmoTarget !== target) setTarget(DEV.gizmoTarget);
    const obj = DEV.gizmoTarget === "stage" ? DEV.stageGroup : DEV.modelGroup;
    const has = !!obj;
    if (has !== ready) setReady(has);
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

  if (mode === "off" || !ready) return null;

  const obj = target === "stage" ? DEV.stageGroup : DEV.modelGroup;

  return (
    <TransformControls
      key={`${mode}-${target}`}
      object={obj}
      mode={mode}
      size={0.8}
      translationSnap={snap ? 0.1 : null}
      rotationSnap={snap ? Math.PI / 12 : null}
      scaleSnap={snap ? 0.05 : null}
      onMouseDown={() => {
        DEV.gizmoDragging = true;
        // Guard: settle capture maths is only valid at the endpoint
        if (target === "settle" && DEV.lastP !== 1) {
          DEV.lastP = 1;
          if (DEV.applyProgress) DEV.applyProgress(1);
          if (DEV.setLeva) DEV.setLeva({ p: 1 });
        }
      }}
      onMouseUp={() => {
        DEV.gizmoDragging = false;
        // Capture BEFORE the next frame's lerp runs — the lerp target
        // then equals the pose just set, so there is no snap-back.
        if (target === "stage") captureStageFromObject();
        else captureSettleFromObject(viewport);
      }}
    />
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
//   ?dev=1           Pose Studio (gizmo W/E/R/Q, T target, Shift snap,
//                    Tab arrow-mode, G grain, arrows nudge, [ ] p nudge)
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
    const damp = 0.1;

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
  });

  return (
    <group ref={stageGroupRef}>
      <group ref={modelGroupRef}>
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
// Main Component — headless canvas, no DOM UI
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
          collapsed={false}
          theme={LEVA_LIGHT}
          titleBar={{ title: "iGlass pose studio" }}
        />
      )}
      {dev && <DevControls initialP={freezeP ?? 0} />}
      <div
        ref={stickyRef}
        style={{
          height: "100vh",
          width: "100vw",
          overflow: "hidden",
        }}
      >
        <Canvas
          camera={{ position: [0, 0, 2.8], fov: 35 }}
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
