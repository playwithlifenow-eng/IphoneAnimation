import {
  useEffect,
  useCallback,
  useMemo,
  lazy,
  Suspense,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import {
  evaluateEntity,
  num,
  str,
  type Entity,
  type Props,
  type StudioDocument,
} from "./model";
import { measurePage, type BoundsProbe } from "./probes";
import { pageLayout, sectionSignals } from "./composition";
import { nearbyGuides } from "./visualGeometry";
import { clocksOf } from "./model";
const SceneView = lazy(() => import("./SceneView"));
import "./runtime.css";
interface PageProps {
  document: StudioDocument;
  profileId: string;
  time: number;
  selection?: string[];
  editor?: boolean;
  signals?: Record<string, number>;
  onSignalsChange?: (signals: Record<string, number>) => void;
  sceneInteractive?: boolean;
  sceneNavigation?: "model" | "camera";
  navigationTool?: boolean;
  showGuides?: boolean;
  onVisualChange?: (entity: Entity, props: Props) => void;
  orbitSensitivity?: number;
  viewportHeight?: number;
  onBackground?: () => void;
  onInsertSection?: (afterId: string) => void;
  onSelectSection?: (id: string) => void;
  onPointerDown?: (
    event: PointerEvent<HTMLElement>,
    entity: Entity,
    resize?: boolean | "width",
  ) => void;
  onText?: (entity: Entity, text: string) => void;
  onSceneChange?: (entity: Entity, props: Props) => void;
}
export function PageRenderer({
  document: d,
  profileId,
  time,
  selection = [],
  editor = false,
  signals: controlledSignals,
  onSignalsChange,
  sceneInteractive = false,
  sceneNavigation = "model",
  navigationTool = false,
  showGuides = false,
  onVisualChange,
  orbitSensitivity,
  viewportHeight,
  onBackground,
  onInsertSection,
  onSelectSection,
  onPointerDown,
  onText,
  onSceneChange,
}: PageProps) {
  const profile = d.profiles.find((p) => p.id === profileId) ?? d.profiles[0];
  const [localSignals, setSignals] = useState<Record<string, number>>({
    pointerX: 0.5,
    pointerY: 0.5,
    scroll: 0,
  });
  const layout = pageLayout(d, profile.id, viewportHeight);
  const signals = useMemo(() => sectionSignals(d, profile.id, controlledSignals ?? localSignals, viewportHeight), [d, profile.id, controlledSignals, localSignals, viewportHeight]);
  const orbitHandlers = useRef(new Map<string, (event: globalThis.PointerEvent) => void>());
  const registerOrbit = useCallback((id: string, handler: ((event: globalThis.PointerEvent) => void) | null) => { if (handler) orbitHandlers.current.set(id, handler); else orbitHandlers.current.delete(id); }, []);
  const hitTests = useRef(new Map<string, (x: number, y: number) => boolean>());
  const registerHit = useCallback((id: string, hit: ((x: number, y: number) => boolean) | null) => {
    if (hit) hitTests.current.set(id, hit); else hitTests.current.delete(id);
  }, []);
  const pick = (x: number, y: number, behind = false) => {
    const candidates: Entity[] = [];
    const seen = new Set<string>();
    for (const node of document.elementsFromPoint(x, y)) {
      const el = node.closest<HTMLElement>("[data-entity]");
      if (!el || !pageRef.current?.contains(el) || seen.has(el.dataset.entity!)) continue;
      seen.add(el.dataset.entity!);
      const e = d.entities.find(e => e.id === el.dataset.entity);
      if (!e || e.kind === "section") continue;
      if (e.kind === "scene" && !hitTests.current.get(e.id)?.(x, y)) continue;
      candidates.push(e);
    }
    if (behind && candidates.length > 1) {
      const index = candidates.findIndex(e => selection.includes(e.id));
      return candidates[(index + 1) % candidates.length];
    }
    return candidates[0];
  };
  useEffect(() => {
    if (controlledSignals || (!d.bindings.some((b) => b.source === "scroll") && !clocksOf(d).some(c => c.source === "scroll")))
      return;
    const update = () =>
      setSignals((s) => ({
        ...s,
        scroll:
          window.scrollY /
          Math.max(1, document.documentElement.scrollHeight - innerHeight),
      }));
    update();
    addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    return () => { removeEventListener("scroll", update); removeEventListener("resize", update); };
  }, [d.bindings, d.clocks, controlledSignals]);
  const pageRef = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<BoundsProbe[]>([]);
  const hasConnectors = d.relationships.some((r) => r.connector);
  useLayoutEffect(() => {
    if (hasConnectors || (editor && showGuides)) setBoxes(measurePage(pageRef.current));
  }, [d, profileId, time, JSON.stringify(signals), hasConnectors, editor, showGuides]);
  const selectedEntity = d.entities.find(e => e.id === selection[0]);
  const guides = editor && showGuides && selection.length === 1 && selectedEntity
    ? nearbyGuides(boxes, selectedEntity.id, new Set(d.entities.filter(e => e.parentId === selectedEntity.parentId && e.kind !== "section").map(e => e.id))) : [];
  const render = (e: Entity) => {
    const p = evaluateEntity(d, e, profile.id, time, signals);
    if (p.visible === false) return null;
    const parent = d.entities.find((x) => x.id === e.parentId);
    const parentValues = parent
      ? evaluateEntity(d, parent, profile.id, time, signals)
      : null;
    const flow = parentValues && str(parentValues, "layout", "free") !== "free";
    const selected = selection.includes(e.id);
    const style: CSSProperties = {
      position: flow ? "relative" : "absolute",
      left: flow ? undefined : num(p, "x"),
      top: flow ? undefined : num(p, "y"),
      width: num(p, "width", 200),
      height: num(p, "height", 100),
      transform: `translate(${num(p, "translateX")}px, ${num(p, "translateY")}px) rotate(${num(p, "rotation")}deg) scale(${num(p, "visualScale", 1)})`,
      opacity: num(p, "opacity", 1),
      color: str(p, "color", "#22382c"),
      background: str(p, "background", "transparent"),
      borderRadius: num(p, "radius"),
      boxSizing: "border-box",
      padding: num(p, "padding"),
      fontFamily: str(p, "fontFamily", "Arial, sans-serif"),
      fontSize: num(p, "fontSize", 16),
      fontWeight: num(p, "fontWeight", 400),
      lineHeight: num(p, "lineHeight", 1.2),
      letterSpacing: num(p, "letterSpacing"),
      textAlign: str(p, "textAlign", "left") as CSSProperties["textAlign"],
      flexShrink: 0,
    };
    if (e.kind === "frame" || e.kind === "section") {
      style.display = "flex";
      style.flexDirection = str(p, "layout") === "row" ? "row" : "column";
      style.gap = num(p, "gap", 16);
      style.overflow = str(
        p,
        "overflow",
        "visible",
      ) as CSSProperties["overflow"];
    }
    let content: React.ReactNode = null;
    if (e.kind === "text")
      content = (
        <div
          className="render-text"
          contentEditable={editor && selected}
          suppressContentEditableWarning
          onDoubleClick={(ev) => {
            if (editor) {
              ev.stopPropagation();
              ev.currentTarget.focus();
            }
          }}
          tabIndex={editor ? 0 : undefined}
          onPointerDown={(ev) => {
            if (
              (ev.target as HTMLElement).isContentEditable &&
              document.getSelection()?.type === "Range"
            )
              ev.stopPropagation();
          }}
          onBlur={(ev) => {
            if (editor && ev.currentTarget.innerText !== str(p, "text"))
              onText?.(e, ev.currentTarget.innerText);
          }}
        >
          {str(p, "text")}
        </div>
      );
    if (e.kind === "button")
      content = (
        <a
          className="render-button"
          href={
            /^(https?:|mailto:|tel:|#|\/)/i.test(str(p, "href", "#"))
              ? str(p, "href", "#")
              : "#"
          }
          onClick={(ev) => {
            if (editor) ev.preventDefault();
          }}
        >
          {str(p, "text", "Button")}
        </a>
      );
    if (e.kind === "image" || e.kind === "svg")
      content = str(p, "src") ? (
        <img
          className="render-media"
          src={str(p, "src")}
          alt={str(p, "alt", e.name)}
          draggable={false}
          style={{
            objectFit: str(
              p,
              "objectFit",
              str(p, "fit", "cover"),
            ) as CSSProperties["objectFit"],
          }}
        />
      ) : (
        <div className="media-empty">Add an image from Assets</div>
      );
    if (e.kind === "video")
      content = str(p, "src") ? (
        <video
          className="render-media"
          src={str(p, "src")}
          controls={!editor}
          muted
          playsInline
          loop={p.loop !== false}
        />
      ) : (
        <div className="media-empty">Add a video from Assets</div>
      );
    if (e.kind === "scene")
      content = (
        <Suspense fallback={<div className="media-empty">Loading 3D renderer…</div>}><SceneView
          entity={e}
          orbitSensitivity={orbitSensitivity}
          onHitTest={registerHit}
          onOrbitHandler={registerOrbit}
          values={p}
          interactive={editor && sceneInteractive && selected}
          navigation={sceneNavigation}
          onChange={(patch) => onSceneChange?.(e, patch)}
        /></Suspense>
      );
    if (e.kind === "component")
      content = (
        <div className={`render-component ${e.componentId ?? ""}`}>
          <div className="component-mark">
            {e.componentId === "stat-card"
              ? "↗"
              : e.componentId === "hero-reference"
                ? "◇"
                : "＋"}
          </div>
          <strong>{str(p, "title", e.name)}</strong>
          <p>{str(p, "text")}</p>
          {e.componentId === "hero-reference" && (
            <small>Reference only · live adapter pending</small>
          )}
        </div>
      );
    const node = (
      <div
        key={e.id}
        className={`render-entity ${editor ? "editable" : ""} ${selected ? "selected" : ""} kind-${e.kind}`}
        data-entity={e.id}
        data-kind={e.kind}
        style={e.kind === "section" ? { ...style, position: "relative", left: undefined, top: undefined, width: "100%", height: layout.sections.find(b => b.id === e.id)?.height, transform: undefined } : style}
        onDoubleClick={(ev) => {
          if (editor && e.kind === "text") {
            ev.stopPropagation();
            ev.currentTarget
              .querySelector<HTMLElement>(".render-text")
              ?.focus();
          }
        }}

      >
        {content}
        {d.entities.filter((child) => child.parentId === e.id).map(render)}
        {editor && selected && e.kind !== "section" && (
          <>
            <span className="selection-label">{e.name}</span>
            <button
              className="resize-handle"
              aria-label={`Resize ${e.name}`}
              onPointerDown={(ev) => onPointerDown?.(ev, e, true)}
            />
            {e.kind === "text" && <button
              className="text-measure-handle"
              aria-label={`Adjust line length of ${e.name}`}
              title="Drag to shape line breaks"
              onPointerDown={(ev) => onPointerDown?.(ev, e, "width")}
              onKeyDown={ev => {
                if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
                ev.preventDefault(); ev.stopPropagation();
                onVisualChange?.(e, { width: Math.max(24, num(p, "width", 200) + (ev.key === "ArrowRight" ? 1 : -1) * (ev.shiftKey ? 24 : 8)) });
              }}
            ><span /></button>}
          </>
        )}
      </div>
    );
    if (e.kind !== "section") return node;
    const box = layout.sections.find(b => b.id === e.id);
    if (!box) return null;
    const scrollY = (signals.scroll ?? 0) * Math.max(0, layout.height - layout.viewport);
    return <section key={e.id} className="page-section" data-section={e.id} style={{ height: box.extent, position: "relative" }}>
      {editor && <div className="section-tools" data-section-controls>
        <button onClick={() => onSelectSection?.(e.id)}>{e.name}{box.pinned ? " · pinned" : ""}</button>
      </div>}
      <div className="section-viewport" style={{ position: box.pinned && !editor ? "sticky" : "relative", top: box.pinned && !editor ? 0 : undefined, height: box.height,
        transform: box.pinned && editor ? `translateY(${Math.max(0, Math.min(box.travel, scrollY - box.top))}px)` : undefined }}>
        {node}
      </div>
      {editor && <button className="section-insert" data-section-controls onClick={() => onInsertSection?.(e.id)}>+ Insert section below</button>}
    </section>;
  };
  return (
    <div
      ref={pageRef}
      className="composition-page"
      data-profile={profile.id}
      style={{ width: profile.width, height: layout.height, overflow: editor ? "hidden" : "clip" }}
      onPointerDownCapture={(ev) => {
        if (!editor || navigationTool || (ev.target as HTMLElement).closest("[data-section-controls],.resize-handle,.text-measure-handle,.scene-status-error button")) return;
        const target = pick(ev.clientX, ev.clientY, ev.altKey);
        if (target?.kind === "scene" && sceneInteractive && selection.includes(target.id)) { ev.stopPropagation(); orbitHandlers.current.get(target.id)?.(ev.nativeEvent); return; }
        if ((ev.target as HTMLElement).isContentEditable && document.activeElement === ev.target && target?.id === selection[0]) return;
        ev.stopPropagation();
        if (target) onPointerDown?.(ev, target); else onBackground?.();
      }}
      onDoubleClickCapture={(ev) => {
        if (!editor || navigationTool) return;
        const target = pick(ev.clientX, ev.clientY);
        if (target?.kind === "text") {
          const el = pageRef.current?.querySelector<HTMLElement>(`[data-entity="${target.id}"] .render-text`);
          el?.focus();
        }
      }}
      onPointerMove={(ev) => {
        if (!d.bindings.length) return;
        const r = ev.currentTarget.getBoundingClientRect();
        const next = {
          ...signals,
          pointerX: (ev.clientX - r.left) / r.width,
          pointerY: (ev.clientY - r.top) / r.height,
        };
        if (onSignalsChange) onSignalsChange(next);
        else if (!controlledSignals) setSignals(next);
      }}
    >
      {hasConnectors && (
        <svg
          className="relationship-connectors"
          width={profile.width}
          height={layout.height}
          aria-label="Composition connectors"
        >
          {d.relationships
            .filter((r) => r.connector)
            .map((r) => {
              const a = boxes.find((b) => b.id === r.a),
                b = boxes.find((b) => b.id === r.b);
              return a && b ? (
                <line
                  key={r.id}
                  x1={a.x + a.width / 2}
                  y1={a.y + a.height / 2}
                  x2={b.x + b.width / 2}
                  y2={b.y + b.height / 2}
                  stroke="#839572"
                  strokeWidth={2}
                />
              ) : null;
            })}
        </svg>
      )}
      {d.entities.filter((e) => !e.parentId).map(render)}
      {guides.length > 0 && <svg className="canvas-guides" width={profile.width} height={layout.height} aria-hidden="true">
        {guides.map((guide, index) => <line key={index} {...guide} className={`guide-${guide.kind}`} vectorEffect="non-scaling-stroke" />)}
      </svg>}
    </div>
  );
}
