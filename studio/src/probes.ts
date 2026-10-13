import type { Relationship } from "./model";
export interface BoundsProbe {
  id: string;
  kind: string;
  space: "page-css-px";
  x: number;
  y: number;
  width: number;
  height: number;
  source: "DOM.getBoundingClientRect";
  scope: "axis-aligned frame";
}
export interface RelationshipReading {
  status: "pass" | "fail" | "unknown";
  value: number | null;
  units: "CSS px";
  criterion: string;
  limitation: string;
}
export function measurePage(page: HTMLElement | null): BoundsProbe[] {
  if (!page) return [];
  const bounds = page.getBoundingClientRect();
  const sx = bounds.width / page.offsetWidth,
    sy = bounds.height / page.offsetHeight;
  if (!sx || !sy) return [];
  return [...page.querySelectorAll<HTMLElement>("[data-entity]")].map((el) => {
    const r = el.getBoundingClientRect();
    return {
      id: el.dataset.entity!,
      kind: el.dataset.kind ?? "unknown",
      space: "page-css-px" as const,
      x: (r.x - bounds.x) / sx,
      y: (r.y - bounds.y) / sy,
      width: r.width / sx,
      height: r.height / sy,
      source: "DOM.getBoundingClientRect" as const,
      scope: "axis-aligned frame" as const,
    };
  });
}
export function readRelationship(
  r: Relationship,
  boxes: BoundsProbe[],
): RelationshipReading {
  const a = boxes.find((b) => b.id === r.a),
    b = boxes.find((b) => b.id === r.b);
  const criterion =
    r.kind === "clearance"
      ? `Frame clearance ≥ ${r.threshold}px`
      : `Left-edge difference ≤ ${r.threshold}px`;
  const limitation =
    "Frame geometry only; visible pixels, clipping and 3D mesh occlusion are not measured.";
  if (!a || !b)
    return {
      status: "unknown",
      value: null,
      units: "CSS px",
      criterion,
      limitation,
    };
  const dx = Math.max(b.x - a.x - a.width, a.x - b.x - b.width, 0),
    dy = Math.max(b.y - a.y - a.height, a.y - b.y - b.height, 0);
  const value =
    r.kind === "clearance" ? Math.hypot(dx, dy) : Math.abs(a.x - b.x);
  return {
    status: (
      r.kind === "clearance" ? value >= r.threshold : value <= r.threshold
    )
      ? "pass"
      : "fail",
    value,
    units: "CSS px",
    criterion,
    limitation,
  };
}
