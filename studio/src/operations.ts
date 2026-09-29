import {
  clone,
  evaluateEntity,
  num,
  ownerOf,
  uid,
  type Command,
  type Entity,
  type Props,
  type StudioDocument,
} from "./model";
import { makeEntity } from "./seed";
import { layoutDocument } from "./layout";

export function descendants(d: StudioDocument, id: string): string[] {
  return d.entities.filter(e => e.parentId === id).flatMap(e => [e.id, ...descendants(d, e.id)]);
}

/** Preserve every profile when moving between coordinate spaces; layout parents then arrange their children. */
export function reparentSelection(d: StudioDocument, ids: string[], parentId?: string): Command[] {
  const roots = d.entities.filter(e => ids.includes(e.id) && !ids.some(id => descendants(d, id).includes(e.id)));
  const parent = d.entities.find(e => e.id === parentId);
  if (parentId && parent?.kind !== "frame") throw new Error("Choose a frame as the parent.");
  if (roots.some(e => e.id === parentId || descendants(d, e.id).includes(parentId ?? ""))) throw new Error("A frame cannot contain itself or one of its parents.");
  const related = new Set<string>(roots.map(e => e.id));
  for (const e of [...roots, ...(parent ? [parent] : [])]) {
    let a: Entity | undefined = e;
    while (a) { related.add(a.id); a = d.entities.find(p => p.id === a?.parentId); }
  }
  requireStatic(d, d.entities.filter(e => related.has(e.id)));
  const commands: Command[] = [];
  for (const scope of ["base", ...d.profiles.filter(p => p.id !== "desktop").map(p => p.id)]) {
    const profile = scope === "base" ? "desktop" : scope;
    const { boxes } = layoutDocument(d, profile);
    const pb = parentId ? boxes.get(parentId) : undefined;
    for (const e of roots) {
      const b = boxes.get(e.id)!;
      commands.push({ type: "patch", id: e.id, scope, values: { x: b.worldX - (pb?.worldX ?? 0), y: b.worldY - (pb?.worldY ?? 0), width: b.width, height: b.height } });
    }
  }
  return [...commands, ...roots.map((e): Command => ({ type: "reparent", id: e.id, parentId }))];
}

export function addSection(d: StudioDocument) {
  const e = makeEntity("frame");
  e.name = `Section ${d.entities.filter(e => e.props.isSection).length + 2}`;
  e.props = { ...e.props, isSection: true, background: "#f2f2e9", x: 0, y: layoutDocument(d, "desktop").height, width: d.profiles.find(p => p.id === "desktop")!.width, height: 560, layout: "free", padding: 0 };
  for (const p of d.profiles.filter(p => p.id !== "desktop")) e.overrides[p.id] = { x: 0, y: layoutDocument(d, p.id).height, width: p.width, height: 560 };
  return e;
}

export function reorderSection(d: StudioDocument, id: string, direction: -1 | 1): Command[] {
  const sections = d.entities.filter(e => e.props.isSection && !e.parentId).sort((a, b) => num(a.props, "y") - num(b.props, "y"));
  const index = sections.findIndex(e => e.id === id), a = sections[index], b = sections[index + direction];
  if (!a || !b) return [];
  requireStatic(d, [a, b]);
  return ["base", ...d.profiles.filter(p => p.id !== "desktop").map(p => p.id)].flatMap(scope => {
    const { boxes } = layoutDocument(d, scope === "base" ? "desktop" : scope);
    const ab = boxes.get(a.id)!, bb = boxes.get(b.id)!;
    const top = Math.min(ab.y, bb.y), gap = Math.max(0, direction === 1 ? bb.y - ab.y - ab.height : ab.y - bb.y - bb.height);
    return [
      { type: "patch", id: a.id, scope, values: { y: direction === 1 ? top + bb.height + gap : top } },
      { type: "patch", id: b.id, scope, values: { y: direction === 1 ? top : top + ab.height + gap } },
    ] as Command[];
  });
}

/** Duplicate a subtree without making its children drift or dropping its behaviour. */
export function duplicateSelection(
  d: StudioDocument,
  selection: string[],
): { commands: Command[]; selection: string[] } {
  const ids = new Set(selection);
  let more = true;
  while (more) {
    more = false;
    for (const e of d.entities)
      if (e.parentId && ids.has(e.parentId) && !ids.has(e.id)) {
        ids.add(e.id);
        more = true;
      }
  }
  const source = d.entities.filter((e) => ids.has(e.id));
  const map = new Map(source.map((e) => [e.id, uid("element")]));
  const roots = new Set(
    source.filter((e) => !e.parentId || !ids.has(e.parentId)).map((e) => e.id),
  );
  const offset = (p: Props) => ({
    ...p,
    ...(typeof p.x === "number" ? { x: p.x + 24 } : {}),
    ...(typeof p.y === "number" ? { y: p.y + 24 } : {}),
  });
  const entities = source.map((e) => ({
    ...clone(e),
    id: map.get(e.id)!,
    name: e.name + " copy",
    parentId: e.parentId ? (map.get(e.parentId) ?? e.parentId) : undefined,
    props: roots.has(e.id) ? offset(e.props) : clone(e.props),
    overrides: Object.fromEntries(
      Object.entries(e.overrides).map(([k, v]) => [
        k,
        roots.has(e.id) ? offset(v) : clone(v),
      ]),
    ),
  }));
  const commands: Command[] = [{ type: "insert", entities }];
  for (const t of d.tracks.filter((t) => ids.has(t.entityId)))
    commands.push({
      type: "track",
      track: {
        ...clone(t),
        id: uid("track"),
        entityId: map.get(t.entityId)!,
        keys: t.keys.map((k) => ({
          ...k,
          id: uid("key"),
          value:
            k.value +
            (roots.has(t.entityId) && ["x", "y"].includes(t.property) ? 24 : 0),
        })),
      },
    });
  for (const b of d.bindings.filter((b) => ids.has(b.entityId))) {
    const delta =
      roots.has(b.entityId) && ["x", "y"].includes(b.property) ? 24 : 0;
    commands.push({
      type: "binding",
      binding: {
        ...b,
        id: uid("binding"),
        entityId: map.get(b.entityId)!,
        min: b.min + delta,
        max: b.max + delta,
      },
    });
  }
  for (const p of d.poses.filter((p) => ids.has(p.entityId)))
    commands.push({
      type: "pose",
      pose: {
        ...clone(p),
        id: uid("pose"),
        entityId: map.get(p.entityId)!,
        values: roots.has(p.entityId) ? offset(p.values) : clone(p.values),
      },
    });
  for (const r of d.relationships.filter((r) => ids.has(r.a) && ids.has(r.b)))
    commands.push({
      type: "relationship",
      relationship: {
        ...r,
        id: uid("relation"),
        a: map.get(r.a)!,
        b: map.get(r.b)!,
      },
    });
  return { commands, selection: [...roots].map((id) => map.get(id)!) };
}
function requireStatic(d: StudioDocument, entities: Entity[]) {
  for (const e of entities)
    for (const profile of d.profiles) {
      const p = evaluateEntity(d, e, profile.id, 0);
      if (
        num(p, "rotation") !== 0 ||
        ["x", "y", "width", "height"].some((k) =>
          ["signal", "track"].includes(ownerOf(d, e, k, profile.id)),
        )
      )
        throw new Error(
          "Group static, unrotated elements. Release their position/size drivers first.",
        );
    }
}
export function groupSelection(
  d: StudioDocument,
  selection: string[],
): { commands: Command[]; selection: string[] } {
  const children = d.entities.filter((e) => selection.includes(e.id));
  if (children.length < 2) throw new Error("Select at least two elements.");
  if (children.some((e) => e.parentId))
    throw new Error("Group elements at the page level first.");
  requireStatic(d, children);
  const frame = makeEntity("frame");
  frame.name = "Group";
  frame.overrides = {};
  const commands: Command[] = [];
  for (const scope of ["base", ...d.profiles.filter(p => p.id !== "desktop").map((p) => p.id)]) {
    const values = children.map((e) =>
      scope === "base" ? e.props : { ...e.props, ...e.overrides[scope] },
    );
    const x = Math.min(...values.map((p) => num(p, "x"))),
      y = Math.min(...values.map((p) => num(p, "y")));
    const bounds = {
      x,
      y,
      width: Math.max(...values.map((p) => num(p, "x") + num(p, "width"))) - x,
      height:
        Math.max(...values.map((p) => num(p, "y") + num(p, "height"))) - y,
    };
    if (scope === "base")
      frame.props = {
        ...frame.props,
        ...bounds,
        background: "transparent",
        padding: 0,
      };
    else frame.overrides[scope] = bounds;
    children.forEach((e, i) =>
      commands.push({
        type: "patch",
        id: e.id,
        scope,
        values: { x: num(values[i], "x") - x, y: num(values[i], "y") - y },
      }),
    );
  }
  return {
    commands: [
      { type: "insert", entities: [frame] },
      ...children.map(
        (e): Command => ({ type: "reparent", id: e.id, parentId: frame.id }),
      ),
      ...commands,
    ],
    selection: [frame.id],
  };
}
export function ungroupSelection(
  d: StudioDocument,
  id: string,
): { commands: Command[]; selection: string[] } {
  const frame = d.entities.find((e) => e.id === id);
  if (!frame || frame.kind !== "frame" || frame.parentId)
    throw new Error("Select a page-level group.");
  requireStatic(d, [frame]);
  const children = d.entities.filter((e) => e.parentId === id);
  requireStatic(d, children);
  const commands: Command[] = [];
  for (const scope of ["base", ...d.profiles.filter(p => p.id !== "desktop").map((p) => p.id)]) {
    const p =
      scope === "base"
        ? frame.props
        : { ...frame.props, ...frame.overrides[scope] };
    if (
      p.layout !== "free" ||
      num(p, "padding") !== 0 ||
      num(p, "opacity", 1) !== 1
    )
      throw new Error(
        "Ungroup requires free layout, no padding and full opacity.",
      );
    children.forEach((e) => {
      const v =
        scope === "base" ? e.props : { ...e.props, ...e.overrides[scope] };
      commands.push({
        type: "patch",
        id: e.id,
        scope,
        values: { x: num(v, "x") + num(p, "x"), y: num(v, "y") + num(p, "y") },
      });
    });
  }
  return {
    commands: [
      ...children.map((e): Command => ({ type: "reparent", id: e.id })),
      ...commands,
      { type: "remove", ids: [id] },
    ],
    selection: children.map((e) => e.id),
  };
}
