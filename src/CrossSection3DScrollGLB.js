import screenImg from "./Screen.png";
import internalsImg from "./internals.jpg";
import { useRef, useMemo, useEffect, useLayoutEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, ContactShadows, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// ============================================
// v2 — HEADLESS PRESENTATION LAYER
//
// All DOM UI (info panels, progress bar, prompts) removed — Framer owns
// every text layer. All pointer interactivity (OrbitControls, layer
// clicks, hover cursors) removed — the model is driven exclusively by
// scroll progress. Drei <Center>/<Resize> replaced by a measured pivot
// (Box3 at mount) so the settle rotation spins on the phone's true
// geometric centre instead of the GLB origin.
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
//   0.70 – 1.00  SETTLE       two-stage rotation to upright face-on,
//                             desktop drifts right to the rest slot
// ============================================
const TIMELINE = {
  explodeEnd: 0.35,
  holdEnd: 0.45,
  reassembleEnd: 0.7,
};

const SETTLE = {
  // Final pose. [0, PI, 0] = upright portrait, front face to camera
  // (validated visually). Overridable for tuning: ?settle=x,y,z (degrees)
  targetEuler: [0, Math.PI, 0],
  // Waypoint roll: the mid pose is the final pose rolled 90° in the view
  // plane (landscape, facing camera). Stage 1 tilts flat→facing, stage 2
  // cartwheels in-plane to portrait. Overridable: ?roll=deg (default -90)
  midRoll: -Math.PI / 2,
  midPoint: 0.45, // fraction of the settle phase spent in stage 1
  scale: 0.8, // upright phone scales down to stay inside the frame
  xShiftFraction: 0.22, // desktop rest slot: fraction of viewport width
  desktopMinWidth: 810, // px — below this, no drift (mobile stays centred)
};

const MODEL = {
  targetSize: 1.6, // world units — largest model dimension after fit
};

// ============================================
// Mode & tuning resolution (contract §5.2 — URL params for static config)
//
//   ?mode=scroll|autoplay|standalone   (unchanged tri-mode driver)
//   ?bg=%230a0a0c                      opaque background; default transparent
//   ?p=0.85          freeze the timeline at a fixed progress (tuning)
//   ?settle=0,180,0  override SETTLE.targetEuler, degrees (tuning)
//   ?roll=-90        override SETTLE.midRoll, degrees (tuning)
//   ?size=1.6        override MODEL.targetSize (tuning)
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
  const rollParam = parseFloat(params.get("roll"));
  if (!isNaN(rollParam)) {
    SETTLE.midRoll = (rollParam * Math.PI) / 180;
  }
  const sizeParam = parseFloat(params.get("size"));
  if (!isNaN(sizeParam) && sizeParam > 0) {
    MODEL.targetSize = sizeParam;
  }
  const pParam = parseFloat(params.get("p"));
  const freezeP = !isNaN(pParam) ? Math.max(0, Math.min(1, pParam)) : null;

  return { mode, bg, freezeP };
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

  // ---------------------------------------------------------
  // SORTING: layers by node name (unchanged from v1).
  // Render order: Body 0 → OLED 1 → Glass Bezel 2 → Glass Front 3
  // NOTE: GLB duplicated hierarchy still pending Blender cleanup.
  // Anisotropy is applied per-texture inside <Canvas> children via
  // renderer caps at material creation below.
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
            color: new THREE.Color(0x0a0a0a),
            roughness: 0.4,
            metalness: 0.0,
            transparent: false,
            depthWrite: true,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
          });
          child.renderOrder = 2;
          glass.push(child);
        } else if (
          name.includes("glass_front") ||
          name.includes("glass front") ||
          (name.includes("glass") && !name.includes("bezel"))
        ) {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xffffff),
            roughness: 0.0,
            metalness: 0.0,
            transparent: true,
            opacity: 0.15,
            depthWrite: false,
            envMapIntensity: 2.0,
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
              const u = (posAttr.getX(i) - minX) / rangeX;
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
          child.material.transparent = false;
          child.material.depthWrite = true;
          child.renderOrder = 0;

          const mat = child.material;
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
  // MEASURED PIVOT (replaces Drei <Center>/<Resize>).
  // Measured AFTER mount on the RENDERED subtree — <primitive> strips
  // the GLB's ancestor transforms, so measuring the source scene graph
  // gives a different coordinate frame than what renders (v2.0 bug:
  // size off by the GLB's ancestor scale, pivot off-centre).
  // Rest rotation is axis-aligned (90° multiples), so the world-space
  // box's max dimension is exact, and worldToLocal is exact for the
  // centre point. One-time measurement; explode offsets are 0 at mount.
  // ---------------------------------------------------------
  const pivotRef = useRef();
  const measuredRef = useRef(false);

  useLayoutEffect(() => {
    const g = pivotRef.current;
    if (measuredRef.current || !g) return;
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
    g.scale.setScalar(s);
    g.position.set(-cLocal.x * s, -cLocal.y * s, -cLocal.z * s);
    measuredRef.current = true;
  }, []);

  // ---------------------------------------------------------
  // SETTLE rotation endpoints + waypoint (two-stage slerp).
  // qStart = flat rest pose. qEnd = upright face-on. qMid = qEnd rolled
  // 90° about its local view axis — landscape but already facing camera.
  // Stage 1 (flat → qMid) tilts up; stage 2 (qMid → qEnd) is a clean
  // in-plane cartwheel to portrait. No shortest-arc corkscrew.
  // ---------------------------------------------------------
  const { qStart, qMid, qEnd } = useMemo(() => {
    const start = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(Math.PI / 2, 0, -Math.PI / 2)
    );
    const end = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(...SETTLE.targetEuler)
    );
    const roll = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      SETTLE.midRoll
    );
    const mid = end.clone().multiply(roll);
    return { qStart: start, qMid: mid, qEnd: end };
  }, []);
  const qTarget = useMemo(() => new THREE.Quaternion(), []);

  // ---------------------------------------------------------
  // ANIMATION: driven by scrollState regardless of the writing mode.
  // lerp smoothing (contract §3.1) — damping lives here.
  // ---------------------------------------------------------
  useFrame((state) => {
    const damp = 0.1;

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

    if (modelGroupRef.current) {
      const t = scrollState.rotate;

      // Two-stage slerp through the view-plane waypoint
      if (t < SETTLE.midPoint) {
        qTarget.slerpQuaternions(qStart, qMid, t / SETTLE.midPoint);
      } else {
        qTarget.slerpQuaternions(
          qMid,
          qEnd,
          (t - SETTLE.midPoint) / (1 - SETTLE.midPoint)
        );
      }
      modelGroupRef.current.quaternion.slerp(qTarget, damp);

      // Settle scale-down
      const targetScale = 1 - (1 - SETTLE.scale) * t;
      const s = THREE.MathUtils.lerp(
        modelGroupRef.current.scale.x,
        targetScale,
        damp
      );
      modelGroupRef.current.scale.setScalar(s);

      // Desktop-only drift to the right-hand rest slot
      const isDesktop = state.size.width >= SETTLE.desktopMinWidth;
      const targetX = isDesktop
        ? state.viewport.width * SETTLE.xShiftFraction * t
        : 0;
      modelGroupRef.current.position.x = THREE.MathUtils.lerp(
        modelGroupRef.current.position.x,
        targetX,
        damp
      );
    }
  });

  return (
    <group ref={modelGroupRef} rotation={[Math.PI / 2, 0, -Math.PI / 2]}>
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

  const { mode, bg, freezeP } = useMemo(resolveRuntimeConfig, []);

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

    // ---- TUNING FREEZE: ?p=0.85 pins the timeline at fixed progress ----
    if (freezeP !== null) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
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
          }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.NoToneMapping;
            gl.setClearColor(0x000000, 0); // fully transparent clear
          }}
          style={{ width: "100%", height: "100%" }}
        >
          <Scene
            modelPath={modelPath}
            screenTexture={screenTexture}
            internalsTexture={internalsTexture}
            explodeDistance={explodeDistance}
          />
        </Canvas>
      </div>
    </div>
  );
}

useGLTF.preload(defaultProps.modelPath);
useTexture.preload(defaultProps.screenTexture);
useTexture.preload(defaultProps.internalsTexture);
