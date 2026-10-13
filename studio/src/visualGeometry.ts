import { evaluateEntity, num, type Entity, type StudioDocument } from "./model";
import type { BoundsProbe } from "./probes";

/** Screen displacement of the right-edge midpoint per authored width pixel.
 * CSS transforms pivot around the centre, which itself moves as width changes.
 */
export function widthAxis(d: StudioDocument, entity: Entity, profileId: string, time: number, signals: Record<string, number>, zoom: number) {
  const own = evaluateEntity(d, entity, profileId, time, signals);
  const angle = num(own, "rotation") * Math.PI / 180, scale = num(own, "visualScale", 1);
  let x = (1 + scale * Math.cos(angle)) / 2, y = scale * Math.sin(angle) / 2;
  const seen = new Set([entity.id]);
  for (let id = entity.parentId; id;) {
    if (seen.has(id)) break;
    seen.add(id);
    const parent = d.entities.find(e => e.id === id);
    if (!parent) break;
    const p = evaluateEntity(d, parent, profileId, time, signals);
    const a = num(p, "rotation") * Math.PI / 180, s = num(p, "visualScale", 1);
    [x, y] = [s * (x * Math.cos(a) - y * Math.sin(a)), s * (x * Math.sin(a) + y * Math.cos(a))];
    id = parent.parentId;
  }
  // At a half turn the midpoint is stationary. Keep a finite local fallback.
  return Math.hypot(x, y) < .001 ? { x: zoom, y: 0 } : { x: x * zoom, y: y * zoom };
}

export interface VisualGuide { x1: number; y1: number; x2: number; y2: number; kind: "alignment" | "clearance" }
/** Bounded hints between sibling frames; no snapping or authored relationships. */
export function nearbyGuides(boxes: BoundsProbe[], selectedId: string, siblingIds: Set<string>): VisualGuide[] {
  const a = boxes.find(b => b.id === selectedId);
  if (!a) return [];
  const guides: VisualGuide[] = [];
  for (const b of boxes) {
    if (b.id === a.id || !siblingIds.has(b.id)) continue;
    for (const x of [a.x, a.x + a.width / 2, a.x + a.width]) {
      if ([b.x, b.x + b.width / 2, b.x + b.width].some(v => Math.abs(x - v) <= 4))
        guides.push({ x1: x, x2: x, y1: Math.min(a.y, b.y), y2: Math.max(a.y + a.height, b.y + b.height), kind: "alignment" });
    }
    for (const y of [a.y, a.y + a.height / 2, a.y + a.height]) {
      if ([b.y, b.y + b.height / 2, b.y + b.height].some(v => Math.abs(y - v) <= 4))
        guides.push({ y1: y, y2: y, x1: Math.min(a.x, b.x), x2: Math.max(a.x + a.width, b.x + b.width), kind: "alignment" });
    }
    const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const left = a.x < b.x ? a : b, right = left === a ? b : a;
    const top = a.y < b.y ? a : b, bottom = top === a ? b : a;
    const gapX = right.x - left.x - left.width, gapY = bottom.y - top.y - top.height;
    if (overlapY > 0 && gapX > 0 && gapX <= 24) {
      const y = Math.max(a.y, b.y) + overlapY / 2;
      guides.push({ x1: left.x + left.width, x2: right.x, y1: y, y2: y, kind: "clearance" });
    }
    if (overlapX > 0 && gapY > 0 && gapY <= 24) {
      const x = Math.max(a.x, b.x) + overlapX / 2;
      guides.push({ x1: x, x2: x, y1: top.y + top.height, y2: bottom.y, kind: "clearance" });
    }
  }
  return guides.slice(0, 12);
}
