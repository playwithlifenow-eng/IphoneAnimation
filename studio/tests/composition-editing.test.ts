import { describe, it, expect } from "vitest";
import { applyCommand, clocksOf, evaluateEntity, validateDocument, type Command, type StudioDocument, type MotionAction } from "../src/model";
import { seedDocument, makeEntity } from "../src/seed";
import { insertSection, moveSection, pageLayout, sectionSignals, scrollAtClock, layoutChangeCommands } from "../src/composition";
import { actionCommand, editProperties } from "../src/editing";
import { duplicateSelection } from "../src/operations";
import { pathNodes, positionKeyCommands } from "../src/paths";
const run = (d: StudioDocument, commands: Command[]) => commands.reduce((next, command) => applyCommand(next, command), d);
function sections() { const seed = seedDocument(); return run(seed, insertSection(seed).commands); }
describe("integrated section choreography", () => {
  it("migrates legacy documents without changing their composition or clocks", () => {
    const old = seedDocument(); old.schemaVersion = 1; delete old.clocks; delete old.actions;
    const migrated = validateDocument(old);
    expect(old.schemaVersion).toBe(1);
    expect(migrated.schemaVersion).toBe(2);
    expect(clocksOf(migrated)).toEqual([{ id: "page", name: "Page", source: "time" }]);
    expect(migrated.entities).toEqual(old.entities);
  });
  it("wraps legacy coordinates and responsive values, then reorders sections without rewriting children", () => {
    const before = seedDocument(), result = insertSection(before), d = run(before, result.commands);
    for (const e of before.entities) {
      const next = d.entities.find(n => n.id === e.id)!;
      expect(next.props).toEqual(e.props); expect(next.overrides).toEqual(e.overrides);
    }
    expect(d.tracks).toEqual(before.tracks);
    const moved = run(d, moveSection(d, result.id, -1));
    expect(pageLayout(moved, "desktop").sections[0].id).toBe(result.id);
    expect(moved.entities.find(e => e.id === "headline")).toEqual(d.entities.find(e => e.id === "headline"));
  });
  it("maps section scroll and DOM/3D tracks through the same clock, independently of wall time", () => {
    let d = sections(); const first = d.entities.find(e => e.kind === "section")!;
    d = applyCommand(d, { type: "patch", id: first.id, scope: "base", values: { pin: true, heightMode: "viewport", scrollVh: 200 } });
    const clockId = clocksOf(d).find(c => c.sectionId === first.id)!.id;
    d.tracks = d.tracks.filter(t => t.entityId !== "phone");
    for (const [id, property] of [["headline", "x"], ["phone", "rotateY"]]) d = applyCommand(d, { type: "track", track: { id: `t-${id}`, entityId: id, property, profileId: "base", clockId, interpolation: "linear", keys: [{ id: "a", time: 0, value: 0 }, { id: "b", time: d.duration, value: 100 }] } });
    const scroll = scrollAtClock(d, "desktop", clockId, .4), signals = sectionSignals(d, "desktop", { scroll });
    expect(evaluateEntity(d, d.entities.find(e => e.id === "phone")!, "desktop", 0, signals).rotateY).toBeCloseTo(40);
    expect(evaluateEntity(d, d.entities.find(e => e.id === "headline")!, "desktop", 7, signals).x).toBeCloseTo(40);
    const longer = applyCommand(d, { type: "duration", duration: 16 });
    expect(evaluateEntity(longer, longer.entities.find(e => e.id === "headline")!, "desktop", 7, signals).x).toBeCloseTo(40);
    const mobile = pageLayout(d, "mobile", 900);
    expect(mobile.sections[0].height).toBe(900); expect(mobile.sections[0].travel).toBe(1800);
    const duplicated = run(d, duplicateSelection(d, [first.id]).commands);
    const copy = duplicated.entities.find(e => e.name === first.name + " copy")!;
    const own = clocksOf(duplicated).find(c => c.sectionId === copy.id)!;
    expect(own.id).not.toBe(clockId);
    expect(duplicated.tracks.filter(t => duplicated.entities.find(e => e.id === t.entityId)?.parentId === copy.id).every(t => t.clockId === own.id)).toBe(true);
  });
  it("keys tracked edits at their clock and offsets inherited curves without touching base", () => {
    let d = seedDocument(); const e = d.entities.find(e => e.id === "phone")!;
    d = applyCommand(d, { type: "clock", clock: { id: "page", name: "Page", source: "scroll" } });
    const old = d.tracks.find(t => t.property === "rotateY")!;
    const at = d.duration / 2, value = Number(evaluateEntity(d, e, "desktop", 0, { scroll: .5 }).rotateY);
    const keyed = run(d, editProperties(d, e, { rotateY: value + 20 }, "desktop", 0, { scroll: .5 }, "key", "page"));
    expect(keyed.tracks.find(t => t.id === old.id)!.keys.find(k => k.time === at)!.value).toBe(value + 20);
    const shifted = run(d, editProperties(d, e, { rotateY: value + 10 }, "mobile", 0, { scroll: .5 }, "offset", "page"));
    expect(shifted.tracks.find(t => t.id === old.id)).toEqual(old);
    expect(shifted.tracks.find(t => t.profileId === "mobile")!.keys.map(k => k.value)).toEqual(old.keys.map(k => k.value + 10));
  });
  it("preserves stack arrangement when converting to free positioning", () => {
    let d = sections(); const section = d.entities.find(e => e.kind === "section")!;
    d = applyCommand(d, { type: "patch", id: section.id, scope: "base", values: { layout: "column", padding: 20, gap: 12 } });
    const children = d.entities.filter(e => e.parentId === section.id);
    const next = run(d, layoutChangeCommands(d, d.entities.find(e => e.id === section.id)!, "free", "desktop", 0, {}));
    expect(evaluateEntity(next, next.entities.find(e => e.id === children[0].id)!, "desktop", 0).y).toBe(20);
    expect(evaluateEntity(next, next.entities.find(e => e.id === children[1].id)!, "desktop", 0).y).toBe(20 + Number(children[0].props.height) + 12);
  });
  it("creates editable actions without a second runtime authority and protects existing ownership", () => {
    const d = seedDocument(), e = d.entities.find(e => e.id === "headline")!;
    const a: MotionAction = { id: "reveal", name: "Reveal headline", kind: "reveal", entityIds: [e.id], profileId: "base", clockId: "page", start: 0, end: 2, amount: 60, axis: "y", stagger: 0, trackIds: [], baseline: { [e.id]: e.props } };
    const next = applyCommand(d, actionCommand(d, a));
    expect(evaluateEntity(next, e, "desktop", 0).opacity).toBe(0);
    expect(evaluateEntity(next, e, "desktop", 2).translateY).toBe(0);
    expect(next.actions![0].trackIds).toHaveLength(2);
    expect(() => actionCommand(next, { ...a, id: "second" })).toThrow(/already has motion/);
    const customized = run(next, editProperties(next, e, { translateY: 42 }, "desktop", 1, {}, "key", "page"));
    expect(customized.actions![0].customized).toBe(true);
    const removed = applyCommand(customized, { type: "remove-action", id: a.id });
    expect(removed.tracks).toEqual(d.tracks);
  });
  it("retains spatial paths after legacy compositions become sections and supports a scroll clock", () => {
    let d = sections(); const e = d.entities.find(e => e.id === "headline")!;
    d = run(d, positionKeyCommands(d, e, "desktop", 0, 0, 0));
    d = run(d, positionKeyCommands(d, e, "desktop", 4, 80, 120));
    expect(pathNodes(d, e, "desktop")).toEqual([{ time: 0, x: 0, y: 0 }, { time: 4, x: 80, y: 120 }]);
  });
});
