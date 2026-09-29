import { describe, it, expect } from "vitest";
import { seedDocument, makeEntity } from "../src/seed";
import { layoutDocument } from "../src/layout";
import { reparentSelection, addSection } from "../src/operations";
import { applyCommand, validateDocument } from "../src/model";
import { parseComponentUrl, bundleComponent } from "../component-import";

describe("continuous page and hierarchy", () => {
  it("keeps out-of-bounds content on an unbounded board and extends the export page", () => {
    const d = seedDocument(); d.bindings = []; d.tracks = [];
    const e = makeEntity("frame"); e.props = { x: -1000, y: 22000, width: 1200, height: 600 };
    d.entities.push(e);
    expect(layoutDocument(d, "desktop").height).toBe(22600);
    expect(layoutDocument(d, "desktop").bounds.x).toBe(-1000);
    const next = addSection(d); expect(next.props.y).toBe(22600);
    expect(validateDocument(d).entities.at(-1)?.props.y).toBe(22000);
  });
  it("reparents and detaches without changing visible coordinates in either profile", () => {
    let d = seedDocument(); d.entities = []; d.bindings = []; d.tracks = [];
    const parent = makeEntity("frame"), child = makeEntity("text");
    parent.props = { x: 100, y: 200, width: 400, height: 300 };
    parent.overrides.mobile = { x: 10, y: 20 };
    child.props = { x: 150, y: 250, width: 60, height: 60 }; child.overrides.mobile = { x: 30, y: 40 };
    d.entities = [parent, child];
    for (const c of reparentSelection(d, [child.id], parent.id)) d = applyCommand(d, c);
    expect(layoutDocument(d, "desktop").boxes.get(child.id)?.worldX).toBe(150);
    expect(layoutDocument(d, "mobile").boxes.get(child.id)?.worldY).toBe(40);
    for (const c of reparentSelection(d, [child.id])) d = applyCommand(d, c);
    expect(d.entities[1].parentId).toBeUndefined();
    expect(layoutDocument(d, "desktop").boxes.get(child.id)?.worldY).toBe(250);
  });
  it("lays out a grid and recomputes an automatic frame height after removal", () => {
    let d = seedDocument(); d.entities = []; d.bindings = []; d.tracks = [];
    const frame = makeEntity("frame"); frame.props = { x: 0, y: 0, width: 420, height: 50, layout: "grid", columns: 2, padding: 10, gap: 20, autoHeight: true };
    const children = Array.from({ length: 3 }, () => { const e = makeEntity("text"); e.parentId = frame.id; e.props.height = 100; return e; });
    d.entities = [frame, ...children];
    const layout = layoutDocument(d, "desktop");
    expect(layout.boxes.get(children[1].id)?.x).toBe(220);
    expect(layout.boxes.get(children[2].id)?.y).toBe(130);
    expect(layout.boxes.get(frame.id)?.height).toBe(240);
    d = applyCommand(d, { type: "remove", ids: [children[2].id] });
    expect(layoutDocument(d, "desktop").boxes.get(frame.id)?.height).toBe(120);
    expect(() => reparentSelection(d, [frame.id], children[0].id)).toThrow();
  });
  it("removing shared copy preserves every placed instance and mobile override", () => {
    const d = seedDocument(); const e = d.entities.find(e => e.copyId)!;
    const atom = d.copy.find(a => a.id === e.copyId)!;
    e.overrides.mobile = { ...e.overrides.mobile, text: "Mobile text" };
    const result = applyCommand(d, { type: "remove-copy", id: atom.id });
    expect(result.entities.find(a => a.id === e.id)?.props.text).toBe(atom.text);
    expect(result.entities.find(a => a.id === e.id)?.copyId).toBeUndefined();
    expect(result.entities.find(a => a.id === e.id)?.overrides.mobile.text).toBe("Mobile text");
  });
});

describe("Framer adapter", () => {
  it("accepts Copy Import and rejects page links", () => {
    expect(parseComponentUrl('import Button from "https://framer.com/m/Button-abcd.js@v123"')).toBe("https://framer.com/m/Button-abcd.js@v123");
    expect(() => parseComponentUrl("https://framer.com/projects/example")).toThrow();
    expect(() => parseComponentUrl("https://127.0.0.1/m/example.js")).toThrow();
  });
  it("bundles an actual React component with the Framer runtime without running it on the server", async () => {
    const source = `import React from 'react'; import { addPropertyControls, ControlType } from 'framer'; export default function Demo({label='Imported',count=1}){return React.createElement('button',{onClick:e=>e.currentTarget.textContent='Clicked'},label+' '+count)}; addPropertyControls(Demo,{label:{type:ControlType.String,title:'Label',defaultValue:'Imported'},count:{type:ControlType.Number,title:'Count',defaultValue:1}});`;
    const bytes = await bundleComponent("https://framer.com/m/StudioFixture.js", (async () => new Response(source)) as typeof fetch);
    expect(bytes.length).toBeGreaterThan(1000);
    expect(new TextDecoder().decode(bytes)).toContain("studioComponent");
  }, 30000);
  it("rejects dependency redirects to local services", async () => {
    await expect(bundleComponent("https://framer.com/m/StudioFixture.js", (async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/secret" } })) as typeof fetch)).rejects.toThrow("Unsupported component dependency host");
  });
});
