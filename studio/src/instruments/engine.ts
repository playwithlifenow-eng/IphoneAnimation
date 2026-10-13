import { Euler, Quaternion, MathUtils } from "three";
import { evaluateEntity, num, type Props, type Entity } from "../model";
import { registry, effectiveInstrument } from "./registry";
import type { Bounds, Driver, Signals, Variant, VisualProject } from "./types";
export const clamp = (n: number, a = 0, b = 1) =>
  Math.min(b, Math.max(a, Number.isFinite(n) ? n : a));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => t * t * (3 - 2 * t);
export function driverValue(
  d: Driver,
  s: Signals,
  actorProgress: Record<string, number> = {},
): number {
  let t =
    d.source === "actor"
      ? (actorProgress[d.actorId ?? ""] ?? 0)
      : (s[d.source] as number);
  t = clamp((t - d.range[0]) / Math.max(0.0001, d.range[1] - d.range[0]));
  if (d.mode === "once") t = Math.max(t, s.entered?.[d.actorId ?? ""] ?? 0);
  for (const m of d.modulators) {
    if (m.kind === "ease") t = mix(t, smooth(clamp(t)), clamp(m.amount));
    if (m.kind === "phase") t = clamp(t + m.amount);
    if (m.kind === "threshold") t = t >= m.amount ? 1 : 0;
    if (m.kind === "invert") t = 1 - t;
    if (m.kind === "spring")
      t =
        1 -
        Math.exp(-6 * t) * Math.cos(t * Math.PI * (1 + clamp(m.amount) * 3));
  }
  return clamp(t, 0, 1.15);
}
export function interpolate(a: Props, b: Props, t: number): Props {
  const out: Props = { ...a };
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const av = a[k],
      bv = b[k];
    if (typeof av === "number" && typeof bv === "number")
      out[k] = mix(av, bv, t);
    else if (
      typeof av === "string" &&
      typeof bv === "string" &&
      /^#[\da-f]{6}$/i.test(av) &&
      /^#[\da-f]{6}$/i.test(bv)
    )
      out[k] =
        "#" +
        [1, 3, 5]
          .map((i) =>
            Math.round(
              mix(
                parseInt(av.slice(i, i + 2), 16),
                parseInt(bv.slice(i, i + 2), 16),
                t,
              ),
            )
              .toString(16)
              .padStart(2, "0"),
          )
          .join("");
    else out[k] = (t < 0.5 ? av : bv) ?? bv ?? av;
  }
  return out;
}
export function responsive(e: Entity, profile: string, width: number): Props {
  const base = { ...e.props, ...e.overrides[profile] };
  if (profile === "mobile") {
    const f = width / 390;
    for (const key of ["x", "width"])
      if (typeof base[key] === "number") base[key] = (base[key] as number) * f;
  } else if (width !== 1200) {
    const f = width / 1200;
    for (const key of ["x", "width", "fontSize"])
      if (typeof base[key] === "number") base[key] = (base[key] as number) * f;
  }
  return base;
}
export function dependencyOrder(v: Variant): string[] {
  const ids = v.document.entities.map((e) => e.id),
    outgoing = new Map(ids.map((id) => [id, [] as string[]])),
    degree = new Map(ids.map((id) => [id, 0]));
  const edges = v.links
    .filter((l) => l.enabled)
    .map((l) => [l.source, l.target]);
  for (const i of v.instruments.filter((i) => i.enabled))
    for (const d of i.drivers)
      if (d.source === "actor" && d.actorId && i.targetId)
        edges.push([d.actorId, i.targetId]);
  for (const [a, b] of edges) {
    if (!outgoing.has(a) || !degree.has(b) || a === b)
      throw new Error("Missing actor or self connection");
    outgoing.get(a)!.push(b);
    degree.set(b, degree.get(b)! + 1);
  }
  const queue = ids.filter((id) => degree.get(id) === 0),
    sorted: string[] = [];
  while (queue.length) {
    const a = queue.shift()!;
    sorted.push(a);
    for (const b of outgoing.get(a)!) {
      degree.set(b, degree.get(b)! - 1);
      if (degree.get(b) === 0) queue.push(b);
    }
  }
  if (sorted.length !== ids.length)
    throw new Error(
      "That connection would create a feedback loop. Use a one-way connection.",
    );
  return sorted;
}
export function composeRotation(p: Props, x: number, y: number, z = 0): void {
  const q = new Quaternion().setFromEuler(
    new Euler(
      ...(["rotateX", "rotateY", "rotateZ"].map((k) =>
        MathUtils.degToRad(num(p, k)),
      ) as [number, number, number]),
    ),
  );
  q.multiply(
    new Quaternion().setFromEuler(
      new Euler(
        MathUtils.degToRad(x),
        MathUtils.degToRad(y),
        MathUtils.degToRad(z),
      ),
    ),
  );
  const e = new Euler().setFromQuaternion(q);
  p.rotateX = MathUtils.radToDeg(e.x);
  p.rotateY = MathUtils.radToDeg(e.y);
  p.rotateZ = MathUtils.radToDeg(e.z);
}
export interface Evaluation {
  actors: Record<string, Props>;
  bounds: Record<string, Bounds>;
  progress: Record<string, number>;
  conflicts: string[];
  theme: number;
}
export function evaluate(
  v: Variant,
  profile: string,
  width: number,
  s: Signals,
): Evaluation {
  v = {...v, instruments: v.instruments.map(i => effectiveInstrument(i, profile))};
  const actors: Record<string, Props> = {},
    bounds: Record<string, Bounds> = {},
    progress: Record<string, number> = {},
    conflicts: string[] = [];
  let theme = 0;
  const stateList = [...v.states].sort((a, b) => a.at - b.at);
  const globalBeat = v.beats.find((b) => b.stateIds.length > 0);
  const phase =
    globalBeat && !globalBeat.enabled
      ? 0
      : globalBeat
        ? clamp(
            (s.scroll - globalBeat.start) /
              Math.max(0.001, globalBeat.end - globalBeat.start),
          )
        : s.scroll;
  const states = stateList.filter(
    (x) => !globalBeat || globalBeat.stateIds.includes(x.id),
  );
  const low = [...states].reverse().find((x) => x.at <= phase) ?? states[0],
    high = states.find((x) => x.at > phase) ?? states.at(-1);
  for (const id of dependencyOrder(v)) {
    const entity = v.document.entities.find((e) => e.id === id)!;
    let p = {
      ...evaluateEntity(
        v.document,
        entity,
        profile,
        s.time * v.document.duration,
        { scroll: s.scroll, pointerX: s.pointerX, pointerY: s.pointerY },
      ),
      ...responsive(entity, profile, width),
    };
    // Preserve existing keyed/signal values unless responsive layout owns those properties.
    const legacy = evaluateEntity(
      v.document,
      entity,
      profile,
      s.time * v.document.duration,
      { scroll: s.scroll, pointerX: s.pointerX, pointerY: s.pointerY },
    );
    for (const t of v.document.tracks.filter((t) => t.entityId === id))
      p[t.property] = legacy[t.property];
    for (const b of v.document.bindings.filter((b) => b.entityId === id))
      p[b.property] = legacy[b.property];
    if (low && high) {
      const a = {
          ...(low.actors[id] ?? {}),
          ...(profile === "mobile" ? low.mobile?.[id] : {}),
        },
        b = {
          ...(high.actors[id] ?? {}),
          ...(profile === "mobile" ? high.mobile?.[id] : {}),
        };
      const stateProps = interpolate(
        a,
        b,
        smooth(clamp((phase - low.at) / Math.max(0.0001, high.at - low.at))),
      );
      const ratio = width / (profile === "mobile" ? 390 : 1200);
      for (const k of ["x", "width"])
        if (typeof stateProps[k] === "number")
          stateProps[k] = (stateProps[k] as number) * ratio;
      p = { ...p, ...stateProps };
    }
    if (s.orbit?.[id]) composeRotation(p, s.orbit[id][0], s.orbit[id][1]);
    const owners = new Map<string, string>();
    for (const i of v.instruments.filter(
      (i) =>
        i.enabled &&
        i.targetId === id &&
        (i.scope === "base" || i.scope === profile),
    )) {
      const def = registry[i.definitionId];
      if (!def) continue;
      const beat = v.beats.find((b) => b.id === i.beatId);
      if (beat && !beat.enabled) continue;
      const vals = { ...i.macroValues, ...i.advancedValues },
        a = (k: string) => vals[k] ?? 0;
      const ds = {
        ...i.drivers[0],
        ...(i.drivers[0].mode === "once" ? { actorId: id } : {}),
      };
      let t = driverValue(
        ds,
        beat
          ? {
              ...s,
              scroll: clamp(
                (s.scroll - beat.start) /
                  Math.max(0.001, beat.end - beat.start),
              ),
            }
          : s,
        progress,
      );
      if (s.reducedMotion) t = 1;
      const strength = beat?.strength ?? 1;
      t *= strength;
      progress[id] = t;
      const output: Props = {};
      switch (i.definitionId) {
        case "parallax":
          output.mediaY = (t - 0.5) * a("depth") * num(p, "height", 400) * 0.5;
          output.mediaScale = 1 + a("depth") * 0.55 + a("overscan") * 0.3;
          output.focus = a("focus");
          output.mediaAxis = a("axis");
          break;
        case "rise":
          output.translateY = (1 - t) * a("lift");
          output.opacity =
            clamp(t * (1.2 + a("softness"))) *
            (1 - clamp((s.scroll - 0.85) / 0.15) * a("exit"));
          break;
        case "settle":
          output.visualScale = 1 - a("depth") * (1 - t);
          output.opacity = clamp(t * 2);
          break;
        case "aperture":
          output.aperture = mix(a("open"), a("end"), t);
          output.roundness = a("shape");
          output.focusX = a("focusX");
          output.focusY = a("focusY");
          break;
        case "orbit":
          composeRotation(p, a("tilt") * t, a("turn") * t);
          break;
        case "glint": {
          const angle =
            ((a("angle") + a("spread") * t + num(p, "rotateY") * 0.5) *
              Math.PI) /
            180;
          output.lightX = Math.sin(angle) * 6;
          output.lightY = a("height");
          output.key = a("intensity");
          output.glint = clamp((Math.sin(angle) + 1) / 2);
          break;
        }
        case "part":
          output.partLift = a("lift") * t;
          output.partHinge = a("hinge") * t;
          output.partIndex = Math.round(a("part"));
          output.partAxis = Math.round(a("axis"));
          break;
        case "camera":
          output.cameraZ = 5 - a("dolly") * t;
          output.cameraYaw = a("orbit") * t;
          output.fov = a("fov");
          break;
        case "material":
          output.solid = clamp(t * a("solid"));
          output.roughness = a("roughness");
          output.metalness = a("metal");
          break;
        case "hotspot":
          output.hotspot = true;
          output.hotspotSize = a("size");
          break;
        case "stagger":
          output.textReveal = t;
          output.stagger = a("stagger");
          output.textLift = a("lift");
          break;
        case "counter":
          output.text = String(Math.round(mix(a("start"), a("end"), t)));
          break;
        case "velocity":
          output.skew = s.reducedMotion
            ? 0
            : clamp(s.velocity * a("amount"), -a("limit"), a("limit"));
          output.visualScale =
            1 +
            (s.reducedMotion
              ? 0
              : Math.min(0.08, Math.abs(s.velocity) * a("amount") * 0.005));
          break;
        case "depth":
          output.translateY = (t - 0.5) * a("depth") * 120;
          output.mist = a("mist");
          break;
        case "curtain":
          output.curtain = 1 - clamp(t * a("amount") * 1.45);
          break;
        case "drift":
          output.translateX = (s.pointerX - 0.5) * a("distance");
          output.translateY = (s.pointerY - 0.5) * a("distance");
          break;
        case "shape":
          output.shape = a("shape");
          break;
      }
      for (const [k, value] of Object.entries(output)) {
        const policy = def.composePolicy[k] ?? "replace";
        if (policy === "replace" && owners.has(k))
          conflicts.push(
            `${entity.name}: ${def.name} takes priority for ${k} over ${owners.get(k)}`,
          );
        if (policy === "add") p[k] = num(p, k) + Number(value);
        else if (policy === "multiply") p[k] = num(p, k, 1) * Number(value);
        else p[k] = value;
        owners.set(k, def.name);
      }
    }
    p.opacity = clamp(num(p, "opacity", 1));
    p.visualScale = clamp(num(p, "visualScale", 1), 0.01, 8);
    let bb = {
      x: num(p, "x") + num(p, "translateX"),
      y: num(p, "y") + num(p, "translateY"),
      width: num(p, "width") * num(p, "visualScale", 1),
      height: num(p, "height") * num(p, "visualScale", 1),
    };
    if (entity.kind === "scene") {
      // Bounded model proxy before a rendered projected bounding box is available.
      const w =
        bb.width *
        (0.38 +
          Math.abs(Math.sin((num(p, "rotateY") * Math.PI) / 180)) * 0.12) *
        num(p, "scale", 1);
      bb = { ...bb, x: bb.x + (bb.width - w) / 2, width: w };
    }
    if (s.bounds?.[id]) bb = s.bounds[id];
    for (const l of v.links.filter((l) => l.enabled && l.target === id)) {
      const b = bounds[l.source],
        source = actors[l.source];
      if (!b || !source) continue;
      if (l.kind === "clearance") {
        const right = width - b.x - b.width;
        if (profile === "mobile") {
          p.y = Math.min(
            num(p, "y"),
            Math.max(32, b.y - num(p, "height") - 24 * l.amount),
          );
          p.width = Math.min(num(p, "width"), width - 48);
        } else if (b.x >= right)
          p.width = clamp(
            b.x - num(p, "x") - 24 * l.amount,
            120,
            num(p, "width"),
          );
        else {
          p.x = Math.max(num(p, "x"), b.x + b.width + 24 * l.amount);
          p.width = Math.max(
            120,
            Math.min(num(p, "width"), width - num(p, "x") - 40),
          );
        }
      }
      if (l.kind === "follow") {
        p.x = b.x + b.width + 20 * l.amount;
        p.y = b.y;
      }
      if (l.kind === "align") p.y = mix(num(p, "y"), b.y, l.amount);
      if (l.kind === "glint") {
        p.lightX =
          Math.sin((num(source, "rotateY") * Math.PI) / 180) * 6 * l.amount;
        p.key =
          3 +
          Math.abs(Math.cos((num(source, "rotateY") * Math.PI) / 180)) *
            4 *
            l.amount;
        p.opacity = clamp(
          0.2 +
            Math.abs(Math.sin((num(source, "rotateY") * Math.PI) / 180)) *
              0.8 *
              l.amount,
        );
      }
      if (l.kind === "reveal")
        p.opacity = clamp((progress[l.source] ?? s.scroll) * l.amount);
      if (l.kind === "synchronize")
        composeRotation(p, 0, num(source, "rotateY") * l.amount);
    }
    actors[id] = p;
    bounds[id] =
      entity.kind === "scene"
        ? bb
        : {
            x: num(p, "x") + num(p, "translateX"),
            y: num(p, "y") + num(p, "translateY"),
            width: num(p, "width"),
            height: num(p, "height"),
          };
    progress[id] ??= s.scroll;
  }
  for (const i of v.instruments.filter((i) => i.enabled && !i.targetId))
    if (i.definitionId === "theme")
      theme = driverValue(i.drivers[0], s) * (i.macroValues.dark ?? 1);
  return { actors, bounds, progress, conflicts, theme };
}
export function validateVisual(p: VisualProject): void {
  if (
    p?.version !== 1 ||
    !Array.isArray(p.variants) ||
    !p.variants.length ||
    !Array.isArray(p.boards) ||
    !p.boards.length
  )
    throw new Error("Invalid visual project");
  const unique = (xs: { id: string }[]) =>
    new Set(xs.map((x) => x.id)).size === xs.length;
  if (!unique(p.variants) || !unique(p.boards))
    throw new Error("Duplicate visual IDs");
  for (const b of p.boards)
    if (
      !p.variants.some((v) => v.id === b.variantId) ||
      !["desktop", "mobile"].includes(b.profile) ||
      ![b.width, b.height, b.x, b.y].every(Number.isFinite) ||
      b.width < 240 ||
      b.width > 2400 ||
      b.height < 200 ||
      b.height > 4000
    )
      throw new Error("Invalid artboard");
  for (const v of p.variants) {
    if (v.document.visual)
      throw new Error("Nested visual projects are not supported");
    if (
      !unique(v.states) ||
      !unique(v.beats) ||
      !unique(v.links) ||
      new Set(v.instruments.map((i) => i.stableId)).size !==
        v.instruments.length
    )
      throw new Error("Duplicate instrument graph IDs");
    for (const i of v.instruments) {
      const d = registry[i.definitionId];
      if (
        !d ||
        i.version !== 1 ||
        (i.targetId && !v.document.entities.some((e) => e.id === i.targetId))
      )
        throw new Error("Invalid instrument target or definition");
      for (const c of [...d.inputs, ...d.advancedControls]) {
        const n = i.macroValues[c.id] ?? i.advancedValues[c.id] ?? c.default;
        if (!Number.isFinite(n) || n < c.min || n > c.max)
          throw new Error("Instrument value outside range");
      }
      if (
        !i.drivers.length ||
        i.drivers.some(
          (d) =>
            ![
              "scroll",
              "time",
              "pointerX",
              "pointerY",
              "velocity",
              "actor",
            ].includes(d.source) ||
            !d.range.every(Number.isFinite) ||
            d.range[1] <= d.range[0] ||
            d.modulators.some((m) => !Number.isFinite(m.amount)),
        )
      )
        throw new Error("Invalid driver");
    }
    for (const b of v.beats)
      if (
        !(
          b.start >= 0 &&
          b.end > b.start &&
          b.end <= 1 &&
          b.strength >= 0 &&
          b.strength <= 1
        ) ||
        b.instrumentIds.some(
          (id) => !v.instruments.some((i) => i.stableId === id),
        ) ||
        b.stateIds.some((id) => !v.states.some((s) => s.id === id))
      )
        throw new Error("Invalid Story Beat");
    for (const s of v.states)
      if (
        !Number.isFinite(s.at) ||
        s.at < 0 ||
        s.at > 1 ||
        Object.keys(s.actors).some(
          (id) => !v.document.entities.some((e) => e.id === id),
        )
      )
        throw new Error("Invalid scene state");
    for (const l of v.links)
      if (
        !Number.isFinite(l.amount) ||
        l.amount < 0 ||
        l.amount > 4 ||
        (l.sourcePort.space !== "stage" && l.sourcePort.space !== "model")
      )
        throw new Error("Invalid relation");
    dependencyOrder(v);
    if (v.instruments.some(i => i.profileOverrides?.mobile)) {
      const mobile = {...v, instruments: v.instruments.map(i => { const next = {...effectiveInstrument(i, 'mobile')}; delete next.profileOverrides; return next; })};
      validateVisual({version:1, variants:[mobile], boards:p.boards.filter(b=>b.variantId===v.id)});
    }
  }
}
