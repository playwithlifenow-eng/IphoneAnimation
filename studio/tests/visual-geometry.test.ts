import { describe, expect, it } from "vitest";
import { seedDocument, makeEntity } from "../src/seed";
import { widthAxis, nearbyGuides } from "../src/visualGeometry";
import type { BoundsProbe } from "../src/probes";

const box = (id: string, x: number, y: number, width = 100, height = 50): BoundsProbe => ({ id, x, y, width, height, kind: "text", source: "DOM.getBoundingClientRect", scope: "axis-aligned frame", space: "page-css-px" });
describe("visual text geometry", () => {
  it("maps a width gesture through rotated/scaled parents and responsive values", () => {
    const d = seedDocument(), e = d.entities.find(e => e.id === "headline")!;
    const parent = makeEntity("frame"); parent.id = "transformed-parent";
    parent.props = { ...parent.props, rotation: 90, visualScale: 2, layout: "free" };
    d.entities.push(parent); e.parentId = parent.id;
    e.props.rotation = 0; e.props.visualScale = 1;
    e.overrides.mobile.rotation = 90;
    const desktop = widthAxis(d, e, "desktop", 0, {}, .5);
    expect(desktop.x).toBeCloseTo(0); expect(desktop.y).toBeCloseTo(1);
    const mobile = widthAxis(d, e, "mobile", 0, {}, .5);
    expect(mobile.x).toBeCloseTo(-.5); expect(mobile.y).toBeCloseTo(.5);
  });
  it("keeps half-turn and collapsed transforms finite", () => {
    const d = seedDocument(), e = d.entities.find(e => e.id === "headline")!;
    e.props.rotation = 180;
    expect(widthAxis(d, e, "desktop", 0, {}, .5)).toEqual({ x: .5, y: 0 });
  });
  it("shows nearby sibling clearance without inventing guides for remote or nested boxes", () => {
    const boxes = [box("selected", 0, 0), box("near", 120, 0), box("remote", 200, 200), box("child", 0, 0)];
    const before = structuredClone(boxes);
    const guides = nearbyGuides(boxes, "selected", new Set(["near", "remote"]));
    expect(guides).toContainEqual({ x1: 100, x2: 120, y1: 25, y2: 25, kind: "clearance" });
    expect(guides.some(g => g.x1 >= 200 || g.y1 >= 200)).toBe(false);
    expect(boxes).toEqual(before);
    expect(nearbyGuides(boxes, "missing", new Set(["near"]))).toEqual([]);
  });
});
