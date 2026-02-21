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

// ============================================
// Utility
// ============================================
function mapRange(value, inMin, inMax, outMin, outMax) {
  const clamped = Math.max(inMin, Math.min(inMax, value));
  if (inMax === inMin) return outMin;
  return outMin + ((clamped - inMin) / (inMax - inMin)) * (outMax - outMin);
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
  scrollDistance: 2,
  glassStagger: [0, 0.6],
  oledStagger: [0.15, 0.75],
  phoneStagger: [0.3, 0.9],
  accentColor: "rgba(100, 160, 255, 1)",
  backgroundColor: "#0a0a0c",
  textColor: "rgba(255, 255, 255, 0.95)",
  mutedTextColor: "rgba(255, 255, 255, 0.5)",
  modelPath: "/14_Pro_Model.glb",
  screenTexture: screenImg,
  internalsTexture: internalsImg,
};

// ============================================
// Global scroll progress (updated by GSAP, read by useFrame)
// ============================================
const scrollState = {
  explosion: 0,
  glassOffset: 0,
  oledOffset: 0,
  phoneOffset: 0,
};

// ============================================
// iPhone Exploded Model Component
// ============================================
function IPhoneExploded({
  modelPath,
  screenTexture,
  internalsTexture,
  selectedLayer,
  onLayerClick,
  explodeDistance,
}) {
  const { scene } = useGLTF(modelPath);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  const { gl } = useThree();
  const maxAniso = gl.capabilities.getMaxAnisotropy();

  // Load screen texture — must set flipY BEFORE GPU upload
  const oledTexture = useTexture(screenTexture);
  oledTexture.flipY = false;
  oledTexture.colorSpace = THREE.SRGBColorSpace;
  oledTexture.generateMipmaps = true;
  oledTexture.minFilter = THREE.LinearMipmapLinearFilter; // trilinear
  oledTexture.magFilter = THREE.LinearFilter;
  oledTexture.anisotropy = maxAniso;
  oledTexture.wrapS = THREE.ClampToEdgeWrapping;
  oledTexture.wrapT = THREE.ClampToEdgeWrapping;
  oledTexture.needsUpdate = true;

  // Load internals teardown texture
  const internTex = useTexture(internalsTexture);
  internTex.colorSpace = THREE.SRGBColorSpace;
  internTex.generateMipmaps = true;
  internTex.minFilter = THREE.LinearMipmapLinearFilter; // trilinear
  internTex.magFilter = THREE.LinearFilter;
  internTex.anisotropy = maxAniso;
  internTex.wrapS = THREE.ClampToEdgeWrapping;
  internTex.wrapT = THREE.ClampToEdgeWrapping;
  internTex.needsUpdate = true;

  // Debug: verify what the GPU actually received
  useEffect(() => {
    if (oledTexture?.image) {
      console.log(
        "OLED texture:",
        oledTexture.image.width,
        "x",
        oledTexture.image.height
      );
    }
    if (internTex?.image) {
      console.log(
        "Internals texture:",
        internTex.image.width,
        "x",
        internTex.image.height
      );
    }
    console.log("GPU maxTextureSize:", gl.capabilities.maxTextureSize);
    console.log("GPU maxAnisotropy:", maxAniso);
  }, [oledTexture, internTex, gl, maxAniso]);

  // Rounded rect geometry for internals plane (memoized)
  const internalsGeo = useMemo(() => {
    const w = 7.0; // slightly inset from OLED width (7.54)
    const h = 15.2; // slightly inset from OLED height (15.92)
    const r = 0.8; // corner radius
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

    // Compute proper 0→1 UVs from vertex positions
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

  // ---------------------------------------------------------
  // SORTING: Separate meshes into layers by node name
  // Structure:
  //   Glass_Front (clear window) + Glass_Bezel (black border) → glass layer
  //   Display_OLED → oled layer
  //   Body Frame → body layer
  //
  // RENDER ORDER (fixes transparency z-fighting):
  //   Body: 0 (drawn first, at back)
  //   OLED: 1 (drawn second)
  //   Glass Bezel: 2 (drawn third)
  //   Glass Front: 3 (drawn last, on top)
  // ---------------------------------------------------------
  const { glassMeshes, oledMeshes, bodyMeshes } = useMemo(() => {
    const glass = [];
    const oled = [];
    const body = [];

    clonedScene.traverse((child) => {
      if (child.isMesh) {
        const name = child.name.toLowerCase();
        const parentName = child.parent?.name?.toLowerCase() || "";

        // Log for debugging
        console.log("Found mesh:", child.name, "| Parent:", child.parent?.name);

        // GLASS BEZEL — Black border (must check BEFORE generic "glass")
        if (name.includes("bezel") || name.includes("glass_bezel")) {
          console.log("✅ GLASS BEZEL:", child.name);
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
        // GLASS FRONT — Clear window
        else if (
          name.includes("glass_front") ||
          name.includes("glass front") ||
          (name.includes("glass") && !name.includes("bezel"))
        ) {
          console.log("✅ GLASS FRONT:", child.name);
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
          console.log("✅ OLED:", child.name);

          // --- Programmatic UV fix ---
          // The GLB's UVs are broken (75% of vertices crammed into bottom 5% of texture).
          // Fix: compute fresh UVs from vertex positions.
          // X maps to U (width), Y maps to V (height). Z is flat (screen surface).
          const posAttr = child.geometry.attributes.position;
          const uvAttr = child.geometry.attributes.uv;

          if (posAttr && uvAttr) {
            // Find bounding box of the mesh
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

            // Overwrite UVs: normalise position → 0..1
            for (let i = 0; i < posAttr.count; i++) {
              const u = (posAttr.getX(i) - minX) / rangeX;
              const v = 1.0 - (posAttr.getY(i) - minY) / rangeY; // flip V so top of screen = top of image
              uvAttr.setXY(i, u, v);
            }
            uvAttr.needsUpdate = true;

            console.log(
              "  UV REMAPPED from positions:",
              `X[${minX.toFixed(2)}→${maxX.toFixed(2)}]`,
              `Y[${minY.toFixed(2)}→${maxY.toFixed(2)}]`
            );
          }

          child.material = new THREE.MeshBasicMaterial({
            map: oledTexture,
            toneMapped: false,
          });
          child.renderOrder = 1;
          oled.push(child);
        }
        // BODY — Everything else
        else {
          child.material = child.material.clone();
          child.material.transparent = false;
          child.material.depthWrite = true;
          child.renderOrder = 0;

          // Sharpen all body textures
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

    console.log(
      `=== FINAL COUNT: Glass=${glass.length}, OLED=${oled.length}, Body=${body.length} ===`
    );
    return { glassMeshes: glass, oledMeshes: oled, bodyMeshes: body };
  }, [clonedScene, oledTexture, maxAniso]);

  // ---------------------------------------------------------
  // ANIMATION: Scroll-driven explosion
  // ---------------------------------------------------------
  useFrame(() => {
    const glassP = scrollState.glassOffset;
    const oledP = scrollState.oledOffset;

    // Direct position from scroll — GSAP scrub already smooths the input
    if (glassGroupRef.current) {
      glassGroupRef.current.position.z = -(glassP * explodeDistance * 2.0);
    }

    if (oledGroupRef.current) {
      oledGroupRef.current.position.z = -(oledP * explodeDistance * 1.0);

      // Glow intensity based on selection (adjust opacity for MeshBasicMaterial)
      oledMeshes.forEach((mesh) => {
        // MeshBasicMaterial is unlit — no emissive to animate
        // Could add subtle opacity shift here if desired later
      });
    }

    // BODY: Stays anchored
    if (bodyGroupRef.current) {
      bodyGroupRef.current.position.z = 0;
    }
  });

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------
  const isExploded = scrollState.explosion > 0.3;

  return (
    <group onPointerMissed={() => onLayerClick(null)}>
      <group rotation={[Math.PI / 2, 0, -Math.PI / 2]}>
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
          {/* Bezel meshes — standard material */}
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

          {/* Internals teardown texture — rounded rect matching body opening */}
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
  selectedLayer,
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
            selectedLayer={selectedLayer}
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
    backgroundColor,
    textColor,
    mutedTextColor,
    modelPath,
    screenTexture,
    internalsTexture,
  } = merged;

  const containerRef = useRef(null);
  const stickyRef = useRef(null);

  const [displayProgress, setDisplayProgress] = useState(0);
  const [selectedLayer, setSelectedLayer] = useState(null);

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
  // GSAP ScrollTrigger
  // ============================================
  useEffect(() => {
  const handleMessage = (event) => {
    if (event.data?.type === "SCROLL_PROGRESS") {
      const p = event.data.progress;

      scrollState.explosion = p;
      scrollState.glassOffset = mapRange(p, glassStagger[0], glassStagger[1], 0, 1);
      scrollState.oledOffset = mapRange(p, oledStagger[0], oledStagger[1], 0, 1);
      scrollState.phoneOffset = mapRange(p, phoneStagger[0], phoneStagger[1], 0, 1);

      setDisplayProgress(p);
    }
  };

  window.addEventListener("message", handleMessage);
  return () => window.removeEventListener("message", handleMessage);
}, [glassStagger, oledStagger, phoneStagger]);

  const handleLayerClick = useCallback(
    (layerId) => {
      setSelectedLayer(selectedLayer === layerId ? null : layerId);
    },
    [selectedLayer]
  );

  const isExploded = displayProgress > 0.5;

  return (
    <div
      ref={containerRef}
      style={{
        height: `100vh`,
        background: backgroundColor,
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
            gl={{ antialias: true, powerPreference: "high-performance" }}
            onCreated={({ gl }) => {
              gl.toneMapping = THREE.NoToneMapping;
            }}
          >
            <Scene
              modelPath={modelPath}
              screenTexture={screenTexture}
              internalsTexture={internalsTexture}
              selectedLayer={selectedLayer}
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
                <p
                  style={{
                    color: "rgba(255,255,255,0.3)",
                    fontSize: 12,
                    marginTop: 16,
                  }}
                >
                  Scroll to explore
                </p>
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



