import { describe, it, expect } from "vitest";
import {
  applyCommand,
  clone,
  evaluateEntity,
  upsertKey,
  type Command,
  type StudioDocument,
} from "../src/model";
import { seedDocument } from "../src/seed";
import {
  pathNodes,
  positionKeyCommands,
  deletePositionKeyCommands,
} from "../src/paths";
import { readRelationship, type BoundsProbe } from "../src/probes";
const apply = (d: StudioDocument, commands: Command[]) =>
  commands.reduce((d, c) => applyCommand(d, c), d);
describe("coordinated paths", () => {
  it("records position keys together and samples the same path as the runtime", () => {
    let d = seedDocument();
    const e = d.entities.find((e) => e.id === "headline")!;
    d = apply(d, positionKeyCommands(d, e, "desktop", 0, 80, 140));
    d = apply(d, positionKeyCommands(d, e, "desktop", 4, 240, 300));
    const target = evaluateEntity(
      d,
      d.entities.find((x) => x.id === "headline")!,
      "desktop",
      2,
    );
    expect([target.x, target.y]).toEqual([160, 220]);
    expect(pathNodes(d, e, "desktop")).toEqual([
      { time: 0, x: 80, y: 140 },
      { time: 4, x: 240, y: 300 },
    ]);
    d = apply(d, deletePositionKeyCommands(d, e, "desktop", 4));
    expect(pathNodes(d, e, "desktop")).toHaveLength(1);
  });
  it("forks inherited animation without deleting other keyframes or changing base", () => {
    let d = seedDocument();
    const e = d.entities.find((e) => e.id === "phone")!;
    const base = clone(d.tracks[0]);
    d = applyCommand(d, {
      type: "track",
      track: upsertKey(d, e.id, "rotateY", "mobile", 4, 60),
    });
    expect(d.tracks.find((t) => t.profileId === "base")).toEqual(base);
    const mobile = d.tracks.find((t) => t.profileId === "mobile")!;
    expect(mobile.keys).toHaveLength(3);
    expect(evaluateEntity(d, e, "mobile", 0).rotateY).toBe(-24);
    expect(evaluateEntity(d, e, "mobile", 4).rotateY).toBe(60);
    expect(evaluateEntity(d, e, "desktop", 4).rotateY).toBe(18);
  });
  it("does not let a path compete with position signals", () => {
    let d = seedDocument();
    const e = d.entities.find((e) => e.id === "headline")!;
    d = applyCommand(d, {
      type: "binding",
      binding: {
        id: "binding-x",
        entityId: e.id,
        property: "x",
        profileId: "base",
        source: "pointerX",
        min: 0,
        max: 100,
      },
    });
    expect(() => positionKeyCommands(d, e, "desktop", 0, 20, 20)).toThrow(
      "signal",
    );
  });
});
const box = (
  id: string,
  x: number,
  y: number,
  width = 100,
  height = 100,
): BoundsProbe => ({
  id,
  x,
  y,
  width,
  height,
  kind: "frame",
  space: "page-css-px",
  source: "DOM.getBoundingClientRect",
  scope: "axis-aligned frame",
});
describe("bounded geometry evidence", () => {
  it("measures frame clearance and never converts missing evidence into a pass", () => {
    const r = {
      id: "r",
      a: "a",
      b: "b",
      kind: "clearance" as const,
      threshold: 20,
    };
    expect(
      readRelationship(r, [box("a", 0, 0), box("b", 130, 0)]),
    ).toMatchObject({ status: "pass", value: 30 });
    expect(
      readRelationship(r, [box("a", 0, 0), box("b", 90, 0)]),
    ).toMatchObject({ status: "fail", value: 0 });
    expect(readRelationship(r, [box("a", 0, 0)])).toMatchObject({
      status: "unknown",
      value: null,
    });
  });
  it("compares left edges using the authored tolerance", () => {
    const r = {
      id: "r",
      a: "a",
      b: "b",
      kind: "align-x" as const,
      threshold: 2,
    };
    expect(
      readRelationship(r, [box("a", 20, 0), box("b", 21, 300)]),
    ).toMatchObject({ status: "pass", value: 1 });
    expect(
      readRelationship(r, [box("a", 20, 0), box("b", 25, 300)]).status,
    ).toBe("fail");
  });
});
