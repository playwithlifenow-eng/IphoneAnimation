const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { unzipSync } = require("fflate");
(async () => {
  fs.mkdirSync("test-results/poc", { recursive: true });
  fs.mkdirSync("docs/poc", { recursive: true });
  const dataDir = fs.mkdtempSync(path.resolve("test-results/poc/workspace-"));
  const server = spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"],
    {
      env: { ...process.env, STUDIO_DATA_DIR: dataDir },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let browser, runtimeServer;
  const checks = [],
    errors = [];
  const check = (n) => {
    checks.push(n);
    console.log("PASS " + n);
  };
  try {
    await new Promise((resolve, reject) => {
      server.stdout.on("data", (d) => {
        if (String(d).includes("Local:")) resolve();
      });
      server.stderr.on("data", (d) => process.stderr.write(d));
      server.on("exit", (c) => reject(Error("Vite exit " + c)));
    });
    browser = await chromium.launch({
      headless: true,
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    });
    const context = await browser.newContext({
      viewport: { width: 1512, height: 982 },
      acceptDownloads: true,
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    const state = () =>
      page.evaluate(async () => (await import("/src/store.ts")).studio.get());
    const project = async () => (await state()).workspace.document.visual;
    const seek = async (value) => {
      const el = page.getByLabel("Story progress", { exact: true }),
        r = await el.boundingBox();
      await page.mouse.click(r.x + r.width * value, r.y + r.height / 2);
    };
    const slider = async (name, fraction) => {
      const el = page.getByLabel(name, { exact: true });
      await el.scrollIntoViewIfNeeded();
      const r = await el.boundingBox();
      await page.mouse.move(r.x + r.width * 0.5, r.y + r.height / 2);
      await page.mouse.down();
      await page.mouse.move(r.x + r.width * fraction, r.y + r.height / 2, {
        steps: 8,
      });
      await page.mouse.up();
    };
    const example = async (name) => {
      await page
        .getByRole("button", { name: "Examples", exact: false })
        .click();
      await page.getByRole("button", { name, exact: false }).click();
      await page.waitForTimeout(300);
      await page.getByLabel("Focus artboard", { exact: true }).click();
      await page.waitForTimeout(300);
    };
    await page.goto("http://127.0.0.1:5173");
    await page.waitForSelector("[data-artboard]");
    await page.waitForTimeout(1200);
    assert.equal(await page.locator("[data-artboard]").count(), 3);
    assert.equal(await page.locator("canvas").count(), 1);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    assert.equal(await page.locator(".vi-instrument").count(), 5);
    check(
      "Light spatial workspace: three real artboards, one WebGL canvas, no horizontal page overflow",
    );
    await page.getByLabel("Focus artboard", { exact: true }).click();
    const original = await project();
    await page
      .getByRole("switch", { name: "Dual Orbit enabled", exact: true })
      .click();
    let p = await project();
    assert.equal(
      p.variants[0].instruments.find((i) => i.definitionId === "orbit").enabled,
      false,
    );
    assert.deepEqual(
      p.variants[0].instruments.find((i) => i.definitionId === "orbit")
        .macroValues,
      original.variants[0].instruments.find((i) => i.definitionId === "orbit")
        .macroValues,
    );
    await page.getByLabel("Undo", { exact: true }).click();
    assert.equal(
      (await project()).variants[0].instruments.find(
        (i) => i.definitionId === "orbit",
      ).enabled,
      true,
    );
    check("Instrument bypass retains settings and undoes once");
    const before = (await state()).workspace.document.revision;
    await slider("Product size", 0.74);
    assert.equal((await state()).workspace.document.revision, before + 1);
    const smallWidth = Number(
      await page
        .locator('.vi-artboard.active [data-actor="headline"]')
        .getAttribute("data-width"),
    );
    await slider("Product size", 0.99);
    await page.waitForTimeout(400);
    const bigWidth = Number(
      await page
        .locator('.vi-artboard.active [data-actor="headline"]')
        .getAttribute("data-width"),
    );
    assert(
      bigWidth < smallWidth,
      `Relational width ${smallWidth} → ${bigWidth}`,
    );
    await page.getByLabel("Undo", { exact: true }).click();
    check(
      "Live projected geometry changes headline clearance when product scale changes",
    );
    const size = page.getByLabel("Product size", { exact: true }),
      r = await size.boundingBox(),
      saved = JSON.stringify(await project());
    await page.mouse.move(r.x + r.width * 0.5, r.y + 2);
    await page.mouse.down();
    await page.mouse.move(r.x + r.width * 0.9, r.y + 2, { steps: 5 });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    assert.equal(JSON.stringify(await project()), saved);
    check("Escape cancels a live macro gesture without a saved change");
    await slider("Product size", 0.4);
    const product = page.locator('.vi-artboard.active [data-actor="product"]'),
      box = await product.boundingBox();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width * 0.5 + 75,
      box.y + box.height * 0.5 + 30,
      { steps: 10 },
    );
    const offset = JSON.parse(await product.getAttribute("data-orbit"));
    assert(Math.hypot(...offset) > 10);
    await page.mouse.up();
    const first = JSON.parse(await product.getAttribute("data-orbit"));
    assert(Math.hypot(...first) > 1);
    // Autosave can replace instrument references during release; it must not cancel decay.
    await page.evaluate(async () => { await (await import("/src/store.ts")).studio.save(); });
    await page.waitForFunction(() => {
      const node = document.querySelector('.vi-artboard.active [data-actor="product"]');
      return node && Math.hypot(...JSON.parse(node.getAttribute("data-orbit"))) < 0.1;
    }, null, { timeout: 10000 });
    assert(
      Math.hypot(...JSON.parse(await product.getAttribute("data-orbit"))) < 0.1,
    );
    check(
      "Direct orbit and scroll coexist; release blends back instead of snapping",
    );
    const pin = page.locator('.vi-artboard.active [data-hotspot="product"]');
    const pinBefore = await pin.boundingBox();
    await slider("Authored pose", 0.5);
    await page.waitForTimeout(300);
    const pinAfter = await pin.boundingBox();
    assert(pinBefore && pinAfter && Math.abs(pinBefore.x - pinAfter.x) > 3);
    check("Real model-space hotspot projection follows pose changes");
    await page.locator(".vi-artboard.active .vi-artboard-title").click();
    await page.keyboard.press("Control+d");
    assert.equal((await project()).boards.length, 4);
    const fork = (await project()).boards.at(-1);
    assert.notEqual(fork.variantId, (await project()).boards[0].variantId);
    await page.getByLabel("Undo", { exact: true }).click();
    assert.equal((await project()).boards.length, 3);
    check(
      "Ctrl & D duplicates the selected artboard as an independent variant; one undo removes it",
    );
    await page
      .getByRole("button", { name: "A · Mobile", exact: false })
      .first()
      .click();
    await page.getByRole("button", { name: /^T Headline/ }).click();
    await slider("Type size", 0.3);
    p = await project();
    assert.notEqual(
      p.variants[0].document.entities.find((e) => e.id === "headline").overrides
        .mobile.fontSize,
      52,
    );
    assert.equal(
      p.variants[0].document.entities.find((e) => e.id === "headline").props
        .fontSize,
      86,
    );
    assert.equal(
      p.variants[1].document.entities.find((e) => e.id === "headline").overrides
        .mobile.fontSize,
      52,
    );
    check(
      "Mobile overrides remain linked to A and isolated from desktop and B",
    );
    await page
      .getByRole("button", { name: "A · Mobile", exact: false })
      .first()
      .click();
    await slider("Viewport width", 0.72);
    p = await project();
    assert(p.boards[1].width > 450 && p.boards[1].width < 600);
    check("Intermediate responsive artboard width renders and persists");
    await example("Olympic editorial");
    const media = page.locator('.vi-artboard.active [data-actor="coast"] img');
    await seek(0.8);
    const transform = await media.evaluate(
      (e) => getComputedStyle(e).transform,
    );
    await page
      .getByRole("switch", { name: "Parallax Window enabled", exact: true })
      .click();
    assert.notEqual(
      await media.evaluate((e) => getComputedStyle(e).transform),
      transform,
    );
    await page.getByLabel("Undo", { exact: true }).click();
    await seek(0.2);
    const forward = await media.evaluate((e) => getComputedStyle(e).transform);
    await seek(0.95);
    await seek(0.2);
    assert.equal(
      await media.evaluate((e) => getComputedStyle(e).transform),
      forward,
    );
    check(
      "Parallax has visible clean bypass and deterministic reversal/re-entry",
    );
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    const scroller = page.locator(".vi-preview-scroll");
    await scroller.hover();
    await page.mouse.wheel(0, 760);
    await page.waitForTimeout(350);
    assert(
      Number(
        await page
          .locator(".vi-preview [data-stage]")
          .getAttribute("data-progress"),
      ) > 0.1,
    );
    await page.getByRole("button", { name: "Close preview ×" }).click();
    check(
      "Native scroll drives the same instruments through finite smoothing in Preview",
    );
    await example("Shape playground");
    await page.getByRole("button", { name: /02 Rectangle/ }).click();
    await slider("Shape", 0.95);
    p = await project();
    assert(p.variants[0].states[1].actors.shape.shape > 1.5);
    assert.equal(p.variants[0].states[0].actors.shape.shape, 0);
    await page.getByRole("button", { name: "Move Circle earlier" }).click();
    p = await project();
    assert.equal(p.variants[0].states.find((s) => s.name === "Circle").at, 0.5);
    check("Direct state editing and reorder author new shape transitions");
    const beatEnd = page
        .getByRole("slider", { name: "Beat end", exact: true })
        .first(),
      be = await beatEnd.boundingBox();
    await page.mouse.move(be.x + 3, be.y + 10);
    await page.mouse.down();
    await page.mouse.move(be.x - 80, be.y + 10, { steps: 7 });
    await page.mouse.up();
    assert((await project()).variants[0].beats[0].end < 0.98);
    await page.getByLabel("Undo", { exact: true }).click();
    check("Story Beat duration stretches as one undoable transaction");
    await page.evaluate(async () => {
      await (await import("/src/store.ts")).studio.save();
    });
    const persisted = await project();
    await page.reload();
    await page.waitForSelector("[data-artboard]");
    assert.deepEqual(await project(), persisted);
    check(
      "SQLite autosave and hard refresh preserve variants, instruments, states and links",
    );
    await example("iGlass");
    await page.setViewportSize({ width: 1366, height: 768 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({ path: "docs/poc/laptop.png" });
    await page.setViewportSize({ width: 1512, height: 982 });
    await page.getByLabel("Focus artboard", { exact: true }).click();
    const downloadEvent = page.waitForEvent("download", { timeout: 60000 });
    await page
      .getByRole("button", { name: "Export intent", exact: true })
      .click();
    const download = await downloadEvent;
    await download.saveAs("test-results/poc/intent.zip");
    const files = unzipSync(fs.readFileSync("test-results/poc/intent.zip"));
    const intent = JSON.parse(Buffer.from(files["intent.json"]).toString());
    assert(intent.storyboard.length >= 3);
    assert(files["index.html"]);
    assert(files["composition.json"]);
    assert(Object.keys(files).some((f) => f.endsWith(".glb")));
    for (const frame of intent.storyboard)
      assert(files[frame.file].length > 10000);
    assert(intent.production.framer.includes("not verified"));
    check(
      "Export includes complete graph, packaged GLB, actual captured storyboard and independent runtime",
    );
    runtimeServer = http.createServer((req, res) => {
      const name =
        decodeURIComponent(req.url.split("?")[0]).replace(/^\//, "") ||
        "index.html";
      const bytes = files[name];
      if (!bytes) {
        res.writeHead(404);
        res.end();
        return;
      }
      const ext = name.split(".").at(-1);
      res.setHeader(
        "Content-Type",
        {
          html: "text/html",
          js: "text/javascript",
          css: "text/css",
          json: "application/json",
          glb: "model/gltf-binary",
          png: "image/png",
          svg: "image/svg+xml",
          webm: "video/webm",
        }[ext] || "application/octet-stream",
      );
      res.end(Buffer.from(bytes));
    });
    await new Promise((r) => runtimeServer.listen(0, "127.0.0.1", r));
    const runtime = await context.newPage();
    runtime.on("pageerror", (e) => errors.push(e.message));
    await runtime.goto("http://127.0.0.1:" + runtimeServer.address().port);
    await runtime.waitForSelector("[data-stage]");
    await runtime.waitForTimeout(800);
    assert.equal(await runtime.locator("canvas").count(), 1);
    assert.equal(await runtime.locator(".vi-toolbar").count(), 0);
    await runtime.evaluate(() => scrollTo(0, 800));
    await runtime.waitForFunction(
      () => Number(document.querySelector("[data-stage]")?.getAttribute("data-progress")) > 0.1,
      null, { timeout: 15000 },
    );
    assert(
      Number(
        await runtime.locator("[data-stage]").getAttribute("data-progress"),
      ) > 0.1,
    );
    await runtime.setViewportSize({ width: 480, height: 900 });
    await runtime.waitForTimeout(300);
    assert.equal(
      await runtime.locator("[data-stage]").getAttribute("data-profile"),
      "mobile",
    );
    await runtime.close();
    check(
      "Standalone exported scene runs without editor/API, scrolls and switches to mobile at 480px",
    );
    await context.close();
    const reducedContext = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      reducedMotion: "reduce",
    });
    const reducedPage = await reducedContext.newPage();
    await reducedPage.goto("http://127.0.0.1:5173");
    await reducedPage.waitForSelector("[data-stage]");
    assert.equal(
      await reducedPage.evaluate(
        () => matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
      true,
    );
    await reducedContext.close();
    check("Reduced-motion environment loads successfully");
    assert.deepEqual(errors, []);
    check("No uncaught exceptions or browser console errors");
    fs.writeFileSync(
      "docs/poc/browser-report.json",
      JSON.stringify(
        { checks, errors, passed: checks.length, at: new Date().toISOString() },
        null,
        2,
      ),
    );
  } catch (e) {
    fs.writeFileSync(
      "test-results/poc/failure.json",
      JSON.stringify({ checks, errors, error: String(e) }, null, 2),
    );
    throw e;
  } finally {
    await browser?.close();
    runtimeServer?.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
