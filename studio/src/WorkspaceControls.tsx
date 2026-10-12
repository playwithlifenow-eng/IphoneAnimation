import { useEffect, useRef, useState } from "react";

export function usePreference<T extends number | boolean>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? "null");
      return typeof stored === typeof initial && (typeof stored !== "number" || Number.isFinite(stored)) ? stored as T : initial;
    } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }, [key, value]);
  return [value, setValue] as const;
}

/** Keyboard and pointer resizing use the same limits; Escape restores the starting size. */
export function ResizeHandle({ label, value, min, max, onChange, axis = "x", direction = 1 }: {
  label: string; value: number; min: number; max: number; onChange: (value: number) => void;
  axis?: "x" | "y"; direction?: number;
}) {
  const drag = useRef<{ coordinate: number; value: number } | null>(null);
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return <div role="separator" aria-label={label} aria-orientation={axis === "x" ? "vertical" : "horizontal"}
    aria-valuemin={min} aria-valuemax={max} aria-valuenow={Math.round(value)} tabIndex={0}
    className={`workspace-resizer resize-${axis}`} title={`${label} · drag or use arrow keys`}
    onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { coordinate: axis === "x" ? e.clientX : e.clientY, value }; }}
    onPointerMove={e => { if (drag.current) onChange(clamp(drag.current.value + ((axis === "x" ? e.clientX : e.clientY) - drag.current.coordinate) * direction)); }}
    onPointerUp={e => { drag.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
    onPointerCancel={() => { if (drag.current) onChange(drag.current.value); drag.current = null; }}
    onLostPointerCapture={() => { drag.current = null; }}
    onKeyDown={e => {
      if (e.key === "Escape" && drag.current) { e.stopPropagation(); onChange(drag.current.value); drag.current = null; }
      const keys = axis === "x" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
      if (keys.includes(e.key)) { e.preventDefault(); onChange(clamp(value + (e.key === keys[0] ? -1 : 1) * direction * (e.shiftKey ? 40 : 10))); }
      if (e.key === "Home" || e.key === "End") { e.preventDefault(); onChange(e.key === "Home" ? min : max); }
    }} />;
}
