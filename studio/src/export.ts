import { zipSync, strToU8 } from "fflate";
import { instrumentManifest } from "./capabilities";
import {
  clone,
  validateWorkspace,
  type StudioDocument,
  type Workspace,
  type Asset,
} from "./model";
export function download(
  name: string,
  data: BlobPart,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function referencedAssets(d: StudioDocument): Asset[] {
  const map = new Map(d.assets.map((a) => [a.url, a]));
  for (const e of d.entities) {
    const key =
      e.kind === "scene"
        ? "modelUrl"
        : ["image", "video", "svg"].includes(e.kind)
          ? "src"
          : null;
    if (!key) continue;
    for (const [scope, p] of Object.entries({
      base: e.props,
      ...e.overrides,
    })) {
      const url = p[key];
      if (typeof url !== "string" || !url || map.has(url)) continue;
      map.set(url, {
        id: `linked-${e.id}-${scope}`,
        name: e.name,
        url,
        type: e.kind === "scene" ? "model" : (e.kind as Asset["type"]),
      });
    }
  }
  return [...map.values()];
}
interface EmbeddedAsset {
  url: string;
  name: string;
  data: string;
}
const documents = (w: Workspace) => [
  w.document,
  ...w.takes.map((t) => t.document),
  ...w.episodes.map((e) => e.document),
];
async function packAsset(asset: Asset): Promise<EmbeddedAsset> {
  const response = await fetch(asset.url);
  if (!response.ok) throw new Error(`Cannot include asset ${asset.name}`);
  const bytes = await response.arrayBuffer();
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  const type = response.headers.get("Content-Type")?.split(";")[0];
  const extensions: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/svg+xml": "svg",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "model/gltf-binary": "glb",
  };
  const suffix = asset.url.split("?")[0].split(".").at(-1) ?? "";
  const extension =
    extensions[type ?? ""] ??
    (asset.type === "model"
      ? "glb"
      : asset.type === "svg"
        ? "svg"
        : asset.type === "video"
          ? "mp4"
          : /^(png|jpg|jpeg|webp|avif)$/.test(suffix)
            ? suffix
            : "png");
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(new Blob([bytes]));
  });
  return {
    url: `/assets/user-${hash}.${extension}`,
    name: `asset-${hash}.${extension}`,
    data,
  };
}
export async function portableWorkspace(workspace: Workspace) {
  const copy = clone(workspace),
    docs = documents(copy);
  const assets = new Map(
    docs.flatMap((d) => referencedAssets(d)).map((a) => [a.url, a]),
  );
  const bundle = new Map<string, EmbeddedAsset>(),
    converted = new Map<string, string>();
  for (const asset of assets.values()) {
    const packed = await packAsset(asset);
    bundle.set(packed.url, packed);
    converted.set(asset.url, packed.url);
  }
  for (const d of docs) remapAssets(d, converted);
  const componentBundles = [];
  for (const url of new Set(docs.flatMap(d => (d.components ?? []).map(c => c.bundle)))) {
    const r = await fetch(url); if (!r.ok) throw new Error("Cannot package imported component.");
    const bytes = new Uint8Array(await r.arrayBuffer());
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map(x => x.toString(16).padStart(2, "0")).join("");
    let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
    componentBundles.push({ hash, data: btoa(binary) });
  }
  return { ...copy, embeddedAssets: [...bundle.values()], componentBundles };
}
export async function importProject(input: unknown): Promise<Workspace> {
  const copy = validateWorkspace(input) as Workspace & {
    embeddedAssets?: EmbeddedAsset[];
    componentBundles?: { hash: string; data: string }[];
  };
  const bundle = copy.embeddedAssets;
  delete copy.embeddedAssets;
  const componentBundles = copy.componentBundles; delete copy.componentBundles;
  if (componentBundles !== undefined) {
    if (!Array.isArray(componentBundles)) throw new Error("Invalid component bundle list.");
    for (const bundle of componentBundles) {
      const r = await fetch("/api/components/bundle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bundle) });
      const result = await r.json(); if (!r.ok) throw new Error(result.error);
    }
  }
  const upload = async (a: EmbeddedAsset) => {
    if (
      typeof a.name !== "string" ||
      typeof a.data !== "string" ||
      !/^\/assets\/user-[a-f0-9]{64}\.(glb|png|jpg|jpeg|webp|avif|svg|mp4|webm)$/.test(
        a.url,
      )
    )
      throw new Error("Invalid bundled asset.");
    const response = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: a.name, data: a.data }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    if (result.url !== a.url) throw new Error("Bundled asset hash mismatch.");
    return result.url as string;
  };
  if (bundle !== undefined) {
    if (!Array.isArray(bundle)) throw new Error("Invalid asset bundle.");
    for (const asset of bundle) await upload(asset);
  }
  // Also accept early portable projects that used repeated data URLs.
  const converted = new Map<string, string>();
  const assets = new Map(
    documents(copy)
      .flatMap((d) => referencedAssets(d))
      .filter((a) => a.url.startsWith("data:"))
      .map((a) => [a.url, a]),
  );
  for (const asset of assets.values()) {
    const packed = await packAsset(asset);
    converted.set(asset.url, await upload(packed));
  }
  for (const d of documents(copy)) remapAssets(d, converted);
  return validateWorkspace(copy);
}
function remapAssets(d: StudioDocument, map: Map<string, string>) {
  for (const a of d.assets) a.url = map.get(a.url) ?? a.url;
  for (const e of d.entities) {
    for (const p of [e.props, ...Object.values(e.overrides)])
      for (const key of ["src", "modelUrl"])
        if (typeof p[key] === "string")
          p[key] = map.get(p[key] as string) ?? p[key];
  }
}
export async function exportRuntime(document: StudioDocument) {
  const res = await fetch("/api/runtime-files");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  const files: Record<string, Uint8Array> = {};
  for (const [name, value] of Object.entries(
    data.files as Record<string, string>,
  ))
    files[name] = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  const doc = clone(document),
    map = new Map<string, string>();
  for (const asset of referencedAssets(doc)) {
    const r = await fetch(asset.url);
    if (!r.ok) throw new Error(`Missing asset: ${asset.name}`);
    const mediaType = r.headers.get("Content-Type")?.split(";")[0];
    const extensions: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "image/avif": "avif",
      "image/svg+xml": "svg",
      "video/mp4": "mp4",
      "video/webm": "webm",
      "model/gltf-binary": "glb",
    };
    const extension =
      extensions[mediaType ?? ""] ??
      (asset.type === "model"
        ? "glb"
        : asset.type === "video"
          ? "mp4"
          : asset.type === "svg"
            ? "svg"
            : (asset.name.split(".").at(-1) ?? "png"));
    const path = `media/${asset.id.replace(/[^a-z0-9-]/gi, "")}.${extension.length < 6 ? extension : "png"}`;
    files[path] = new Uint8Array(await r.arrayBuffer());
    map.set(asset.url, `./${path}`);
  }
  remapAssets(doc, map);
  for (const c of doc.components ?? []) {
    const r = await fetch(c.bundle); if (!r.ok) throw new Error(`Missing component: ${c.name}`);
    const bytes = new Uint8Array(await r.arrayBuffer());
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map(x => x.toString(16).padStart(2, "0")).join("");
    const path = `media/component-${hash}.js`; files[path] = bytes; c.bundle = `./${path}`;
  }
  files["composition.json"] = strToU8(JSON.stringify(doc, null, 2));
  const digest = async (bytes: Uint8Array) =>
    Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
  const hashes = Object.fromEntries(
    await Promise.all(
      Object.entries(files).map(async ([name, bytes]) => [
        name,
        await digest(bytes),
      ]),
    ),
  );
  files["composition-manifest.json"] = strToU8(
    JSON.stringify(
      {
        schemaVersion: 1,
        id: doc.id,
        revision: doc.revision,
        file: "composition.json",
        sha256: hashes["composition.json"],
        profiles: doc.profiles,
        assets: doc.assets,
      },
      null,
      2,
    ),
  );
  files["instrument-manifest.json"] = strToU8(
    JSON.stringify(instrumentManifest(doc.entities), null, 2),
  );
  files["implementation-manifest.json"] = strToU8(
    JSON.stringify(
      { ...data.implementation, artifacts: hashes, editorIncluded: false },
      null,
      2,
    ),
  );
  files["environment-manifest.json"] = strToU8(
    JSON.stringify(
      {
        schemaVersion: 1,
        capturedAt: new Date().toISOString(),
        exportBrowser: navigator.userAgent,
        viewport: [innerWidth, innerHeight],
        devicePixelRatio,
        host: "static-http",
        targetBrowser: "unverified until opened",
        reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
        framer: "not-yet-verified",
      },
      null,
      2,
    ),
  );
  files["delivery-manifest.json"] = strToU8(
    JSON.stringify(
      {
        version: 1,
        documentId: doc.id,
        revision: doc.revision,
        implementation: "iglass-studio/0.1.0",
        runtime: "shared-evaluator",
        host: "static-http",
        framer: "not-yet-verified",
        editorIncluded: false,
        originalHero: "unchanged",
      },
      null,
      2,
    ),
  );
  files["README.txt"] = strToU8(
    "Serve this folder over HTTP (for example python -m http.server 8080). Open index.html. This export contains the shared composition runtime and assets; it does not include the editor, feedback store or SQLite service. Framer host compatibility has not yet been verified. Media references are packaged. Fonts and CSS background URLs remain external; native video uses browser controls and is not synchronised to choreography.",
  );
  download("iglass-composition-runtime.zip", zipSync(files), "application/zip");
}
