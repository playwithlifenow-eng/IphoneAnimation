const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { unzipSync } = require("fflate");
(async () => {
  fs.mkdirSync("test-results", { recursive: true });
  const dataDir = fs.mkdtempSync(path.resolve("test-results/workspace-"));
  const server = spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"],
    {
      env: { ...process.env, STUDIO_DATA_DIR: dataDir },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let browser, runtimeServer;
  try {
    await new Promise((resolve, reject) => {
      server.stdout.on("data", (d) => {
        if (d.toString().includes("Local:")) resolve();
      });
      server.stderr.on("data", (d) => process.stderr.write(d));
      server.on("exit", (code) => reject(new Error("Vite exited " + code)));
    });
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.STUDIO_BROWSER_EXECUTABLE || undefined,
      args: process.env.STUDIO_BROWSER_EXECUTABLE
        ? [
            "--no-sandbox",
            "--no-zygote",
            "--single-process",
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
            "--disable-dev-shm-usage",
          ]
        : [],
    });
    const context = await browser.newContext({
      viewport: { width: 1512, height: 982 },
      acceptDownloads: true,
    });
    const page = await context.newPage();
    const errors = [];
    const checks = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    const state = () =>
      page.evaluate(async () => (await import("/src/store.ts")).studio.get());
    const doc = async () => (await state()).workspace.document;
    const check = (name) => {
      checks.push(name);
      console.log("PASS " + name);
    };
    await page.goto("http://127.0.0.1:5173");
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(async () => (await import("/src/store.ts")).studio.get().loaded);
    assert.equal(await page.title(), "iGlass Composition Studio");
    assert.equal(await page.locator("canvas").count(), 1);
    assert.equal(await page.locator("vite-error-overlay").count(), 0);
    assert(
      !(await page
        .getByText("3D preview unavailable", { exact: true })
        .count()),
    );
    await page.screenshot({ path: "test-results/desktop.png" });
    check("Editor and original GLB load");
    await page
      .getByLabel("Element text", { exact: true })
      .fill("A sharper\npoint of view.");
    assert.equal(
      (await doc()).copy.find((a) => a.id === "copy-headline").text,
      "A sharper\npoint of view.",
    );
    await page.getByLabel("Undo", { exact: true }).click();
    assert.equal(
      (await doc()).copy.find((a) => a.id === "copy-headline").text,
      "A clearer\npoint of view.",
    );
    await page.getByLabel("Redo", { exact: true }).click();
    assert.equal(
      (await doc()).copy.find((a) => a.id === "copy-headline").text,
      "A sharper\npoint of view.",
    );
    check("Shared copy editing and undo/redo");
    const headline = page.locator('[data-entity="headline"] .render-text');
    await headline.dblclick();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.insertText("Directly authored.");
    await page.getByRole("button", { name: "Compose", exact: true }).click();
    assert.equal(
      (await doc()).copy.find((a) => a.id === "copy-headline").text,
      "Directly authored.",
    );
    await page.getByLabel("Undo", { exact: true }).click();
    check("Direct text manipulation");
    const element = page.locator('[data-entity="headline"]');
    const before = await doc();
    const box = await element.boundingBox();
    await page.mouse.move(box.x + box.width - 12, box.y + box.height - 12);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width + 28, box.y + box.height + 12, {
      steps: 5,
    });
    await page.mouse.up();
    const moved = await doc();
    assert(moved.entities.find((e) => e.id === "headline").props.x > 78);
    assert.equal(moved.revision, before.revision + 1);
    await page.getByLabel("Undo", { exact: true }).click();
    assert.equal(
      (await doc()).entities.find((e) => e.id === "headline").props.x,
      78,
    );
    check("Pointer drag is one undoable transaction");
    const dragBox = await element.boundingBox();
    await page.mouse.move(
      dragBox.x + dragBox.width - 12,
      dragBox.y + dragBox.height - 12,
    );
    await page.mouse.down();
    await page.mouse.move(
      dragBox.x + dragBox.width + 48,
      dragBox.y + dragBox.height + 12,
    );
    await page.keyboard.press("Escape");
    await page.mouse.up();
    assert.equal(
      (await doc()).entities.find((e) => e.id === "headline").props.x,
      78,
    );
    check("Escape cancels pointer edits");
    await page.locator(".layer-select").filter({ hasText: "The main idea" }).click();
    await page.getByRole("button", { name: "Mobile", exact: true }).click();
    await page.getByLabel("X", { exact: true }).fill("37");
    await page.getByLabel("X", { exact: true }).blur();
    let entity = (await doc()).entities.find((e) => e.id === "headline");
    assert.equal(entity.props.x, 78);
    assert.equal(entity.overrides.mobile.x, 37);
    await page.screenshot({ path: "test-results/mobile.png" });
    await page.getByRole("button", { name: "Desktop", exact: true }).click();
    assert.equal(
      await page.getByLabel("X", { exact: true }).inputValue(),
      "78",
    );
    check("Responsive profile overrides");
    await page.getByLabel("Edit motion path", { exact: true }).click();
    await page
      .getByRole("button", { name: "Add position key", exact: true })
      .click();
    await page.getByLabel("Animation playhead", { exact: true }).fill("4");
    await page.getByLabel("X", { exact: true }).fill("240");
    await page.getByLabel("Y", { exact: true }).fill("260");
    await page.getByLabel("Y", { exact: true }).blur();
    const point = page.getByRole("button", {
      name: "Path point at 4 seconds",
      exact: true,
    });
    const pointBox = await point.boundingBox();
    const pathBefore = await doc();
    await page.mouse.move(
      pointBox.x + pointBox.width / 2,
      pointBox.y + pointBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      pointBox.x + pointBox.width / 2 + 28,
      pointBox.y + pointBox.height / 2 + 14,
      { steps: 4 },
    );
    await page.mouse.up();
    const pathAfter = await doc();
    assert.equal(pathAfter.revision, pathBefore.revision + 1);
    assert(
      pathAfter.tracks
        .find((t) => t.entityId === "headline" && t.property === "x")
        .keys.find((k) => k.time === 4).value > 240,
    );
    await page.getByLabel("Undo", { exact: true }).click();
    assert.equal(
      (await doc()).tracks
        .find((t) => t.entityId === "headline" && t.property === "x")
        .keys.find((k) => k.time === 4).value,
      240,
    );
    await point.focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(
      (await doc()).tracks
        .find((t) => t.entityId === "headline" && t.property === "x")
        .keys.find((k) => k.time === 4).value,
      241,
    );
    await page.screenshot({ path: "test-results/path.png" });
    await page.getByLabel("Edit motion path", { exact: true }).click();
    await page.getByLabel("Return to start", { exact: true }).click();
    check("Spatial path handles, keyboard nudges and one-step undo");
    await page
      .locator(".layer-select")
      .filter({ hasText: "The main idea" })
      .click();
    await page
      .locator(".layer-select")
      .filter({ hasText: "Supporting copy" })
      .click({ modifiers: ["Shift"] });
    await page.getByRole("button", { name: "Relations", exact: true }).click();
    await page
      .getByRole("button", { name: "Add relationship", exact: true })
      .click();
    const relation = (await doc()).relationships[0];
    assert.equal(relation.kind, "clearance");
    await page
      .getByLabel("Show connector " + relation.id, { exact: true })
      .check();
    assert.equal(
      await page.locator(".relationship-connectors line").count(),
      1,
    );
    assert(
      (await page.locator(".relationship-card output").innerText()).includes(
        "px",
      ),
    );
    await page.screenshot({ path: "test-results/relationships.png" });
    check("Authored relationships, measured bounds and runtime connectors");

    await page
      .getByRole("button", { name: "Scene & look", exact: true })
      .click();
    await page.getByLabel("Rotate Y", { exact: true }).fill("31");
    await page.getByLabel("Rotate Y", { exact: true }).blur();
    assert.equal(
      (await doc()).tracks
        .find((t) => t.entityId === "phone" && t.property === "rotateY")
        .keys.find((k) => k.time === 0).value,
      31,
    );
    await page.getByLabel("Roughness", { exact: true }).fill("0.25");
    await page.getByLabel("Roughness", { exact: true }).blur();
    assert.equal(
      (await doc()).entities.find((e) => e.id === "phone").props.roughness,
      0.25,
    );
    await page
      .getByLabel("Original OLED · 3D rotateY key at 4 seconds", {
        exact: true,
      })
      .click();
    assert.equal(
      await page.getByLabel("Key value", { exact: true }).inputValue(),
      "18",
    );
    await page.getByLabel("Key value", { exact: true }).fill("22");
    assert.equal(
      (await doc()).tracks
        .find((t) => t.entityId === "phone" && t.property === "rotateY")
        .keys.find((k) => k.time === 4).value,
      22,
    );
    check("3D appearance and keyframe authoring");
    await page.getByLabel("Pose name", { exact: true }).fill("Oblique");
    await page
      .getByRole("button", { name: "Record pose", exact: true })
      .click();
    assert.equal((await doc()).poses.at(-1).name, "Oblique");
    check("Named pose capture");
    await page.getByRole("button", { name: "Takes", exact: true }).click();
    await page
      .getByRole("button", { name: "Capture current Take", exact: true })
      .click();
    await page.getByLabel("Take name", { exact: true }).fill("Quiet direction");
    await page
      .getByRole("button", { name: "Capture Take", exact: true })
      .click();
    await page.getByLabel("Rotate Z", { exact: true }).fill("12");
    await page.getByRole("button", { name: "Compare", exact: true }).click();
    assert.equal(await page.locator(".compare-stage").count(), 2);
    assert((await page.locator(".diff-list").innerText()).includes("rotateZ"));
    await page
      .waitForFunction(
        () =>
          document.querySelectorAll(
            ".compare-stage .scene-view > .scene-status",
          ).length === 0,
        {},
        { timeout: 45000 },
      )
      .catch(async (e) => {
        console.log(
          "COMPARE_STATUS",
          await page
            .locator(".compare-stage .scene-view > .scene-status")
            .allTextContents(),
          errors,
        );
        await page.screenshot({ path: "test-results/compare-error.png" });
        throw e;
      });
    await page.screenshot({ path: "test-results/compare.png" });
    await page.keyboard.press("Escape");
    check("Immutable Takes and synchronised comparison");

    await page.getByRole("tab", { name: "Behaviour", exact: false }).click();
    await page
      .getByLabel("Signal property", { exact: true })
      .selectOption("rotateX");
    await page
      .getByLabel("Signal source", { exact: true })
      .selectOption("scroll");
    await page
      .getByRole("button", { name: "Connect signal", exact: true })
      .click();
    await page
      .getByLabel("Preview scroll progress", { exact: true })
      .fill("0.75");
    await page.getByRole("tab", { name: "Design", exact: true }).click();
    assert.equal(
      await page.getByLabel("Rotate X", { exact: true }).inputValue(),
      "12",
    );
    assert.equal(
      await page.getByLabel("Rotate X", { exact: true }).isDisabled(),
      true,
    );
    check("Signal ownership and controlled preview inputs");
    await page.getByRole("button", { name: "Evaluate", exact: true }).click();
    await page
      .getByLabel("Feedback", { exact: true })
      .fill("Keep this framing; soften the light.");
    await page
      .getByRole("button", { name: "Save feedback", exact: true })
      .click();
    const episode = (await state()).workspace.episodes[0];
    assert.equal(episode.note, "Keep this framing; soften the light.");
    assert(episode.geometry.length > 0);
    assert.equal(episode.geometry[0].space, "page-css-px");
    assert.equal(episode.probes.length, 1);
    assert.equal(episode.signals.scroll, 0.75);
    assert.equal(episode.capture.originalVideo, "not-recorded");
    assert.equal(episode.document.revision, (await doc()).revision);
    check("Feedback retains exact state and honest capture provenance");
    await page.getByRole("button", { name: "Compose", exact: true }).click();
    await page.getByRole("button", { name: "Assets", exact: true }).click();
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles({
        name: "test.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="30" fill="#789467"/></svg>',
        ),
      });
    await page.waitForFunction(
      async () =>
        (await import("/src/store.ts")).studio.get().workspace.document.assets
          .length === 2,
    );
    check("Asset import and insertion");
    await page.evaluate(async () => {
      await (await import("/src/store.ts")).studio.save();
    });
    const saved = await doc();
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(async () => (await import("/src/store.ts")).studio.get().loaded);
    assert.deepEqual(await doc(), saved);
    check("SQLite save and reopen");
    await page.getByRole("button", { name: "Export", exact: true }).click();
    let downloadEvent = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Portable project", exact: false })
      .click();
    let dl = await downloadEvent;
    await dl.saveAs("test-results/project.json");
    const portable = JSON.parse(
      fs.readFileSync("test-results/project.json", "utf8"),
    );
    assert.equal(portable.embeddedAssets.length, 2);
    assert(fs.statSync("test-results/project.json").size < 8 * 1024 * 1024);
    assert(
      portable.document.assets.every((a) => a.url.startsWith("/assets/user-")),
    );
    check("Portable project includes GLB and imported assets");
    await page
      .locator("input[type=file]")
      .last()
      .setInputFiles("test-results/project.json");
    await page.waitForFunction(async () => {
      const s = (await import("/src/store.ts")).studio.get();
      return (
        s.workspace.document.assets.every((a) =>
          a.url.startsWith("/assets/user-"),
        ) && s.workspace.document.assets.length === 2
      );
    });
    assert.equal((await state()).workspace.takes.length, portable.takes.length);
    assert.equal(
      (await state()).workspace.episodes.length,
      portable.episodes.length,
    );
    await page.evaluate(async () => {
      await (await import("/src/store.ts")).studio.save();
    });
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(async () => (await import("/src/store.ts")).studio.get().loaded);
    assert.equal(
      (await doc()).entities.length,
      portable.document.entities.length,
    );
    check("Deduplicated portable project imports and reopens with Takes");
    await page.getByRole("button", { name: "Export", exact: true }).click();

    downloadEvent = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Runtime package", exact: false })
      .click();
    dl = await downloadEvent;
    await dl.saveAs("test-results/runtime.zip");
    const files = unzipSync(fs.readFileSync("test-results/runtime.zip"));
    assert(files["composition.json"]);
    assert(!Object.keys(files).some((k) => k.includes("studio-")));
    assert.equal(
      JSON.parse(Buffer.from(files["delivery-manifest.json"]).toString())
        .editorIncluded,
      false,
    );
    for (const name of [
      "composition",
      "instrument",
      "implementation",
      "environment",
    ])
      assert(files[name + "-manifest.json"]);
    const implementation = JSON.parse(
      Buffer.from(files["implementation-manifest.json"]).toString(),
    );
    const { createHash } = require("node:crypto");
    for (const [name, digest] of Object.entries(implementation.artifacts))
      assert.equal(
        createHash("sha256").update(files[name]).digest("hex"),
        digest,
      );
    check("Four manifests and exported artifact hashes");
    const mime = {
      ".html": "text/html",
      ".json": "application/json",
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".glb": "model/gltf-binary",
    };
    runtimeServer = http.createServer((req, res) => {
      const key =
        req.url === "/" ? "index.html" : req.url.slice(1).split("?")[0];
      if (!files[key]) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, {
        "Content-Type": mime[path.extname(key)] || "application/octet-stream",
      });
      res.end(Buffer.from(files[key]));
    });
    await new Promise((resolve) =>
      runtimeServer.listen(5174, "127.0.0.1", resolve),
    );
    const runtime = await context.newPage();
    runtime.on("pageerror", (e) => errors.push(e.message));
    runtime.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await runtime.goto("http://127.0.0.1:5174");
    await runtime.waitForLoadState("networkidle");
    await runtime.waitForFunction(
      () =>
        document.querySelectorAll(".scene-view > .scene-status").length === 0,
      {},
      { timeout: 45000 },
    );
    assert.equal(await runtime.locator('[data-entity="headline"]').count(), 1);
    assert.equal(await runtime.locator("canvas").count(), 1);
    assert.equal(
      await runtime.locator(".relationship-connectors line").count(),
      1,
    );
    assert.equal(
      await runtime.getByText("Unsupported or invalid document.").count(),
      0,
    );
    assert.equal(await runtime.locator(".topbar").count(), 0);
    await runtime.screenshot({ path: "test-results/runtime.png" });
    check("Exported static runtime reopens independently without editor code");
    assert.deepEqual(errors, []);
    check("No browser console errors or uncaught exceptions");
    fs.writeFileSync(
      "test-results/browser-report.json",
      JSON.stringify(
        {
          verifiedAt: new Date().toISOString(),
          checks,
          errors,
          browser: await browser.version(),
          viewport: { width: 1512, height: 982 },
        },
        null,
        2,
      ),
    );
  } finally {
    if (browser) await browser.close();
    if (runtimeServer) runtimeServer.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
