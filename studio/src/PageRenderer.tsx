import {
  useEffect,
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
import { layoutDocument } from "./layout";
import { ImportedComponent } from "./ImportedComponent";
import { SceneView } from "./SceneView";
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
  onPointerDown?: (
    event: PointerEvent<HTMLElement>,
    entity: Entity,
    resize?: boolean,
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
  const signals = controlledSignals ?? localSignals;
  useEffect(() => {
    if (controlledSignals || !d.bindings.some((b) => b.source === "scroll"))
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
    return () => removeEventListener("scroll", update);
  }, [d.bindings, controlledSignals]);
  const pageRef = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<BoundsProbe[]>([]);
  const hasConnectors = d.relationships.some((r) => r.connector);
  useLayoutEffect(() => {
    if (hasConnectors) setBoxes(measurePage(pageRef.current));
  }, [d, profileId, time, signals, hasConnectors]);
  const layout = layoutDocument(d, profile.id, time, signals);
  const render = (e: Entity) => {
    const p = evaluateEntity(d, e, profile.id, time, signals);
    if (p.visible === false) return null;
    const box = layout.boxes.get(e.id)!;
    const selected = selection.includes(e.id);
    const style: CSSProperties = {
      position: "absolute",
      left: box.x,
      top: box.y,
      width: box.width,
      height: box.height,
      transform: `rotate(${num(p, "rotation")}deg)`,
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
    if (e.kind === "frame") {
      style.padding = 0;
      style.overflow = str(
        p,
        "overflow",
        "visible",
      ) as CSSProperties["overflow"];
    }
    let content: React.ReactNode = null;
    const TextTag = (["h1", "h2", "h3"].includes(str(p, "role")) ? str(p, "role") : "div") as "h1" | "h2" | "h3" | "div";
    if (e.kind === "text")
      content = (
        <TextTag
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
        </TextTag>
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
        <SceneView
          entity={e}
          values={p}
          interactive={editor && sceneInteractive && selected}
          onChange={(patch) => onSceneChange?.(e, patch)}
        />
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
    const definition = d.components?.find(c => c.id === e.componentId);
    if (e.kind === "component" && definition) content = <ImportedComponent definition={definition} values={p} interactive={!editor || sceneInteractive} />;
    return (
      <div
        key={e.id}
        className={`render-entity ${editor ? "editable" : ""} ${selected ? "selected" : ""} kind-${e.kind}`}
        data-entity={e.id}
        data-kind={e.kind}
        style={style}
        onDoubleClick={(ev) => {
          if (editor && e.kind === "text") {
            ev.stopPropagation();
            ev.currentTarget
              .querySelector<HTMLElement>(".render-text")
              ?.focus();
          }
        }}
        onPointerDown={(ev) => {
          if (editor) onPointerDown?.(ev, e);
        }}
      >
        {content}
        {d.entities.filter((child) => child.parentId === e.id).map(render)}
        {editor && selected && (
          <>
            <span className="selection-label">{e.name}</span>
            <button
              className="resize-handle"
              aria-label={`Resize ${e.name}`}
              onPointerDown={(ev) => onPointerDown?.(ev, e, true)}
            />
          </>
        )}
      </div>
    );
  };
  return (
    <div
      ref={pageRef}
      className={`composition-page${editor ? " editor-page" : ""}`}
      data-profile={profile.id}
      style={{ width: profile.width, height: layout.height }}
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
    </div>
  );
}
