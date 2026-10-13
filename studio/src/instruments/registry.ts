import type {
  Capability,
  Control,
  InstrumentDefinition,
  InstrumentInstance,
  Unit,
} from "./types";
import { uid, type Entity } from "../model";
const c = (
  id: string,
  name: string,
  min: number,
  max: number,
  value: number,
  unit: Unit = "ratio",
): Control => ({ id, name, min, max, default: value, unit });
const amount = c("amount", "Presence", 0, 1, 0.7);
const defs: [
  string,
  string,
  string,
  string,
  Capability[],
  Control[],
  Control[],
  string[],
][] = [
  [
    "smooth",
    "Smooth Scroll",
    "≈",
    "Environment",
    ["stage"],
    [c("weight", "Weight", 0, 1, 0.45)],
    [c("travel", "Travel", 1, 8, 3)],
    ["scroll"],
  ],
  [
    "stage",
    "Stage Lock",
    "⊏",
    "Space",
    ["stage"],
    [c("travel", "Travel", 1, 8, 3)],
    [],
    ["pin"],
  ],
  [
    "parallax",
    "Parallax Window",
    "↕",
    "Media",
    ["media"],
    [c("depth", "Depth", 0, 1, 0.45), c("focus", "Focus", 0, 1, 0.5)],
    [
      c("overscan", "Breathing room", 0.05, 0.7, 0.3),
      c("axis", "Direction", 0, 1, 0),
    ],
    ["mediaY", "mediaScale"],
  ],
  [
    "rise",
    "Soft Rise",
    "↗",
    "Entrance",
    ["text", "media", "layout"],
    [c("lift", "Lift", 0, 180, 60, "px"), c("softness", "Softness", 0, 1, 0.8)],
    [c("exit", "Exit fade", 0, 1, 0), c("stagger", "Stagger", 0, 0.5, 0)],
    ["translateY", "opacity"],
  ],
  [
    "settle",
    "Scale Settle",
    "◇",
    "Entrance",
    ["layout"],
    [c("depth", "Depth", 0, 0.8, 0.2)],
    [],
    ["visualScale", "opacity"],
  ],
  [
    "aperture",
    "Aperture Portal",
    "◉",
    "Media",
    ["media", "shape"],
    [
      c("open", "Opening", 0.02, 1.5, 0.08),
      c("end", "Destination", 0.02, 1.5, 1.1),
      c("shape", "Roundness", 0, 1, 1),
    ],
    [
      c("focusX", "Centre across", 0, 1, 0.5),
      c("focusY", "Centre down", 0, 1, 0.5),
    ],
    ["aperture", "roundness"],
  ],
  [
    "orbit",
    "Dual Orbit",
    "↻",
    "Spatial",
    ["model"],
    [
      c("turn", "Turn", -360, 360, 90, "degrees"),
      c("tilt", "Tilt", -80, 80, 12, "degrees"),
    ],
    [c("release", "Return softness", 0.1, 2, 0.65, "seconds")],
    ["rotateY", "rotateX"],
  ],
  [
    "glint",
    "Glint Sweep",
    "✧",
    "Light",
    ["model"],
    [
      c("angle", "Direction", -180, 180, 50, "degrees"),
      c("intensity", "Brilliance", 0, 12, 5),
    ],
    [
      c("spread", "Sweep", 0, 360, 150, "degrees"),
      c("height", "Height", -5, 8, 3),
    ],
    ["lightX", "lightY", "key"],
  ],
  [
    "part",
    "Part Lift / Hinge",
    "↥",
    "Spatial",
    ["model"],
    [
      c("lift", "Separation", 0, 2, 0.7),
      c("hinge", "Fold", -120, 120, 0, "degrees"),
    ],
    [c("part", "Part", 0, 3, 2), c("axis", "Axis", 0, 2, 2)],
    ["partLift", "partHinge"],
  ],
  [
    "camera",
    "Camera Approach",
    "⌖",
    "Spatial",
    ["model"],
    [
      c("dolly", "Approach", -2, 3, 0.8),
      c("orbit", "Arc", -90, 90, 15, "degrees"),
    ],
    [c("fov", "Perspective", 15, 75, 35, "degrees")],
    ["cameraZ", "cameraYaw", "fov"],
  ],
  [
    "material",
    "Lattice → Solid",
    "▧",
    "Surface",
    ["model"],
    [c("solid", "Finish", 0, 1, 1), c("roughness", "Satin", 0, 1, 0.25)],
    [c("metal", "Metallic", 0, 1, 0.5)],
    ["solid", "roughness", "metalness"],
  ],
  [
    "hotspot",
    "Surface Pin",
    "⊕",
    "Spatial",
    ["model"],
    [c("size", "Emphasis", 0.5, 2, 1)],
    [],
    ["hotspot"],
  ],
  [
    "stagger",
    "Masked Text",
    "≋",
    "Typography",
    ["text"],
    [
      c("lift", "Reveal", 0, 100, 55, "px"),
      c("stagger", "Cascade", 0, 0.8, 0.2),
    ],
    [],
    ["textReveal", "stagger"],
  ],
  [
    "counter",
    "Counter",
    "№",
    "Typography",
    ["text"],
    [c("end", "Count to", 1, 1000, 450), c("start", "Count from", 0, 1000, 0)],
    [],
    ["counter"],
  ],
  [
    "velocity",
    "Velocity Response",
    "〰",
    "Dynamics",
    ["layout"],
    [c("amount", "Elasticity", 0, 1, 0.3)],
    [c("limit", "Limit", 0, 15, 5, "degrees")],
    ["skew", "visualScale"],
  ],
  [
    "depth",
    "Depth Sandwich",
    "☰",
    "Space",
    ["layout"],
    [c("depth", "Plane", -2, 2, 0.5), c("mist", "Atmosphere", 0, 0.7, 0.15)],
    [],
    ["translateY", "mist"],
  ],
  [
    "curtain",
    "Curtain Reveal",
    "◧",
    "Media",
    ["media", "shape"],
    [amount],
    [],
    ["curtain"],
  ],
  [
    "drift",
    "Pointer Drift",
    "⤧",
    "Dynamics",
    ["media", "layout"],
    [c("distance", "Reach", 0, 80, 20, "px")],
    [],
    ["translateX", "translateY"],
  ],
  [
    "theme",
    "Theme Shift",
    "◐",
    "Environment",
    ["stage"],
    [c("dark", "Dusk", 0, 1, 1)],
    [],
    ["theme"],
  ],
  [
    "shape",
    "Shape Journey",
    "△",
    "Shape",
    ["shape"],
    [c("shape", "Shape", 0, 2, 0)],
    [],
    ["shape"],
  ],
];
export const registry: Record<string, InstrumentDefinition> =
  Object.fromEntries(
    defs.map(([id, name, icon, category, caps, inputs, advanced, outputs]) => [
      id,
      {
        id,
        version: 1,
        name,
        icon,
        category,
        purpose: name,
        supportedActorCapabilities: caps,
        scope: ["smooth", "theme"].includes(id)
          ? "global"
          : id === "stage"
            ? "stage"
            : "actor",
        inputs,
        advancedControls: advanced,
        driverPorts: [
          { id: "progress", unit: "progress", space: "stage" },
          { id: "pointer", unit: "ratio", space: "viewport" },
        ],
        outputPorts: outputs.map((id) => ({
          id,
          unit: /rotate|light|skew/.test(id)
            ? "degrees"
            : /translate|mediaY/.test(id)
              ? "px"
              : "ratio",
          space: /camera|rotate|part|light/.test(id) ? "model" : "actor",
        })),
        composePolicy: Object.fromEntries(
          outputs.map((o) => [
            o,
            /translate|rotate/.test(o)
              ? o.startsWith("rotate")
                ? "quaternion"
                : "add"
              : /Scale|opacity/.test(o)
                ? "multiply"
                : "replace",
          ]),
        ),
        visualHandle:
          id === "glint"
            ? "puck"
            : id === "orbit"
              ? "orbit"
              : id === "part"
                ? "axis"
                : ["aperture", "stage"].includes(id)
                  ? "edge"
                  : "slider",
        previewAdapter: id === "depth" ? "proxy" : "working",
        runtimeAdapter: id,
        deliveryRoutes: ["react_gsap_r3f"],
        constraints:
          id === "depth" ? ["CSS planes; not depth-aware refraction"] : [],
        dependencies: [],
        fallback: "Preserve authored base",
        determinism:
          "Pure progress evaluation; transient interaction is explicitly supplied",
        tests: ["instruments.test.ts", "browser-poc.cjs"],
      } as InstrumentDefinition,
    ]),
  );
export function capabilities(e?: Entity): Capability[] {
  if (!e) return ["stage"];
  return [
    "layout",
    ...(["image", "video"].includes(e.kind)
      ? ["media"]
      : e.kind === "text"
        ? ["text"]
        : e.kind === "scene"
          ? ["model"]
          : e.kind === "svg"
            ? ["shape"]
            : []),
  ] as Capability[];
}
export function instantiate(id: string, targetId?: string): InstrumentInstance {
  const d = registry[id];
  if (!d) throw new Error("Unknown instrument");
  return {
    stableId: uid("instrument"),
    definitionId: id,
    version: 1,
    ...(targetId ? { targetId } : {}),
    enabled: true,
    macroValues: Object.fromEntries(d.inputs.map((x) => [x.id, x.default])),
    advancedValues: Object.fromEntries(
      d.advancedControls.map((x) => [x.id, x.default]),
    ),
    drivers: [
      {
        source: "scroll",
        range: [0, 1],
        modulators: [{ kind: "ease", amount: 1 }],
      },
    ],
    outputBindings: d.outputPorts.map((x) => x.id),
    scope: "base",
  };
}

export function effectiveInstrument(i: InstrumentInstance, profile: string): InstrumentInstance {
  const override = profile === 'mobile' ? i.profileOverrides?.mobile : undefined;
  return override ? {...i, ...override} : i;
}
