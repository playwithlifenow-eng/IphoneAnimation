const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { unzipSync } = require("fflate");
exports.run = async ({ page, state, doc, check }) => {
  const original = (await state()).workspace;
  const headline = d => d.entities.find(e => e.id === "headline");
  const choose = async () => page.evaluate(async () => { const { studio } = await import("/src/store.ts"); studio.select(["headline"]); studio.session({ playing: false }); });
  const restore = async () => page.evaluate(async workspace => { const { studio } = await import("/src/store.ts"); studio.importWorkspace(workspace); studio.session({ profileId: "desktop", playhead: 0, signals: { pointerX: .5, pointerY: .5, scroll: 0 } }); studio.select(["headline"]); }, original);
  const move = async (locator, dx, dy = 0, cancel = false, expectGuides = false) => {
    await locator.scrollIntoViewIfNeeded();
    const b = await locator.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { steps: 6 });
    if (expectGuides) assert(await page.locator(".canvas-guides line").count() > 0, "live alignment guides are rendered");
    if (cancel) { await page.keyboard.press("Escape"); await page.mouse.move(b.x + b.width / 2 + dx + 6, b.y + b.height / 2 + dy, { steps: 2 }); }
    await page.mouse.up();
  };
  const slider = (name, fraction, cancel = false) => adjustSlider(page.getByRole("slider", { name, exact: true }), fraction, cancel);
  async function adjustSlider(locator, fraction, cancel) {
    await locator.scrollIntoViewIfNeeded(); const b = await locator.boundingBox();
    await page.mouse.move(b.x + b.width * .5, b.y + b.height / 2); await page.mouse.down();
    await page.mouse.move(b.x + b.width * fraction, b.y + b.height / 2, { steps: 6 });
    assert((await state()).preview, "slider supplies a live preview before release");
    if (cancel) { await page.keyboard.press("Escape"); await page.mouse.move(b.x + b.width * .25, b.y + b.height / 2); }
    await page.mouse.up();
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  await choose();
  assert.equal(await page.getByLabel("X", { exact: true }).isVisible(), false);
  assert.equal(await page.getByLabel("Font size", { exact: true }).isVisible(), false);
  assert.equal(await page.locator(".right-panel input[type=number]:visible").count(), 0);
  assert(await page.locator(".topbar").evaluate(e => e.scrollWidth <= e.clientWidth));
  check("M1: text Inspector has no visible numeric inputs; laptop header fits");

  await page.getByText("Edit copy", { exact: true }).click();
  await page.getByLabel("Element text", { exact: true }).fill("A clearer point of view.");
  await page.evaluate(async () => (await import("/src/store.ts")).studio.session({ zoom: .7 }));
  const handle = page.getByRole("button", { name: "Adjust line length of The main idea", exact: true });
  const lines = () => page.locator('[data-entity="headline"] .render-text').evaluate(e => { const r = document.createRange(); r.selectNodeContents(e); return new Set([...r.getClientRects()].map(b => Math.round(b.y))).size; });
  const initial = await doc(), initialLines = await lines();
  await move(handle, -140, 0, false, true);
  let after = await doc();
  assert.equal(headline(after).props.width, headline(initial).props.width - 200);
  assert.equal(headline(after).props.height, headline(initial).props.height);
  assert.equal(after.revision, initial.revision + 1); assert((await lines()) > initialLines);
  await page.getByLabel("Undo", { exact: true }).click(); assert.equal(headline(await doc()).props.width, headline(initial).props.width);
  await move(handle, -100, 0, true); assert.equal(headline(await doc()).props.width, headline(initial).props.width);
  await handle.press("ArrowLeft"); assert.equal(headline(await doc()).props.width, headline(initial).props.width - 8);
  await page.getByLabel("Undo", { exact: true }).click();
  check("M1: width handle rewraps real text at zoom; height/copy preserved; one undo; Escape and keyboard work");

  await page.evaluate(async () => { const { studio } = await import("/src/store.ts"); studio.execute({ type: "patch", id: "headline", scope: "base", values: { rotation: 30, visualScale: 1.2 } }); });
  const transformed = await doc();
  // Centre-origin CSS gives this right-edge motion for +40 authored width.
  const dx = .7 * (1 + 1.2 * Math.cos(Math.PI / 6)) / 2 * 40, dy = .7 * 1.2 * Math.sin(Math.PI / 6) / 2 * 40;
  await move(handle, dx, dy); assert(Math.abs(headline(await doc()).props.width - headline(transformed).props.width - 40) <= 1);
  await page.getByLabel("Undo", { exact: true }).click(); await page.getByLabel("Undo", { exact: true }).click();
  check("M1: rotated/scaled text measure follows its actual CSS edge transform");

  const presetBefore = await doc();
  await page.getByRole("button", { name: "Cinematic Title", exact: true }).click();
  assert.equal(headline(await doc()).props.fontSize, 64); assert.equal((await doc()).revision, presetBefore.revision + 1);
  await page.getByLabel("Undo", { exact: true }).click(); assert.deepEqual(headline(await doc()).props, headline(presetBefore).props);
  const rhythmBefore = await doc(); await slider("Rhythm", .7); after = await doc();
  assert(headline(after).props.lineHeight > headline(rhythmBefore).props.lineHeight);
  assert.notEqual(headline(after).props.letterSpacing, headline(rhythmBefore).props.letterSpacing);
  assert.equal(after.revision, rhythmBefore.revision + 1);
  await page.getByLabel("Undo", { exact: true }).click(); assert.deepEqual(headline(await doc()).props, headline(rhythmBefore).props);
  await slider("Rhythm", .6, true); assert.deepEqual(headline(await doc()).props, headline(rhythmBefore).props);
  const typeBefore = await doc(); await page.getByRole("slider", { name: "Type size", exact: true }).press("ArrowRight");
  assert.equal(headline(await doc()).props.fontSize, headline(typeBefore).props.fontSize + 1);
  await page.getByLabel("Undo", { exact: true }).click();
  check("M1: typography presets and coupled rhythm are atomic; live sliders cancel even if pointer keeps moving");

  await page.evaluate(async () => { const { studio } = await import("/src/store.ts"); studio.batch([
    { type: "track", track: { id: "m1-line", entityId: "headline", property: "lineHeight", profileId: "base", clockId: "page", interpolation: "linear", keys: [{ id: "ml0", time: 0, value: 1 }, { id: "ml1", time: 8, value: 1.4 }] } },
    { type: "binding", binding: { id: "m1-spacing", entityId: "headline", property: "letterSpacing", profileId: "base", source: "pointerX", min: -3, max: 1 } },
    { type: "track", track: { id: "m1-width", entityId: "headline", property: "width", profileId: "base", clockId: "page", interpolation: "linear", keys: [{ id: "mw0", time: 0, value: 335 }, { id: "mw1", time: 8, value: 390 }] } },
  ], "Ownership fixture"); });
  const driven = await doc();
  await page.getByLabel("Responsive profile", { exact: true }).selectOption("mobile");
  await slider("Rhythm", .8); after = await doc();
  assert.deepEqual(after.tracks.filter(t => t.profileId === "base"), driven.tracks);
  assert.deepEqual(after.bindings.filter(b => b.profileId === "base"), driven.bindings);
  assert(after.tracks.some(t => t.entityId === "headline" && t.property === "lineHeight" && t.profileId === "mobile"));
  assert(after.bindings.some(b => b.entityId === "headline" && b.property === "letterSpacing" && b.profileId === "mobile"));
  assert(await page.getByLabel("Inherit base Rhythm line spacing", { exact: true }).isVisible());
  await page.getByLabel("Undo", { exact: true }).click();
  assert.equal((await doc()).tracks.filter(t => t.profileId === "mobile").length, 0);
  assert.equal((await doc()).bindings.filter(b => b.profileId === "mobile").length, 0);
  await move(handle, -30); after = await doc();
  assert.deepEqual(after.tracks.filter(t => t.profileId === "base"), driven.tracks);
  assert(after.tracks.some(t => t.property === "width" && t.profileId === "mobile"));
  await page.getByLabel("Undo", { exact: true }).click();
  check("M1: mobile rhythm and measure fork inherited tracks/signals; ownership badges and undo preserve base");

  await restore();
  await page.getByRole("button", { name: "Cinematic Title", exact: true }).click();
  await slider("Prominence", .7);
  const base = headline(await doc()).props;
  await page.getByLabel("Responsive profile", { exact: true }).selectOption("mobile");
  await move(handle, -35); assert.deepEqual(headline(await doc()).props, base);
  await page.locator(".topbar").getByRole("button", { name: "Capture Take", exact: true }).click();
  assert.equal(await page.getByRole("dialog").count(), 0);
  let takes = (await state()).workspace.takes; assert.equal(takes.length, original.takes.length + 1);
  const snapshot = takes.at(-1); assert.equal(snapshot.name, `Take ${takes.length}`);
  await page.getByLabel("Responsive profile", { exact: true }).selectOption("desktop");
  await slider("Prominence", .4);
  assert.deepEqual((await state()).workspace.takes.at(-1), snapshot);
  await page.getByRole("button", { name: "Compare with latest Take", exact: true }).click();
  assert.equal(await page.locator(".compare-stage").count(), 2);
  assert((await page.locator(".diff-list").innerText()).includes("opacity")); await page.keyboard.press("Escape");
  await page.locator(".right-panel").getByRole("button", { name: "Capture Take", exact: true }).click();
  assert.equal((await state()).workspace.takes.length, original.takes.length + 2);
  const saved = JSON.parse(JSON.stringify((await state()).workspace));
  await page.evaluate(async () => (await import("/src/store.ts")).studio.save());
  await page.reload(); await page.waitForLoadState("networkidle");
  assert.deepEqual((await state()).workspace, saved);
  await choose();
  check("M1: header/Inspector capture immediately, snapshots stay immutable, comparison and save/reopen preserve changes");

  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Runtime package", exact: false }).click();
  await (await download).saveAs("test-results/milestone-runtime.zip");
  const files = unzipSync(fs.readFileSync("test-results/milestone-runtime.zip"));
  const exported = JSON.parse(Buffer.from(files["composition.json"]).toString());
  const expectedExport = structuredClone(saved.document);
  const assetPaths = new Map();
  for (const asset of expectedExport.assets) {
    const target = exported.assets.find(a => a.id === asset.id);
    assert(target && files[target.url.replace(/^\.\//, "")], "runtime contains each relocated asset");
    assetPaths.set(asset.url, target.url); asset.url = target.url;
  }
  for (const entity of expectedExport.entities) for (const props of [entity.props, ...Object.values(entity.overrides)])
    for (const key of ["modelUrl", "src"]) if (assetPaths.has(props[key])) props[key] = assetPaths.get(props[key]);
  assert.deepEqual(exported, expectedExport);
  const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".glb": "model/gltf-binary" };
  const server = http.createServer((req, res) => { const name = decodeURIComponent(req.url.split("?")[0]).replace(/^\//, "") || "index.html"; const bytes = files[name]; res.writeHead(bytes ? 200 : 404, { "Content-Type": mime[path.extname(name)] || "application/octet-stream" }); res.end(bytes ? Buffer.from(bytes) : "Missing"); });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const runtime = await page.context().newPage();
  try {
    await runtime.goto(`http://127.0.0.1:${server.address().port}/`); await runtime.waitForLoadState("networkidle");
    const actual = await runtime.locator('[data-entity="headline"]').evaluate(e => { const s = getComputedStyle(e); return { width: parseFloat(s.width), fontSize: parseFloat(s.fontSize), opacity: parseFloat(s.opacity) }; });
    assert.equal(actual.width, headline(saved.document).props.width); assert.equal(actual.fontSize, headline(saved.document).props.fontSize); assert.equal(actual.opacity, headline(saved.document).props.opacity);
    await runtime.setViewportSize({ width: 390, height: 844 });
    await runtime.waitForFunction(() => document.querySelector('.composition-page')?.dataset.profile === 'mobile');
    assert.equal(await runtime.locator('[data-entity="headline"]').evaluate(e => parseFloat(getComputedStyle(e).width)), headline(saved.document).overrides.mobile.width);
    assert.equal(await runtime.locator(".text-measure-handle,.ic-inspector,.canvas-guides").count(), 0);
  } finally { await runtime.close(); await new Promise(resolve => server.close(resolve)); }
  check("M1: independent exported runtime matches visual typography, opacity and mobile measure; no editor controls");
  await page.keyboard.press("Escape");
  await page.getByLabel("Open Takes", { exact: true }).click();
  await page.locator(".take-card").first().getByRole("button", { name: "Restore", exact: true }).click();
  assert.deepEqual(headline(await doc()).props, headline(snapshot.document).props);
  check("M1: captured direction restores through the existing Take workflow");
  await restore(); await page.getByRole("button", { name: "Compose", exact: true }).click();
  await page.locator(".right-panel .ic-scroll").evaluate(e => e.scrollTop = 0);
  await page.screenshot({ path: "test-results/milestone-desktop.png" });
  await page.setViewportSize({ width: 1512, height: 982 });
};
