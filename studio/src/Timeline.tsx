import { editProperties } from "./editing";
import { useEffect, useState } from "react";
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Diamond,
  Pause,
  Play,
  Plus,
  SkipBack,
  Trash2,
} from "lucide-react";
import type { TimelineProps } from "./contracts";
import {
  evaluateEntity,
  clockTime,
  clocksOf,
  num,
  ownerOf,
  uid,
  upsertKey,
  type Props,
  type Track,
  type Command,
} from "./model";
import { NumberField } from "./Inspector";
import "./controls.css";

const LABELS: Record<string, string> = {
  translateX: "Offset X",
  translateY: "Offset Y",
  visualScale: "Visual scale",
  x: "Position X",
  y: "Position Y",
  width: "Width",
  height: "Height",
  rotation: "Rotation",
  opacity: "Opacity",
  rotateX: "Rotate X",
  rotateY: "Rotate Y",
  rotateZ: "Rotate Z",
  offsetX: "Offset X",
  offsetY: "Offset Y",
  offsetZ: "Offset Z",
  scale: "Model scale",
  cameraZ: "Camera distance",
  fov: "Field of view",
  fontSize: "Font size",
  letterSpacing: "Tracking",
  ambient: "Ambient light",
  key: "Key light",
  exposure: "Exposure",
};
const POSE_KEYS = [
  "x",
  "y",
  "width",
  "height",
  "rotation",
  "opacity",
  "rotateX",
  "rotateY",
  "rotateZ",
  "offsetX",
  "offsetY",
  "offsetZ",
  "scale",
  "cameraZ",
  "fov",
];

export function Timeline({
  document: doc,
  selection,
  profileId,
  playhead,
  signals,
  playing,
  onSeek,
  onPlay,
  onCommand,
  onBatch,
  onSelect,
  clockId = "page",
  onClockSelect,
  editMode = "key",
  onEditMode,
}: TimelineProps) {
  const clock = clocksOf(doc).find(c => c.id === clockId) ?? clocksOf(doc)[0];
  const position = clockTime(doc, clock.id, playhead, signals);
  const scroll = clock.source === "scroll";
  const format = (time: number) => scroll ? `${Math.round(time / doc.duration * 100)}%` : `${time.toFixed(2)}s`;
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("iglass.studio.timeline-collapsed") === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("iglass.studio.timeline-collapsed", String(collapsed));
    } catch {
      // The panel remains usable when browser preference storage is unavailable.
    }
  }, [collapsed]);
  const [property, setProperty] = useState("x");
  const [poseName, setPoseName] = useState("");
  const [keySelection, setKeySelection] = useState<{
    trackId: string;
    keyId: string;
  } | null>(null);
  const entity = doc.entities.find((item) => item.id === selection[0]);
  const scope = profileId === "desktop" ? "base" : profileId;
  useEffect(() => {
    setProperty(entity?.kind === "scene" ? "rotateY" : "x");
    setKeySelection((current) =>
      doc.tracks.some(
        (t) => t.id === current?.trackId && t.entityId === entity?.id,
      )
        ? current
        : null,
    );
  }, [entity?.id, entity?.kind]);
  const properties =
    entity?.kind === "scene"
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
          "rotation",
          "opacity",
          "ambient",
          "key",
          "exposure",
        ]
      : [
          "x",
          "y",
          "width",
          "height",
          "rotation",
          "opacity",
          ...(["text", "button", "component"].includes(entity?.kind ?? "")
            ? ["fontSize", "letterSpacing"]
            : []),
        ];
  properties.push("translateX", "translateY", "visualScale");
  const visibleTracks = doc.tracks.filter(
    (track) => (track.profileId === profileId || (track.profileId === "base" && !doc.tracks.some(t => t.entityId === track.entityId && t.property === track.property && t.profileId === profileId))) && (track.clockId ?? "page") === clock.id,
  );
  const selectedTrack = visibleTracks.find(
    (track) => track.id === keySelection?.trackId,
  );
  const selectedKey = selectedTrack?.keys.find(
    (key) => key.id === keySelection?.keyId,
  );
  const lastKey = Math.max(
    0.1,
    ...doc.tracks.flatMap((track) => track.keys.map((key) => key.time)),
  );
  const ticks = Array.from(
    { length: 9 },
    (_, index) => (doc.duration * index) / 8,
  );
  const canAddKey =
    entity && entity.kind !== "section" &&
    !doc.tracks.some(t => t.entityId === entity.id && t.property === property && (t.profileId === "base" || t.profileId === profileId) && (t.clockId ?? "page") !== clock.id) &&
    !doc.bindings.some(
      (binding) =>
        binding.entityId === entity.id &&
        binding.property === property &&
        (binding.profileId === "base" || binding.profileId === profileId),
    );
  const addKey = () => {
    if (!entity || !canAddKey) return;
    const values = evaluateEntity(doc, entity, profileId, playhead, signals);
    const time = Math.min(
      Math.floor(doc.duration * 100) / 100,
      Math.round(position * 100) / 100,
    );
    const track = upsertKey(
      doc,
      entity.id,
      property,
      scope,
      time,
      num(values, property),
      clock.id,
    );
    onCommand({ type: "track", track }, `Key ${LABELS[property] ?? property}`);
    const key = track.keys.find((item) => item.time === time);
    if (key) setKeySelection({ trackId: track.id, keyId: key.id });
  };
  const forkForProfile = (track: Track): Track => profileId !== "desktop" && track.profileId === "base"
    ? { ...track, id: uid("track"), profileId: scope } : track;
  const changeKey = (values: { time?: number; value?: number }) => {
    if (!selectedTrack || !selectedKey) return;
    if (
      values.time !== undefined &&
      selectedTrack.keys.some(
        (key) => key.id !== selectedKey.id && key.time === values.time,
      )
    )
      return;
    const track = forkForProfile(selectedTrack);
    onCommand({ type: "track", track: { ...track, keys: track.keys.map(key => key.id === selectedKey.id ? { ...key, ...values } : key) } }, "Edit keyframe");
    setKeySelection({ trackId: track.id, keyId: selectedKey.id });
  };
  const deleteKey = () => {
    if (!selectedTrack || !selectedKey) return;
    const track = forkForProfile(selectedTrack);
    const keys = track.keys.filter((key) => key.id !== selectedKey.id);
    if (!keys.length && track.id !== selectedTrack.id) return;
    onCommand(
      keys.length
        ? { type: "track", track: { ...track, keys } }
        : { type: "remove-track", id: selectedTrack.id },
      "Delete keyframe",
    );
    setKeySelection(null);
  };
  const recordPose = () => {
    if (!entity) return;
    const values = evaluateEntity(doc, entity, profileId, playhead, signals);
    const transforms: Props = {};
    for (const key of POSE_KEYS)
      if (
        typeof values[key] === "number" &&
        (entity.kind === "scene" ||
          ["x", "y", "width", "height", "rotation", "opacity"].includes(key))
      )
        transforms[key] = values[key];
    onCommand(
      {
        type: "pose",
        pose: {
          id: uid("pose"),
          name: poseName.trim() || `${entity.name} · ${format(position)}`,
          entityId: entity.id,
          profileId: scope,
          time: position,
          values: transforms,
        },
      },
      "Record pose",
    );
    setPoseName("");
  };
  const poses = doc.poses.filter(
    (pose) =>
      pose.entityId === entity?.id &&
      (pose.profileId === "base" || pose.profileId === profileId),
  );
  const recallPose = (values: Props) => {
    if (!entity) return;
    const commands = editProperties(doc, entity, values, profileId, playhead, signals ?? {}, editMode ?? "key", clock.id);
    if (commands.length) onBatch(commands, "Recall pose");
  };
  const interpolation = (track: Track, value: Track["interpolation"]) =>
    onCommand(
      { type: "track", track: { ...track, interpolation: value } },
      "Change interpolation",
    );
  return (
    <section className={`tl-panel${collapsed ? " tl-collapsed" : ""}`} aria-label="Choreography timeline">
      <div className="tl-header">
        <div className="tl-heading">
          <span className="tl-label">Choreography</span>
          <span className="tl-subtitle">
            {visibleTracks.length}{" "}
            {visibleTracks.length === 1 ? "track" : "tracks"}
          </span>
        </div>
        <div className="tl-transport">
          <button
            type="button"
            title="Return to start"
            aria-label="Return to start"
            onClick={() => onSeek(0)}
          >
            <SkipBack size={13} />
          </button>
          <button
            type="button"
            className="tl-play"
            aria-label={playing ? "Pause animation" : "Play animation"}
            onClick={onPlay}
          >
            {playing ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <output className="tl-time">
            {format(position)}
            <span> / {scroll ? "100%" : `${doc.duration.toFixed(2)}s`}</span>
          </output>
        </div>
        <select aria-label="Choreography scope" className="tl-scope" value={clock.id} onChange={e => onClockSelect?.(e.target.value)}>
          {clocksOf(doc).map(c => <option key={c.id} value={c.id}>{c.sectionId ? doc.entities.find(e => e.id === c.sectionId)?.name : c.name}</option>)}
        </select>
        <select aria-label="Choreography driver" value={clock.source} onChange={e => onCommand({ type: "clock", clock: { ...clock, source: e.target.value as "time" | "scroll" } }, "Change clock driver")}>
          <option value="time">Time</option><option value="scroll">Scroll</option>
        </select>
        <select aria-label="Animated edit mode" value={editMode} onChange={e => onEditMode?.(e.target.value as "key" | "offset")} title="Tracked properties: record a key at this moment, or shift the entire animation. Static properties remain static until you add a key or action.">
          <option value="key">Key this moment</option><option value="offset">Offset animation</option>
        </select>
        {!scroll && <div className="tl-duration">
          <NumberField
            label="Duration"
            value={doc.duration}
            min={lastKey}
            max={600}
            step={0.5}
            suffix="s"
            onChange={(duration) =>
              onCommand({ type: "duration", duration }, "Change duration")
            }
          />
        </div>}
        <button
          type="button"
          className="tl-collapse"
          aria-label={collapsed ? "Expand choreography" : "Collapse choreography"}
          aria-expanded={!collapsed}
          aria-controls="choreography-content"
          title={collapsed ? "Show timeline and keyframes" : "Hide timeline to enlarge the canvas"}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </div>
      <div id="choreography-content" className="tl-content" hidden={collapsed}>
      <div className="tl-ruler-row">
        <div className="tl-ruler-title">
          PROPERTY{" "}
          <span>{scope === "base" ? "BASE" : scope.toUpperCase()}</span>
        </div>
        <div className="tl-ruler">
          <div className="tl-ticks">
            {ticks.map((time, index) => (
              <span key={index} style={{ left: `${index * 12.5}%` }}>
                {format(time)}
              </span>
            ))}
          </div>
          <input
            type="range"
            className="tl-scrubber"
            aria-label="Animation playhead"
            min={0}
            max={doc.duration}
            step={0.01}
            value={position}
            onChange={(event) => onSeek(Number(event.target.value))}
          />
        </div>
        <span className="tl-interpolation-heading">INTERPOLATION</span>
      </div>
      <div className="tl-tracks">
        {visibleTracks.length === 0 ? (
          <div className="tl-empty">
            Select an element and add a keyframe. Scrub to another moment,
            change a value, and add the next key.
          </div>
        ) : (
          visibleTracks.map((track) => {
            const target = doc.entities.find(
              (item) => item.id === track.entityId,
            );
            return (
              <div
                key={track.id}
                className={`tl-track ${selection.includes(track.entityId) ? "tl-track-selected" : ""}`}
              >
                <button
                  type="button"
                  className="tl-track-name"
                  title={`Select ${target?.name ?? "element"}`}
                  onClick={() => { onSelect(track.entityId); onClockSelect?.(track.clockId ?? "page"); }}
                >
                  <Diamond size={10} />
                  <span>
                    {target?.name ?? "Missing element"}
                    <small>
                      {LABELS[track.property] ?? track.property}{" "}
                      <b>{track.profileId}</b>
                    </small>
                  </span>
                </button>
                <div
                  className="tl-lane"
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    onSeek(
                      Math.max(
                        0,
                        Math.min(
                          doc.duration,
                          ((event.clientX - rect.left) / rect.width) *
                            doc.duration,
                        ),
                      ),
                    );
                  }}
                >
                  <div className="tl-lane-rule" />
                  <div
                    className="tl-playhead"
                    style={{ left: `${(position / doc.duration) * 100}%` }}
                  />
                  {track.keys.map((key) => (
                    <button
                      type="button"
                      key={key.id}
                      className={`tl-key ${keySelection?.keyId === key.id ? "tl-key-selected" : ""}`}
                      style={{ left: `${(key.time / doc.duration) * 100}%` }}
                      title={`${LABELS[track.property] ?? track.property}: ${key.value} at ${format(key.time)}`}
                      aria-label={`${target?.name} ${track.property} key at ${scroll ? format(key.time) : `${key.time} seconds`}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSeek(key.time);
                        onSelect(track.entityId);
                        onClockSelect?.(track.clockId ?? "page");
                        setKeySelection({ trackId: track.id, keyId: key.id });
                      }}
                    >
                      <Diamond size={11} fill="currentColor" />
                    </button>
                  ))}
                </div>
                <select
                  className="tl-interpolation"
                  aria-label={`${target?.name} ${track.property} interpolation`}
                  value={track.interpolation}
                  onChange={(event) =>
                    interpolation(
                      track,
                      event.target.value as Track["interpolation"],
                    )
                  }
                >
                  <option value="smooth">Smooth</option>
                  <option value="linear">Linear</option>
                  <option value="hold">Hold</option>
                </select>
              </div>
            );
          })
        )}
      </div>
      <div className="tl-tools">
        <div className="tl-add-key">
          <select
            aria-label="Animate property"
            disabled={!entity}
            value={property}
            onChange={(event) => setProperty(event.target.value)}
          >
            {properties.map((item) => (
              <option key={item} value={item}>
                {LABELS[item] ?? item}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="tl-action"
            disabled={!canAddKey}
            title={
              entity && !canAddKey
                ? "This property has a signal or another clock. Select that owner in Behaviour."
                : "Add or update a keyframe at the playhead"
            }
            onClick={addKey}
          >
            <Plus size={12} />
            Add key
          </button>
        </div>
        {selectedTrack && selectedKey ? (
          <div className="tl-key-editor">
            <NumberField
              label="Key time"
              value={scroll ? selectedKey.time / doc.duration * 100 : selectedKey.time}
              min={0}
              max={scroll ? 100 : doc.duration}
              step={scroll ? 1 : 0.01}
              suffix={scroll ? "%" : "s"}
              onChange={(time) => changeKey({ time: scroll ? time / 100 * doc.duration : time })}
            />
            <NumberField
              label="Key value"
              value={selectedKey.value}
              step={0.1}
              onChange={(value) => changeKey({ value })}
            />
            <button
              type="button"
              aria-label="Delete selected keyframe"
              disabled={profileId !== "desktop" && selectedTrack.profileId === "base" && selectedTrack.keys.length === 1}
              title={profileId !== "desktop" && selectedTrack.profileId === "base" && selectedTrack.keys.length === 1 ? "Add a profile key before removing the only inherited key" : "Delete selected keyframe"}
              onClick={deleteKey}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ) : (
          <span className="tl-hint">
            {entity
              ? "Drag tracked objects to edit motion. Static objects stay static until keyed."
              : "Select an element to begin."}
          </span>
        )}
        <div className="tl-record">
          <input
            aria-label="Pose name"
            placeholder="Name this pose…"
            value={poseName}
            disabled={!entity}
            onChange={(event) => setPoseName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") recordPose();
            }}
          />
          <button
            type="button"
            className="tl-action"
            disabled={!entity}
            onClick={recordPose}
          >
            <Camera size={13} />
            Record pose
          </button>
        </div>
      </div>
      {poses.length > 0 && (
        <div className="tl-poses">
          <span>POSES</span>
          {poses.map((pose) => (
            <button
              type="button"
              key={pose.id}
              onClick={() => recallPose(pose.values)}
              title={`Apply saved transforms at the current playhead. Signal mappings are offset when needed. Recorded at ${pose.time.toFixed(2)}s.`}
            >
              <Camera size={11} />
              {pose.name}
            </button>
          ))}
        </div>
      )}
      </div>
    </section>
  );
}

export default Timeline;
