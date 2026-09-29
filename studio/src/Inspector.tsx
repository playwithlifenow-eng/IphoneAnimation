import { useEffect, useState, type ReactNode } from "react";
import {
  Box,
  ChevronDown,
  Link2,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import type { InspectorProps } from "./contracts";
import {
  evaluateEntity,
  num,
  ownerOf,
  str,
  uid,
  type Props,
  type Value,
} from "./model";
import { capabilityEnvelope } from "./capabilities";
import { COMPONENTS } from "./seed";
import "./controls.css";

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
}) {
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
    <label className={`ic-number ${disabled ? "ic-disabled" : ""}`}>
      <span className="ic-field-label">
        {label}
        {owner && owner !== "base" && (
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
    </label>
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
  const number = (
    key: string,
    label: string,
    fallback = 0,
    min?: number,
    max?: number,
    step = 1,
    suffix?: string,
  ) => (
    <NumberField
      key={key}
      label={label}
      value={num(values, key, fallback)}
      min={min}
      max={max}
      step={step}
      suffix={suffix}
      owner={ownerOf(doc, entity, key, profileId)}
      disabled={ownerOf(doc, entity, key, profileId) === "signal"}
      onChange={(value) => patch(key, value)}
    />
  );
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
        <span className="ic-kind">{entity.kind}</span>
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
          Behaviour
          {ownedTracks.length + ownedBindings.length > 0 && (
            <small>{ownedTracks.length + ownedBindings.length}</small>
          )}
        </button>
      </div>
      <div className="ic-scroll">
        {tab === "design" ? (
          <>
            <Section title="Transform">
              <div className="ic-field-grid">
                {number("x", "X", 0, undefined, undefined, 1, "px")}
                {number("y", "Y", 0, undefined, undefined, 1, "px")}
                {number("width", "Width", 320, 1, 10000, 1, "px")}
                {number("height", "Height", 200, 1, 10000, 1, "px")}
                {number(
                  "rotation",
                  "Rotation",
                  0,
                  undefined,
                  undefined,
                  1,
                  "°",
                )}
                {number("opacity", "Opacity", 1, 0, 1, 0.05)}
              </div>
              <label className="ic-check">
                <input
                  type="checkbox"
                  checked={values.visible !== false}
                  onChange={(event) => patch("visible", event.target.checked)}
                />
                Visible in composition
              </label>
            </Section>
            {isText && (
              <Section title="Content">
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
              </Section>
            )}
            {isText && (
              <Section title="Typography">
                {text("fontFamily", "Font family", "Arial, sans-serif")}
                <div className="ic-field-grid">
                  {number("fontSize", "Font size", 16, 1, 500, 1, "px")}
                  {number("fontWeight", "Weight", 400, 100, 900, 100)}
                  {number("lineHeight", "Line height", 1.2, 0.1, 5, 0.05)}
                  {number("letterSpacing", "Tracking", 0, -30, 100, 0.1, "px")}
                </div>
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
              <div className="ic-field-grid">
                {number("radius", "Corner radius", 0, 0, 1000, 1, "px")}
                {number("padding", "Padding", 0, 0, 1000, 1, "px")}
              </div>
            </Section>
            {entity.kind === "frame" && (
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
            <Section title="Capability envelope">
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
            </Section>
            {scope !== "base" && (
              <Section
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
              </Section>
            )}
          </>
        ) : (
          <>
            <Section title="Property ownership">
              <p className="ic-help">
                Static fields use base values or profile overrides. Tracked
                numeric fields edit a key at the playhead. Signal-owned fields
                are locked until their binding is removed.
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
