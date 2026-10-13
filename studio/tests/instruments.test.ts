import { describe, it, expect } from "vitest";
import {
  makeProject,
  exampleVariant,
  makeLink,
  examples,
} from "../src/instruments/examples";
import {
  evaluate,
  validateVisual,
  driverValue,
  composeRotation,
} from "../src/instruments/engine";
import { instantiate, registry } from "../src/instruments/registry";
import { validateDocument, applyCommand, clone } from "../src/model";
import { seedDocument } from "../src/seed";
import { duplicateBoard, patchActor } from "../src/instruments/editing";
const signals = (scroll = 0.5) => ({
  scroll,
  time: scroll,
  velocity: 0,
  pointerX: 0.5,
  pointerY: 0.5,
});
describe("visual instrument ontology", () => {
  it("migrates additively and round-trips old documents and the entire graph", () => {
    const d = seedDocument(),
      before = JSON.stringify(d);
    const p = makeProject();
    validateVisual(p);
    const n = applyCommand(d, { type: "visual-project", project: p });
    expect(n.entities).toEqual(d.entities);
    expect(n.tracks).toEqual(d.tracks);
    expect(JSON.stringify(d)).toBe(before);
    expect(validateDocument(JSON.parse(JSON.stringify(n)))).toEqual(n);
  });
  it.each(examples.map((x) => x.id))(
    "%s uses valid, editable instances of the same registry",
    (name) => {
      const p = makeProject(name);
      expect(() => validateVisual(p)).not.toThrow();
      const v = p.variants[0];
      for (const i of v.instruments)
        expect(registry[i.definitionId]).toBeDefined();
      for (const s of [0, 0.2, 0.65, 1])
        for (const a of Object.values(
          evaluate(v, "desktop", 1200, signals(s)).actors,
        ))
          for (const value of Object.values(a))
            if (typeof value === "number")
              expect(Number.isFinite(value)).toBe(true);
    },
  );
  it("ON/OFF is a clean bypass retaining the exact parameters", () => {
    const v = exampleVariant("olympic"),
      i = v.instruments.find((i) => i.definitionId === "parallax")!,
      saved = clone(i.macroValues);
    const a = evaluate(v, "desktop", 1200, signals(0.8)).actors.coast;
    i.enabled = false;
    const b = evaluate(v, "desktop", 1200, signals(0.8)).actors.coast;
    expect(a.mediaScale).toBeGreaterThan(1);
    expect(b.mediaScale).toBeUndefined();
    expect(i.macroValues).toEqual(saved);
    i.enabled = true;
    expect(evaluate(v, "desktop", 1200, signals(0.8)).actors.coast).toEqual(a);
  });
  it("responds to geometry, not a parallel scroll keyframe", () => {
    const v = exampleVariant(),
      s = signals(0.3);
    const a = evaluate(v, "desktop", 1200, {
      ...s,
      bounds: { product: { x: 600, y: 100, width: 200, height: 500 } },
    });
    const b = evaluate(v, "desktop", 1200, {
      ...s,
      bounds: { product: { x: 440, y: 100, width: 370, height: 500 } },
    });
    expect(b.actors.headline.width).toBeLessThan(
      a.actors.headline.width as number,
    );
  });
  it("rejects feedback cycles and missing references before committing", () => {
    const v = exampleVariant();
    v.links.push(makeLink("headline", "product", "follow"));
    expect(() =>
      validateVisual({
        version: 1,
        variants: [v],
        boards: [
          {
            id: "b",
            name: "test",
            variantId: v.id,
            profile: "desktop",
            width: 1200,
            height: 760,
            x: 0,
            y: 0,
          },
        ],
      }),
    ).toThrow(/feedback/);
  });
  it("artboard forks are independent while responsive views share a variant", () => {
    const p = makeProject(),
      a = p.boards[0],
      mobile = p.boards[1],
      original = clone(p.variants[0]);
    patchActor(p, mobile, "headline", { fontSize: 42 });
    expect(
      p.variants[0].document.entities.find((e) => e.id === "headline")!.props
        .fontSize,
    ).toBe(86);
    expect(
      p.variants[0].document.entities.find((e) => e.id === "headline")!
        .overrides.mobile.fontSize,
    ).toBe(42);
    const id = duplicateBoard(p, a),
      b = p.boards.find((b) => b.id === id)!;
    patchActor(p, b, "headline", { text: "Independent" });
    expect(p.variants[0].document.entities).not.toEqual(
      p.variants.at(-1)!.document.entities,
    );
    expect(
      original.document.entities.find((e) => e.id === "headline")!.props.text,
    ).toBe(
      p.variants[0].document.entities.find((e) => e.id === "headline")!.props
        .text,
    );
  });
  it("linked states interpolate continuously and endpoint edits stay scoped", () => {
    const p = makeProject("shapes"),
      b = p.boards[0],
      v = p.variants[0];
    const a = evaluate(v, "desktop", 1200, signals(0.49)).actors.shape,
      c = evaluate(v, "desktop", 1200, signals(0.51)).actors.shape;
    expect(Math.abs(Number(a.width) - Number(c.width))).toBeLessThan(2);
    patchActor(p, b, "shape", { width: 480 }, v.states[1].id);
    expect(v.states[1].actors.shape.width).toBe(480);
    expect(v.states[0].actors.shape.width).toBe(280);
  });
  it("composition multiplies scale, clamps opacity and reports replace writers", () => {
    const v = exampleVariant("olympic"),
      a = instantiate("settle", "coast"),
      b = instantiate("settle", "coast");
    v.instruments = [a, b];
    const out = evaluate(v, "desktop", 1200, signals(0));
    expect(out.actors.coast.visualScale).toBeCloseTo(0.64);
    expect(out.actors.coast.opacity).toBe(0);
    v.instruments = [
      instantiate("aperture", "coast"),
      instantiate("aperture", "coast"),
    ];
    expect(
      evaluate(v, "desktop", 1200, signals()).conflicts.length,
    ).toBeGreaterThan(0);
  });
  it("composes drag orientation with scroll without overwriting either owner", () => {
    const v = exampleVariant(),
      normal = evaluate(v, "desktop", 1200, signals()).actors.product,
      drag = evaluate(v, "desktop", 1200, {
        ...signals(),
        orbit: { product: [15, 35] },
      }).actors.product;
    expect(drag.rotateY).not.toBe(normal.rotateY);
    expect(evaluate(v, "desktop", 1200, signals()).actors.product).toEqual(
      normal,
    );
    const p = { rotateX: 20, rotateY: 40, rotateZ: 10 };
    composeRotation(p, 15, 35);
    expect(Object.values(p).every(Number.isFinite)).toBe(true);
  });
  it("supports actor progress through typed driver routing and multiple modulators", () => {
    const d = {
      source: "actor" as const,
      actorId: "a",
      range: [0, 1] as [number, number],
      modulators: [
        { kind: "ease" as const, amount: 1 },
        { kind: "phase" as const, amount: 0.1 },
      ],
    };
    expect(driverValue(d, signals(), { a: 0.5 })).toBeCloseTo(0.6);
  });
  it("reverse scrub returns exactly to the same state; reduced motion suppresses velocity", () => {
    const v = exampleVariant("olympic");
    v.instruments.push(instantiate("velocity", "coast"));
    const a = evaluate(v, "desktop", 1200, signals(0.25));
    evaluate(v, "desktop", 1200, signals(0.9));
    expect(evaluate(v, "desktop", 1200, signals(0.25))).toEqual(a);
    expect(
      evaluate(v, "desktop", 1200, {
        ...signals(),
        velocity: 10,
        reducedMotion: true,
      }).actors.coast.skew,
    ).toBe(0);
  });
  it("mobile instrument overrides isolate macros and bypass without mutating desktop", () => {
    const p = makeProject("olympic"), v = p.variants[0];
    const i = v.instruments.find(i => i.definitionId === "parallax")!;
    const desktop = evaluate(v, "desktop", 1200, signals(0.8));
    i.profileOverrides = { mobile: { macroValues: { ...i.macroValues, depth: 0.9 }, advancedValues: { ...i.advancedValues }, drivers: clone(i.drivers), enabled: false } };
    expect(evaluate(v, "mobile", 390, signals(0.8)).actors.coast.mediaScale).toBeUndefined();
    expect(evaluate(v, "desktop", 1200, signals(0.8))).toEqual(desktop);
    expect(() => validateVisual(p)).not.toThrow();
    i.profileOverrides!.mobile!.enabled = true;
    expect(evaluate(v, "mobile", 390, signals(0.8)).actors.coast.mediaScale).toBeGreaterThan(1);
    expect(evaluate(v, "desktop", 1200, signals(0.8))).toEqual(desktop);
  });
  it("compound bypass restores authored model state and retains all child settings", () => {
    const v = exampleVariant(),
      copy = clone(v.instruments);
    expect(
      evaluate(v, "desktop", 1200, signals()).actors.product.partLift,
    ).toBeGreaterThan(0);
    v.beats[0].enabled = false;
    expect(
      evaluate(v, "desktop", 1200, signals()).actors.product.partLift,
    ).toBeUndefined();
    expect(v.instruments).toEqual(copy);
  });
});
