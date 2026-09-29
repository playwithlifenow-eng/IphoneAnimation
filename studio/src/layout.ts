import { evaluateEntity, num, str, type StudioDocument, type Props } from "./model";

export interface LayoutBox { x: number; y: number; width: number; height: number; worldX: number; worldY: number }

/** Shared, deterministic page layout for editor, Take previews and exported runtime. */
export function layoutDocument(d: StudioDocument, profileId: string, time = 0, signals: Record<string, number> = {}) {
  const profile = d.profiles.find(p => p.id === profileId) ?? d.profiles[0];
  const boxes = new Map<string, LayoutBox>();
  const values = new Map(d.entities.map(e => [e.id, evaluateEntity(d, e, profileId, time, signals)]));
  const entities = new Map(d.entities.map(e => [e.id, e]));
  const childMap = new Map<string | undefined, typeof d.entities>();
  for (const e of d.entities) childMap.set(e.parentId, [...(childMap.get(e.parentId) ?? []), e]);
  const children = (id?: string) => childMap.get(id) ?? [];
  const size = (id: string, widthOverride?: number): LayoutBox => {
    const e = entities.get(id)!;
    const p = values.get(id)!;
    const box: LayoutBox = { x: num(p, "x"), y: num(p, "y"), width: Math.max(1, widthOverride ?? num(p, "width", 200)), height: Math.max(1, num(p, "height", 100)), worldX: 0, worldY: 0 };
    boxes.set(id, box);
    const padding = Math.max(0, num(p, "padding"));
    const gap = Math.max(0, num(p, "gap", 16));
    const layout = str(p, "layout", "free");
    const columns = Math.max(1, Math.round(num(p, "columns", 2)));
    const innerWidth = Math.max(1, box.width - padding * 2);
    let cursorX = padding, cursorY = padding, rowHeight = 0, index = 0, bottom = padding;
    for (const child of children(id)) {
      const cp = values.get(child.id)!;
      const hidden = cp.visible === false;
      const fill = str(cp, "widthMode") === "fill";
      const childWidth = layout === "grid" ? Math.max(1, (innerWidth - gap * (columns - 1)) / columns) : fill && layout === "column" ? innerWidth : undefined;
      const b = size(child.id, childWidth);
      if (layout === "column") { b.x = padding; b.y = cursorY; if (!hidden) cursorY += b.height + gap; }
      if (layout === "row") { b.x = cursorX; b.y = padding; if (!hidden) cursorX += b.width + gap; }
      if (layout === "grid") {
        if (index && index % columns === 0) { cursorY += rowHeight + gap; rowHeight = 0; }
        b.x = padding + (index % columns) * (b.width + gap); b.y = cursorY;
        if (!hidden) { rowHeight = Math.max(rowHeight, b.height); index++; }
      }
      if (!hidden) bottom = Math.max(bottom, b.y + b.height);
    }
    if (e.kind === "frame" && p.autoHeight === true) box.height = Math.max(24, bottom + padding);
    return box;
  };
  const world = (id: string, x = 0, y = 0) => {
    const b = boxes.get(id)!;
    b.worldX = x + b.x; b.worldY = y + b.y;
    for (const c of children(id)) world(c.id, b.worldX, b.worldY);
  };
  for (const e of children()) { size(e.id); world(e.id); }
  // Profile height is a minimum, never an authoring boundary. Root content extends the page.
  let height = profile.height, minX = 0, minY = 0, maxX = profile.width;
  for (const e of d.entities) {
    if (values.get(e.id)?.visible === false) continue;
    let ancestor = e.parentId ? entities.get(e.parentId) : undefined;
    let excluded = false;
    while (ancestor) {
      const p = values.get(ancestor.id)!;
      if (p.visible === false || ["hidden", "clip", "scroll", "auto"].includes(str(p, "overflow", "visible"))) { excluded = true; break; }
      ancestor = ancestor.parentId ? entities.get(ancestor.parentId) : undefined;
    }
    if (excluded) continue;
    const b = boxes.get(e.id)!;
    // Account for rotated bounds, including the ancestor transforms used by the renderer.
    const corners = [[0, 0], [b.width, 0], [0, b.height], [b.width, b.height]].map(([x, y]) => {
      let current: typeof e | undefined = e;
      while (current) {
        const cb = boxes.get(current.id)!, cp = values.get(current.id)!;
        const r = num(cp, "rotation") * Math.PI / 180, cx = cb.width / 2, cy = cb.height / 2;
        const dx = x - cx, dy = y - cy;
        x = cb.x + cx + dx * Math.cos(r) - dy * Math.sin(r);
        y = cb.y + cy + dx * Math.sin(r) + dy * Math.cos(r);
        current = current.parentId ? entities.get(current.parentId) : undefined;
      }
      return { x, y };
    });
    minX = Math.min(minX, ...corners.map(p => p.x)); minY = Math.min(minY, ...corners.map(p => p.y));
    maxX = Math.max(maxX, ...corners.map(p => p.x)); height = Math.max(height, ...corners.map(p => p.y));
  }
  return { boxes, values, height: Math.ceil(height), bounds: { x: minX, y: minY, width: maxX - minX, height: height - minY } };
}

export const COPY_ROLES: Record<string, { label: string; props: Props }> = {
  h1: { label: "H1 · Page headline", props: { role: "h1", fontSize: 72, fontWeight: 500, lineHeight: 1.05, height: 170 } },
  h2: { label: "H2 · Section heading", props: { role: "h2", fontSize: 44, fontWeight: 500, lineHeight: 1.12, height: 110 } },
  h3: { label: "H3 · Subheading", props: { role: "h3", fontSize: 28, fontWeight: 500, lineHeight: 1.2, height: 75 } },
  body: { label: "Body", props: { role: "body", fontSize: 18, fontWeight: 400, lineHeight: 1.5, height: 100 } },
  microcopy: { label: "Microcopy", props: { role: "microcopy", fontSize: 12, fontWeight: 400, lineHeight: 1.4, height: 45 } },
  cta: { label: "CTA", props: { role: "cta", fontSize: 16, fontWeight: 500, lineHeight: 1.2, height: 48 } },
};
