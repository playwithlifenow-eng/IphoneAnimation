import type { VisualProject } from "./instruments/types";
import { validateVisual } from "./instruments/engine";
export type Value = string | number | boolean;
export type Props = Record<string, Value>;
export type Kind =
  | "text"
  | "button"
  | "frame"
  | "section"
  | "image"
  | "video"
  | "svg"
  | "line"
  | "scene"
  | "component";
export interface Entity {
  id: string;
  name: string;
  kind: Kind;
  parentId?: string;
  copyId?: string;
  componentId?: string;
  props: Props;
  overrides: Record<string, Props>;
}
export interface Profile {
  id: string;
  name: string;
  width: number;
  height: number;
}
export interface CopyAtom {
  id: string;
  name: string;
  text: string;
  variants: string[];
}
export interface Asset {
  id: string;
  name: string;
  url: string;
  type: "model" | "image" | "video" | "svg";
  hash?: string;
}
export interface Keyframe {
  id: string;
  time: number;
  value: number;
}
export interface Clock {
  id: string;
  name: string;
  source: "time" | "scroll";
  sectionId?: string;
}
export interface MotionAction {
  id: string;
  name: string;
  kind: "reveal" | "move" | "rotate" | "scale";
  entityIds: string[];
  profileId: string;
  clockId: string;
  start: number;
  end: number;
  amount: number;
  stagger: number;
  axis: "x" | "y";
  trackIds: string[];
  baseline: Record<string, Props>;
  customized?: boolean;
}
export interface Track {
  clockId?: string;
  id: string;
  entityId: string;
  property: string;
  profileId: string;
  interpolation: "linear" | "smooth" | "hold";
  keys: Keyframe[];
}
export interface Pose {
  id: string;
  name: string;
  entityId: string;
  profileId: string;
  time: number;
  values: Props;
}
export interface Binding {
  id: string;
  entityId: string;
  property: string;
  source: "pointerX" | "pointerY" | "scroll";
  min: number;
  max: number;
  profileId: string;
}
export interface Relationship {
  id: string;
  a: string;
  b: string;
  kind: "clearance" | "align-x";
  threshold: number;
  connector?: boolean;
}
export interface StudioDocument {
  visual?: VisualProject;
  schemaVersion: 1 | 2;
  clocks?: Clock[];
  actions?: MotionAction[];
  id: string;
  name: string;
  revision: number;
  duration: number;
  profiles: Profile[];
  entities: Entity[];
  copy: CopyAtom[];
  assets: Asset[];
  tracks: Track[];
  poses: Pose[];
  bindings: Binding[];
  relationships: Relationship[];
}
export interface Take {
  id: string;
  name: string;
  createdAt: string;
  parentId?: string;
  document: StudioDocument;
}
export interface Episode {
  id: string;
  createdAt: string;
  document: StudioDocument;
  profileId: string;
  playhead: number;
  selection: string[];
  signals?: Record<string, number>;
  note: string;
  tag: string;
  events: EventRecord[];
  geometry: unknown[];
  probes?: unknown[];
  environment: Record<string, unknown>;
  capture: {
    still: string;
    originalVideo: "not-recorded";
    replay: "document-and-controlled-time";
  };
}
export interface EventRecord {
  at: string;
  revision: number;
  label: string;
  type: string;
}
export interface Workspace {
  version: 1;
  document: StudioDocument;
  takes: Take[];
  episodes: Episode[];
  acceptedTakeId?: string;
  workingParentTakeId?: string;
}
export type Command =
  | { type: "visual-project"; project: VisualProject }
  | { type: "patch"; id: string; values: Props; scope: string }
  | { type: "insert"; entities: Entity[] }
  | { type: "remove"; ids: string[] }
  | { type: "rename"; id: string; name: string }
  | { type: "reparent"; id: string; parentId?: string }
  | { type: "copy"; atom: CopyAtom }
  | { type: "asset"; asset: Asset }
  | { type: "track"; track: Track }
  | { type: "remove-track"; id: string }
  | { type: "pose"; pose: Pose }
  | { type: "binding"; binding: Binding }
  | { type: "remove-binding"; id: string }
  | { type: "remove-relationship"; id: string }
  | { type: "reset-override"; id: string; scope: string; property?: string }
  | { type: "profile"; profile: Profile }
  | { type: "document-name"; name: string }
  | { type: "duration"; duration: number }
  | { type: "relationship"; relationship: Relationship }
  | { type: "clock"; clock: Clock }
  | { type: "reorder"; ids: string[] }
  | { type: "action"; action: MotionAction; tracks: Track[] }
  | { type: "remove-action"; id: string };
export const uid = (prefix = "id") =>
  `${prefix}-${crypto.randomUUID().slice(0, 10)}`;
export const clone = <T>(value: T): T => structuredClone(value);
export const num = (p: Props, key: string, fallback = 0): number =>
  typeof p[key] === "number" ? (p[key] as number) : fallback;
export const str = (p: Props, key: string, fallback = ""): string =>
  typeof p[key] === "string" ? (p[key] as string) : fallback;
const kinds = new Set<Kind>([
  "text",
  "button",
  "frame",
  "section",
  "image",
  "video",
  "svg",
  "line",
  "scene",
  "component",
]);
export function validateDocument(input: unknown): StudioDocument {
  const d = clone(input) as StudioDocument;
  if (
    !d ||
    ![1, 2].includes(d.schemaVersion) ||
    typeof d.id !== "string" ||
    typeof d.name !== "string" ||
    !Number.isInteger(d.revision) ||
    !Number.isFinite(d.duration) ||
    d.duration <= 0 ||
    d.duration > 600
  )
    throw new Error("Unsupported or invalid document.");
  if (d.schemaVersion === 1) d.schemaVersion = 2;
  d.clocks ??= [{ id: "page", name: "Page", source: "time" }];
  d.actions ??= [];
  for (const key of [
    "entities",
    "copy",
    "assets",
    "tracks",
    "poses",
    "bindings",
    "relationships",
    "profiles",
    "clocks",
    "actions",
  ] as const)
    if (!Array.isArray(d[key])) throw new Error(`Missing ${key}.`);
  const unique = (xs: { id: string }[]) =>
    xs.every((x) => typeof x?.id === "string") &&
    new Set(xs.map((x) => x.id)).size === xs.length;
  for (const xs of [
    d.entities,
    d.copy,
    d.assets,
    d.tracks,
    d.poses,
    d.bindings,
    d.relationships,
    d.profiles,
    d.clocks,
    d.actions,
  ])
    if (!unique(xs)) throw new Error("Duplicate or missing IDs.");
  if (
    !d.profiles.some((p) => p.id === "desktop") ||
    d.profiles.some(
      (p) =>
        !Number.isFinite(p.width) ||
        !Number.isFinite(p.height) ||
        p.width < 200 ||
        p.width > 5000 ||
        p.height < 200 ||
        p.height > 10000,
    )
  )
    throw new Error("Invalid profile dimensions.");
  const ids = new Set(d.entities.map((e) => e.id));
  const scopes = new Set(["base", ...d.profiles.map((p) => p.id)]);
  const validProps = (p: Props) =>
    p &&
    Object.values(p).every(
      (v) =>
        ["string", "boolean", "number"].includes(typeof v) &&
        (typeof v !== "number" || Number.isFinite(v)),
    );
  for (const e of d.entities) {
    if (
      !kinds.has(e.kind) ||
      !validProps(e.props) ||
      !e.overrides ||
      Object.entries(e.overrides).some(
        ([k, v]) => !scopes.has(k) || !validProps(v),
      )
    )
      throw new Error("Invalid entity properties.");
    if (e.parentId && !ids.has(e.parentId)) throw new Error("Missing parent.");
    if (e.copyId && !d.copy.some((a) => a.id === e.copyId))
      throw new Error("Missing copy record.");
    const seen = new Set([e.id]);
    let parent = e.parentId;
    while (parent) {
      if (seen.has(parent)) throw new Error("Hierarchy cycle.");
      seen.add(parent);
      parent = d.entities.find((x) => x.id === parent)?.parentId;
    }
  }
  if (!d.clocks.some(c => c.id === "page" && !c.sectionId) || d.clocks.some(c =>
    !["time", "scroll"].includes(c.source) || typeof c.name !== "string" ||
    (c.sectionId && !d.entities.some(e => e.id === c.sectionId && e.kind === "section"))))
    throw new Error("Invalid choreography clock.");
  if (d.entities.some(e => e.kind === "section" && e.parentId))
    throw new Error("Sections must be at page level.");
  const owners = new Set<string>();
  for (const t of d.tracks) {
    const key = `${t.entityId}:${t.property}:${t.profileId}`;
    if (
      !ids.has(t.entityId) ||
      (t.clockId !== undefined && !d.clocks.some(c => c.id === t.clockId)) ||
      !scopes.has(t.profileId) ||
      owners.has(key) ||
      !["linear", "smooth", "hold"].includes(t.interpolation) ||
      !Array.isArray(t.keys) ||
      !unique(t.keys) ||
      t.keys.some(
        (k) =>
          !Number.isFinite(k.time) ||
          k.time < 0 ||
          k.time > d.duration ||
          !Number.isFinite(k.value),
      ) ||
      new Set(t.keys.map((k) => k.time)).size !== t.keys.length
    )
      throw new Error("Invalid or conflicting track.");
    owners.add(key);
  }
  for (const action of d.actions) {
    if (!Array.isArray(action.entityIds) || !Array.isArray(action.trackIds) ||
      action.entityIds.some(id => !ids.has(id)) || !scopes.has(action.profileId) ||
      !d.clocks.some(c => c.id === action.clockId) || !validAction(action, d.duration) ||
      action.entityIds.some(id => !validProps(action.baseline?.[id])) ||
      action.trackIds.some(id => !d.tracks.some(t => t.id === id && action.entityIds.includes(t.entityId) && t.profileId === action.profileId && (t.clockId ?? "page") === action.clockId)))
      throw new Error("Invalid motion action.");
  }
  for (const b of d.bindings) {
    const key = `${b.entityId}:${b.property}:${b.profileId}`;
    if (
      !ids.has(b.entityId) ||
      !scopes.has(b.profileId) ||
      owners.has(key) ||
      !["pointerX", "pointerY", "scroll"].includes(b.source) ||
      !Number.isFinite(b.min) ||
      !Number.isFinite(b.max)
    )
      throw new Error("Conflicting signal owner.");
    owners.add(key);
  }
  for (const a of d.assets)
    if (
      typeof a.url !== "string" ||
      !/^(\/assets\/|\.\/media\/|data:|https?:\/\/)/.test(a.url)
    )
      throw new Error("Unsupported asset URL.");
  for (const p of d.poses)
    if (
      !ids.has(p.entityId) ||
      !scopes.has(p.profileId) ||
      !validProps(p.values) ||
      !Number.isFinite(p.time) ||
      p.time < 0 ||
      p.time > d.duration
    )
      throw new Error("Invalid pose.");
  for (const r of d.relationships)
    if (
      !ids.has(r.a) ||
      !ids.has(r.b) ||
      !["clearance", "align-x"].includes(r.kind) ||
      !Number.isFinite(r.threshold) ||
      r.threshold < 0 ||
      r.a === r.b
    )
      throw new Error("Invalid relationship.");
  for (const a of d.copy)
    if (
      typeof a.text !== "string" ||
      !Array.isArray(a.variants) ||
      a.variants.some((v) => typeof v !== "string")
    )
      throw new Error("Invalid copy record.");
  if (d.visual) { validateVisual(d.visual); for (const variant of d.visual.variants) variant.document = validateDocument(variant.document); }
  return clone(d);
}
export function applyCommand(
  document: StudioDocument,
  command: Command,
  expectedRevision = document.revision,
): StudioDocument {
  if (expectedRevision !== document.revision)
    throw new Error("Stale edit: document has changed.");
  const d = validateDocument(document);
  const entity = (id: string) => {
    const e = d.entities.find((e) => e.id === id);
    if (!e) throw new Error("Element no longer exists.");
    return e;
  };
  switch (command.type) {
    case "visual-project":
      d.visual = clone(command.project);
      break;
    case "patch": {
      const e = entity(command.id);
      if (command.scope === "base") Object.assign(e.props, command.values);
      else
        e.overrides[command.scope] = {
          ...e.overrides[command.scope],
          ...command.values,
        };
      break;
    }
    case "insert":
      d.entities.push(...clone(command.entities));
      break;
    case "remove": {
      const ids = new Set(command.ids);
      let changed = true;
      while (changed) {
        changed = false;
        for (const e of d.entities)
          if (e.parentId && ids.has(e.parentId) && !ids.has(e.id)) {
            ids.add(e.id);
            changed = true;
          }
      }
      const removedClocks = new Set(d.clocks!.filter(c => c.sectionId && ids.has(c.sectionId)).map(c => c.id));
      if (d.tracks.some(t => !ids.has(t.entityId) && removedClocks.has(t.clockId ?? "page")))
        throw new Error("This section clock also drives elements outside the section. Change their clock before deleting it.");
      d.clocks = d.clocks!.filter(c => !removedClocks.has(c.id));
      d.actions = d.actions!.filter(a => !a.entityIds.some(id => ids.has(id)) && !removedClocks.has(a.clockId));
      d.entities = d.entities.filter((e) => !ids.has(e.id));
      d.tracks = d.tracks.filter((t) => !ids.has(t.entityId));
      d.poses = d.poses.filter((p) => !ids.has(p.entityId));
      d.bindings = d.bindings.filter((b) => !ids.has(b.entityId));
      d.relationships = d.relationships.filter(
        (r) => !ids.has(r.a) && !ids.has(r.b),
      );
      break;
    }
    case "rename":
      entity(command.id).name = command.name;
      break;
    case "reparent":
      entity(command.id).parentId = command.parentId;
      break;
    case "copy":
      d.copy = d.copy
        .filter((a) => a.id !== command.atom.id)
        .concat(clone(command.atom));
      break;
    case "asset":
      d.assets = d.assets
        .filter((a) => a.id !== command.asset.id)
        .concat(clone(command.asset));
      break;
    case "clock":
      d.clocks = d.clocks!.filter(c => c.id !== command.clock.id).concat(clone(command.clock));
      break;
    case "reorder":
      if (command.ids.length !== d.entities.length || new Set(command.ids).size !== d.entities.length)
        throw new Error("Invalid layer order.");
      d.entities = command.ids.map(entity);
      break;
    case "action": {
      const before = d.actions!.find(a => a.id === command.action.id);
      d.tracks = d.tracks.filter(t => !before?.trackIds.includes(t.id)).concat(clone(command.tracks));
      d.actions = d.actions!.filter(a => a.id !== command.action.id).concat(clone(command.action));
      break;
    }
    case "remove-action": {
      const action = d.actions!.find(a => a.id === command.id);
      d.tracks = d.tracks.filter(t => !action?.trackIds.includes(t.id));
      d.actions = d.actions!.filter(a => a.id !== command.id);
      break;
    }
    case "track":
      d.actions = d.actions!.map(a => a.trackIds.includes(command.track.id) ? { ...a, customized: true } : a);
      d.tracks = d.tracks
        .filter((t) => t.id !== command.track.id)
        .concat(clone(command.track));
      break;
    case "remove-track":
      d.actions = d.actions!.filter(a => !a.trackIds.includes(command.id));
      d.tracks = d.tracks.filter((t) => t.id !== command.id);
      break;
    case "pose":
      d.poses = d.poses
        .filter((p) => p.id !== command.pose.id)
        .concat(clone(command.pose));
      break;
    case "binding":
      d.bindings = d.bindings
        .filter((b) => b.id !== command.binding.id)
        .concat(clone(command.binding));
      break;
    case "remove-relationship":
      d.relationships = d.relationships.filter((r) => r.id !== command.id);
      break;
    case "remove-binding":
      d.bindings = d.bindings.filter((b) => b.id !== command.id);
      break;
    case "reset-override": {
      const e = entity(command.id);
      if (command.property)
        delete e.overrides[command.scope]?.[command.property];
      else delete e.overrides[command.scope];
      break;
    }
    case "profile":
      d.profiles = d.profiles
        .filter((p) => p.id !== command.profile.id)
        .concat(clone(command.profile));
      break;
    case "document-name":
      d.name = command.name;
      break;
    case "duration": {
      const ratio = command.duration / d.duration;
      const scrollClocks = new Set(clocksOf(d).filter(c => c.source === "scroll").map(c => c.id));
      d.tracks = d.tracks.map(t => scrollClocks.has(t.clockId ?? "page") ? { ...t, keys: t.keys.map(k => ({ ...k, time: k.time * ratio })) } : t);
      d.actions = d.actions!.map(a => scrollClocks.has(a.clockId) ? { ...a, start: a.start * ratio, end: a.end * ratio, stagger: a.stagger * ratio } : a);
      d.duration = command.duration;
      break;
    }
    case "relationship":
      d.relationships = d.relationships
        .filter((r) => r.id !== command.relationship.id)
        .concat(clone(command.relationship));
      break;
  }
  if (JSON.stringify(d) === JSON.stringify(document)) return document;
  d.revision = document.revision + 1;
  return validateDocument(d);
}
export function sampleTrack(track: Track, time: number): number | undefined {
  const keys = [...track.keys].sort((a, b) => a.time - b.time);
  if (!keys.length) return undefined;
  if (time <= keys[0].time) return keys[0].value;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1],
      b = keys[i];
    if (time <= b.time) {
      let u = (time - a.time) / (b.time - a.time);
      if (track.interpolation === "hold") u = time === b.time ? 1 : 0;
      if (track.interpolation === "smooth") u = u * u * (3 - 2 * u);
      return a.value + (b.value - a.value) * u;
    }
  }
  return keys[keys.length - 1].value;
}
export function ownerOf(
  d: StudioDocument,
  e: Entity,
  property: string,
  profileId: string,
): "signal" | "track" | "override" | "base" {
  for (const scope of [profileId, "base"]) {
    if (
      d.bindings.some(
        (b) =>
          b.entityId === e.id &&
          b.property === property &&
          b.profileId === scope,
      )
    )
      return "signal";
    if (
      d.tracks.some(
        (t) =>
          t.entityId === e.id &&
          t.property === property &&
          t.profileId === scope &&
          t.keys.length,
      )
    )
      return "track";
  }
  return Object.hasOwn(e.overrides[profileId] ?? {}, property)
    ? "override"
    : "base";
}
export function evaluateEntity(
  d: StudioDocument,
  e: Entity,
  profileId: string,
  time: number,
  signals: Record<string, number> = {},
): Props {
  const props = { ...e.props, ...e.overrides[profileId] };
  if (e.copyId) {
    const atom = d.copy.find((a) => a.id === e.copyId);
    if (atom && !Object.hasOwn(e.overrides[profileId] ?? {}, "text"))
      props.text = atom.text;
  }
  for (const scope of ["base", profileId]) {
    for (const t of d.tracks.filter(
      (t) => t.entityId === e.id && t.profileId === scope,
    )) {
      const value = sampleTrack(t, clockTime(d, t.clockId, time, signals));
      if (value !== undefined) props[t.property] = value;
    }
    for (const b of d.bindings.filter(
      (b) => b.entityId === e.id && b.profileId === scope,
    ))
      props[b.property] =
        b.min +
        (b.max - b.min) * Math.min(1, Math.max(0, signals[b.source] ?? 0.5));
  }
  return props;
}
export function upsertKey(
  d: StudioDocument,
  entityId: string,
  property: string,
  profileId: string,
  time: number,
  value: number,
  clockId?: string,
): Track {
  const exact = d.tracks.find(
    (t) =>
      t.entityId === entityId &&
      t.property === property &&
      t.profileId === profileId,
  );
  const inherited =
    profileId !== "base"
      ? d.tracks.find(
          (t) =>
            t.entityId === entityId &&
            t.property === property &&
            t.profileId === "base",
        )
      : undefined;
  const t: Track = exact
    ? clone(exact)
    : {
        id: uid("track"),
        entityId,
        property,
        profileId,
        interpolation: inherited?.interpolation ?? "smooth",
        clockId: inherited?.clockId ?? clockId ?? "page",
        keys: inherited
          ? inherited.keys.map((k) => ({ ...k, id: uid("key") }))
          : [],
      };
  const at = Math.min(d.duration, Math.max(0, Math.round(time * 100) / 100));
  const old = t.keys.find((k) => k.time === at);
  if (old) old.value = value;
  else t.keys.push({ id: uid("key"), time: at, value });
  return t;
}
export function validateWorkspace(input: unknown): Workspace {
  const w = input as Workspace;
  if (
    !w ||
    w.version !== 1 ||
    !Array.isArray(w.takes) ||
    !Array.isArray(w.episodes)
  )
    throw new Error("Invalid workspace.");
  const next = clone(w);
  next.document = validateDocument(w.document);
  next.takes = next.takes.map(t => ({ ...t, document: validateDocument(t.document) }));
  next.episodes = next.episodes.map(e => ({ ...e, document: validateDocument(e.document) }));
  return next;
}
export function diffDocuments(a: StudioDocument, b: StudioDocument): string[] {
  const changes: string[] = [];
  for (const e of b.entities) {
    const before = a.entities.find((x) => x.id === e.id);
    if (!before) {
      changes.push(`Added ${e.name}`);
      continue;
    }
    for (const k of new Set([
      ...Object.keys(e.props),
      ...Object.keys(before.props),
    ]))
      if (e.props[k] !== before.props[k])
        changes.push(`${e.name} · ${k}: ${before.props[k]} → ${e.props[k]}`);
    for (const k of ["name", "parentId", "copyId", "componentId"] as const)
      if (e[k] !== before[k]) changes.push(`${e.name} · ${k} changed`);
    if (JSON.stringify(e.overrides) !== JSON.stringify(before.overrides))
      changes.push(`${e.name} · responsive overrides changed`);
  }
  for (const e of a.entities)
    if (!b.entities.some((x) => x.id === e.id))
      changes.push(`Removed ${e.name}`);
  if (JSON.stringify(a.tracks) !== JSON.stringify(b.tracks))
    changes.push("Choreography changed");
  if (JSON.stringify(a.copy) !== JSON.stringify(b.copy))
    changes.push("Copy changed");
  for (const [key, label] of [
    ["relationships", "Relationships"],
    ["bindings", "Signal bindings"],
    ["poses", "Named poses"],
    ["profiles", "Responsive profiles"],
    ["assets", "Assets"],
    ["duration", "Duration"],
    ["name", "Document name"],
    ["clocks", "Choreography clocks"],
    ["actions", "Motion actions"],
  ] as const)
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key]))
      changes.push(label + " changed");
  return changes;
}

export const clocksOf = (d: StudioDocument): Clock[] => d.clocks ?? [{ id: "page", name: "Page", source: "time" }];
export function clockTime(d: StudioDocument, id: string | undefined, time: number, signals: Record<string, number> = {}): number {
  const clock = clocksOf(d).find(c => c.id === (id ?? "page"));
  if (clock?.source !== "scroll") return time;
  const value = signals[clock.sectionId ? `section:${clock.sectionId}` : "scroll"] ?? 0;
  return Math.max(0, Math.min(1, value)) * d.duration;
}
export function entityClockId(d: StudioDocument, e: Entity | undefined): string {
  const track = d.tracks.find(t => t.entityId === e?.id);
  if (track) return track.clockId ?? "page";
  while (e) {
    const clock = clocksOf(d).find(c => c.sectionId === e!.id);
    if (clock) return clock.id;
    e = d.entities.find(p => p.id === e?.parentId);
  }
  return "page";
}
function validAction(a: MotionAction, duration: number) {
  return ["reveal", "move", "rotate", "scale"].includes(a.kind) &&
    [a.start, a.end, a.amount, a.stagger].every(Number.isFinite) &&
    a.start >= 0 && a.end > a.start && a.stagger >= 0 &&
    a.end + a.stagger * Math.max(0, a.entityIds.length - 1) <= duration + 0.00001 &&
    ["x", "y"].includes(a.axis) && !!a.baseline;
}
