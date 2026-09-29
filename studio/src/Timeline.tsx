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
}: TimelineProps) {
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
  const visibleTracks = doc.tracks.filter(
    (track) => track.profileId === "base" || track.profileId === profileId,
  );
  const selectedTrack = doc.tracks.find(
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
    entity &&
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
      Math.round(playhead * 100) / 100,
    );
    const track = upsertKey(
      doc,
      entity.id,
      property,
      scope,
      time,
      num(values, property),
    );
    onCommand({ type: "track", track }, `Key ${LABELS[property] ?? property}`);
    const key = track.keys.find((item) => item.time === time);
    if (key) setKeySelection({ trackId: track.id, keyId: key.id });
  };
  const changeKey = (values: { time?: number; value?: number }) => {
    if (!selectedTrack || !selectedKey) return;
    if (
      values.time !== undefined &&
      selectedTrack.keys.some(
        (key) => key.id !== selectedKey.id && key.time === values.time,
      )
    )
      return;
    onCommand(
      {
        type: "track",
        track: {
          ...selectedTrack,
          keys: selectedTrack.keys.map((key) =>
            key.id === selectedKey.id ? { ...key, ...values } : key,
          ),
        },
      },
      "Edit keyframe",
    );
  };
  const deleteKey = () => {
    if (!selectedTrack || !selectedKey) return;
    const keys = selectedTrack.keys.filter((key) => key.id !== selectedKey.id);
    onCommand(
      keys.length
        ? { type: "track", track: { ...selectedTrack, keys } }
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
          name: poseName.trim() || `${entity.name} · ${playhead.toFixed(2)}s`,
          entityId: entity.id,
          profileId: scope,
          time: playhead,
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
    const staticValues: Props = {};
    const commands: Command[] = [];
    for (const [key, value] of Object.entries(values)) {
      if (ownerOf(doc, entity, key, profileId) === "signal") continue;
      const animated = doc.tracks.some(
        (track) =>
          track.entityId === entity.id &&
          track.property === key &&
          (track.profileId === "base" || track.profileId === profileId),
      );
      if (animated && typeof value === "number")
        commands.push({
          type: "track",
          track: upsertKey(
            doc,
            entity.id,
            key,
            scope,
            Math.min(
              Math.floor(doc.duration * 100) / 100,
              Math.round(playhead * 100) / 100,
            ),
            value,
          ),
        });
      else staticValues[key] = value;
    }
    if (Object.keys(staticValues).length)
      commands.push({
        type: "patch",
        id: entity.id,
        scope,
        values: staticValues,
      });
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
            {playhead.toFixed(2)}
            <span> / {doc.duration.toFixed(2)}s</span>
          </output>
        </div>
      <div className="tl-tools" hidden={collapsed}>
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
                ? "Release the signal binding before adding a key"
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
              value={selectedKey.time}
              min={0}
              max={doc.duration}
              step={0.01}
              suffix="s"
              onChange={(time) => changeKey({ time })}
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
              title="Delete selected keyframe"
              onClick={deleteKey}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ) : null}
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
        <div className="tl-duration">
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
        </div>
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
                {Number(time.toFixed(1))}s
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
            value={playhead}
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
                  onClick={() => onSelect(track.entityId)}
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
                    style={{ left: `${(playhead / doc.duration) * 100}%` }}
                  />
                  {track.keys.map((key) => (
                    <button
                      type="button"
                      key={key.id}
                      className={`tl-key ${keySelection?.keyId === key.id ? "tl-key-selected" : ""}`}
                      style={{ left: `${(key.time / doc.duration) * 100}%` }}
                      title={`${LABELS[track.property] ?? track.property}: ${key.value} at ${key.time.toFixed(2)}s`}
                      aria-label={`${target?.name} ${track.property} key at ${key.time} seconds`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSeek(key.time);
                        onSelect(track.entityId);
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
      {poses.length > 0 && (
        <div className="tl-poses">
          <span>POSES</span>
          {poses.map((pose) => (
            <button
              type="button"
              key={pose.id}
              onClick={() => recallPose(pose.values)}
              title={`Apply saved transforms at the current playhead. Signal-owned properties are preserved. Recorded at ${pose.time.toFixed(2)}s.`}
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
