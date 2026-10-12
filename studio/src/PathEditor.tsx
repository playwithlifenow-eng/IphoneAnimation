import { pageLayout, staticValues } from "./composition";
import { useRef, type PointerEvent } from "react";
import {
  clocksOf,
  num,
  type Command,
  type Entity,
  type StudioDocument,
} from "./model";
import {
  pathAvailability,
  pathValues,
  pathClockId,
  pathNodes,
  positionKeyCommands,
  deletePositionKeyCommands,
} from "./paths";
interface PathProps {
  document: StudioDocument;
  entity: Entity;
  profileId: string;
  zoom: number;
  playhead: number;
  scroll?: number;
  onSeek: (t: number) => void;
  onBegin: () => void;
  onPreview: (commands: Command[]) => void;
  onCommit: () => void;
  onCancel: () => void;
  onBatch: (commands: Command[], label: string) => void;
  onError: (message: string) => void;
}
export function PathEditor({
  document: d,
  entity,
  profileId,
  zoom,
  playhead,
  scroll = 0,
  onSeek,
  onBegin,
  onPreview,
  onCommit,
  onCancel,
  onBatch,
  onError,
}: PathProps) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    document: StudioDocument;
    entity: Entity;
    time: number;
    x: number;
    y: number;
    startX: number;
    startY: number;
  } | null>(null);
  const profile = d.profiles.find((p) => p.id === profileId)!;
  const unavailable = pathAvailability(d, entity, profileId);
  if (unavailable) return null;
  const layout = pageLayout(d, profileId);
  const section = layout.sections.find(s => s.id === entity.parentId);
  const p = staticValues(entity, profileId);
  const offset = { x: num(p, "translateX"), y: num(p, "translateY") + (section?.top ?? 0) + (section?.pinned ? Math.max(0, Math.min(section.travel, scroll * (layout.height - layout.viewport) - section.top)) : 0) };
  const isScroll = clocksOf(d).find(c => c.id === pathClockId(d, entity, profileId))?.source === "scroll";
  const label = (time: number) => isScroll ? `${Math.round(time / d.duration * 100)}%` : `${time.toFixed(2)}s`;
  const nodes = pathNodes(d, entity, profileId);
  const samples = Array.from({ length: 121 }, (_, i) => {
    const p = pathValues(d, entity, profileId, (d.duration * i) / 120);
    return `${num(p, "x")},${num(p, "y")}`;
  }).join(" ");
  const locate = (ev: PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return {
      x: ((ev.clientX - r.left) * profile.width) / r.width - offset.x,
      y: ((ev.clientY - r.top) * layout.height) / r.height - offset.y,
    };
  };
  return (
    <svg
      ref={svg}
      className="path-overlay"
      width={profile.width}
      height={layout.height}
      viewBox={`0 0 ${profile.width} ${layout.height}`}
      aria-label={`${entity.name} motion path`}
    >
      <g transform={`translate(${offset.x},${offset.y})`}>
      {nodes.length > 1 && (
        <polyline
          points={samples}
          fill="none"
          stroke="#7250a0"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {nodes.map((node, index) => (
        <g key={node.time}>
          <circle
            className="path-node"
            cx={node.x}
            cy={node.y}
            r={6 / zoom}
            fill={Math.abs(playhead - node.time) < 0.02 ? "#7250a0" : "#fff"}
            stroke="#7250a0"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            tabIndex={0}
            role="button"
            aria-label={isScroll ? `Path point at ${label(node.time)}` : `Path point at ${node.time} seconds`}
            onPointerDown={(ev) => {
              ev.stopPropagation();
              ev.preventDefault();
              const p = locate(ev);
              drag.current = {
                document: d,
                entity,
                time: node.time,
                x: node.x,
                y: node.y,
                startX: p.x,
                startY: p.y,
              };
              onSeek(node.time);
              onBegin();
              ev.currentTarget.focus();
              ev.currentTarget.setPointerCapture(ev.pointerId);
            }}
            onPointerMove={(ev) => {
              const start = drag.current;
              if (!start) return;
              ev.stopPropagation();
              const p = locate(ev),
                snap = (v: number) =>
                  ev.shiftKey ? Math.round(v / 8) * 8 : Math.round(v);
              onPreview(
                positionKeyCommands(
                  start.document,
                  start.entity,
                  profileId,
                  start.time,
                  snap(start.x + p.x - start.startX),
                  snap(start.y + p.y - start.startY),
                ),
              );
            }}
            onPointerUp={(ev) => {
              if (!drag.current) return;
              ev.stopPropagation();
              drag.current = null;
              onCommit();
              if (ev.currentTarget.hasPointerCapture(ev.pointerId))
                ev.currentTarget.releasePointerCapture(ev.pointerId);
            }}
            onPointerCancel={() => {
              drag.current = null;
              onCancel();
            }}
            onKeyDown={(ev) => {
              if (ev.key === "Escape") {
                drag.current = null;
                onCancel();
                ev.stopPropagation();
                return;
              }
              if (ev.key === "Delete" || ev.key === "Backspace") {
                ev.preventDefault();
                ev.stopPropagation();
                try {
                  onBatch(
                    deletePositionKeyCommands(d, entity, profileId, node.time),
                    "Delete path point",
                  );
                } catch (e) {
                  onError(String(e));
                }
                return;
              }
              if (
                ![
                  "ArrowLeft",
                  "ArrowRight",
                  "ArrowUp",
                  "ArrowDown",
                  "Enter",
                ].includes(ev.key)
              )
                return;
              ev.preventDefault();
              ev.stopPropagation();
              onSeek(node.time);
              if (ev.key === "Enter") return;
              const delta = ev.shiftKey ? 8 : 1;
              onBatch(
                positionKeyCommands(
                  d,
                  entity,
                  profileId,
                  node.time,
                  node.x +
                    (ev.key === "ArrowLeft"
                      ? -delta
                      : ev.key === "ArrowRight"
                        ? delta
                        : 0),
                  node.y +
                    (ev.key === "ArrowUp"
                      ? -delta
                      : ev.key === "ArrowDown"
                        ? delta
                        : 0),
                ),
                "Nudge path point",
              );
            }}
          />
          <text
            x={node.x + 10 / zoom}
            y={node.y - 10 / zoom}
            fontSize={10 / zoom}
            fill="#7250a0"
            paintOrder="stroke"
            stroke="#f9faf6"
            strokeWidth={3 / zoom}
          >
            {index + 1} · {label(node.time)}
          </text>
        </g>
      ))}
      </g>
    </svg>
  );
}
