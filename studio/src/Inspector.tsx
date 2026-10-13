import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Box,
  Diamond,
  ChevronDown,
  Link2,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import type { InspectorProps } from "./contracts";
import {
  evaluateEntity,
  clockTime,
  num,
  ownerOf,
  str,
  uid,
  type Props,
  type Value,
} from "./model";
import { studio } from "./store";
import { effectiveTrack } from "./editing";
import { capabilityEnvelope } from "./capabilities";
import { COMPONENTS } from "./seed";
import "./controls.css";
import { VisualSlider } from "./VisualSlider";

/** Numeric fields retain incomplete input locally; the document only receives finite numbers. */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  disabled = false,
  owner,
  badges,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  owner?: string;
  badges?: ReactNode;
}) {
  const drag = useRef<{ x: number; value: number; pointerId: number; moved: boolean } | null>(null);
  useEffect(() => () => { if (drag.current) studio.cancelGesture(); }, []);
  const [draft, setDraft] = useState(String(Number(value.toFixed(4))));
  useEffect(() => setDraft(String(Number(value.toFixed(4)))), [value]);
  const commit = (raw: string) => {
    setDraft(raw);
    if (!raw.trim()) return;
    const next = Number(raw);
    if (!Number.isFinite(next)) return;
    if ((min !== undefined && next < min) || (max !== undefined && next > max))
      return;
    onChange(next);
  };
  return (
    <div className={`ic-number ${disabled ? "ic-disabled" : ""}`}>
      <span className="ic-field-label">
        <button type="button" className="ic-scrub-label" aria-label={`Scrub ${label}`} disabled={disabled}
          title="Drag to adjust · Shift for coarse · Alt for fine · Escape cancels"
          onPointerDown={e => {
            if (e.button !== 0 || disabled) return;
            e.preventDefault(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId);
            studio.beginGesture(); drag.current = { x: e.clientX, value, pointerId: e.pointerId, moved: false };
          }}
          onPointerMove={e => {
            const start = drag.current;
            if (!start || !studio.hasGesture()) return;
            const delta = e.clientX - start.x;
            if (!start.moved && Math.abs(delta) < 3) return;
            start.moved = true;
            const next = start.value + delta * step * (e.shiftKey ? 10 : e.altKey ? .1 : 1);
            onChange(Number(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, next)).toFixed(4)));
          }}
          onPointerUp={e => {
            const start = drag.current; drag.current = null;
            if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
            studio.commitGesture();
            if (start && !start.moved) e.currentTarget.closest(".ic-number")?.querySelector("input")?.focus();
          }}
          onPointerCancel={() => { drag.current = null; studio.cancelGesture(); }}
          onLostPointerCapture={() => { if (drag.current) { drag.current = null; studio.cancelGesture(); } }}
          onKeyDown={e => {
            if (e.key === "Escape" && drag.current) { e.stopPropagation(); drag.current = null; studio.cancelGesture(); }
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault(); onChange(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, value + (e.key === "ArrowLeft" ? -1 : 1) * step * (e.shiftKey ? 10 : 1))));
            }
          }}>{label}</button>
        {badges}
        {!badges && owner && owner !== "base" && (
          <span
            className={`ic-owner ic-owner-${owner}`}
            title={`Value controlled by ${owner}`}
          >
            {owner}
          </span>
        )}
      </span>
      <span className="ic-number-input">
        <input
          type="number"
          aria-label={label}
          value={draft}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => commit(event.target.value)}
          onBlur={() => setDraft(String(Number(value.toFixed(4))))}
        />
        {suffix && <small>{suffix}</small>}
      </span>
    </div>
  );
}

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="ic-section">
      <div className="ic-section-heading">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Inspector({
  document: doc,
  entity,
  profileId,
  playhead,
  signals,
  onCommand,
  onPatch,
  onBatch,
  onSeekTrack,
  onCaptureTake,
  onCompareTake,
}: InspectorProps) {
  const [tab, setTab] = useState<"design" | "motion">("design");
  const [signalProperty, setSignalProperty] = useState("rotateY");
  const [signalSource, setSignalSource] = useState<
    "pointerX" | "pointerY" | "scroll"
  >("pointerX");
  const [signalMin, setSignalMin] = useState(-24);
  const [signalMax, setSignalMax] = useState(24);
  const scope = profileId === "desktop" ? "base" : profileId;
  useEffect(() => {
    setSignalProperty(entity?.kind === "scene" ? "rotateY" : "x");
  }, [entity?.id, entity?.kind]);
  if (!entity)
    return (
      <aside className="ic-inspector">
        <div className="ic-panel-title">
          <SlidersHorizontal size={15} />
          <span>Inspector</span>
        </div>
        <div className="ic-empty">
          <Box size={27} />
          <strong>A place for every detail.</strong>
          <p>
            Select an element on the canvas or in Layers to shape its
            appearance.
          </p>
        </div>
      </aside>
    );
  const envelope = capabilityEnvelope(entity);
  const values = evaluateEntity(doc, entity, profileId, playhead, signals);
  const profileName =
    doc.profiles.find((profile) => profile.id === profileId)?.name ?? profileId;
  const copy = doc.copy.find((atom) => atom.id === entity.copyId);
  const component = COMPONENTS.find((item) => item.id === entity.componentId);
  const isText =
    entity.kind === "text" ||
    entity.kind === "button" ||
    entity.kind === "component";
  const isMedia = ["image", "video", "svg"].includes(entity.kind);
  const ownedTracks = doc.tracks.filter(
    (track) =>
      track.entityId === entity.id &&
      (track.profileId === "base" || track.profileId === profileId),
  );
  const ownedBindings = doc.bindings.filter(
    (binding) =>
      binding.entityId === entity.id &&
      (binding.profileId === "base" || binding.profileId === profileId),
  );
  const numericProperties =
    entity.kind === "scene"
      ? [
          "rotateX",
          "rotateY",
          "rotateZ",
          "offsetX",
          "offsetY",
          "offsetZ",
          "scale",
          "cameraZ",
          "cameraYaw",
          "cameraPitch",
          "fov",
          "x",
          "y",
          "opacity",
          "exposure",
          "key",
          "ambient",
        ]
      : [
          "x",
          "y",
          "width",
          "height",
          "rotation",
          "opacity",
          ...(isText ? ["fontSize", "letterSpacing"] : []),
        ];
  const patch = (key: string, value: Value) => onPatch({ [key]: value });
  const badges = (key: string, label: string) => {
    const owner = ownerOf(doc, entity, key, profileId);
    const track = owner === "track" ? effectiveTrack(doc, entity, key, profileId) : undefined;
    const binding = owner === "signal" ? (doc.bindings.find(b => b.entityId === entity.id && b.property === key && b.profileId === profileId) ?? doc.bindings.find(b => b.entityId === entity.id && b.property === key && b.profileId === "base")) : undefined;
    const at = track ? clockTime(doc, track.clockId, playhead, signals) : 0;
    const keyed = track?.keys.some(k => Math.abs(k.time - at) < .0001);
    const overridden = scope !== "base" && (Object.hasOwn(entity.overrides[scope] ?? {}, key) || doc.tracks.some(t => t.entityId === entity.id && t.property === key && t.profileId === scope) || doc.bindings.some(b => b.entityId === entity.id && b.property === key && b.profileId === scope));
    return <span className="property-badges">
        {overridden && <button type="button" className="property-scope" aria-label={`Inherit base ${label}`} title={`Reset ${label}: remove this profile’s value, animation and signal overrides; inherit base`}
          onClick={() => onBatch([
            { type: "reset-override", id: entity.id, scope, property: key },
            ...doc.tracks.filter(t => t.entityId === entity.id && t.property === key && t.profileId === scope).map(t => ({ type: "remove-track" as const, id: t.id })),
            ...doc.bindings.filter(b => b.entityId === entity.id && b.property === key && b.profileId === scope).map(b => ({ type: "remove-binding" as const, id: b.id })),
          ], `Inherit base ${label}`)}>{profileName.slice(0, 3).toUpperCase()}</button>}
        {track && <button type="button" className={`property-key ${keyed ? "at-key" : ""}`} aria-label={`Go to nearest ${label} key`} title={keyed ? "Key at this position" : "Animated · go to nearest key"}
          onClick={() => { const key = [...track.keys].sort((a,b) => Math.abs(a.time-at)-Math.abs(b.time-at))[0]; if(key) onSeekTrack(key.time, track.clockId ?? "page"); }}><Diamond size={13} fill={keyed ? "currentColor" : "none"} /></button>}
        {binding && <button type="button" className="property-signal" title={`Driven by ${binding.source}; edits offset its mapping`} aria-label={`${label} driven by ${binding.source}`} onClick={() => setTab("motion")}>~ {binding.source}</button>}
      </span>;
  };
  const number = (key: string, label: string, fallback = 0, min?: number, max?: number, step = 1, suffix?: string) =>
    <NumberField key={key} label={label} value={num(values, key, fallback)} min={min} max={max} step={step} suffix={suffix}
      onChange={value => patch(key, value)} badges={badges(key, label)} />;
  const text = (key: string, label: string, fallback = "") => (
    <label className="ic-text-field">
      <span>{label}</span>
      <input
        aria-label={label}
        value={str(values, key, fallback)}
        onChange={(event) => patch(key, event.target.value)}
      />
    </label>
  );
  const colour = (key: string, label: string, fallback: string) => {
    const value = str(values, key, fallback);
    return (
      <label className="ic-colour-field">
        <span>{label}</span>
        <div className="ic-colour-input">
          <input
            type="color"
            aria-label={`${label} picker`}
            value={/^#[a-f\d]{6}$/i.test(value) ? value : fallback}
            onChange={(event) => patch(key, event.target.value)}
          />
          <input
            aria-label={label}
            value={value}
            onChange={(event) => patch(key, event.target.value)}
          />
        </div>
      </label>
    );
  };
  const setCopy = (value: string) => {
    if (copy && scope === "base")
      onCommand(
        { type: "copy", atom: { ...copy, text: value } },
        "Edit shared copy",
      );
    else patch("text", value);
  };
  const scopeBindings = ownedBindings.filter(
    (binding) => binding.profileId === scope,
  );
  const conflictingTrack = ownedTracks.some(
    (track) => track.property === signalProperty && track.profileId === scope,
  );
  const signalExists = scopeBindings.find(
    (binding) => binding.property === signalProperty,
  );
  const addSignal = () =>
    onCommand(
      {
        type: "binding",
        binding: {
          id: signalExists?.id ?? uid("binding"),
          entityId: entity.id,
          property: signalProperty,
          source: signalSource,
          min: signalMin,
          max: signalMax,
          profileId: scope,
        },
      },
      `Bind ${signalProperty} to ${signalSource}`,
    );
  return (
    <aside className="ic-inspector" aria-label="Element inspector">
      <div className="ic-panel-title">
        <SlidersHorizontal size={15} />
        <span>Inspector</span>
        <button type="button" className="ic-capture" onClick={onCaptureTake} title="Preserve this direction without a naming dialog">Capture Take</button>
      </div>
      <div className="ic-entity-heading">
        <input
          aria-label="Element name"
          value={entity.name}
          onChange={(event) =>
            onCommand(
              { type: "rename", id: entity.id, name: event.target.value },
              "Rename element",
            )
          }
        />
        <div className="ic-scope-line">
          <span
            className={`ic-scope-dot ${scope !== "base" ? "ic-scope-override" : ""}`}
          />
          {scope === "base"
            ? "Base · all profiles"
            : `${profileName} overrides`}
        </div>
      </div>
      <div className="ic-tabs" role="tablist" aria-label="Inspector sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "design"}
          className={tab === "design" ? "active" : ""}
          onClick={() => setTab("design")}
        >
          Design
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "motion"}
          className={tab === "motion" ? "active" : ""}
          onClick={() => setTab("motion")}
        >
          Animation & signals
          {ownedTracks.length + ownedBindings.length > 0 && (
            <small>{ownedTracks.length + ownedBindings.length}</small>
          )}
        </button>
      </div>
      {onCompareTake && <button type="button" className="ic-compare-take" onClick={onCompareTake}>Compare with latest Take</button>}
      <div className="ic-scroll">
        {tab === "design" ? (
          <>
            {entity.kind !== "section" && (!entity.parentId || doc.entities.find(e => e.id === entity.parentId)?.kind === "section") && doc.entities.some(e => e.kind === "section") && <Section title="Page section">
              <label className="ic-select-field">Move to section<select aria-label="Move to section" value={entity.parentId ?? ""} onChange={e => onCommand({ type: "reparent", id: entity.id, parentId: e.target.value || undefined }, "Move to section")}>
                {!entity.parentId && <option value="">Page overlay</option>}
                {doc.entities.filter(e => e.kind === "section").map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select></label>
              <p className="ic-help">Keeps the element’s local position, responsive values and existing animation clock.</p>
            </Section>}
            {entity.kind === "section" && <Section title="Section flow">
              <label className="ic-select-field">Height mode<select aria-label="Section height mode" value={str(values, "heightMode", "fixed")} onChange={e => patch("heightMode", e.target.value)}>
                <option value="fixed">Fixed height</option><option value="viewport">Viewport height</option><option value="content">Fit authored content</option>
              </select></label>
              {str(values, "heightMode", "fixed") === "fixed" && number("height", "Section height", 760, 100, 10000)}
              <label className="ic-check"><input type="checkbox" aria-label="Pin section" checked={values.pin === true} onChange={e => patch("pin", e.target.checked)} />Pin during scroll choreography</label>
              {values.pin === true && number("scrollVh", "Scroll distance", 100, 10, 1000, 10, "vh")}
              <p className="ic-help">Section height is the visible frame. Scroll distance adds travel while that frame stays pinned. Reorder sections in Layers.</p>
            </Section>}
            {isText && (
              <Section title="Typography">
                <div className="ic-type-presets" role="group" aria-label="Typography starting points">
                  {[
                    { name: "Display Hero", size: 86, weight: 500, height: .99, tracking: -.05, sample: 28 },
                    { name: "Cinematic Title", size: 64, weight: 500, height: 1.08, tracking: -.035, sample: 23 },
                    { name: "Editorial Lead", size: 36, weight: 400, height: 1.2, tracking: -.015, sample: 19 },
                    { name: "Body", size: 18, weight: 400, height: 1.5, tracking: 0, sample: 15 },
                  ].map(preset => <button type="button" key={preset.name} onClick={() => onPatch({ fontSize: preset.size, fontWeight: preset.weight, lineHeight: preset.height, letterSpacing: preset.size * preset.tracking })}>
                    <span aria-hidden="true" style={{ fontSize: preset.sample, fontFamily: str(values, "fontFamily", "Arial"), fontWeight: preset.weight }}>Aa</span>
                    <span>{preset.name}</span>
                  </button>)}
                </div>
                <p className="ic-help">Choose a starting point, then shape it freely.</p>
                <VisualSlider key={`${entity.id}:${profileId}:size`} label="Type size" value={num(values, "fontSize", 16)} min={8} max={500} step={1}
                  from="Small" to="Large" onChange={value => patch("fontSize", value)} badges={badges("fontSize", "Type size")} />
                <VisualSlider key={`${entity.id}:${profileId}:weight`} label="Type weight" value={num(values, "fontWeight", 400)} min={100} max={900} step={100}
                  from="Light" to="Bold" onChange={value => patch("fontWeight", value)} badges={badges("fontWeight", "Type weight")} />
                <VisualSlider key={`${entity.id}:${profileId}:rhythm`} label="Rhythm" value={(num(values, "lineHeight", 1.2) - .95) / .75} min={0} max={1} step={.01}
                  from="Tight" to="Airy" onChange={value => onPatch({ lineHeight: .95 + value * .75, letterSpacing: num(values, "fontSize", 16) * (-.05 + value * .09) })}
                  badges={<>{badges("lineHeight", "Rhythm line spacing")}{badges("letterSpacing", "Rhythm letter spacing")}</>}
                  help="Moves line spacing and letter spacing together. Adjust them separately in Typography precision." />
                <details className="ic-precision-panel" key={`${entity.id}:type-precision`}>
                  <summary>Typography precision</summary>
                  <div className="ic-font-precision">{text("fontFamily", "Font family", "Arial, sans-serif")}</div>
                  <div className="ic-field-grid">
                    {number("fontSize", "Font size", 16, 1, 500, 1, "px")}
                    {number("fontWeight", "Weight", 400, 100, 900, 100)}
                    {number("lineHeight", "Line height", 1.2, .1, 5, .05)}
                    {number("letterSpacing", "Tracking", 0, -30, 100, .1, "px")}
                  </div>
                </details>
                <label className="ic-select-field">
                  <span>Alignment</span>
                  <select
                    aria-label="Text alignment"
                    value={str(values, "textAlign", "left")}
                    onChange={(event) => patch("textAlign", event.target.value)}
                  >
                    <option value="left">Left</option>
                    <option value="center">Centre</option>
                    <option value="right">Right</option>
                  </select>
                </label>
              </Section>
            )}
            <Section title="Presence">
              <VisualSlider key={`${entity.id}:${profileId}:opacity`} label="Prominence" value={num(values, "opacity", 1)} min={0} max={1} step={.01}
                from="Transparent" to="Solid" onChange={value => patch("opacity", value)} badges={badges("opacity", "Prominence")} />
              <label className="ic-check"><input type="checkbox" checked={values.visible !== false} onChange={event => patch("visible", event.target.checked)} />Visible in composition</label>
              {entity.kind === "text" && <div className="ic-canvas-tip"><span>Drag the right-edge handle to shape line breaks.</span>{badges("width", "Line length")}</div>}
            </Section>
            {isText && (
              <details className="ic-precision-panel ic-transform-precision"><summary>Edit copy</summary><Section title="Content">
                {entity.kind === "component" && text("title", "Title")}
                <label className="ic-text-field">
                  <span>
                    {copy && scope === "base" ? "Shared copy" : "Text"}
                    {copy && <Link2 size={11} />}
                  </span>
                  <textarea
                    aria-label="Element text"
                    value={str(values, "text")}
                    rows={4}
                    onChange={(event) => setCopy(event.target.value)}
                  />
                </label>
                {copy && (
                  <p className="ic-help">
                    {scope === "base"
                      ? `Linked to “${copy.name}”. Edits update every use of this copy atom.`
                      : "Text edits apply to this profile. The shared copy stays available for other profiles."}
                  </p>
                )}
                {entity.kind === "button" && text("href", "Destination URL")}
              </Section></details>
            )}
            <details className="ic-precision-panel ic-transform-precision" key={`${entity.id}:transform-precision`}>
              <summary>Position &amp; size precision</summary>
              <div className="ic-field-grid">
                {entity.kind !== "section" && <>
                  {number("x", "X", 0, undefined, undefined, 1, "px")}
                  {number("y", "Y", 0, undefined, undefined, 1, "px")}
                  {number("width", "Width", 320, 1, 10000, 1, "px")}
                  {number("height", "Height", 200, 1, 10000, 1, "px")}
                  {number("rotation", "Rotation", 0, undefined, undefined, 1, "°")}
                  {number("translateX", "Page offset X", 0)}
                  {number("translateY", "Page offset Y", 0)}
                  {number("visualScale", "Visual scale", 1, .01, 100, .1)}
                </>}
                {number("opacity", "Opacity", 1, 0, 1, .05)}
              </div>
              <p className="ic-help">Animation and signal edits keep their current owner. Use Choreography to choose key or offset editing.</p>
            </details>
            {isMedia && (
              <Section
                title={entity.kind === "video" ? "Video" : "Image source"}
              >
                {text("src", "Source URL")}
                <p className="ic-help">
                  Use a hosted URL or an imported asset. SVGs render as images.
                </p>
                <label className="ic-select-field">
                  <span>Fit</span>
                  <select
                    aria-label="Media fit"
                    value={str(values, "objectFit", "cover")}
                    onChange={(event) => patch("objectFit", event.target.value)}
                  >
                    <option value="cover">Cover</option>
                    <option value="contain">Contain</option>
                    <option value="fill">Stretch</option>
                  </select>
                </label>
                {entity.kind === "image" && text("alt", "Alternative text")}
                {entity.kind === "video" && (
                  <label className="ic-check">
                    <input
                      type="checkbox"
                      checked={values.loop !== false}
                      onChange={(event) => patch("loop", event.target.checked)}
                    />
                    Loop video
                  </label>
                )}
              </Section>
            )}
            {entity.kind === "scene" && (
              <>
                <Section title="3D asset">
                  {text("modelUrl", "GLB URL")}
                  <p className="ic-help">
                    Transforms below affect the model inside its canvas frame.
                    Existing geometry is preserved.
                  </p>
                </Section>
                <Section title="Model transform">
                  <div className="ic-field-grid">
                    {number(
                      "rotateX",
                      "Rotate X",
                      0,
                      undefined,
                      undefined,
                      1,
                      "°",
                    )}
                    {number(
                      "rotateY",
                      "Rotate Y",
                      0,
                      undefined,
                      undefined,
                      1,
                      "°",
                    )}
                    {number(
                      "rotateZ",
                      "Rotate Z",
                      0,
                      undefined,
                      undefined,
                      1,
                      "°",
                    )}
                    {number("scale", "Scale", 1, 0.01, 100, 0.05)}
                    {number(
                      "offsetX",
                      "Offset X",
                      0,
                      undefined,
                      undefined,
                      0.05,
                    )}
                    {number(
                      "offsetY",
                      "Offset Y",
                      0,
                      undefined,
                      undefined,
                      0.05,
                    )}
                    {number(
                      "offsetZ",
                      "Offset Z",
                      0,
                      undefined,
                      undefined,
                      0.05,
                    )}
                  </div>
                </Section>
                <Section title="Camera">
                  <div className="ic-field-grid">
                    {number("cameraYaw", "Camera yaw", 0, undefined, undefined, 0.5, "°")}
                    {number("cameraPitch", "Camera pitch", 0, -85, 85, 0.5, "°")}
                    {number("cameraZ", "Camera distance", 5, 0.2, 100, 0.1)}
                    {number("fov", "Field of view", 35, 10, 100, 1, "°")}
                  </div>
                </Section>
                <Section title="Light & material">
                  <div className="ic-field-grid">
                    {number("ambient", "Ambient light", 1.5, 0, 20, 0.1)}
                    {number("key", "Key light", 3, 0, 40, 0.1)}
                    {number("lightX", "Light X", 4, -50, 50, 0.5)}
                    {number("lightY", "Light Y", 5, -50, 50, 0.5)}
                    {number("roughness", "Roughness", 0.45, 0, 1, 0.05)}
                    {number("metalness", "Metalness", 0.3, 0, 1, 0.05)}
                    {number("exposure", "Exposure", 1, 0, 10, 0.05)}
                  </div>
                  <p className="ic-help">
                    Material controls apply across the loaded model. Per-mesh
                    material selection is not implemented.
                  </p>
                </Section>
              </>
            )}
            <Section title="Appearance">
              {isText && colour("color", "Text colour", "#233a30")}
              {colour("background", "Fill", "#ecebe4")}
              <details className="ic-precision-panel"><summary>Shape precision</summary><div className="ic-field-grid">
                {number("radius", "Corner radius", 0, 0, 1000, 1, "px")}
                {number("padding", "Padding", 0, 0, 1000, 1, "px")}
              </div></details>
            </Section>
            {(entity.kind === "frame" || entity.kind === "section") && (
              <Section title="Child layout">
                <label className="ic-select-field">
                  <span>Direction</span>
                  <select
                    aria-label="Layout direction"
                    value={str(values, "layout", "free")}
                    onChange={(event) => patch("layout", event.target.value)}
                  >
                    <option value="free">Free positioning</option>
                    <option value="row">Horizontal stack</option>
                    <option value="column">Vertical stack</option>
                  </select>
                </label>
                {number("gap", "Gap", 16, 0, 1000, 1, "px")}
                <p className="ic-help">
                  Stack layout arranges the frame’s direct children. Their saved
                  X/Y positions are used when returning to free layout.
                </p>
              </Section>
            )}
            {component && (
              <Section title="Component contract">
                <div className="ic-capabilities">
                  {component.capabilities.map((capability) => (
                    <span key={capability}>{capability}</span>
                  ))}
                </div>
                <p className="ic-help">{component.description}</p>
                {component.id === "hero-reference" && (
                  <p className="ic-notice">
                    Source reference only. Production Hero playback is not
                    embedded in this component.
                  </p>
                )}
              </Section>
            )}
            <details className="ic-precision-panel ic-transform-precision"><summary>Capabilities &amp; limits</summary><Section title="Capability envelope">
              <div className="ic-capabilities">
                {envelope.supported.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
              <p className="ic-help">
                {envelope.adapter} · v{envelope.version}
              </p>
              <p className="ic-help">Limited: {envelope.limited.join("; ")}.</p>
              <p className="ic-help">
                Unavailable: {envelope.unavailable.join("; ")}.
              </p>
            </Section></details>
            {scope !== "base" && (
              <details className="ic-precision-panel ic-transform-precision"><summary>Profile override details</summary><Section
                title={`${profileName} overrides`}
                action={
                  <button
                    type="button"
                    className="ic-icon-button"
                    title="Reset all profile overrides"
                    aria-label="Reset all profile overrides"
                    onClick={() =>
                      onCommand(
                        { type: "reset-override", id: entity.id, scope },
                        "Reset profile overrides",
                      )
                    }
                  >
                    <RotateCcw size={13} />
                  </button>
                }
              >
                {Object.keys(entity.overrides[scope] ?? {}).length === 0 ? (
                  <p className="ic-help">
                    This element inherits its base design.
                  </p>
                ) : (
                  <div className="ic-overrides">
                    {Object.entries(entity.overrides[scope] ?? {}).map(
                      ([key, value]) => (
                        <div key={key}>
                          <span title={String(value)}>
                            {key}
                            <small>{String(value).slice(0, 32)}</small>
                          </span>
                          <button
                            type="button"
                            className="ic-icon-button"
                            aria-label={`Reset ${key} override`}
                            title={`Inherit base ${key}`}
                            onClick={() =>
                              onCommand(
                                {
                                  type: "reset-override",
                                  id: entity.id,
                                  scope,
                                  property: key,
                                },
                                `Reset ${key} override`,
                              )
                            }
                          >
                            <RotateCcw size={12} />
                          </button>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </Section></details>
            )}
          </>
        ) : (
          <>
            <Section title="Property ownership">
              <p className="ic-help">
                Static fields use base values or profile overrides. Tracked
                numeric fields edit a key at the playhead. Signal-owned edits
                offset the mapping while preserving its range.
              </p>
              {ownedTracks.length === 0 && ownedBindings.length === 0 && (
                <p className="ic-notice">
                  No motion or signal owners. Add a key in Choreography to
                  animate a numeric property.
                </p>
              )}
              {ownedTracks.map((track) => (
                <div className="ic-owner-row" key={track.id}>
                  <div>
                    <strong>{track.property}</strong>
                    <small>
                      Track · {track.profileId} · {track.keys.length} keys
                    </small>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onCommand(
                        { type: "remove-track", id: track.id },
                        `Remove ${track.property} track`,
                      )
                    }
                  >
                    Release
                  </button>
                </div>
              ))}
              {ownedBindings.map((binding) => (
                <div className="ic-owner-row" key={binding.id}>
                  <div>
                    <strong>{binding.property}</strong>
                    <small>
                      {binding.source} · {binding.profileId} · {binding.min} →{" "}
                      {binding.max}
                    </small>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onCommand(
                        { type: "remove-binding", id: binding.id },
                        `Remove ${binding.property} binding`,
                      )
                    }
                  >
                    Release
                  </button>
                </div>
              ))}
            </Section>
            <Section title="Connect a signal">
              <label className="ic-select-field">
                <span>Property</span>
                <select
                  aria-label="Signal property"
                  value={signalProperty}
                  onChange={(event) => setSignalProperty(event.target.value)}
                >
                  {numericProperties.map((property) => (
                    <option key={property} value={property}>
                      {property}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ic-select-field">
                <span>Source</span>
                <select
                  aria-label="Signal source"
                  value={signalSource}
                  onChange={(event) =>
                    setSignalSource(event.target.value as typeof signalSource)
                  }
                >
                  <option value="pointerX">Pointer X</option>
                  <option value="pointerY">Pointer Y</option>
                  <option value="scroll">Scroll progress</option>
                </select>
              </label>
              <div className="ic-field-grid">
                <NumberField
                  label="Minimum output"
                  value={signalMin}
                  step={0.1}
                  onChange={setSignalMin}
                />
                <NumberField
                  label="Maximum output"
                  value={signalMax}
                  step={0.1}
                  onChange={setSignalMax}
                />
              </div>
              <button
                type="button"
                className="ic-wide-button"
                disabled={conflictingTrack}
                onClick={addSignal}
              >
                <Link2 size={13} />
                {signalExists ? "Update binding" : "Connect signal"}
              </button>
              <p className="ic-help">
                {conflictingTrack
                  ? "Release this property’s track first. A property can have only one owner per profile."
                  : `Maps normalised input 0–1 to the output range in ${scope === "base" ? "all profiles" : profileName}.`}
              </p>
            </Section>
          </>
        )}
      </div>
      <div className="ic-panel-footer">
        <span>
          {scope === "base" ? "Editing base values" : `Editing ${profileName}`}
        </span>
        <ChevronDown size={12} />
      </div>
    </aside>
  );
}

export default Inspector;
