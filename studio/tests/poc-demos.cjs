const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
(async () => {
  const dataDir = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "pose-demos-"));
  const server = spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"],
    {
      env: { ...process.env, STUDIO_DATA_DIR: dataDir },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let browser;
  const only = process.env.POC_DEMO_FILTER?.split(",");
  const report = only && fs.existsSync("docs/poc/demo-report.json")
    ? JSON.parse(fs.readFileSync("docs/poc/demo-report.json", "utf8")).filter(r => !only.includes(r.example)) : [];
  try {
    await new Promise((r, j) => {
      server.stdout.on("data", (d) => {
        if (String(d).includes("Local:")) r();
      });
      server.on("exit", j);
      server.stderr.on("data", (d) => process.stderr.write(d));
    });
    browser = await chromium.launch({
      headless: true,
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    });
    for (const [id, name, control] of [
      ["iglass", "iGlass", "Part Lift / Hinge Separation"],
      ["olympic", "Olympic editorial", "Parallax Window Depth"],
      ["cartier", "Cartier rhythm", "Dual Orbit Turn"],
      ["morpho", "Morpho portal", "Aperture Portal Destination"],
      ["aevion", "Aevion states", "Dual Orbit Turn"],
      ["teatika", "Teatika material", "Glint Sweep Brilliance"],
      ["shapes", "Shape playground", "Shape"],
    ]) {
      if (only && !only.includes(id)) continue;
      const ctx = await browser.newContext({
        viewport: { width: 1512, height: 982 },
        recordVideo: {
          dir: "test-results/poc/demos",
          size: { width: 1512, height: 982 },
        },
      });
      const p = await ctx.newPage(),
        errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto("http://127.0.0.1:5173");
      await p.waitForSelector("[data-artboard]");
      await p.getByRole("button", { name: "Examples", exact: false }).click();
      await p.getByRole("button", { name, exact: false }).click();
      await p.waitForTimeout(400);
      await p.getByLabel("Focus artboard", { exact: true }).click();
      await p.waitForTimeout(800);
      const seek = async (v) => {
        const b = await p
          .getByLabel("Story progress", { exact: true })
          .boundingBox();
        await p.mouse.click(b.x + b.width * v, b.y + b.height / 2);
        await p.waitForTimeout(300);
      };
      await seek(0.12);
      const before = await p
        .locator(".vi-artboard.active .vi-stage")
        .screenshot();
      const scrub = await p
        .getByLabel("Story progress", { exact: true })
        .boundingBox();
      await p.mouse.move(scrub.x + scrub.width * 0.12, scrub.y + 2);
      await p.mouse.down();
      await p.mouse.move(scrub.x + scrub.width * 0.82, scrub.y + 2, {
        steps: 6,
      });
      await p.mouse.up();
      await p.waitForTimeout(400);
      if (id === "morpho")
        await p
          .locator(".vi-layer-row").filter({ hasText: "Portal" })
          .first()
          .click();
      const knob = p.getByLabel(control, { exact: true });
      assert.equal(await knob.count(), 1, `${id}: live control ${control}`);
      {
        await knob.scrollIntoViewIfNeeded();
        const r = await knob.boundingBox();
        await p.mouse.move(r.x + r.width * 0.45, r.y + 2);
        await p.mouse.down();
        await p.mouse.move(r.x + r.width * 0.82, r.y + 2, { steps: 6 });
        await p.mouse.up();
      }
      if (["iglass", "aevion"].includes(id)) {
        const r = await p
          .locator('.vi-artboard.active [data-actor="product"]')
          .boundingBox();
        await p.mouse.move(r.x + r.width * 0.5, r.y + r.height * 0.45);
        await p.mouse.down();
        await p.mouse.move(
          r.x + r.width * 0.5 + 65,
          r.y + r.height * 0.45 + 25,
          { steps: 6 },
        );
        await p.mouse.up();
        await p.waitForTimeout(900);
      }
      if (id === "iglass" || id === "cartier") {
        await knob.scrollIntoViewIfNeeded();
        const range = await knob.boundingBox();
        await p.mouse.click(range.x + range.width * (id === "iglass" ? 0.25 : 0.59), range.y + range.height / 2);
      }
      await seek(
        id === "morpho"
          ? 0.77
          : id === "cartier"
            ? 0.8
            : id === "olympic"
              ? 0.14
              : 0.63,
      );
      await p.waitForTimeout(500);
      const after = await p
        .locator(".vi-artboard.active .vi-stage")
        .screenshot();
      assert.notEqual(
        crypto.createHash("sha256").update(before).digest("hex"),
        crypto.createHash("sha256").update(after).digest("hex"),
      );
      await p.screenshot({ path: `docs/poc/${id}.png` });
      await p
        .locator(".vi-artboard.active .vi-stage")
        .screenshot({ path: `docs/poc/${id}-stage.png` });
      await seek(0.3);
      await p.waitForTimeout(200);
      await seek(0.7);
      if (id === "cartier") {
        await seek(1);
        await p.waitForTimeout(800);
      }
      await p.evaluate(async () => {
        await (await import("/src/store.ts")).studio.save();
      });
      assert.deepEqual(errors, []);
      const video = p.video();
      await ctx.close();
      await video.saveAs(path.resolve(`docs/poc/${id}.webm`));
      report.push({
        example: id,
        recordedAt: new Date().toISOString(),
        sourceCommit: require("node:child_process").execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        control,
        renderer:
          id === "iglass"
            ? "original GLB"
            : id === "olympic" || id === "shapes"
              ? "DOM / vector media"
              : "original procedural fixture",
        stagePixelChange: true,
        errors,
        screenshot: `${id}.png`,
        video: `${id}.webm`,
      });
      console.log("CAPTURE " + id);
    }
    fs.writeFileSync(
      "docs/poc/demo-report.json",
      JSON.stringify(report, null, 2),
    );
  } finally {
    await browser?.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
