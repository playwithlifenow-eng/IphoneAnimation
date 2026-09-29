import { bundleComponent, parseComponentUrl } from "./component-import";
import { sourceIdentity } from "./build-identity";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { validateWorkspace } from "./src/model";
const dir = resolve(process.env.STUDIO_DATA_DIR ?? ".studio-data");
mkdirSync(resolve(dir, "assets"), { recursive: true });
const db = new DatabaseSync(resolve(dir, "studio.sqlite"));
db.exec(
  "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, version INTEGER NOT NULL, updated INTEGER NOT NULL)",
);
const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
};
async function body(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 40 * 1024 * 1024)
      throw new Error("Project exceeds 40 MB; use external media assets.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function middleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  const path = (req.url ?? "").split("?")[0];
  if (!path.startsWith("/api/") && !path.startsWith("/assets/user-") && !path.startsWith("/assets/component-"))
    return next();
  try {
    if (req.method !== "GET" && req.headers.origin) {
      const origin = new URL(req.headers.origin);
      if (origin.host !== req.headers.host)
        return json(res, 403, { error: "Origin mismatch." });
    }
    if (path === "/api/components/import" && req.method === "POST") {
      const data = await body(req);
      const sourceUrl = parseComponentUrl(String(data.source ?? ""));
      const bytes = await bundleComponent(sourceUrl);
      const hash = createHash("sha256").update(bytes).digest("hex");
      const name = `component-${hash}.js`;
      writeFileSync(resolve(dir, "assets", name), bytes);
      return json(res, 201, { sourceUrl, bundle: `/assets/${name}`, hash });
    }
    if (path === "/api/components/bundle" && req.method === "POST") {
      const data = await body(req);
      const bytes = Buffer.from(data.data, "base64");
      if (bytes.length > 20 * 1024 * 1024) throw new Error("Component exceeds 20 MB.");
      const hash = createHash("sha256").update(bytes).digest("hex");
      if (hash !== data.hash) throw new Error("Component bundle hash mismatch.");
      const name = `component-${hash}.js`;
      writeFileSync(resolve(dir, "assets", name), bytes);
      return json(res, 201, { bundle: `/assets/${name}` });
    }
    if (/^\/assets\/component-[a-f0-9]{64}\.js$/.test(path) && req.method === "GET") {
      const file = resolve(dir, "assets", basename(path));
      if (!existsSync(file)) return json(res, 404, { error: "Component bundle missing. Re-import the component." });
      res.writeHead(200, { "Content-Type": "text/javascript", "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff" });
      res.end(readFileSync(file)); return;
    }
    if (path === "/api/workspace" && req.method === "GET") {
      const row = db.prepare("SELECT * FROM workspace WHERE id=1").get() as
        | { payload: string; version: number; updated: number }
        | undefined;
      return json(res, 200, {
        workspace: row ? JSON.parse(row.payload) : null,
        version: row?.version ?? 0,
        updatedAt: row?.updated ?? 0,
      });
    }
    if (path === "/api/workspace" && req.method === "PUT") {
      const data = await body(req);
      const w = validateWorkspace(data.workspace);
      const row = db
        .prepare("SELECT version FROM workspace WHERE id=1")
        .get() as { version: number } | undefined;
      const version = row?.version ?? 0;
      if (data.expectedVersion !== version)
        return json(res, 409, {
          error:
            "Another window saved newer changes. Export your edits before reloading.",
        });
      const now = Date.now();
      db.prepare(
        "INSERT INTO workspace(id,payload,version,updated) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,version=excluded.version,updated=excluded.updated",
      ).run(JSON.stringify(w), version + 1, now);
      return json(res, 200, { version: version + 1, updatedAt: now });
    }
    if (path === "/api/assets" && req.method === "POST") {
      const data = await body(req);
      const ext = String(data.name).split(".").at(-1)?.toLowerCase();
      if (
        ![
          "glb",
          "png",
          "jpg",
          "jpeg",
          "webp",
          "avif",
          "svg",
          "mp4",
          "webm",
        ].includes(ext ?? "")
      )
        throw new Error("Unsupported asset type.");
      const bytes = Buffer.from(data.data, "base64");
      if (bytes.length > 25 * 1024 * 1024)
        throw new Error("Asset exceeds 25 MB.");
      if (ext === "glb" && bytes.subarray(0, 4).toString() !== "glTF")
        throw new Error("Not a binary glTF file.");
      const hash = createHash("sha256").update(bytes).digest("hex");
      const name = `user-${hash}.${ext}`;
      writeFileSync(resolve(dir, "assets", name), bytes);
      return json(res, 201, { url: `/assets/${name}`, hash, name: data.name });
    }
    if (path.startsWith("/assets/user-") && req.method === "GET") {
      const name = basename(path);
      if (
        !/^user-[a-f0-9]{64}\.(glb|png|jpg|jpeg|webp|avif|svg|mp4|webm)$/.test(
          name,
        )
      )
        return json(res, 404, { error: "Asset not found" });
      const file = resolve(dir, "assets", name);
      if (!existsSync(file))
        return json(res, 404, { error: "Asset not found" });
      const types: Record<string, string> = {
        glb: "model/gltf-binary",
        svg: "image/svg+xml",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        webp: "image/webp",
        avif: "image/avif",
        mp4: "video/mp4",
        webm: "video/webm",
      };
      res.writeHead(200, {
        "Content-Type": types[name.split(".").at(-1)!],
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'",
      });
      res.end(readFileSync(file));
      return;
    }
    if (path === "/api/runtime-files" && req.method === "GET") {
      const dist = resolve("dist"),
        manifestPath = resolve(dist, ".vite/manifest.json");
      if (!existsSync(manifestPath))
        return json(res, 409, {
          error: "Build the runtime first with npm run build.",
        });
      const implementation = JSON.parse(
        readFileSync(resolve(dist, "implementation.json"), "utf8"),
      );
      if (implementation.sourceHash !== sourceIdentity())
        return json(res, 409, {
          error:
            "The runtime build is older than this source. Run npm run build before exporting.",
        });
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      const files: Record<string, string> = {};
      const visited = new Set<string>();
      function add(key: string) {
        if (visited.has(key)) return;
        visited.add(key);
        const item = manifest[key];
        if (!item) throw new Error("Missing runtime manifest entry.");
        for (const f of [
          item.file,
          ...(item.css ?? []),
          ...(item.assets ?? []),
        ])
          files[f] = readFileSync(resolve(dist, f)).toString("base64");
        for (const key of [
          ...(item.imports ?? []),
          ...(item.dynamicImports ?? []),
        ])
          add(key);
      }
      add("runtime.html");
      files["index.html"] = readFileSync(
        resolve(dist, "runtime.html"),
      ).toString("base64");
      return json(res, 200, { files, implementation });
    }
    return json(res, 404, { error: "Unknown endpoint." });
  } catch (error) {
    return json(res, 400, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
