import {
  Component,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import {
  Box3,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  Vector3,
  type Object3D,
  type Material,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { num, str, type Props } from "../model";
import type { Bounds } from "./types";
export interface Projection {
  bounds: Bounds;
  pin: { x: number; y: number; visible: boolean };
  meshes: string[];
}
interface SceneProps {
  values: Props;
  onProjection: (p: Projection) => void;
  onPick?: (p: Props) => void;
  onReady?: () => void;
}
class Boundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: "" };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    return this.state.error ? (
      <div className="vi-scene-error">
        Model unavailable
        <br />
        {this.state.error}
      </div>
    ) : (
      this.props.children
    );
  }
}
function Setup({ p }: { p: Props }) {
  const { camera, scene, gl, invalidate } = useThree();
  useLayoutEffect(() => {
    const c = camera as PerspectiveCamera,
      z = num(p, "cameraZ", 5),
      yaw = (num(p, "cameraYaw") * Math.PI) / 180;
    c.position.set(
      z * Math.sin(yaw),
      num(p, "cameraPitch") * 0.02,
      z * Math.cos(yaw),
    );
    c.lookAt(0, 0, 0);
    c.fov = num(p, "fov", 35);
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
    invalidate();
  }, [camera, invalidate, p]);
  useEffect(() => {
    const room = new RoomEnvironment(gl),
      pm = new PMREMGenerator(gl),
      env = pm.fromScene(room, 0.04);
    scene.environment = env.texture;
    room.dispose();
    pm.dispose();
    invalidate();
    return () => {
      scene.environment = null;
      env.dispose();
    };
  }, [gl, scene, invalidate]);
  return (
    <>
      <ambientLight intensity={num(p, "ambient", 1.4)} />
      <directionalLight
        position={[num(p, "lightX", 4), num(p, "lightY", 5), 5]}
        intensity={num(p, "key", 4)}
      />
      <directionalLight position={[-4, 1, -3]} intensity={2} color="#b4c8e2" />
    </>
  );
}
function Projector({
  root,
  p,
  onProjection,
  meshes,
}: {
  root: React.RefObject<Group>;
  p: Props;
  onProjection: SceneProps["onProjection"];
  meshes: string[];
}) {
  const { camera, size, invalidate } = useThree();
  useLayoutEffect(() => {
    const g = root.current;
    if (!g) return;
    g.updateWorldMatrix(true, true);
    camera.updateMatrixWorld();
    const box = new Box3().setFromObject(g),
      min = new Vector3(Infinity, Infinity, 0),
      max = new Vector3(-Infinity, -Infinity, 0);
    if (box.isEmpty()) return;
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          const v = new Vector3(x, y, z).project(camera);
          min.x = Math.min(min.x, ((v.x + 1) * size.width) / 2);
          min.y = Math.min(min.y, ((1 - v.y) * size.height) / 2);
          max.x = Math.max(max.x, ((v.x + 1) * size.width) / 2);
          max.y = Math.max(max.y, ((1 - v.y) * size.height) / 2);
        }
    const point = new Vector3(
      num(p, "hotspotX"),
      num(p, "hotspotY", 0.5),
      num(p, "hotspotZ", 0.15),
    );
    const named = str(p, "hotspotMesh");
    const anchor = named ? g.getObjectByName(named) : g;
    (anchor ?? g).localToWorld(point);
    point.project(camera);
    onProjection({
      bounds: {
        x: min.x,
        y: min.y,
        width: max.x - min.x,
        height: max.y - min.y,
      },
      pin: {
        x: ((point.x + 1) * size.width) / 2,
        y: ((1 - point.y) * size.height) / 2,
        visible:
          point.z >= -1 &&
          point.z <= 1 &&
          Math.abs(point.x) < 1.3 &&
          Math.abs(point.y) < 1.3,
      },
      meshes,
    });
    invalidate();
  }, [
    root,
    p,
    camera,
    size.width,
    size.height,
    onProjection,
    meshes,
    invalidate,
  ]);
  return null;
}
const rad = (p: Props, k: string) => (num(p, k) * Math.PI) / 180;
function Model({ values: p, onProjection, onPick, onReady }: SceneProps) {
  const gltf = useLoader(
    GLTFLoader,
    str(p, "modelUrl", "/assets/14_pro_oled_repaired.glb"),
  );
  const root = useRef<Group>(null);
  const product = useMemo(() => {
    const object = skeletonClone(gltf.scene),
      materials: {
        m: MeshStandardMaterial;
        rough: number;
        metal: number;
        opacity: number;
        transparent: boolean;
      }[] = [],
      parts: { node: Object3D; position: Vector3; rotation: Vector3 }[] = [],
      wires: Mesh[] = [];
    object.traverse((node) => {
      if (node instanceof Mesh) {
        const list = (
          Array.isArray(node.material) ? node.material : [node.material]
        ).map((m: Material) => {
          const c = m.clone() as MeshStandardMaterial;
          materials.push({
            m: c,
            rough: c.roughness,
            metal: c.metalness,
            opacity: c.opacity,
            transparent: c.transparent,
          });
          return c;
        });
        node.material = Array.isArray(node.material) ? list : list[0];
        parts.push({
          node,
          position: node.position.clone(),
          rotation: new Vector3(
            node.rotation.x,
            node.rotation.y,
            node.rotation.z,
          ),
        });
      }
    });
    for (const part of parts) {
      const mesh = part.node as Mesh;
      const wire = new Mesh(
        mesh.geometry,
        new MeshStandardMaterial({
          color: "#c4ab70",
          wireframe: true,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      wire.name = "wire-overlay";
      mesh.add(wire);
      wires.push(wire);
    }
    const box = new Box3().setFromObject(object),
      size = box.getSize(new Vector3()),
      center = box.getCenter(new Vector3());
    return {
      object,
      materials,
      parts,
      wires,
      center,
      fit: 2.6 / Math.max(size.y, size.x, size.z),
      names: parts.map((x) => x.node.name),
    };
  }, [gltf]);
  useLayoutEffect(() => {
    const solid = num(p, "solid", 1);
    for (const { m, rough, metal, opacity, transparent } of product.materials) {
      m.roughness =
        typeof p.roughness === "number" ? num(p, "roughness") : rough;
      m.metalness =
        typeof p.metalness === "number" ? num(p, "metalness") : metal;
      m.opacity = opacity * solid;
      m.transparent = solid < 1 || transparent;
      m.needsUpdate = true;
    }
    for (const w of product.wires)
      (w.material as MeshStandardMaterial).opacity = 1 - solid;
    const name = str(
      p,
      "partName",
      product.names[Math.round(num(p, "partIndex", 2))] ?? "",
    );
    for (const part of product.parts) {
      part.node.position.copy(part.position);
      part.node.rotation.set(part.rotation.x, part.rotation.y, part.rotation.z);
      if (part.node.name === name) {
        const axis = Math.round(num(p, "partAxis", 2)),
          a = ["x", "y", "z"][axis] as "x" | "y" | "z";
        part.node.position[a] +=
          (num(p, "partLift") * num(p, "partDirection", 1)) / product.fit;
        part.node.rotation.x += rad(p, "partHinge");
      }
    }
  }, [p, product]);
  useEffect(() => {
    onReady?.();
    return () => {
      product.materials.forEach((x) => x.m.dispose());
      product.wires.forEach((w) => (w.material as Material).dispose());
    };
  }, [product, onReady]);
  return (
    <group
      ref={root}
      rotation={[rad(p, "rotateX"), rad(p, "rotateY"), rad(p, "rotateZ")]}
      scale={num(p, "scale", 1)}
      onPointerDown={(e) => {
        if (!onPick) return;
        e.stopPropagation();
        const object =
            e.object.name === "wire-overlay" ? e.object.parent! : e.object,
          local = object.worldToLocal(e.point.clone());
        onPick({
          hotspotMesh: object.name,
          hotspotX: local.x,
          hotspotY: local.y,
          hotspotZ: local.z,
          partName: object.name,
        });
      }}
    >
      <group scale={product.fit}>
        <group
          position={[-product.center.x, -product.center.y, -product.center.z]}
        >
          <primitive object={product.object} dispose={null} />
        </group>
      </group>
      <Projector
        root={root}
        p={p}
        onProjection={onProjection}
        meshes={product.names}
      />
    </group>
  );
}
const fixtureNames: Record<string, string[]> = {
  watch: ["Case", "Strap", "Crystal"],
  drone: ["Body", "Arm", "Sensor"],
  can: ["Body", "Lid"],
  case: ["Base", "Lid"],
};
function Fixture({ values: p, onProjection, onPick, onReady }: SceneProps) {
  const root = useRef<Group>(null),
    kind = str(p, "fixture"),
    solid = num(p, "solid", 1),
    hinge = rad(p, "partHinge"),
    lift = num(p, "partLift"),
    mat = {
      color:
        kind === "watch" ? "#c5ac72" : kind === "case" ? "#66513b" : "#b9c5bd",
      metalness: num(p, "metalness", 0.65),
      roughness: num(p, "roughness", 0.25),
      wireframe: solid < 0.45,
    };
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  const material = <meshStandardMaterial {...mat} />;
  return (
    <group
      ref={root}
      rotation={[rad(p, "rotateX"), rad(p, "rotateY"), rad(p, "rotateZ")]}
      scale={num(p, "scale", 1)}
      onPointerDown={(e) => {
        if (onPick) {
          e.stopPropagation();
          const local = root.current!.worldToLocal(e.point.clone());
          onPick({
            hotspotMesh: "",
            hotspotX: local.x,
            hotspotY: local.y,
            hotspotZ: local.z,
          });
        }
      }}
    >
      {kind === "watch" ? (
        <>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.73, 0.73, 0.22, 64]} />
            {material}
          </mesh>
          <mesh position={[0, 0, 0.13]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.62, 0.62, 0.03, 64]} />
            <meshStandardMaterial color="#eee8d9" roughness={0.4} />
          </mesh>
          {[-1, 1].map((sign) => (
            <mesh key={sign} position={[0, sign * 1, 0]}>
              <boxGeometry args={[0.72, 0.85, 0.12]} />
              <meshStandardMaterial color="#3d4139" roughness={0.65} />
            </mesh>
          ))}
          {Array.from({ length: 12 }, (_, i) => (
            <mesh
              key={i}
              position={[
                Math.sin((i * Math.PI) / 6) * 0.51,
                Math.cos((i * Math.PI) / 6) * 0.51,
                0.16,
              ]}
              rotation={[0, 0, (-i * Math.PI) / 6]}
            >
              <boxGeometry args={[0.025, 0.085, 0.018]} />
              {material}
            </mesh>
          ))}
          <mesh position={[0, 0.16, 0.19]} rotation={[0, 0, -0.6]}>
            <boxGeometry args={[0.035, 0.55, 0.02]} />
            {material}
          </mesh>
          <mesh position={[0.1, 0, 0.21]} rotation={[0, 0, 1.1]}>
            <boxGeometry args={[0.035, 0.4, 0.02]} />
            {material}
          </mesh>
          <mesh position={[0, 0, 0.2 + lift]}>
            <torusGeometry args={[0.7, 0.035, 12, 64]} />
            {material}
          </mesh>
        </>
      ) : null}
      {kind === "can" ? (
        <>
          <mesh>
            <cylinderGeometry args={[0.52, 0.52, 1.9, 64]} />
            <meshStandardMaterial {...mat} color="#4c8190" />
          </mesh>
          <mesh position={[0, 1.01 + lift, 0]}>
            <cylinderGeometry args={[0.51, 0.51, 0.07, 64]} />
            {material}
          </mesh>
          <mesh
            position={[0, 1.06 + lift, 0.12]}
            rotation={[-Math.PI / 2 + hinge, 0, 0]}
          >
            <torusGeometry args={[0.16, 0.035, 8, 32]} />
            {material}
          </mesh>
        </>
      ) : null}
      {kind === "drone" ? (
        <>
          <mesh>
            <boxGeometry args={[0.75, 0.26, 0.95]} />
            {material}
          </mesh>
          {[-1, 1].flatMap((x) =>
            [-1, 1].map((z) => (
              <group
                key={`${x}${z}`}
                position={[x * 0.3, 0, z * 0.3]}
                rotation={[0, x * z * hinge, 0]}
              >
                <mesh
                  position={[x * 0.47, 0, z * 0.16]}
                  rotation={[0, -x * z * 0.3, 0]}
                >
                  <boxGeometry args={[0.95, 0.1, 0.14]} />
                  {material}
                </mesh>
                <mesh position={[x * 0.9, 0.08, z * 0.3]}>
                  <cylinderGeometry args={[0.14, 0.12, 0.16, 24]} />
                  {material}
                </mesh>
                <mesh position={[x * 0.9, 0.19, z * 0.3]}>
                  <boxGeometry args={[0.85, 0.02, 0.07]} />
                  <meshStandardMaterial color="#333a36" />
                </mesh>
              </group>
            )),
          )}
          <mesh position={[0, -0.23, 0.4]}>
            <sphereGeometry args={[0.15, 24, 16]} />
            <meshStandardMaterial
              color="#152c36"
              metalness={0.8}
              roughness={0.1}
            />
          </mesh>
        </>
      ) : null}
      {kind === "case" ? (
        <>
          <mesh position={[0, -0.45, 0]}>
            <boxGeometry args={[1.6, 0.9, 0.65]} />
            {material}
          </mesh>
          <group position={[0, 0, -0.3]} rotation={[-hinge, 0, 0]}>
            <mesh position={[0, 0.44 + lift, 0.3]}>
              <boxGeometry args={[1.6, 0.88, 0.65]} />
              {material}
            </mesh>
            <mesh position={[0, 0.9 + lift, 0.3]}>
              <torusGeometry args={[0.19, 0.045, 8, 24, Math.PI]} />
              {material}
            </mesh>
          </group>
          {[-1, 1].map((x) => (
            <mesh
              key={x}
              position={[x * 0.58, -0.95, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.1, 0.1, 0.15, 20]} />
              <meshStandardMaterial color="#232823" />
            </mesh>
          ))}
        </>
      ) : null}
      <Projector
        root={root}
        p={p}
        onProjection={onProjection}
        meshes={fixtureNames[kind] ?? []}
      />
    </group>
  );
}
export default function InstrumentScene(props: SceneProps) {
  return (
    <Boundary
      key={str(props.values, "modelUrl") + str(props.values, "fixture")}
    >
      <Canvas
        frameloop="demand"
        resize={{ offsetSize: true }}
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 5], fov: 35 }}
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
      >
        <Setup p={props.values} />
        <Suspense fallback={null}>
          {props.values.fixture ? <Fixture {...props} /> : <Model {...props} />}
        </Suspense>
      </Canvas>
    </Boundary>
  );
}
