import screenImg from "./Screen.png";
import internalsImg from "./internals.jpg";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  ContactShadows,
  useGLTF,
  useTexture,
  Center,
  Resize,
} from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// ============================================
// Utility
// ============================================
function mapRange(value, inMin, inMax, outMin, outMax) {
  const clamped = Math.max(inMin, Math.min(inMax, value));
  if (inMax === inMin) return outMin;
  return outMin + ((clamped - inMin) / (inMax - inMin)) * (outMax - outMin);
}

// ============================================
// Timeline phases (fractions of total scroll progress)
//
//   0.00 – 0.40  EXPLODE      existing stagger maths, remapped into window
//   0.40 – 0.55  HOLD         fully exploded beat
//   0.55 – 0.80  REASSEMBLE   mirror of explode
//   0.80 – 1.00  ROTATE       whole model settles: lying flat → upright,
//                             face-on to camera
//
// Tune the feel by moving these boundaries — nothing else needs touching.
// ============================================
const TIMELINE = {
  explodeEnd: 0.4,
  holdEnd: 0.55,
  reassembleEnd: 0.8,
};

const SETTLE = {
  // Target orientation for the finale, relative to the model's natural axes.
  // The resting pose is Euler [PI/2, 0, -PI/2] (lying flat). [0, 0, 0] is the
  // inferred upright/face-on pose — VERIFY visually on first deploy; if the
  // phone settles facing the wrong way, this single constant is the fix.
 targetEuler: [0, Math.PI, 0],
  // Upright phone is taller than the flat pose is wide — scale down slightly
  // during the rotate so it stays inside the canvas.
  scale: 0.8,
};

// smoothstep — eases the rotate phase so the settle reads as ceremonial
function smoothstep(t) {
  return t * t * (3 - 2 * t);
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
// Mode resolution (contract §5.2 — URL params for static config)
//
//   ?mode=scroll      → listen for postMessage scroll-progress (Framer bridge)
//   ?mode=autoplay    → self-driving explode/reassemble loop (homepage hero)
//   ?mode=standalone  → internal ScrollTrigger (direct-URL testing / Playwright)
//   (no param)        → auto: iframe ⇒ scroll, top window ⇒ standalone
//
//   ?bg=%230a0a0c     → optional opaque background override; default transparent
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
  return { mode, bg };
}

// ============================================
// Default props
// ============================================
const defaultProps = {
  glassHeadline: "Strongest Aftermarket Front Glass",
  glassDescription:
    "Premium replacement glass with factory-grade OCA adhesive—fitted without touching your original display.",
  glassLabel: "Glass",
  oledHeadline: "Genuine Display Preserved",
  oledDescription:
    "Your phone's original OLED stays untouched. No aftermarket swaps. No LCD downgrades.",
  oledLabel: "OLED",
  phoneHeadline: "Your Phone",
  phoneDescription:
    "Everything else—camera, battery, logic board—exactly as it was. We only work on what's broken.",
  phoneLabel: "Phone",
  promptText: "Tap a layer to learn more",
  introText: "Glass-only repair preserves your original display.",
  explodeDistance: 1.2,
  scrollDistance: 4, // standalone runway — matches the 4-phase timeline
  glassStagger: [0, 0.6],
  oledStagger: [0.15, 0.75],
  phoneStagger: [0.3, 0.9],
  accentColor: "rgba(100, 160, 255, 1)",
  textColor: "rgba(255, 255, 255, 0.95)",
  mutedTextColor: "rgba(255, 255, 255, 0.5)",
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
  rotate: 0, // settle rotation amount (0 flat → 1 upright)
};

// ============================================
// iPhone Exploded Model Component
// ============================================
function IPhoneExploded({
  modelPath,
  screenTexture,
  internalsTexture,
  onLayerClick,
  explodeDistance,
}) {
  const { scene } = useGLTF(modelPath);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  const { gl } = useThree();
  const maxAniso = gl.capabilities.getMaxAnisotropy();

  // Screen texture — flipY must be set BEFORE GPU upload
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

  // Internals teardown texture
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
  const modelGroupRef = useRef(); // whole-model group — rotate phase target

  // Rotation endpoints for the settle phase, precomputed once.
  // qStart = the resting pose baked into the JSX ([PI/2, 0, -PI/2]);
  // qEnd   = SETTLE.targetEuler (upright, face-on).
  const { qStart, qEnd } = useMemo(() => {
    const s = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(Math.PI / 2, 0, -Math.PI / 2)
    );
    const e = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(...SETTLE.targetEuler)
    );
    return { qStart: s, qEnd: e };
  }, []);
  const qTarget = useMemo(() => new THREE.Quaternion(), []);

  // ---------------------------------------------------------
  // SORTING: layers by node name.
  // Render order (fixes transparency z-fighting):
  //   Body 0 → OLED 1 → Glass Bezel 2 → Glass Front 3
  // NOTE: the GLB currently contains a duplicated hierarchy
  // (`Body Frame` + `Body Frame.001`, etc). Both copies land in
  // the body bucket — renders correctly but doubles draw calls.
  // Fix at source in the Blender cleanup session, not here.
  // ---------------------------------------------------------
  const { glassMeshes, oledMeshes, bodyMeshes } = useMemo(() => {
    const glass = [];
    const oled = [];
    const body = [];

    clonedScene.traverse((child) => {
      if (child.isMesh) {
        const name = child.name.toLowerCase();

        // GLASS BEZEL — must check BEFORE generic "glass"
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
        }
        // GLASS FRONT — clear window
        else if (
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
        }
        // OLED DISPLAY
        else if (name.includes("display") || name.includes("oled")) {
          // Programmatic UV fix — the GLB's UVs are broken.
          // TEMPORARY: remove once UVs are corrected at source in Blender.
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
        }
        // BODY — everything else
        else {
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
  // ANIMATION: driven by scrollState regardless of which mode
  // is writing to it (bridge / autoplay / internal trigger).
  // lerp smoothing (contract §3.1) — the postMessage bridge has
  // no scrub smoothing, so damping happens here instead.
  // ---------------------------------------------------------
  useFrame(() => {
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

    // ROTATE phase — slerp the whole model between resting and upright
    // poses, damped in quaternion space (same 0.1 baseline as positions).
    if (modelGroupRef.current) {
      qTarget.slerpQuaternions(qStart, qEnd, scrollState.rotate);
      modelGroupRef.current.quaternion.slerp(qTarget, damp);

      const targetScale = 1 - (1 - SETTLE.scale) * scrollState.rotate;
      const s = THREE.MathUtils.lerp(
        modelGroupRef.current.scale.x,
        targetScale,
        damp
      );
      modelGroupRef.current.scale.setScalar(s);
    }
  });

  const isExploded = scrollState.explosion > 0.3;

  return (
    <group onPointerMissed={() => onLayerClick(null)}>
      <group ref={modelGroupRef} rotation={[Math.PI / 2, 0, -Math.PI / 2]}>
        {/* GLASS (Front Window + Bezel) */}
        <group
          ref={glassGroupRef}
          onClick={(e) => {
            e.stopPropagation();
            if (isExploded) onLayerClick("glass");
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            if (isExploded) document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "auto";
          }}
        >
          {glassMeshes.map((m, i) => (
            <primitive key={`glass-${i}`} object={m} />
          ))}
        </group>

        {/* OLED */}
        <group
          ref={oledGroupRef}
          onClick={(e) => {
            e.stopPropagation();
            if (isExploded) onLayerClick("oled");
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            if (isExploded) document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "auto";
          }}
        >
          {oledMeshes.map((m, i) => (
            <primitive key={`oled-${i}`} object={m} />
          ))}
        </group>

        {/* BODY */}
        <group
          ref={bodyGroupRef}
          onClick={(e) => {
            e.stopPropagation();
            if (isExploded) onLayerClick("phone");
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            if (isExploded) document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "auto";
          }}
        >
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
// Scene Component
// ============================================
function Scene({
  modelPath,
  screenTexture,
  internalsTexture,
  onLayerClick,
  explodeDistance,
}) {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow />
      <directionalLight position={[-5, 5, 2]} intensity={0.8} color="#e8f0ff" />
      <pointLight position={[0, 2, 2]} intensity={0.5} color="#4080ff" />

      <Environment preset="studio" />

      <Resize scale={1.6}>
        <Center>
          <IPhoneExploded
            modelPath={modelPath}
            screenTexture={screenTexture}
            internalsTexture={internalsTexture}
            onLayerClick={onLayerClick}
            explodeDistance={explodeDistance}
          />
        </Center>
      </Resize>

      <ContactShadows
        position={[0, -0.7, 0]}
        opacity={0.5}
        scale={5}
        blur={2.5}
      />

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.5}
        minAzimuthAngle={-Math.PI / 3}
        maxAzimuthAngle={Math.PI / 3}
        rotateSpeed={0.5}
      />
    </>
  );
}

// ============================================
// Main Component
// ============================================
export default function CrossSection3DScrollGLB(props) {
  const merged = { ...defaultProps, ...props };
  const {
    glassHeadline,
    glassDescription,
    glassLabel,
    oledHeadline,
    oledDescription,
    oledLabel,
    phoneHeadline,
    phoneDescription,
    phoneLabel,
    promptText,
    introText,
    explodeDistance,
    scrollDistance,
    glassStagger,
    oledStagger,
    phoneStagger,
    accentColor,
    textColor,
    mutedTextColor,
    modelPath,
    screenTexture,
    internalsTexture,
  } = merged;

  // Resolved once per mount — mode & background come from the URL
  const { mode, bg } = useMemo(resolveRuntimeConfig, []);

  const containerRef = useRef(null);
  const stickyRef = useRef(null);

  const [displayProgress, setDisplayProgress] = useState(0);
  const [selectedLayer, setSelectedLayer] = useState(null);
  const [uiExploded, setUiExploded] = useState(false);

  const layers = {
    glass: {
      headline: glassHeadline,
      description: glassDescription,
      label: glassLabel,
    },
    oled: {
      headline: oledHeadline,
      description: oledDescription,
      label: oledLabel,
    },
    phone: {
      headline: phoneHeadline,
      description: phoneDescription,
      label: phoneLabel,
    },
  };

  // ============================================
  // Progress driver — one applyProgress used by all three modes
  // ============================================
  useEffect(() => {
    const applyProgress = (p) => {
      // Phase remap: raw scroll p → explode amount + rotate amount.
      // The existing stagger maths is unchanged — it now receives the
      // remapped explode amount instead of raw p, so the same choreography
      // plays forward (explode) and mirrored (reassemble).
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

      // Info panel state follows the explode amount, not raw scroll —
      // otherwise the panel would stay in "exploded" copy through the
      // reassemble and rotate phases.
      setUiExploded((prev) => {
        const next = explode > 0.5;
        return prev === next ? prev : next;
      });

      // Quantised to 0.5% steps — caps React re-renders at ~200 per
      // full sweep instead of one per scroll tick (C2 Law 3).
      const q = Math.round(p * 200) / 200;
      setDisplayProgress((prev) => (prev === q ? prev : q));
    };

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
      // Handshake — lets the parent confirm the app is listening.
      // Payload is non-sensitive (a readiness flag only).
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
        duration: 7, // covers explode + hold + reassemble + rotate legibly
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
  }, [mode, scrollDistance, glassStagger, oledStagger, phoneStagger]);

  const handleLayerClick = useCallback(
    (layerId) => {
      setSelectedLayer(selectedLayer === layerId ? null : layerId);
    },
    [selectedLayer]
  );

  const isExploded = uiExploded;

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
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          boxSizing: "border-box",
          fontFamily:
            "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
          overflow: "hidden",
        }}
      >
        {/* 3D Canvas */}
        <div
          style={{
            width: "100%",
            maxWidth: 550,
            height: "58vh",
            maxHeight: 600,
            borderRadius: 16,
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
          >
            <Scene
              modelPath={modelPath}
              screenTexture={screenTexture}
              internalsTexture={internalsTexture}
              onLayerClick={handleLayerClick}
              explodeDistance={explodeDistance}
            />
          </Canvas>
        </div>

        {/* Progress indicator */}
        <div
          style={{
            width: "100%",
            maxWidth: 180,
            height: 2,
            background: "rgba(255,255,255,0.1)",
            borderRadius: 1,
            marginTop: 28,
            overflow: "hidden",
          }}
        >
          <motion.div
            style={{
              height: "100%",
              background: accentColor,
              borderRadius: 1,
            }}
            animate={{ width: `${displayProgress * 100}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>

        {/* Info panel */}
        <div
          style={{
            width: "100%",
            maxWidth: 380,
            minHeight: 120,
            textAlign: "center",
            marginTop: 28,
          }}
        >
          <AnimatePresence mode="wait">
            {!isExploded ? (
              <motion.div
                key="intro"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <p
                  style={{
                    color: mutedTextColor,
                    fontSize: 15,
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {introText}
                </p>
                {mode !== "autoplay" && (
                  <p
                    style={{
                      color: "rgba(255,255,255,0.3)",
                      fontSize: 12,
                      marginTop: 16,
                    }}
                  >
                    Scroll to explore
                  </p>
                )}
              </motion.div>
            ) : selectedLayer ? (
              <motion.div
                key={selectedLayer}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <span
                  style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    background: "rgba(100,160,255,0.15)",
                    borderRadius: 4,
                    color: accentColor,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 12,
                  }}
                >
                  {layers[selectedLayer].label}
                </span>
                <h3
                  style={{
                    color: textColor,
                    fontSize: 20,
                    fontWeight: 600,
                    margin: "0 0 12px 0",
                  }}
                >
                  {layers[selectedLayer].headline}
                </h3>
                <p
                  style={{
                    color: mutedTextColor,
                    fontSize: 15,
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {layers[selectedLayer].description}
                </p>
              </motion.div>
            ) : (
              <motion.p
                key="prompt"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{
                  color: mutedTextColor,
                  fontSize: 15,
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {promptText}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <p
          style={{
            color: mutedTextColor,
            fontSize: 11,
            marginTop: 20,
            opacity: 0.4,
          }}
        >
          Drag to rotate
        </p>
      </div>
    </div>
  );
}

useGLTF.preload(defaultProps.modelPath);
useTexture.preload(defaultProps.screenTexture);
useTexture.preload(defaultProps.internalsTexture);
