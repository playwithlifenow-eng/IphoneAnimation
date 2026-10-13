import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { num, str, type Entity, type Props } from "../model";
import { evaluate, clamp } from "./engine";
import type { Artboard, Signals, Variant, Bounds } from "./types";
import type { Projection } from "./InstrumentScene";
const InstrumentScene = lazy(() => import("./InstrumentScene"));
interface StageProps {
  variant: Variant;
  board: Artboard;
  signals: Signals;
  active: boolean;
  selection?: string;
  sceneId?: string;
  editor?: boolean;
  wires?: boolean;
  pinMode?: boolean;
  onSelect?: (id: string) => void;
  onPatch?: (id: string, patch: Props) => void;
  onDrag?: (
    e: PointerEvent<HTMLElement>,
    id: string,
    kind: "move" | "width" | "size" | "aperture",
  ) => void;
  onReady?: () => void;
  onOrbit?: (id: string, offset: [number, number]) => void;
}
function polygon(shape: number) {
  const a = [
      [0.5, 0],
      [0.625, 0.25],
      [0.75, 0.5],
      [0.875, 0.75],
      [1, 1],
      [0.75, 1],
      [0.5, 1],
      [0.25, 1],
      [0, 1],
      [0.125, 0.75],
      [0.25, 0.5],
      [0.375, 0.25],
    ],
    b = Array.from({ length: 12 }, (_, i) =>
      i < 3
        ? [i / 3, 0]
        : i < 6
          ? [1, (i - 3) / 3]
          : i < 9
            ? [1 - (i - 6) / 3, 1]
            : [0, 1 - (i - 9) / 3],
    ),
    c = Array.from({ length: 12 }, (_, i) => [
      0.5 + Math.sin((i * Math.PI) / 6) * 0.5,
      0.5 - Math.cos((i * Math.PI) / 6) * 0.5,
    ]);
  const l = shape <= 1 ? a : b,
    r = shape <= 1 ? b : c,
    t = shape <= 1 ? shape : shape - 1;
  return l
    .map(
      (p, i) =>
        `${(p[0] + (r[i][0] - p[0]) * t) * 100}% ${(p[1] + (r[i][1] - p[1]) * t) * 100}%`,
    )
    .join(",");
}
function ModelActor({
  p,
  live,
  onProjection,
  onPick,
  onReady,
}: {
  p: Props;
  live: boolean;
  onProjection: (p: Projection) => void;
  onPick?: (p: Props) => void;
  onReady?: () => void;
}) {
  return live ? (
    <Suspense fallback={<div className="vi-model-proxy">Loading model…</div>}>
      <InstrumentScene
        values={p}
        onProjection={onProjection}
        onPick={onPick}
        onReady={onReady}
      />
    </Suspense>
  ) : (
    <div
      className="vi-model-proxy"
      style={{
        transform: `perspective(800px) rotateX(${num(p, "rotateX")}deg) rotateY(${num(p, "rotateY")}deg) rotateZ(${num(p, "rotateZ")}deg) scale(${num(p, "scale", 1)})`,
      }}
    >
      <div className={"vi-proxy-body " + str(p, "fixture", "phone")}>
        <span />
        <i
          style={{
            transform: `translateZ(${num(p, "partLift") * 70}px) translateY(${-num(p, "partLift") * 30}px)`,
          }}
        />
      </div>
      <small>Live pose proxy</small>
    </div>
  );
}
export function Stage({
  variant: v,
  board: b,
  signals,
  active,
  selection,
  sceneId,
  editor = true,
  wires = false,
  pinMode,
  onSelect,
  onPatch,
  onDrag,
  onReady,
  onOrbit,
}: StageProps) {
  const [projections, setProjections] = useState<Record<string, Projection>>(
      {},
    ),
    [pointer, setPointer] = useState<[number, number]>([0.5, 0.5]),
    [orbit, setOrbit] = useState<Record<string, [number, number]>>({});
  const projectionCallbacks = useRef(
    new Map<string, (p: Projection) => void>(),
  );
  const release = useRef(0),
    drag = useRef<{
      id: string;
      x: number;
      y: number;
      value: [number, number];
      pointerId: number;
      el: HTMLElement;
    } | null>(null);
  const entered = useRef<Record<string, number>>({});
  for (const i of v.instruments)
    if (i.targetId && i.drivers[0].mode === "once")
      entered.current[i.targetId] = Math.max(
        entered.current[i.targetId] ?? 0,
        clamp(
          (signals.scroll - i.drivers[0].range[0]) /
            Math.max(0.001, i.drivers[0].range[1] - i.drivers[0].range[0]),
        ),
      );
  const raw = useMemo(
    () =>
      evaluate(v, b.profile, b.width, {
        ...signals,
        pointerX: pointer[0],
        pointerY: pointer[1],
        orbit,
        entered: entered.current,
      }),
    [v, b.profile, b.width, signals, pointer, orbit],
  );
  const bounds = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(projections).map(([id, proj]) => {
          const p = raw.actors[id] ?? {};
          return [
            id,
            {
              ...proj.bounds,
              x: proj.bounds.x + num(p, "x"),
              y: proj.bounds.y + num(p, "y"),
            },
          ];
        }),
      ),
    [projections, raw],
  );
  const result = useMemo(
    () =>
      evaluate(v, b.profile, b.width, {
        ...signals,
        pointerX: pointer[0],
        pointerY: pointer[1],
        orbit,
        bounds,
        entered: entered.current,
      }),
    [v, b.profile, b.width, signals, pointer, orbit, bounds],
  );
  const pinned = v.instruments.some(
    (i) => i.definitionId === "stage" && i.enabled,
  );
  const contentHeight = Math.max(
    b.height,
    ...Object.values(result.actors).map(
      (p) => num(p, "y") + num(p, "height") + 40,
    ),
  );
  const pageShift = pinned ? 0 : -signals.scroll * (contentHeight - b.height);
  const endDrag = useCallback(
    (cancel = false) => {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      if (d.el.hasPointerCapture(d.pointerId))
        d.el.releasePointerCapture(d.pointerId);
      cancelAnimationFrame(release.current);
      if (cancel) {
        setOrbit({});
        onOrbit?.(d.id, [0, 0]);
        return;
      }
      let last = performance.now();
      const decay = (now: number) => {
        const dt = (now - last) / 1000;
        last = now;
        const inst = v.instruments.find(
            (i) =>
              i.targetId === d.id && i.definitionId === "orbit" && i.enabled,
          ),
          tau = inst?.advancedValues.release ?? 0.65;
        d.value = [
          d.value[0] * Math.exp((-dt * 6) / tau),
          d.value[1] * Math.exp((-dt * 6) / tau),
        ];
        if (Math.hypot(...d.value) < 0.03) {
          setOrbit({});
          onOrbit?.(d.id, [0, 0]);
          release.current = 0;
          return;
        }
        setOrbit({ [d.id]: d.value });
        onOrbit?.(d.id, d.value);
        release.current = requestAnimationFrame(decay);
      };
      release.current = requestAnimationFrame(decay);
    },
    [v.instruments, onOrbit],
  );
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") endDrag(true);
    };
    addEventListener("keydown", key);
    return () => {
      removeEventListener("keydown", key);
      cancelAnimationFrame(release.current);
    };
  }, [endDrag]);
  useEffect(() => {
    setProjections({});
    setOrbit({});
  }, [v.id, b.width, b.profile, active]);
  const selected = v.document.entities.find((e) => e.id === selection);
  const selectedScene =
    sceneId ??
    (selected?.kind === "scene"
      ? selected.id
      : v.document.entities.find((e) => e.kind === "scene")?.id);
  const render = (entity: Entity) => {
    const p = result.actors[entity.id];
    if (!p || p.visible === false) return null;
    const id = entity.id,
      sel = selection === id,
      w = num(p, "width"),
      h = num(p, "height");
    const style: CSSProperties = {
      position: "absolute",
      left: num(p, "x"),
      top: num(p, "y"),
      width: w,
      height: h,
      opacity: num(p, "opacity", 1),
      transform: `translate(${num(p, "translateX")}px,${num(p, "translateY")}px) rotate(${num(p, "rotation")}deg) skewY(${num(p, "skew")}deg) scale(${num(p, "visualScale", 1)})`,
      color: str(p, "color", "#23372d"),
      background:
        entity.kind === "svg"
          ? "transparent"
          : str(p, "background", "transparent"),
      borderRadius: num(p, "radius"),
      fontFamily: str(p, "fontFamily", "Arial, sans-serif"),
      fontSize: num(p, "fontSize", 20),
      fontWeight: num(p, "fontWeight", 400),
      letterSpacing: num(p, "letterSpacing"),
      lineHeight: num(p, "lineHeight", 1.1),
      textAlign: str(p, "textAlign", "left") as CSSProperties["textAlign"],
      zIndex: sel ? 20 : undefined,
    };
    const isScene = entity.kind === "scene",
      proj = projections[id];
    if (!projectionCallbacks.current.has(id))
      projectionCallbacks.current.set(id, (pr) =>
        setProjections((old) =>
          JSON.stringify(old[id]) === JSON.stringify(pr)
            ? old
            : { ...old, [id]: pr },
        ),
      );
    const begin = (ev: PointerEvent<HTMLDivElement>) => {
      if (
        (ev.target as HTMLElement).closest(
          'button,[contenteditable="true"],video',
        )
      )
        return;
      ev.stopPropagation();
      onSelect?.(id);
      if (isScene && (pinMode || !active)) return;
      if (
        isScene &&
        !ev.shiftKey &&
        v.instruments.some(
          (i) => i.targetId === id && i.definitionId === "orbit" && i.enabled,
        )
      ) {
        cancelAnimationFrame(release.current);
        const el = ev.currentTarget;
        el.setPointerCapture(ev.pointerId);
        drag.current = {
          id,
          x: ev.clientX,
          y: ev.clientY,
          value: orbit[id] ?? [0, 0],
          pointerId: ev.pointerId,
          el,
        };
        return;
      }
      if (editor) onDrag?.(ev, id, "move");
    };
    return (
      <div
        key={id}
        className={`vi-actor ${sel && editor ? "is-selected" : ""} ${isScene ? "is-scene" : ""}`}
        data-actor={id}
        data-orbit={JSON.stringify(orbit[id] ?? [0, 0])}
        data-width={w}
        style={style}
        onPointerDown={begin}
        onPointerMove={(ev) => {
          const d = drag.current;
          if (!d || d.id !== id) return;
          const rect = ev.currentTarget.getBoundingClientRect(),
            scale = rect.width / w;
          const next: [number, number] = [
            d.value[0] + ((ev.clientY - d.y) * 0.5) / scale,
            d.value[1] + ((ev.clientX - d.x) * 0.5) / scale,
          ];
          d.x = ev.clientX;
          d.y = ev.clientY;
          d.value = next;
          setOrbit({ [id]: next });
          onOrbit?.(id, next);
        }}
        onPointerUp={() => endDrag()}
        onPointerCancel={() => endDrag(true)}
        onLostPointerCapture={() => {
          if (drag.current) endDrag(true);
        }}
      >
        {entity.kind === "text" || entity.kind === "button" ? (
          <div
            className="vi-text"
            contentEditable={editor && sel}
            suppressContentEditableWarning
            onDoubleClick={(e) => {
              e.stopPropagation();
              onSelect?.(id);
              (e.currentTarget as HTMLElement).focus();
            }}
            onBlur={(ev) => {
              if (editor && ev.currentTarget.innerText !== str(p, "text"))
                onPatch?.(id, { text: ev.currentTarget.innerText });
            }}
            style={{ whiteSpace: "pre-wrap", height: "100%", outline: "none" }}
          >
            {typeof p.textReveal === "number"
              ? str(p, "text")
                  .split("\n")
                  .map((line, i) => (
                    <span
                      key={i}
                      style={{ display: "block", overflow: "hidden" }}
                    >
                      <span
                        style={{
                          display: "block",
                          transform: `translateY(${(1 - clamp(num(p, "textReveal") * 1.5 - i * num(p, "stagger") * 0.3)) * num(p, "textLift", 55)}px)`,
                          opacity: clamp(
                            num(p, "textReveal") * 1.5 -
                              i * num(p, "stagger") * 0.3,
                          ),
                        }}
                      >
                        {line}
                      </span>
                    </span>
                  ))
              : str(p, "text")}
          </div>
        ) : null}
        {entity.kind === "image" || entity.kind === "video" ? (
          <div
            className="vi-media"
            style={{
              width: "100%",
              height: "100%",
              overflow: "hidden",
              borderRadius: num(p, "radius"),
              clipPath:
                typeof p.aperture === "number"
                  ? `inset(${Math.max(0, (1 - num(p, "aperture")) * 50)}% round ${num(p, "roundness") * 50}%)`
                  : undefined,
            }}
          >
            {entity.kind === "image" ? (
              <img
                draggable={false}
                src={str(p, "src")}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: `${num(p, "focusX", 0.5) * 100}% ${num(p, "focus", 0.5) * 100}%`,
                  transform: `translate${num(p, "mediaAxis") > 0.5 ? "X" : "Y"}(${num(p, "mediaY")}px) scale(${num(p, "mediaScale", 1)})`,
                }}
              />
            ) : (
              <video
                src={str(p, "src")}
                poster={str(p, "poster")}
                autoPlay={!signals.reducedMotion}
                muted
                loop
                playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            )}
            {typeof p.curtain === "number" ? (
              <>
                <i
                  className="vi-curtain"
                  style={{ width: `${num(p, "curtain") * 50}%`, left: 0 }}
                />
                <i
                  className="vi-curtain"
                  style={{ width: `${num(p, "curtain") * 50}%`, right: 0 }}
                />
              </>
            ) : null}
          </div>
        ) : null}
        {entity.kind === "svg" ? (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: str(p, "background", "#8467d6"),
              clipPath: `polygon(${polygon(clamp(num(p, "shape"), 0, 2))})`,
            }}
          />
        ) : null}
        {entity.kind === "frame" || entity.kind === "line" ? (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: str(p, "background"),
            }}
          />
        ) : null}
        {entity.kind === "component" ? (
          <div
            className="vi-component"
            style={{ padding: num(p, "padding", 24) }}
          >
            <strong>{str(p, "title", "Original OLED.")}</strong>
            <p>{str(p, "text", "Preserve what matters.")}</p>
          </div>
        ) : null}
        {isScene ? (
          <>
            <ModelActor
              p={p}
              live={active && selectedScene === id}
              onProjection={projectionCallbacks.current.get(id)!}
              onPick={pinMode ? (patch) => onPatch?.(id, patch) : undefined}
              onReady={onReady}
            />
            {p.fixture && editor && sel ? (
              <span className="vi-fixture-tag">
                Original {str(p, "fixture")} fixture
              </span>
            ) : null}
            {p.hotspot && proj?.pin.visible ? (
              <div
                className="vi-hotspot"
                data-hotspot={id}
                style={{
                  left: proj.pin.x,
                  top: proj.pin.y,
                  transform: `scale(${num(p, "hotspotSize", 1)})`,
                }}
              >
                <i />
                <span>{str(p, "hotspotText", "Surface detail")}</span>
              </div>
            ) : null}
          </>
        ) : null}
        {num(p, "mist") > 0 ? (
          <div className="vi-mist" style={{ opacity: num(p, "mist") }} />
        ) : null}
        {sel && editor ? (
          <>
            <span className="vi-actor-label">{entity.name}</span>
            <button
              className="vi-width-handle"
              aria-label="Drag text width"
              onPointerDown={(e) => {
                e.stopPropagation();
                onDrag?.(e, id, "width");
              }}
            />
            <button
              className="vi-size-handle"
              aria-label="Resize actor"
              onPointerDown={(e) => {
                e.stopPropagation();
                onDrag?.(e, id, "size");
              }}
            />
            {typeof p.aperture === "number" ? (
              <button
                className="vi-aperture-handle"
                aria-label="Shape portal"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onDrag?.(e, id, "aperture");
                }}
              >
                ↔
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    );
  };
  return (
    <div
      className="vi-stage"
      data-stage={b.id}
      data-profile={b.profile}
      data-progress={signals.scroll.toFixed(4)}
      style={{
        width: b.width,
        height: b.height,
        background: result.theme > 0.5 ? "#202a2b" : v.background,
      }}
      onPointerMove={(ev) => {
        if (!active || drag.current) return;
        const r = ev.currentTarget.getBoundingClientRect();
        setPointer([
          clamp((ev.clientX - r.left) / r.width),
          clamp((ev.clientY - r.top) / r.height),
        ]);
      }}
    >
      <div
        className="vi-stage-content"
        style={{
          position: "absolute",
          width: "100%",
          height: contentHeight,
          transform: `translateY(${pageShift}px)`,
        }}
      >
        {v.document.entities.map(render)}
        {wires && editor ? (
          <svg className="vi-wires" width={b.width} height={contentHeight}>
            {v.links
              .filter((l) => l.enabled)
              .map((l) => {
                const a = result.bounds[l.source],
                  b = result.bounds[l.target];
                if (!a || !b) return null;
                const x = a.x + a.width / 2,
                  y = a.y + a.height / 2,
                  tx = b.x + b.width / 2,
                  ty = b.y + b.height / 2;
                return (
                  <g key={l.id}>
                    <path
                      d={`M${x},${y} C${x - 100},${y} ${tx + 100},${ty} ${tx},${ty}`}
                      fill="none"
                      stroke="#0071e3"
                      strokeWidth="2"
                      strokeDasharray="5 5"
                    />
                    <circle cx={x} cy={y} r="5" fill="#0071e3" />
                    <text
                      x={(x + tx) / 2}
                      y={(y + ty) / 2 - 8}
                      fill="#0071e3"
                      fontSize="13"
                    >
                      {l.kind}
                    </text>
                  </g>
                );
              })}
          </svg>
        ) : null}
      </div>
    </div>
  );
}
