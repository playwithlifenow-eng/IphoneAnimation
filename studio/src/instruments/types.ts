import type { Props, StudioDocument } from "../model";
export type Capability =
  | "layout"
  | "text"
  | "media"
  | "model"
  | "shape"
  | "stage";
export type Unit =
  | "progress"
  | "px"
  | "degrees"
  | "ratio"
  | "seconds"
  | "state";
export type Space = "stage" | "actor" | "model" | "viewport";
export type Fidelity = "working" | "proxy" | "partial" | "pending";
export interface Control {
  id: string;
  name: string;
  min: number;
  max: number;
  default: number;
  unit: Unit;
  step?: number;
}
export interface Port {
  id: string;
  unit: Unit;
  space: Space;
}
export interface InstrumentDefinition {
  id: string;
  version: 1;
  name: string;
  icon: string;
  category: string;
  purpose: string;
  supportedActorCapabilities: Capability[];
  scope: "global" | "stage" | "actor" | "relationship";
  inputs: Control[];
  advancedControls: Control[];
  driverPorts: Port[];
  outputPorts: Port[];
  composePolicy: Record<
    string,
    "add" | "multiply" | "replace" | "quaternion" | "clamp"
  >;
  visualHandle: "slider" | "puck" | "edge" | "orbit" | "axis";
  previewAdapter: Fidelity;
  runtimeAdapter: string;
  deliveryRoutes: string[];
  constraints: string[];
  dependencies: string[];
  fallback: string;
  determinism: string;
  tests: string[];
}
export interface Modulator {
  kind: "ease" | "phase" | "threshold" | "spring" | "invert";
  amount: number;
}
export interface Driver {
  source: "scroll" | "time" | "pointerX" | "pointerY" | "velocity" | "actor";
  actorId?: string;
  range: [number, number];
  modulators: Modulator[];
  mode?: "scrub" | "once" | "entry";
}
export interface InstrumentInstance {
  stableId: string;
  definitionId: string;
  version: 1;
  targetId?: string;
  enabled: boolean;
  macroValues: Record<string, number>;
  advancedValues: Record<string, number>;
  drivers: Driver[];
  outputBindings: string[];
  scope: "base" | "mobile";
  beatId?: string;
  profileOverrides?: { mobile?: { macroValues: Record<string, number>; advancedValues: Record<string, number>; enabled: boolean; drivers: Driver[] } };
}
export interface SceneState {
  id: string;
  name: string;
  at: number;
  actors: Record<string, Props>;
  mobile?: Record<string, Props>;
}
export interface StoryBeat {
  id: string;
  name: string;
  start: number;
  end: number;
  enabled: boolean;
  strength: number;
  instrumentIds: string[];
  stateIds: string[];
}
export interface ActorLink {
  id: string;
  source: string;
  target: string;
  kind: "clearance" | "follow" | "align" | "glint" | "reveal" | "synchronize";
  enabled: boolean;
  amount: number;
  sourcePort: Port;
  targetPort: Port;
}
export interface Reference {
  id: string;
  assetUrl: string;
  name: string;
  type: "image" | "video";
  timecode: number;
  observation: string;
  inferredControl: string;
  fidelity: Fidelity;
  still?: string;
  strokes: { points: number[][]; colour: string }[];
}
export interface Variant {
  id: string;
  name: string;
  document: StudioDocument;
  instruments: InstrumentInstance[];
  states: SceneState[];
  beats: StoryBeat[];
  links: ActorLink[];
  background: string;
  example: string;
  references: Reference[];
}
export interface Artboard {
  id: string;
  name: string;
  variantId: string;
  profile: "desktop" | "mobile";
  width: number;
  height: number;
  x: number;
  y: number;
}
export interface VisualProject {
  version: 1;
  variants: Variant[];
  boards: Artboard[];
}
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Signals {
  scroll: number;
  time: number;
  velocity: number;
  pointerX: number;
  pointerY: number;
  reducedMotion?: boolean;
  orbit?: Record<string, [number, number]>;
  bounds?: Record<string, Bounds>;
  entered?: Record<string, number>;
}
