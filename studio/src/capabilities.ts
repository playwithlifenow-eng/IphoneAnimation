import type { Entity, Kind } from "./model";
export const INSTRUMENT_VERSION = "iglass-studio/0.1.0";
export interface CapabilityEnvelope {
  adapter: string;
  version: 1;
  supported: string[];
  limited: string[];
  unavailable: string[];
}
const common = [
  "Selection and transforms",
  "Profile overrides",
  "Undo and Takes",
  "Numeric tracks",
  "Page-level position path handles",
  "Frame relationships and connectors",
  "Pointer/scroll bindings",
];
const byKind: Record<Kind, Omit<CapabilityEnvelope, "version">> = {
  text: {
    adapter: "dom.text",
    supported: ["Linked copy", "Direct text editing", "Typography"],
    limited: ["Installed or hosted CSS fonts"],
    unavailable: ["Font asset packaging", "Rich text spans"],
  },
  button: {
    adapter: "dom.button",
    supported: ["Text", "Destination", "Shape and fill"],
    limited: ["Link navigation in exported runtime"],
    unavailable: ["Business actions"],
  },
  frame: {
    adapter: "dom.frame",
    supported: ["Visible parenting and children", "Free/row/column/grid layout", "Gap and padding", "Auto frame height"],
    limited: ["Grouping static, unrotated elements"],
    unavailable: ["Constraint solver"],
  },
  image: {
    adapter: "dom.image",
    supported: ["Imported images", "Fit and alt text"],
    limited: ["CORS-dependent hosted sources"],
    unavailable: ["Bitmap editing"],
  },
  svg: {
    adapter: "dom.svg-image",
    supported: ["Imported SVG as image"],
    limited: ["SVG is an opaque media asset"],
    unavailable: ["SVG path control points"],
  },
  video: {
    adapter: "dom.video",
    supported: ["Imported video", "Loop", "Native runtime controls"],
    limited: ["Browser codec support"],
    unavailable: ["Timeline-synchronised video editing"],
  },
  line: {
    adapter: "dom.rule",
    supported: ["2D shape", "Fill"],
    limited: ["Rectangular line primitive"],
    unavailable: ["Custom connector routing"],
  },
  scene: {
    adapter: "three.glb",
    supported: [
      "GLB insertion",
      "Object pose",
      "Camera distance/FOV",
      "Lighting",
      "Global roughness/metalness",
    ],
    limited: [
      "One model and camera per scene frame",
      "Named numeric poses/tracks",
      "Locally generated environment",
    ],
    unavailable: [
      "Per-mesh materials",
      "Mesh topology editing",
      "Camera target handles",
      "Legacy Hero playback equivalence",
    ],
  },
  component: {
    adapter: "builtin.component",
    supported: ["Registered built-ins", "Text and appearance", "Shelf removal"],
    limited: ["Known local adapters"],
    unavailable: ["Native editing of component internals"],
  },
};
export function capabilityEnvelope(entity: Entity): CapabilityEnvelope {
  const item = byKind[entity.kind];
  if (entity.kind === "component" && entity.componentId && !["proof-card", "stat-card", "hero-reference"].includes(entity.componentId)) return {
    adapter: "framer.import", version: 1,
    supported: [...common, "Bundled Copy Import", "Live preview", "Property controls and JSON props", "Portable and runtime export"],
    limited: ["Sandboxed iframe", "Framer-dependent behavior varies by component", "External images, fonts and data may require their hosts"],
    unavailable: ["Native editing of component internals", "Framer CMS and project context"],
  };
  if (entity.componentId === "hero-reference")
    return {
      adapter: "reference.hero",
      version: 1,
      supported: ["Pinned source reference", "Position and size"],
      limited: ["Reference card only"],
      unavailable: [
        "Live legacy Hero adapter",
        "Production playback equivalence",
      ],
    };
  return { ...item, version: 1, supported: [...common, ...item.supported] };
}
export function instrumentManifest(entities: Entity[]) {
  return {
    schemaVersion: 1,
    id: INSTRUMENT_VERSION,
    documentSchema: 1,
    authority: "semantic-document",
    adapters: entities.map((e) => ({
      entityId: e.id,
      componentId: e.componentId,
      ...capabilityEnvelope(e),
    })),
    ownership: {
      scopeOrder: [
        "profile driver",
        "base driver",
        "profile static override",
        "base static",
      ],
      oneWriterPerPropertyAndScope: true,
    },
    units: {
      page: "CSS px",
      modelPosition: "normalised model units",
      modelRotation: "degrees",
      time: "seconds",
      signals: "normalised 0–1",
    },
    rendering: {
      quality: "DPR capped at 1.75",
      reducedMotion: "runtime holds at time zero",
    },
    capture: {
      pixels: "unavailable",
      video: "not-recorded",
      geometry: "DOM bounds in page CSS pixels",
      relationshipReadings: "Frame alignment/clearance; unknown when absent",
      sceneGeometry: "not-probed",
    },
  };
}
