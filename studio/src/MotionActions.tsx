import { useState } from "react";
import { clocksOf, evaluateEntity, uid, type Command, type MotionAction, type StudioDocument } from "./model";
import { actionCommand } from "./editing";
import { NumberField } from "./Inspector";

export function MotionActions({ document: d, selection, profileId, clockId, time, signals, onCommand, onError }: {
  document: StudioDocument; selection: string[]; profileId: string; clockId: string; time: number; signals: Record<string, number>;
  onCommand: (command: Command, label: string) => void; onError: (message: string) => void;
}) {
  const [kind, setKind] = useState<MotionAction["kind"]>("reveal");
  const [amount, setAmount] = useState(48);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(Math.min(2, d.duration));
  const [stagger, setStagger] = useState(0.15);
  const [axis, setAxis] = useState<"x" | "y">("y");
  const targets = d.entities.filter(e => selection.includes(e.id) && e.kind !== "section");
  const apply = (action: MotionAction) => {
    try { onCommand(actionCommand(d, action), `${action.name} action`); }
    catch (error) { onError(error instanceof Error ? error.message : String(error)); }
  };
  const create = () => apply({ id: uid("action"), name: `${kind[0].toUpperCase() + kind.slice(1)} ${targets.length === 1 ? targets[0].name : `${targets.length} elements`}`, kind, entityIds: targets.map(e => e.id), profileId: profileId === "desktop" ? "base" : profileId, clockId, start, end, stagger, amount, axis, trackIds: [], baseline: Object.fromEntries(targets.map(e => [e.id, evaluateEntity(d, e, profileId, time, signals)])) });
  const scroll = clocksOf(d).find(c => c.id === clockId)?.source === "scroll";
  return <div className="motion-actions">
    <div className="panel-heading">Motion actions</div>
    <p className="ic-help">Compose a movement, then tune its timing. Actions create ordinary editable tracks. Detailed key edits mark an action as customized.</p>
    <label className="ic-select-field">Action<select aria-label="Motion action" value={kind} onChange={e => { const k = e.target.value as MotionAction["kind"]; setKind(k); setAmount(k === "scale" ? 1.2 : k === "rotate" ? 45 : 48); }}>
      <option value="reveal">Reveal</option><option value="move">Move</option><option value="rotate">Rotate</option><option value="scale">Scale</option>
    </select></label>
    {(kind === "reveal" || kind === "move") && <label className="ic-select-field">Direction<select aria-label="Action axis" value={axis} onChange={e => setAxis(e.target.value as "x" | "y")}><option value="y">Vertical</option><option value="x">Horizontal</option></select></label>}
    <NumberField label={kind === "scale" ? "Scale factor" : kind === "rotate" ? "Angle" : "Distance"} value={amount} min={kind === "scale" ? 0.01 : undefined} onChange={setAmount} step={kind === "scale" ? 0.1 : 1} />
    <NumberField label={scroll ? "Start %" : "Start time"} value={scroll ? start / d.duration * 100 : start} min={0} max={scroll ? 100 : d.duration} step={scroll ? 1 : 0.1} onChange={v => setStart(scroll ? v / 100 * d.duration : v)} />
    <NumberField label={scroll ? "End %" : "End time"} value={scroll ? end / d.duration * 100 : end} min={0} max={scroll ? 100 : d.duration} step={scroll ? 1 : 0.1} onChange={v => setEnd(scroll ? v / 100 * d.duration : v)} />
    <NumberField label={scroll ? "Stagger %" : "Stagger seconds"} value={scroll ? stagger / d.duration * 100 : stagger} min={0} step={scroll ? 1 : 0.05} onChange={v => setStagger(scroll ? v / 100 * d.duration : v)} />
    <button className="wide-action" disabled={!targets.length || end <= start || end + stagger * (targets.length - 1) > d.duration} onClick={create}>Apply to {targets.length || "selected"} {targets.length === 1 ? "element" : "elements"}</button>
    <p className="ic-help">Clock: {clocksOf(d).find(c => c.id === clockId)?.name}. Select its scope in Choreography. Negative distance reverses direction. Reveal ends at the original design position.</p>
    {(d.actions ?? []).map(a => { const percent = clocksOf(d).find(c => c.id === a.clockId)?.source === "scroll"; const factor = percent ? 100 / d.duration : 1; return <div className="motion-action-card" key={a.id}>
      <strong>{a.name}</strong><small>{a.customized ? "Customized keys · remove before creating a replacement" : `${a.entityIds.length} targets · ${clocksOf(d).find(c => c.id === a.clockId)?.name}`}</small>
      {!a.customized && <>
        <NumberField label={`${a.name} amount`} value={a.amount} step={a.kind === "scale" ? 0.1 : 1} onChange={amount => apply({ ...a, amount })} />
        <NumberField label={`${a.name} start`} value={a.start * factor} min={0} max={(a.end - 0.01) * factor} step={percent ? 1 : 0.1} suffix={percent ? "%" : "s"} onChange={start => apply({ ...a, start: start / factor })} />
        <NumberField label={`${a.name} end`} value={a.end * factor} min={(a.start + 0.01) * factor} max={(d.duration - a.stagger * (a.entityIds.length - 1)) * factor} step={percent ? 1 : 0.1} suffix={percent ? "%" : "s"} onChange={end => apply({ ...a, end: end / factor })} />
      </>}
      <button className="wide-action" onClick={() => onCommand({ type: "remove-action", id: a.id }, "Remove motion action")}>Remove action and its tracks</button>
    </div>; })}
    <p className="ic-help">“Separate glass” requires independently addressable parts. Imported single-model scenes currently expose whole-model motion; per-mesh actions are not offered.</p>
  </div>;
}
