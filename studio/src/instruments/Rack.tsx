import { useRef, useState } from "react";
import { num, uid, type Props } from "../model";
import { studio } from "../store";
import { registry, capabilities, instantiate, effectiveInstrument } from "./registry";
import { editProject, patchActor } from "./editing";
import type {
  Artboard,
  Control,
  InstrumentInstance,
  Variant,
  VisualProject,
} from "./types";
export function Slider({
  name,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onEdit,
}: {
  name: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onEdit: (value: number, preview: boolean) => void;
}) {
  const held = useRef(false),
    cancelled = useRef(false);
  const begin = () => {
    held.current = true;
    cancelled.current = false;
    studio.beginGesture();
  };
  const end = () => {
    if (held.current) {
      held.current = false;
      if (!cancelled.current) studio.commitGesture(name);
    }
  };
  return (
    <label className="vi-slider">
      <span>
        {name.replace(
          /^(Parallax Window|Soft Rise|Scale Settle|Aperture Portal|Dual Orbit|Glint Sweep|Part Lift \/ Hinge|Camera Approach|Lattice → Solid|Surface Pin|Masked Text|Counter|Velocity Response|Depth Sandwich|Curtain Reveal|Pointer Drift|Theme Shift|Shape Journey|Smooth Scroll|Stage Lock) /,
          "",
        )}
      </span>
      <input
        aria-label={name}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={begin}
        onChange={(ev) => {
          if (cancelled.current) return;
          onEdit(Number(ev.target.value), held.current);
        }}
        onPointerUp={end}
        onPointerCancel={() => {
          held.current = false;
          cancelled.current = true;
          studio.cancelGesture();
        }}
        onKeyDown={(ev) => {
          if (ev.key === "Escape") {
            cancelled.current = true;
            held.current = false;
            studio.cancelGesture();
            ev.currentTarget.blur();
          } else if (ev.key.startsWith("Arrow") && !held.current) begin();
        }}
        onKeyUp={end}
        onBlur={end}
      />
    </label>
  );
}
export function Rack({
  variant: v,
  board: b,
  selection,
  stateId,
  pinMode,
  onPin,
  onConnect,
  onDeleteBoard,
  onDuplicateBoard,
  onFit,
}: {
  variant: Variant;
  board: Artboard;
  selection: string;
  stateId?: string;
  pinMode: boolean;
  onPin: () => void;
  onConnect: () => void;
  onDeleteBoard: () => void;
  onDuplicateBoard: () => void;
  onFit: () => void;
}) {
  const [adding, setAdding] = useState(false),
    [query, setQuery] = useState("");
  const actor = v.document.entities.find((e) => e.id === selection), endpoint = v.states.find(s => s.id === stateId),
    p = actor ? { ...actor.props, ...actor.overrides[b.profile], ...endpoint?.actors[actor.id], ...(b.profile === 'mobile' ? endpoint?.mobile?.[actor.id] : {}) } : {};
  const update = (
    label: string,
    f: (v: Variant, p: VisualProject) => void,
    preview = false,
  ) =>
    editProject(
      label,
      (p) => f(p.variants.find((x) => x.id === v.id)!, p),
      preview,
    );
  const patch = (values: Props, preview = false) =>
    editProject(
      "Shape " + (actor?.name ?? "stage"),
      (pr) => patchActor(pr, b, selection, values, stateId),
      preview,
    );
  const instances = v.instruments.filter((i) => i.targetId === actor?.id && (i.scope === "base" || i.scope === b.profile)).map(i => effectiveInstrument(i, b.profile));
  const editInstance = (
    id: string,
    f: (i: InstrumentInstance) => void,
    preview = false,
  ) =>
    update(
      "Adjust instrument",
      (v) => {
        const original = v.instruments.find((i) => i.stableId === id)!;
        if (b.profile === 'mobile' && original.scope === 'base') {
          const edited = structuredClone(effectiveInstrument(original, b.profile)); f(edited);
          original.profileOverrides ??= {}; original.profileOverrides.mobile = {macroValues: edited.macroValues, advancedValues: edited.advancedValues, enabled: edited.enabled, drivers: edited.drivers};
        } else f(original);
      },
      preview,
    );
  const control = (i: InstrumentInstance, c: Control, advanced = false) => (
    <Slider
      key={c.id}
      name={`${registry[i.definitionId].name} ${c.name}`}
      value={(advanced ? i.advancedValues : i.macroValues)[c.id] ?? c.default}
      min={c.min}
      max={c.max}
      step={c.step ?? (c.max - c.min) / 200}
      onEdit={(n, preview) =>
        editInstance(
          i.stableId,
          (i) => ((advanced ? i.advancedValues : i.macroValues)[c.id] = n),
          preview,
        )
      }
    />
  );
  return (
    <aside className="vi-right">
      <div className="vi-panel-heading">
        <span>{actor ? "ACTOR" : "ARTBOARD"}</span>
        <span>
          {b.profile === "mobile" ? "Linked · Mobile" : v.name + " · Desktop"}
        </span>
      </div>
      <h2>{actor?.name ?? b.name}</h2>
      {actor ? (
        <>
          <div className="vi-quick-actions">
            <button onClick={onConnect}>⌁ Connect</button>
            {actor.kind === "scene" ? (
              <button aria-pressed={pinMode} onClick={onPin}>
                ⊕ Pick surface
              </button>
            ) : null}
          </div>
          {actor.kind === "text" ? (
            <div className="vi-type-presets">
              {["Editorial", "Modern", "Statement"].map((s, i) => (
                <button
                  key={s}
                  onClick={() =>
                    patch({
                      fontFamily:
                        i === 0 ? "Georgia, serif" : "Arial, sans-serif",
                      fontWeight: i === 2 ? 700 : 400,
                      fontSize:
                        b.profile === "mobile"
                          ? [46, 52, 60][i]
                          : [78, 86, 100][i],
                      letterSpacing: i === 0 ? -2 : -4,
                    })
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}
          <div className="vi-base-controls">
            {actor.kind === "text" ? (
              <>
                <Slider
                  name="Type size"
                  value={num(p, "fontSize", 50)}
                  min={12}
                  max={150}
                  step={1}
                  onEdit={(n, prev) => patch({ fontSize: n }, prev)}
                />
                <Slider
                  name="Rhythm"
                  value={num(p, "lineHeight", 1.1)}
                  min={0.85}
                  max={2}
                  onEdit={(n, prev) => patch({ lineHeight: n }, prev)}
                />
              </>
            ) : null}
            {actor.kind === "scene" ? (
              <>
                <Slider
                  name="Product size"
                  value={num(p, "scale", 1)}
                  min={0.4}
                  max={2}
                  onEdit={(n, prev) => patch({ scale: n }, prev)}
                />
                <Slider
                  name="Authored pose"
                  value={num(p, "rotateY")}
                  min={-180}
                  max={180}
                  step={1}
                  onEdit={(n, prev) => patch({ rotateY: n }, prev)}
                />
              </>
            ) : null}
            {actor.kind === "svg" ? (
              <Slider
                name="Shape"
                value={num(p, "shape")}
                min={0}
                max={2}
                onEdit={(n, prev) => patch({ shape: n }, prev)}
              />
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div className="vi-quick-actions">
            <button onClick={onDuplicateBoard}>Duplicate</button>
            <button onClick={onFit}>Focus</button>
            <button onClick={onDeleteBoard}>Delete</button>
          </div>
          <input
            className="vi-name-input"
            aria-label="Artboard name"
            defaultValue={b.name}
            key={b.id + b.name}
            onBlur={(e) =>
              editProject(
                "Rename artboard",
                (p) =>
                  (p.boards.find((x) => x.id === b.id)!.name = e.target.value),
              )
            }
          />
          <Slider
            name="Viewport width"
            value={b.width}
            min={b.profile === "mobile" ? 280 : 640}
            max={b.profile === "mobile" ? 600 : 1600}
            step={1}
            onEdit={(n, prev) =>
              editProject(
                "Resize artboard",
                (p) => (p.boards.find((x) => x.id === b.id)!.width = n),
                prev,
              )
            }
          />
        </>
      )}
      <div className="vi-rack-heading">
        <h3>Instrument rack</h3>
        <button aria-label="Add Instrument" onClick={() => setAdding(!adding)}>
          ＋
        </button>
      </div>
      {adding ? (
        <div className="vi-add-menu">
          <input
            autoFocus
            placeholder="Find an instrument…"
            aria-label="Search instruments"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {Object.values(registry)
            .filter(
              (d) =>
                d.supportedActorCapabilities.some((c) =>
                  capabilities(actor).includes(c),
                ) && d.name.toLowerCase().includes(query.toLowerCase()),
            )
            .map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  update("Add " + d.name, (v) =>
                    v.instruments.push({...instantiate(d.id, actor?.id), scope: b.profile === "mobile" ? "mobile" : "base"}),
                  );
                  setAdding(false);
                  setQuery("");
                }}
              >
                <b>{d.icon}</b>
                {d.name}
                <small>{d.category}</small>
              </button>
            ))}
        </div>
      ) : null}
      {instances.length === 0 ? (
        <div className="vi-empty">
          Add an instrument.
          <br />
          Try a movement, a reveal, a little depth.
        </div>
      ) : null}
      {instances.map((i, index) => {
        const def = registry[i.definitionId];
        return (
          <section
            className={"vi-instrument " + (!i.enabled ? "bypassed" : "")}
            key={i.stableId}
            data-instrument={i.definitionId}
          >
            <header>
              <span className="vi-instrument-icon">{def.icon}</span>
              <strong>{def.name}</strong>
              <button
                className="vi-switch"
                role="switch"
                aria-label={`${def.name} enabled`}
                aria-checked={i.enabled}
                onClick={() =>
                  editInstance(i.stableId, (i) => (i.enabled = !i.enabled))
                }
              >
                <i />
              </button>
            </header>
            {def.id === "glint" ? (
              <div
                className="vi-glint-disc"
                aria-label="Glint direction puck"
                onPointerDown={(ev) => {
                  ev.currentTarget.setPointerCapture(ev.pointerId);
                  studio.beginGesture();
                }}
                onPointerMove={(ev) => {
                  if (
                    !ev.currentTarget.hasPointerCapture(ev.pointerId) ||
                    !studio.hasGesture()
                  )
                    return;
                  const r = ev.currentTarget.getBoundingClientRect(),
                    angle =
                      (Math.atan2(
                        ev.clientX - r.left - r.width / 2,
                        -(ev.clientY - r.top - r.height / 2),
                      ) *
                        180) /
                      Math.PI;
                  editInstance(
                    i.stableId,
                    (i) => (i.macroValues.angle = angle),
                    true,
                  );
                }}
                onPointerUp={() => studio.commitGesture("Sweep light")}
                onPointerCancel={() => studio.cancelGesture()}
              >
                <i
                  style={{
                    transform: `rotate(${i.macroValues.angle}deg) translateY(-26px)`,
                  }}
                />
                <span>✧</span>
              </div>
            ) : null}
            {def.inputs.map((c) => control(i, c))}
            <details>
              <summary>
                Shape & routing <span>⌄</span>
              </summary>
              {def.advancedControls.map((c) => control(i, c, true))}
              {def.id === "part" && actor?.kind === "scene" ? (
                <label>
                  Mesh
                  <select
                    aria-label="Part mesh"
                    value={String(p.partName ?? "Glass_Front")}
                    onChange={(e) => patch({ partName: e.target.value })}
                  >
                    {[
                      "Body Frame",
                      "Glass_Bezel",
                      "Glass_Front",
                      "Display_OLED.001",
                    ].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label>
                Playback
                <select
                  aria-label={`${def.name} playback`}
                  value={i.drivers[0].mode ?? "scrub"}
                  onChange={(e) =>
                    editInstance(
                      i.stableId,
                      (i) => (i.drivers[0].mode = e.target.value as "scrub"),
                    )
                  }
                >
                  <option value="scrub">Scroll linked</option>
                  <option value="entry">Every entry</option>
                  <option value="once">Once on entry</option>
                </select>
              </label>
              <label>
                Driver
                <select
                  aria-label={`${def.name} driver`}
                  value={i.drivers[0].source}
                  onChange={(e) =>
                    editInstance(
                      i.stableId,
                      (i) =>
                        (i.drivers[0].source = e.target
                          .value as (typeof i.drivers)[0]["source"]),
                    )
                  }
                >
                  {[
                    "scroll",
                    "time",
                    "pointerX",
                    "pointerY",
                    "velocity",
                    "actor",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              {i.drivers[0].source === "actor" ? (
                <select
                  aria-label="Source actor"
                  value={i.drivers[0].actorId ?? ""}
                  onChange={(e) =>
                    editInstance(
                      i.stableId,
                      (i) => (i.drivers[0].actorId = e.target.value),
                    )
                  }
                >
                  <option value="">Choose actor</option>
                  {v.document.entities
                    .filter((e) => e.id !== actor?.id)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </select>
              ) : null}
              <Slider
                name={`${def.name} begins`}
                value={i.drivers[0].range[0]}
                min={0}
                max={0.95}
                onEdit={(n, prev) =>
                  editInstance(
                    i.stableId,
                    (i) =>
                      (i.drivers[0].range = [
                        n,
                        Math.max(n + 0.01, i.drivers[0].range[1]),
                      ]),
                    prev,
                  )
                }
              />
              <Slider
                name={`${def.name} finishes`}
                value={i.drivers[0].range[1]}
                min={0.05}
                max={1}
                onEdit={(n, prev) =>
                  editInstance(
                    i.stableId,
                    (i) =>
                      (i.drivers[0].range = [
                        Math.min(n - 0.01, i.drivers[0].range[0]),
                        n,
                      ]),
                    prev,
                  )
                }
              />
              <label>
                Response
                <select
                  aria-label={`${def.name} response`}
                  value={i.drivers[0].modulators.at(-1)?.kind ?? "ease"}
                  onChange={(e) =>
                    editInstance(
                      i.stableId,
                      (i) =>
                        (i.drivers[0].modulators = [
                          { kind: "ease", amount: 1 },
                          {
                            kind: e.target.value as "ease",
                            amount:
                              e.target.value === "phase"
                                ? 0.1
                                : e.target.value === "threshold"
                                  ? 0.5
                                  : 0.5,
                          },
                        ]),
                    )
                  }
                >
                  {["ease", "phase", "spring", "threshold", "invert"].map(
                    (s) => (
                      <option key={s}>{s}</option>
                    ),
                  )}
                </select>
              </label>
              <div className="vi-instrument-actions">
                <button
                  onClick={() =>
                    editInstance(i.stableId, (i) => {
                      const fresh = instantiate(i.definitionId, i.targetId);
                      i.macroValues = fresh.macroValues;
                      i.advancedValues = fresh.advancedValues;
                      i.drivers = fresh.drivers;
                    })
                  }
                >
                  Reset
                </button>
                <button
                  onClick={() =>
                    update("Duplicate instrument", (v) => {
                      const c = structuredClone(i);
                      c.stableId = uid("instrument");
                      v.instruments.push(c);
                      const beat = v.beats.find((b) => b.id === c.beatId);
                      beat?.instrumentIds.push(c.stableId);
                    })
                  }
                >
                  Copy
                </button>
                <button
                  disabled={!index}
                  onClick={() =>
                    update("Reorder instrument", (v) => {
                      const a = v.instruments.findIndex(
                          (x) => x.stableId === i.stableId,
                        ),
                        b = v.instruments.findIndex(
                          (x) => x.stableId === instances[index - 1].stableId,
                        );
                      [v.instruments[a], v.instruments[b]] = [
                        v.instruments[b],
                        v.instruments[a],
                      ];
                    })
                  }
                >
                  ↑
                </button>
                <button
                  onClick={() =>
                    update("Remove instrument", (v) => {
                      v.instruments = v.instruments.filter(
                        (x) => x.stableId !== i.stableId,
                      );
                      v.beats.forEach(
                        (b) =>
                          (b.instrumentIds = b.instrumentIds.filter(
                            (id) => id !== i.stableId,
                          )),
                      );
                    })
                  }
                >
                  ×
                </button>
              </div>
            </details>
          </section>
        );
      })}
      {v.links
        .filter((l) => l.source === selection || l.target === selection)
        .map((l) => (
          <section className="vi-connection" key={l.id}>
            <span>
              ⌁ {l.source} → {l.target}
            </span>
            <select
              aria-label="Connection behaviour"
              value={l.kind}
              onChange={(e) =>
                update(
                  "Change coupling",
                  (v) =>
                    (v.links.find((x) => x.id === l.id)!.kind = e.target
                      .value as typeof l.kind),
                )
              }
            >
              {[
                "clearance",
                "follow",
                "align",
                "glint",
                "reveal",
                "synchronize",
              ].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
            <Slider
              name="Coupling"
              value={l.amount}
              max={2}
              onEdit={(n, prev) =>
                update(
                  "Coupling",
                  (v) => (v.links.find((x) => x.id === l.id)!.amount = n),
                  prev,
                )
              }
            />
            <button
              onClick={() =>
                update(
                  "Bypass connection",
                  (v) =>
                    (v.links.find((x) => x.id === l.id)!.enabled = !l.enabled),
                )
              }
            >
              {l.enabled ? "Disconnect" : "Connect"}
            </button>
          </section>
        ))}
      {actor ? (
        <details className="vi-precision">
          <summary>Precision</summary>
          {["x", "y", "width", "height", "rotation", "opacity"].map((k) => (
            <label key={k}>
              {k}
              <input
                type="number"
                aria-label={`Precision ${k}`}
                value={num(p, k)}
                onChange={(e) => patch({ [k]: Number(e.target.value) })}
              />
            </label>
          ))}
          <label>
            Colour
            <input
              type="color"
              aria-label="Actor colour"
              value={String(
                p[actor.kind === "svg" ? "background" : "color"] ?? "#333333",
              )}
              onChange={(e) =>
                patch({
                  [actor.kind === "svg" ? "background" : "color"]:
                    e.target.value,
                })
              }
            />
          </label>
          {actor.kind === "scene" ? (
            <input
              aria-label="Hotspot label"
              value={String(p.hotspotText ?? "Surface detail")}
              onChange={(e) => patch({ hotspotText: e.target.value })}
            />
          ) : null}
        </details>
      ) : null}
    </aside>
  );
}
