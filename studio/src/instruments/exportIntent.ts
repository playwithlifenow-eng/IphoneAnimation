import { toPng } from "html-to-image";
import { zipSync, strToU8 } from "fflate";
import { download } from "../export";
import { clone } from "../model";
import { registry } from "./registry";
import type { Artboard, VisualProject } from "./types";
export async function exportIntent(
  project: VisualProject,
  board: Artboard,
  progress: number,
  capture: (p: number) => Promise<HTMLElement>,
) {
  const files: Record<string, Uint8Array> = {},
    p = clone(project),
    v = p.variants.find((v) => v.id === board.variantId)!;
  const at = [
    ...new Set([progress, ...v.states.map((s) => s.at), 0, 1]),
  ].sort();
  const frames = [];
  for (let i = 0; i < at.length; i++) {
    const el = await capture(at[i]);
    const data = await toPng(el, {
      pixelRatio: 1,
      cacheBust: false,
      filter: (n) =>
        !(
          n instanceof HTMLElement &&
          /vi-(actor-label|width-handle|size-handle|aperture-handle|fixture-tag)/.test(
            n.className,
          )
        ),
    });
    const bytes = Uint8Array.from(atob(data.split(",")[1]), (c) =>
        c.charCodeAt(0),
      ),
      name = `storyboard/frame-${i.toString().padStart(2, "0")}.png`;
    files[name] = bytes;
    frames.push({
      file: name,
      progress: at[i],
      artboard: board.id,
      activeModel: "real",
      otherModels: "live pose proxy",
    });
  }
  await capture(progress);
  const urls = new Set<string>();
  const scan = (x: unknown) => {
    if (typeof x === "string" && /^(\/assets\/|https?:\/\/)/.test(x))
      urls.add(x);
    else if (x && typeof x === "object") Object.values(x).forEach(scan);
  };
  scan(p);
  const replacements = new Map<string, string>();
  let index = 0;
  for (const url of urls) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not package asset: ${url}`);
    const path = `media/${index++}-${url.split("/").at(-1)!.split("?")[0]}`;
    files[path] = new Uint8Array(await res.arrayBuffer());
    replacements.set(url, "./" + path);
  }
  const portable = JSON.parse(
    JSON.stringify(p, (_k, val) =>
      typeof val === "string" ? (replacements.get(val) ?? val) : val,
    ),
  );
  const defs = [
    ...new Set(
      p.variants.flatMap((v) => v.instruments.map((i) => i.definitionId)),
    ),
  ].map((id) => registry[id]);
  const intent = {
    version: 1,
    kind: "pose-visual-intent",
    selected: { artboard: board.id, progress },
    project: portable,
    instrumentDefinitions: defs,
    storyboard: frames,
    production: {
      react_r3f: "Shared bounded evaluator runtime",
      framer: "Translation required; native host not verified",
      webflow: "Translation required; native Designer mapping not verified",
      arbitraryReactImport: "unsupported",
      fixtures:
        "Original simplified watch/drone/can/case; not source-site models",
      depth: "CSS planes, not physically depth-aware refraction",
      hotspotOcclusion: "Frustum clipping; no surface occlusion test",
    },
    references: p.variants.flatMap((v) => v.references),
    capture: {
      type: "actual DOM/WebGL raster frames",
      video: "Reproducible through tests/browser-poc.cjs",
    },
  };
  files["intent.json"] = strToU8(JSON.stringify(intent, null, 2));
  files["composition.json"] = strToU8(
    JSON.stringify({ project: portable, boardId: board.id }),
  );
  const runtime = await fetch("/api/runtime-files?visual=1");
  if (!runtime.ok)
    throw new Error(
      (await runtime.json()).error ?? "Build the runtime before export",
    );
  const data = await runtime.json();
  for (const [path, base64] of Object.entries(
    data.files as Record<string, string>,
  ))
    files[path] = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  files["README.txt"] = strToU8(
    "Serve this folder over HTTP (python -m http.server 8080). Open index.html. Scroll and drag the product. intent.json contains the complete editable graph and actual storyboard captures. Framer/Webflow require a production translation and are not claimed verified. Only the selected 3D actor uses full WebGL; secondary models are labelled pose proxies. Sample scenery is original vector artwork; tide.webm is an animated illustration.",
  );
  download("pose-visual-intent.zip", zipSync(files), "application/zip");
}
