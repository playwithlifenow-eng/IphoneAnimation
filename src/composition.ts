import { editProperties } from "./editing";
import { applyCommand, evaluateEntity, clocksOf, num, str, uid, type Command, type Entity, type StudioDocument } from "./model";

export const staticValues = (e: Entity, profileId: string) => ({ ...e.props, ...e.overrides[profileId] });
export function sectionFor(d: StudioDocument, e: Entity | undefined): Entity | undefined {
  while (e) {
    if (e.kind === "section") return e;
    e = d.entities.find(p => p.id === e?.parentId);
  }
}
/** Authored layout determines scroll ranges. Animated transforms cannot change their own clock. */
export function pageLayout(d: StudioDocument, profileId: string, viewportHeight?: number) {
  const profile = d.profiles.find(p => p.id === profileId) ?? d.profiles[0];
  const viewport = viewportHeight ?? profile.height;
  let top = 0;
  const sections = d.entities.filter(e => e.kind === "section" && !e.parentId && staticValues(e, profileId).visible !== false).map(e => {
    const p = staticValues(e, profileId);
    const children = d.entities.filter(c => c.parentId === e.id && staticValues(c, profileId).visible !== false);
    const padding = num(p, "padding");
    const heights = children.map(c => num(staticValues(c, profileId), "height", 100));
    const content = str(p, "layout", "free") === "column"
      ? heights.reduce((a, b) => a + b, 0) + Math.max(0, heights.length - 1) * num(p, "gap", 16) + padding * 2
      : str(p, "layout", "free") === "row"
        ? Math.max(0, ...heights) + padding * 2
        : Math.max(0, ...children.map(c => { const v = staticValues(c, profileId); return num(v, "y") + num(v, "height", 100); })) + padding * 2;
    const mode = str(p, "heightMode", "fixed");
    const height = Math.max(100, mode === "viewport" ? viewport : mode === "content" ? content : num(p, "height", viewport));
    const travel = p.pin === true ? Math.max(1, num(p, "scrollVh", 100)) * viewport / 100 : 0;
    const box = { id: e.id, top, height, travel, extent: height + travel, pinned: p.pin === true };
    top += box.extent;
    return box;
  });
  return { sections, height: sections.length ? Math.max(viewport, top) : profile.height, viewport, width: profile.width };
}
export function scrollRange(d: StudioDocument, profileId: string, sectionId?: string, viewportHeight?: number) {
  const layout = pageLayout(d, profileId, viewportHeight);
  const max = Math.max(0, layout.height - layout.viewport);
  const box = layout.sections.find(s => s.id === sectionId);
  if (!box) return { start: 0, end: max, max };
  return { start: box.pinned ? box.top : Math.max(0, box.top - layout.viewport),
    end: box.pinned ? Math.min(max, box.top + box.travel) : Math.min(max, box.top + box.height), max };
}
export function sectionSignals(d: StudioDocument, profileId: string, input: Record<string, number>, viewportHeight?: number) {
  const signals = { ...input };
  const { max } = scrollRange(d, profileId, undefined, viewportHeight);
  const y = Math.max(0, Math.min(1, input.scroll ?? 0)) * max;
  for (const clock of clocksOf(d)) if (clock.sectionId) {
    const range = scrollRange(d, profileId, clock.sectionId, viewportHeight);
    signals[`section:${clock.sectionId}`] = range.end > range.start ? Math.max(0, Math.min(1, (y - range.start) / (range.end - range.start))) : 0;
  }
  return signals;
}
export function scrollAtClock(d: StudioDocument, profileId: string, clockId: string, progress: number) {
  const clock = clocksOf(d).find(c => c.id === clockId);
  const range = scrollRange(d, profileId, clock?.sectionId);
  return range.max > 0 ? (range.start + Math.max(0, Math.min(1, progress)) * (range.end - range.start)) / range.max : 0;
}

export function insertSection(d: StudioDocument, afterId?: string): { commands: Command[]; id: string } {
  const commands: Command[] = [];
  let working = d;
  const push = (c: Command) => { commands.push(c); working = applyCommand(working, c); };
  const create = (name: string, legacy = false): Entity => ({
    id: uid("section"), kind: "section", name, overrides: Object.fromEntries(d.profiles.filter(p => p.id !== "desktop").map(p => [p.id, { height: p.height }])),
    props: { x: 0, y: 0, height: d.profiles.find(p => p.id === "desktop")!.height, heightMode: legacy ? "fixed" : "viewport", layout: "free", padding: 0, gap: 24, pin: false, scrollVh: 100, background: "transparent", opacity: 1, visible: true },
  });
  if (!d.entities.some(e => e.kind === "section")) {
    const first = create("Original composition", true);
    push({ type: "insert", entities: [first] });
    for (const e of d.entities.filter(e => !e.parentId)) push({ type: "reparent", id: e.id, parentId: first.id });
    push({ type: "clock", clock: { id: `clock-${first.id}`, name: first.name, source: "scroll", sectionId: first.id } });
    afterId = first.id;
  }
  const section = create(`Section ${working.entities.filter(e => e.kind === "section").length + 1}`);
  push({ type: "insert", entities: [section] });
  push({ type: "clock", clock: { id: `clock-${section.id}`, name: section.name, source: "scroll", sectionId: section.id } });
  const sections = working.entities.filter(e => e.kind === "section" && e.id !== section.id).map(e => e.id);
  const index = afterId ? sections.indexOf(afterId) + 1 : sections.length;
  sections.splice(index, 0, section.id);
  push({ type: "reorder", ids: [...sections, ...working.entities.filter(e => e.kind !== "section").map(e => e.id)] });
  return { commands, id: section.id };
}
export function moveSection(d: StudioDocument, id: string, direction: -1 | 1): Command[] {
  const sections = d.entities.filter(e => e.kind === "section").map(e => e.id);
  const i = sections.indexOf(id), j = i + direction;
  if (i < 0 || j < 0 || j >= sections.length) return [];
  [sections[i], sections[j]] = [sections[j], sections[i]];
  return [{ type: "reorder", ids: [...sections, ...d.entities.filter(e => e.kind !== "section").map(e => e.id)] }];
}

/** Keep the visible arrangement when leaving a stack; do not resurrect stale freeform coordinates. */
export function layoutChangeCommands(d: StudioDocument, parent: Entity, next: string, profileId: string, time: number, signals: Record<string, number>): Command[] {
  const scope = profileId === "desktop" ? "base" : profileId;
  const commands: Command[] = [];
  const affected = profileId === "desktop" ? d.profiles.filter(p => p.id === "desktop" || parent.overrides[p.id]?.layout === undefined) : d.profiles.filter(p => p.id === profileId);
  for (const profile of affected) {
    const p = evaluateEntity(d, parent, profile.id, time, signals);
    if (next !== "free" || str(p, "layout", "free") === "free") continue;
    const row = p.layout === "row", padding = num(p, "padding"), gap = num(p, "gap", 16);
    let cursor = padding;
    for (const child of d.entities.filter(e => e.parentId === parent.id)) {
      const v = evaluateEntity(d, child, profile.id, time, signals);
      if (v.visible === false) continue;
      commands.push(...editProperties(d, child, { x: row ? cursor : padding, y: row ? padding : cursor }, profile.id, time, signals, "offset", "page"));
      cursor += num(v, row ? "width" : "height", row ? 200 : 100) + gap;
    }
  }
  commands.push({ type: "patch", id: parent.id, scope, values: { layout: next } });
  return commands;
}
