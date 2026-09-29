import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import {
  ACESFilmicToneMapping,
  Box3,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  SRGBColorSpace,
  Vector3,
  type Material,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { SceneViewProps } from "./contracts";
import { num, str, type Props } from "./model";
import "./scene.css";

const DEFAULT_MODEL = "/assets/14_pro_oled_repaired.glb";
const finite = (values: Props, key: string, fallback: number) => {
  const value = num(values, key, fallback);
  return Number.isFinite(value) ? value : fallback;
};
const bounded = (
  values: Props,
  key: string,
  fallback: number,
  min: number,
  max: number,
) => MathUtils.clamp(finite(values, key, fallback), min, max);

let webglSupport: boolean | undefined;
function canRenderWebGL(): boolean {
  if (webglSupport !== undefined) return webglSupport;
  if (typeof document === "undefined") return false;
  const canvas = document.createElement("canvas");
  try {
    const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
    webglSupport = !!context;
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

interface BoundaryProps {
  children: ReactNode;
  onError: (message: string) => void;
  onRetry: () => void;
}
class SceneBoundary extends Component<BoundaryProps, { error?: string }> {
  state: { error?: string } = {};
  static getDerivedStateFromError(error: unknown) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "The model could not be rendered.",
    };
  }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onError(error.message);
  }
  render() {
    if (this.state.error)
      return (
        <div className="scene-status scene-status-error" role="alert">
          <strong>3D scene unavailable</strong>
          <span>{this.state.error}</span>
          <button type="button" onClick={this.props.onRetry}>
            Retry model
          </button>
        </div>
      );
    return this.props.children;
  }
}

function Loading({ report }: { report: (message: string) => void }) {
  useEffect(() => {
    report("Loading 3D model…");
  }, [report]);
  return null;
}

function RendererSetup({
  values,
  onContext,
}: {
  values: Props;
  onContext: (message: string | null) => void;
}) {
  const { camera, gl, scene, invalidate } = useThree();
  const fov = bounded(values, "fov", 35, 10, 100);
  const cameraZ = bounded(values, "cameraZ", 5, 0.2, 100);
  const exposure = bounded(values, "exposure", 1, 0, 10);

  useEffect(() => {
    const perspective = camera as PerspectiveCamera;
    perspective.position.set(0, 0, cameraZ);
    perspective.lookAt(0, 0, 0);
    perspective.fov = fov;
    perspective.near = 0.01;
    perspective.far = 1000;
    perspective.updateProjectionMatrix();
    gl.toneMappingExposure = exposure;
    invalidate();
  }, [camera, gl, cameraZ, fov, exposure, invalidate]);

  useEffect(() => {
    // Real image-based reflections, generated locally; no external HDR dependency.
    const room = new RoomEnvironment(gl);
    const pmrem = new PMREMGenerator(gl);
    const target = pmrem.fromScene(room, 0.04);
    const priorEnvironment = scene.environment;
    scene.environment = target.texture;
    room.dispose();
    pmrem.dispose();
    invalidate();
    return () => {
      if (scene.environment === target.texture)
        scene.environment = priorEnvironment;
      target.dispose();
    };
  }, [gl, scene, invalidate]);

  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => {
      event.preventDefault();
      onContext("WebGL context lost. Restore the tab or retry the model.");
    };
    const restored = () => {
      onContext(null);
      invalidate();
    };
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
    };
  }, [gl, invalidate, onContext]);
  return null;
}

function Product({
  url,
  values,
  report,
}: {
  url: string;
  values: Props;
  report: (message: string) => void;
}) {
  const gltf = useLoader(GLTFLoader, url);
  const { size, invalidate } = useThree();
  const aspect = Math.max(0.1, size.width / Math.max(1, size.height));
  const product = useMemo(() => {
    // The loader cache owns textures and geometry. Each instance owns its cloned
    // material state, so changing a Take cannot change another preview.
    const object = cloneSkeleton(gltf.scene);
    const materials: {
      material: MeshStandardMaterial;
      roughness: number;
      metalness: number;
    }[] = [];
    const clones: Material[] = [];
    let meshCount = 0;
    object.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      meshCount++;
      const cloneMaterial = (original: Material) => {
        const material = original.clone();
        clones.push(material);
        if (material instanceof MeshStandardMaterial)
          materials.push({
            material,
            roughness: material.roughness,
            metalness: material.metalness,
          });
        return material;
      };
      node.material = Array.isArray(node.material)
        ? node.material.map(cloneMaterial)
        : cloneMaterial(node.material);
    });
    object.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(object);
    const dimensions = bounds.getSize(new Vector3());
    if (
      bounds.isEmpty() ||
      !Number.isFinite(dimensions.length()) ||
      dimensions.length() === 0
    ) {
      clones.forEach((material) => material.dispose());
      throw new Error("The GLB contains no visible geometry.");
    }
    return {
      object,
      dimensions,
      center: bounds.getCenter(new Vector3()),
      materials,
      clones,
      meshCount,
    };
  }, [gltf]);

  useEffect(
    () => () => {
      product.clones.forEach((material) => material.dispose());
    },
    [product],
  );
  useEffect(() => {
    report(`Ready · ${product.meshCount} meshes`);
    invalidate();
  }, [product, report, invalidate]);

  const roughness =
    typeof values.roughness === "number"
      ? bounded(values, "roughness", 0.45, 0, 1)
      : undefined;
  const metalness =
    typeof values.metalness === "number"
      ? bounded(values, "metalness", 0.3, 0, 1)
      : undefined;
  useEffect(() => {
    for (const entry of product.materials) {
      entry.material.roughness = roughness ?? entry.roughness;
      entry.material.metalness = metalness ?? entry.metalness;
    }
    invalidate();
  }, [product, roughness, metalness, invalidate]);

  // A stable 2.6-unit fit leaves breathing room at the default camera. Camera,
  // FOV and scale remain creative controls rather than being auto-corrected.
  const fit =
    2.6 /
    Math.max(
      product.dimensions.y,
      product.dimensions.x / aspect,
      product.dimensions.z,
      0.000001,
    );
  const rotation: [number, number, number] = [
    "rotateX",
    "rotateY",
    "rotateZ",
  ].map((key) => MathUtils.degToRad(finite(values, key, 0))) as [
    number,
    number,
    number,
  ];
  const offset: [number, number, number] = [
    "offsetX",
    "offsetY",
    "offsetZ",
  ].map((key) => finite(values, key, 0)) as [number, number, number];
  return (
    <group
      position={offset}
      rotation={rotation}
      scale={bounded(values, "scale", 1, 0.001, 100)}
    >
      <group scale={fit}>
        <group
          position={[-product.center.x, -product.center.y, -product.center.z]}
        >
          <primitive object={product.object} dispose={null} />
        </group>
      </group>
    </group>
  );
}

export function SceneView({
  entity,
  values,
  interactive = false,
  onChange,
  onStatus,
}: SceneViewProps) {
  const url = str(values, "modelUrl", DEFAULT_MODEL) || DEFAULT_MODEL;
  const enabled = values.visible !== false && values.active !== false;
  const [status, setStatus] = useState("Loading 3D model…");
  const [contextError, setContextError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [dragValues, setDragValues] = useState<Props | null>(null);
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    rotateX: number;
    rotateY: number;
    patch: Props;
  } | null>(null);
  const statusCallback = useRef(onStatus);
  statusCallback.current = onStatus;
  const report = useCallback((message: string) => {
    setStatus(message);
    statusCallback.current?.(message);
  }, []);
  const reportContext = useCallback(
    (message: string | null) => {
      setContextError(message);
      if (message) report(message);
      else report("Ready");
    },
    [report],
  );
  const available = canRenderWebGL();
  const canDrag = interactive && !!onChange;
  const effectiveValues = dragValues ? { ...values, ...dragValues } : values;

  useEffect(() => {
    drag.current = null;
    setDragValues(null);
    setContextError(null);
    if (!enabled) report("3D preview paused");
    else if (!available) report("WebGL is unavailable in this browser.");
  }, [url, enabled, available, attempt, report]);

  const retry = useCallback(() => {
    useLoader.clear(GLTFLoader, url);
    setAttempt((value) => value + 1);
  }, [url]);
  if (!enabled) return null;
  if (!available)
    return (
      <div className="scene-view">
        <div className="scene-status scene-status-error" role="status">
          <strong>3D preview unavailable</strong>
          <span>
            This browser does not provide WebGL. The composition still retains
            the model and its settings.
          </span>
        </div>
      </div>
    );

  return (
    <div
      className={`scene-view${canDrag ? " scene-interactive" : ""}`}
      aria-label={`${entity.name} 3D preview`}
      tabIndex={canDrag ? 0 : undefined}
      onPointerDown={(event) => {
        if (!canDrag || event.button !== 0 || drag.current) return;
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          rotateX: finite(values, "rotateX", 0),
          rotateY: finite(values, "rotateY", 0),
          patch: {},
        };
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start || start.pointerId !== event.pointerId) return;
        event.stopPropagation();
        start.patch = {
          rotateX: start.rotateX + (event.clientY - start.y) * 0.4,
          rotateY: start.rotateY + (event.clientX - start.x) * 0.4,
        };
        setDragValues(start.patch);
      }}
      onPointerUp={(event) => {
        const start = drag.current;
        if (!start || start.pointerId !== event.pointerId) return;
        event.stopPropagation();
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        if (Object.keys(start.patch).length) onChange?.(start.patch);
        setDragValues(null);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setDragValues(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          drag.current = null;
          setDragValues(null);
          return;
        }
        if (
          !canDrag ||
          !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
            event.key,
          )
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        const delta = event.shiftKey ? 15 : 5;
        const horizontal =
          event.key === "ArrowLeft" || event.key === "ArrowRight";
        const property = horizontal ? "rotateY" : "rotateX";
        const direction =
          event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
        onChange?.({
          [property]: finite(values, property, 0) + delta * direction,
        });
      }}
    >
      <SceneBoundary key={`${url}:${attempt}`} onError={report} onRetry={retry}>
        <Canvas
          frameloop="demand"
          dpr={[1, 1.75]}
          camera={{ position: [0, 0, 5], fov: 35, near: 0.01, far: 1000 }}
          gl={{
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: true,
            powerPreference: "high-performance",
          }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
            gl.toneMapping = ACESFilmicToneMapping;
            gl.outputColorSpace = SRGBColorSpace;
          }}
          fallback={
            <div className="scene-status scene-status-error">
              WebGL could not start.
            </div>
          }
        >
          <RendererSetup values={effectiveValues} onContext={reportContext} />
          <ambientLight
            intensity={bounded(effectiveValues, "ambient", 1.5, 0, 20)}
          />
          <directionalLight
            position={[
              finite(effectiveValues, "lightX", 4),
              finite(effectiveValues, "lightY", 5),
              5,
            ]}
            intensity={bounded(effectiveValues, "key", 3, 0, 40)}
          />
          <Suspense fallback={<Loading report={report} />}>
            <Product url={url} values={effectiveValues} report={report} />
          </Suspense>
        </Canvas>
        {status.startsWith("Loading") && (
          <div className="scene-status" role="status">
            <span className="scene-loader" />
            <span>Loading original model</span>
          </div>
        )}
        {contextError && (
          <div className="scene-status scene-status-error" role="alert">
            <span>{contextError}</span>
            <button type="button" onClick={retry}>
              Retry model
            </button>
          </div>
        )}
        {canDrag && !contextError && status.startsWith("Ready") && (
          <span className="scene-drag-hint">
            Drag to rotate · arrows for precision
          </span>
        )}
      </SceneBoundary>
    </div>
  );
}

export default SceneView;
