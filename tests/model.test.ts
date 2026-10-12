import { describe, it, expect } from "vitest";
import {
  applyCommand,
  clone,
  evaluateEntity,
  ownerOf,
  sampleTrack,
  upsertKey,
  validateDocument,
  type Command,
  type StudioDocument,
} from "../src/model";
import { seedDocument } from "../src/seed";
import {
  duplicateSelection,
  groupSelection,
  ungroupSelection,
} from "../src/operations";
const apply = (d: StudioDocument, commands: Command[]) =>
  commands.reduce((doc, c) => applyCommand(doc, c), d);
describe("semantic document invariants", () => {
  it("does not mutate a captured state and rejects stale revisions", () => {
    const d = seedDocument(),
      captured = clone(d);
    const next = applyCommand(d, {
      type: "patch",
      id: "headline",
      scope: "base",
      values: { x: 100 },
    });
    expect(d).toEqual(captured);
    expect(next.revision).toBe(1);
    expect(() =>
      applyCommand(next, { type: "document-name", name: "stale" }, 0),
    ).toThrow("Stale");
  });
  it("keeps responsive art direction local and resolves profile drivers before base drivers", () => {
    let d = seedDocument();
    d = applyCommand(d, {
      type: "patch",
      id: "headline",
      scope: "mobile",
      values: { x: 37 },
    });
    const e = d.entities.find((e) => e.id === "headline")!;
    expect(evaluateEntity(d, e, "desktop", 0).x).toBe(78);
    expect(evaluateEntity(d, e, "mobile", 0).x).toBe(37);
    d = applyCommand(d, {
      type: "binding",
      binding: {
        id: "b",
        entityId: e.id,
        property: "x",
        profileId: "base",
        source: "pointerX",
        min: 10,
        max: 20,
      },
    });
    d = applyCommand(d, {
      type: "track",
      track: upsertKey(d, e.id, "x", "mobile", 0, 90),
    });
    expect(ownerOf(d, e, "x", "mobile")).toBe("track");
    expect(evaluateEntity(d, e, "mobile", 0, { pointerX: 1 }).x).toBe(90);
    expect(evaluateEntity(d, e, "desktop", 0, { pointerX: 1 }).x).toBe(20);
  });
  it("rejects duplicated writers and malformed cyclic documents", () => {
    const d = seedDocument();
    expect(() =>
      applyCommand(d, {
        type: "binding",
        binding: {
          id: "b",
          entityId: "phone",
          property: "rotateY",
          profileId: "base",
          source: "scroll",
          min: 0,
          max: 1,
        },
      }),
    ).toThrow("owner");
    d.entities[0].parentId = d.entities[1].id;
    d.entities[1].parentId = d.entities[0].id;
    expect(() => validateDocument(d)).toThrow("cycle");
  });
  it("samples known keyframes consistently, replaces keys at the same time, and supports hold", () => {
    let d = seedDocument();
    let t = upsertKey(d, "headline", "x", "base", 1, 30);
    d = applyCommand(d, { type: "track", track: t });
    t = upsertKey(d, "headline", "x", "base", 1, 50);
    expect(t.keys).toHaveLength(1);
    t.keys.push({ id: "end", time: 3, value: 100 });
    expect(sampleTrack({ ...t, interpolation: "linear" }, 2)).toBe(75);
    expect(sampleTrack({ ...t, interpolation: "hold" }, 2.99)).toBe(50);
    expect(sampleTrack({ ...t, interpolation: "hold" }, 3)).toBe(100);
  });
  it("preserves page positions on every profile through grouping and ungrouping", () => {
    const d = seedDocument();
    const grouped = groupSelection(d, ["headline", "body"]);
    const g = apply(d, grouped.commands);
    const frame = g.entities.find((e) => e.id === grouped.selection[0])!;
    for (const profile of d.profiles)
      for (const id of ["headline", "body"]) {
        const before = evaluateEntity(
          d,
          d.entities.find((e) => e.id === id)!,
          profile.id,
          0,
        );
        const after = evaluateEntity(
          g,
          g.entities.find((e) => e.id === id)!,
          profile.id,
          0,
        );
        const offset = evaluateEntity(g, frame, profile.id, 0);
        expect(Number(after.x) + Number(offset.x)).toBe(before.x);
        expect(Number(after.y) + Number(offset.y)).toBe(before.y);
      }
    const u = apply(g, ungroupSelection(g, frame.id).commands);
    for (const p of d.profiles)
      for (const id of ["headline", "body"])
        expect(
          evaluateEntity(u, u.entities.find((e) => e.id === id)!, p.id, 0),
        ).toEqual(
          evaluateEntity(d, d.entities.find((e) => e.id === id)!, p.id, 0),
        );
  });
  it("duplicates subtrees and drivers without drifting child coordinates", () => {
    let d = seedDocument();
    const group = groupSelection(d, ["headline", "body"]);
    d = apply(d, group.commands);
    const result = duplicateSelection(d, [group.selection[0], "phone"]);
    const copy = apply(d, result.commands);
    const headlineCopy = copy.entities.find(
      (e) => e.name === "The main idea copy",
    )!;
    expect(headlineCopy.props.x).toBe(
      d.entities.find((e) => e.id === "headline")!.props.x,
    );
    expect(headlineCopy.parentId).not.toBe(
      d.entities.find((e) => e.id === "headline")!.parentId,
    );
    const phone = copy.entities.find(
      (e) => e.name === "Original OLED · 3D copy",
    )!;
    expect(copy.tracks.find((t) => t.entityId === phone.id)?.keys).toHaveLength(
      3,
    );
    expect(evaluateEntity(copy, phone, "desktop", 4).rotateY).toBe(18);
  });
  it("deletes descendant drivers and accepts portable runtime asset references", () => {
    const d = seedDocument();
    const next = applyCommand(d, { type: "remove", ids: ["phone"] });
    expect(next.tracks).toHaveLength(0);
    d.assets[0].url = "./media/asset-oled.glb";
    expect(validateDocument(d).assets[0].url).toContain("./media/");
  });
});
