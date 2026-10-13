import { clone, uid, type Props } from "../model";
import { studio } from "../store";
import type { Artboard, Variant, VisualProject } from "./types";
export const projectNow = () =>
  studio.get().preview?.visual ?? studio.get().workspace.document.visual!;
export function editProject(
  label: string,
  edit: (p: VisualProject) => void,
  preview = false,
) {
  const p = clone(studio.get().workspace.document.visual!);
  edit(p);
  const command = { type: "visual-project" as const, project: p };
  if (preview) studio.previewCommands([command]);
  else studio.execute(command, label);
}
export function patchActor(
  p: VisualProject,
  board: Artboard,
  id: string,
  patch: Props,
  stateId?: string,
) {
  const v = p.variants.find((v) => v.id === board.variantId)!;
  const e = v.document.entities.find((e) => e.id === id);
  if (!e) return;
  if (stateId) {
    const s = v.states.find((s) => s.id === stateId)!;
    if (board.profile === "mobile") {
      s.mobile ??= {};
      s.mobile[id] = { ...s.mobile[id], ...patch };
    } else s.actors[id] = { ...s.actors[id], ...patch };
    return;
  }
  const base =
    board.profile === "mobile" ? (e.overrides.mobile ??= {}) : e.props;
  for (const [k, value] of Object.entries(patch)) {
    const before = base[k] ?? e.props[k];
    // Moving a whole arrangement moves its endpoints too. Editing a selected state affects only that endpoint.
    for (const s of v.states) {
      const slot = board.profile === "mobile" ? s.mobile?.[id] : s.actors[id];
      if (slot && k in slot) {
        slot[k] =
          typeof value === "number" &&
          typeof before === "number" &&
          typeof slot[k] === "number"
            ? (slot[k] as number) + value - before
            : value;
      }
    }
    base[k] = value;
  }
  if (
    e.copyId &&
    typeof patch.text === "string" &&
    board.profile === "desktop"
  ) {
    const copy = v.document.copy.find((c) => c.id === e.copyId);
    if (copy) copy.text = patch.text;
  }
}
export function duplicateBoard(p: VisualProject, b: Artboard): string {
  const v = clone(p.variants.find((v) => v.id === b.variantId)!);
  v.id = uid("variant");
  v.name = String.fromCharCode(65 + p.variants.length);
  p.variants.push(v);
  const board = {
    ...clone(b),
    id: uid("board"),
    variantId: v.id,
    name: `${v.name} · ${b.profile === "mobile" ? "Mobile" : "Desktop"}`,
    x: Math.max(...p.boards.map((b) => b.x + b.width)) + 60,
    y: 0,
  };
  p.boards.push(board);
  return board.id;
}
export function removeActor(v: Variant, id: string) {
  v.document.entities = v.document.entities.filter((e) => e.id !== id);
  v.document.tracks = v.document.tracks.filter((t) => t.entityId !== id);
  v.document.bindings = v.document.bindings.filter((t) => t.entityId !== id);
  v.document.poses = v.document.poses.filter((t) => t.entityId !== id);
  v.document.relationships = v.document.relationships.filter(
    (t) => t.a !== id && t.b !== id,
  );
  const removed = v.instruments
    .filter((i) => i.targetId === id)
    .map((i) => i.stableId);
  v.instruments = v.instruments.filter((i) => i.targetId !== id);
  v.links = v.links.filter((l) => l.source !== id && l.target !== id);
  v.states.forEach((s) => {
    delete s.actors[id];
    if (s.mobile) delete s.mobile[id];
  });
  v.beats.forEach(
    (b) =>
      (b.instrumentIds = b.instrumentIds.filter((x) => !removed.includes(x))),
  );
}
