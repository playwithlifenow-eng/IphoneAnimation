import { useEffect, useId, useRef, type ReactNode } from "react";
import { studio } from "./store";

/** A whole pointer/keyboard adjustment is one cancellable document gesture. */
export function VisualSlider({ label, value, min, max, step, from, to, onChange, badges, help }: {
  label: string; value: number; min: number; max: number; step: number;
  from: string; to: string; onChange: (value: number) => void;
  badges?: ReactNode; help?: string;
}) {
  const id = useId();
  const active = useRef(false);
  const mode = useRef<"pointer" | "keyboard">("pointer");
  const begin = (nextMode: "pointer" | "keyboard") => {
    if (!active.current) { mode.current = nextMode; studio.beginGesture(); active.current = true; }
  };
  const finish = (cancel = false) => {
    if (!active.current) return;
    active.current = false;
    cancel ? studio.cancelGesture() : studio.commitGesture(`Adjust ${label}`);
  };
  useEffect(() => () => { if (active.current) studio.cancelGesture(); }, []);
  const fraction = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return <div className="ic-visual-slider">
    <div className="ic-instrument-label"><label htmlFor={id}>{label}</label>{badges}</div>
    <input id={id} type="range" min={min} max={max} step={step}
      value={Math.max(min, Math.min(max, value))}
      aria-valuetext={fraction < .25 ? from : fraction > .75 ? to : `Between ${from.toLowerCase()} and ${to.toLowerCase()}`}
      aria-describedby={help ? `${id}-help` : undefined}
      onPointerDown={e => { if (e.button !== 0) return; begin("pointer"); e.currentTarget.setPointerCapture(e.pointerId); }}
      onChange={e => { if (active.current && !studio.hasGesture()) return; onChange(Number(e.target.value)); }}
      onPointerUp={() => finish()}
      onPointerCancel={() => finish(true)}
      onLostPointerCapture={() => finish(true)}
      onKeyDown={e => {
        if (e.key === "Escape" && active.current) { e.preventDefault(); e.stopPropagation(); studio.cancelGesture(); }
        else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(e.key)) begin("keyboard");
      }}
      onKeyUp={e => { if (mode.current === "keyboard" && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(e.key)) finish(); }}
      onBlur={() => finish()} />
    <div className="ic-slider-ends" aria-hidden="true"><span>{from}</span><span>{to}</span></div>
    {help && <p id={`${id}-help`} className="ic-help">{help}</p>}
  </div>;
}
