import { useLayoutEffect, useState, type RefObject } from "react";
import { Link2, Plus, Trash2, RefreshCw } from "lucide-react";
import {
  uid,
  type Command,
  type StudioDocument,
  type Relationship,
} from "./model";
import { measurePage, readRelationship, type BoundsProbe } from "./probes";
export function Relationships({
  document: d,
  selection,
  profileId,
  time,
  signals,
  canvasRef,
  onCommand,
}: {
  document: StudioDocument;
  selection: string[];
  profileId: string;
  time: number;
  signals: Record<string, number>;
  canvasRef: RefObject<HTMLDivElement>;
  onCommand: (c: Command, label?: string) => void;
}) {
  const [boxes, setBoxes] = useState<BoundsProbe[]>([]),
    [kind, setKind] = useState<Relationship["kind"]>("clearance"),
    [threshold, setThreshold] = useState(24);
  const measure = () =>
    setBoxes(
      measurePage(
        canvasRef.current?.querySelector<HTMLElement>(".composition-page") ??
          null,
      ),
    );
  useLayoutEffect(measure, [d, profileId, time, signals]);
  const names = (id: string) =>
    d.entities.find((e) => e.id === id)?.name ?? "Missing element";
  return (
    <>
      <div className="panel-heading">
        Relationships <Link2 size={15} />
      </div>
      <p className="panel-hint">
        Select two elements. Author a relationship, then inspect measured frame
        geometry.
      </p>
      <div className="relationship-create">
        <label>
          Intent
          <select
            aria-label="Relationship intent"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as Relationship["kind"]);
              setThreshold(e.target.value === "clearance" ? 24 : 2);
            }}
          >
            <option value="clearance">Minimum clearance</option>
            <option value="align-x">Align left edges</option>
          </select>
        </label>
        <label>
          {kind === "clearance" ? "Minimum gap" : "Tolerance"}
          <input
            aria-label="Relationship threshold"
            type="number"
            min={0}
            max={10000}
            value={threshold}
            onChange={(e) =>
              setThreshold(Math.max(0, Math.min(10000, Number(e.target.value))))
            }
          />
        </label>
        <button
          className="wide-action"
          disabled={selection.length !== 2}
          onClick={() =>
            onCommand(
              {
                type: "relationship",
                relationship: {
                  id: uid("relation"),
                  a: selection[0],
                  b: selection[1],
                  kind,
                  threshold,
                  connector: false,
                },
              },
              "Author relationship",
            )
          }
        >
          <Plus size={13} />
          Add relationship
        </button>
        <small>
          {selection.length === 2
            ? selection.map(names).join(" ↔ ")
            : "Shift-click two layers to select."}
        </small>
      </div>
      <button className="wide-action subtle" onClick={measure}>
        <RefreshCw size={12} />
        Measure current frames
      </button>
      {d.relationships.map((r) => {
        const reading = readRelationship(r, boxes);
        return (
          <article className="relationship-card" key={r.id}>
            <strong>
              {names(r.a)}
              <span>↔ {names(r.b)}</span>
            </strong>
            <p>{reading.criterion}</p>
            <output className={"probe-" + reading.status}>
              {reading.status.toUpperCase()} ·{" "}
              {reading.value === null
                ? "Not observed"
                : `${reading.value.toFixed(1)} px`}
            </output>
            <label>
              <input
                type="checkbox"
                aria-label={`Show connector ${r.id}`}
                checked={r.connector === true}
                onChange={(e) =>
                  onCommand(
                    {
                      type: "relationship",
                      relationship: { ...r, connector: e.target.checked },
                    },
                    "Toggle connector",
                  )
                }
              />
              Show connector in composition
            </label>
            <button
              aria-label={`Remove relationship ${r.id}`}
              onClick={() =>
                onCommand(
                  { type: "remove-relationship", id: r.id },
                  "Remove relationship",
                )
              }
            >
              <Trash2 size={12} />
              Remove
            </button>
          </article>
        );
      })}
      <p className="capability-note">
        These checks describe axis-aligned DOM frames in page CSS pixels. They
        do not measure visible pixels, clipping, or 3D mesh occlusion. Hidden
        endpoints return unknown.
      </p>
    </>
  );
}
