import { clockTime, clone, evaluateEntity, num, ownerOf, sampleTrack, uid, upsertKey, type Command, type Entity, type MotionAction, type Props, type StudioDocument, type Track } from "./model";

export type EditMode = "key" | "offset";
export function effectiveTrack(d: StudioDocument, e: Entity, key: string, profileId: string) {
  return d.tracks.find(t => t.entityId === e.id && t.property === key && t.profileId === profileId) ??
    d.tracks.find(t => t.entityId === e.id && t.property === key && t.profileId === "base");
}
/** The canvas, inspector and orbit tool share this single edit policy. */
export function editProperties(d: StudioDocument, e: Entity, values: Props, profileId: string, time: number, signals: Record<string, number>, mode: EditMode, clockId: string): Command[] {
  const scope = profileId === "desktop" ? "base" : profileId;
  const evaluated = evaluateEntity(d, e, profileId, time, signals);
  const basic: Props = {}, commands: Command[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (value === evaluated[key]) continue;
    const owner = ownerOf(d, e, key, profileId);
    if (owner === "signal") {
      if (typeof value !== "number") throw new Error("This signal requires numeric values.");
      const b = d.bindings.find(b => b.entityId === e.id && b.property === key && b.profileId === profileId) ?? d.bindings.find(b => b.entityId === e.id && b.property === key && b.profileId === "base");
      if (!b) continue;
      const delta = value - num(evaluated, key);
      commands.push({ type: "binding", binding: { ...b, id: b.profileId === scope ? b.id : uid("binding"), profileId: scope, min: b.min + delta, max: b.max + delta } });
    } else if (owner === "track" && typeof value === "number") {
      const original = effectiveTrack(d, e, key, profileId)!;
      const targetScope = profileId === "desktop" ? original.profileId : scope;
      const at = clockTime(d, original.clockId, time, signals);
      if (mode === "key") commands.push({ type: "track", track: upsertKey(d, e.id, key, targetScope, at, value, original.clockId) });
      else {
        const t = clone(original), delta = value - (sampleTrack(original, at) ?? num(evaluated, key));
        if (t.profileId !== targetScope) { t.id = uid("track"); t.profileId = targetScope; }
        t.keys = t.keys.map(k => ({ ...k, value: k.value + delta }));
        commands.push({ type: "track", track: t });
      }
    } else basic[key] = value;
  }
  if (Object.keys(basic).length) commands.push({ type: "patch", id: e.id, scope, values: basic });
  return commands;
}

export function actionCommand(d: StudioDocument, action: MotionAction): Command {
  const tracks: Track[] = [];
  const scope = action.profileId;
  action.entityIds.forEach((id, index) => {
    const e = d.entities.find(e => e.id === id);
    if (!e) throw new Error("The action target no longer exists.");
    const p = action.baseline[id];
    if (!p) throw new Error("Missing action baseline.");
    const from: Props = {}, to: Props = {};
    const axis = action.axis === "x" ? "translateX" : "translateY";
    if (action.kind === "reveal") {
      from.opacity = 0; to.opacity = num(p, "opacity", 1);
      from[axis] = num(p, axis) + action.amount;
      to[axis] = num(p, axis);
    } else {
      const property = action.kind === "move" ? axis : action.kind === "rotate" ? e.kind === "scene" ? "rotateY" : "rotation" : e.kind === "scene" ? "scale" : "visualScale";
      from[property] = num(p, property, action.kind === "scale" ? 1 : 0);
      to[property] = action.kind === "scale" ? Number(from[property]) * action.amount : Number(from[property]) + action.amount;
    }
    for (const property of Object.keys(from)) {
      const existing = effectiveTrack(d, e, property, scope === "base" ? "desktop" : scope);
      if ((existing && !action.trackIds.includes(existing.id)) || ownerOf(d, e, property, scope === "base" ? "desktop" : scope) === "signal")
        throw new Error(`${e.name} · ${property} already has motion. Edit that track or remove its owner before applying this action.`);
      const track: Track = { id: existing?.id ?? uid("track"), entityId: id, property, profileId: scope, clockId: action.clockId, interpolation: "smooth", keys: [
        { id: uid("key"), time: action.start + index * action.stagger, value: Number(from[property]) },
        { id: uid("key"), time: action.end + index * action.stagger, value: Number(to[property]) },
      ] };
      tracks.push(track);
    }
  });
  return { type: "action", action: { ...action, customized: false, trackIds: tracks.map(t => t.id) }, tracks };
}
