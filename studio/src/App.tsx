import { readRecoveries } from "./recovery";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  MousePointer2,
  Hand,
  Box,
  Layers,
  Type,
  Plus,
  ChevronDown,
  Undo2,
  Redo2,
  Download,
  Upload,
  Monitor,
  Smartphone,
  ArrowUpRight,
  SlidersHorizontal,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Frame,
  Image,
  Film,
  Minus,
  Grid2X2,
  PanelLeft,
  Check,
  X,
  GitBranch,
  MessageSquare,
  Sparkles,
  CircleHelp,
  Move,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Group,
  Ungroup,
  Save,
  PanelRight,
  Camera,
  Rotate3D,
} from "lucide-react";
import {
  duplicateSelection,
  groupSelection,
  ungroupSelection,
} from "./operations";
import { PageRenderer } from "./PageRenderer";
import { Inspector } from "./Inspector";
import { Timeline } from "./Timeline";
import { studio, useStudio } from "./store";
import {
  clone,
  evaluateEntity,
  num,
  str,
  uid,
  ownerOf,
  upsertKey,
  diffDocuments,
  type Entity,
  type Kind,
  type Props,
  type Command,
  type Take,
} from "./model";
import { scrollRange, layoutChangeCommands, pageLayout, sectionSignals, scrollAtClock, insertSection, moveSection, sectionFor, staticValues } from "./composition";
import { effectiveTrack, editProperties } from "./editing";
import { MotionActions } from "./MotionActions";
import { clockTime, clocksOf } from "./model";
import { Relationships } from "./Relationships";
import { measurePage, readRelationship } from "./probes";
import { PathEditor } from "./PathEditor";
import { pathAvailability, pathClockId, positionKeyCommands } from "./paths";
import { makeEntity, COMPONENTS } from "./seed";
import {
  download,
  portableWorkspace,
  exportRuntime,
  importProject,
} from "./export";
import { ResizeHandle, usePreference } from "./WorkspaceControls";
const tabs = [
  ["compose", "Compose"],
  ["copy", "Copy"],
  ["components", "Components"],
  ["looks", "Scene & look"],
  ["motion", "Motion actions"],
  ["takes", "Takes"],
];
const kindIcon: Record<Kind, typeof Box> = {
  text: Type,
  button: ArrowUpRight,
  frame: Frame,
  section: Frame,
  image: Image,
  video: Film,
  svg: Image,
  line: Minus,
  scene: Box,
  component: Grid2X2,
};
export default function App() {
  const s = useStudio();
  const doc = s.preview ?? s.workspace.document;
  const entity = doc.entities.find((e) => e.id === s.selection[0]);
  const profile =
    doc.profiles.find((p) => p.id === s.profileId) ?? doc.profiles[0];
  const layout = pageLayout(doc, s.profileId);
  const signals = sectionSignals(doc, s.profileId, s.signals);
  const clock = clocksOf(doc).find(c => c.id === s.clockId) ?? clocksOf(doc)[0];
  const position = clockTime(doc, clock.id, s.playhead, signals);
  const scope = s.profileId === "desktop" ? "base" : s.profileId;
  const [leftOpen, setLeftOpen] = usePreference<boolean>("iglass.ui.left-open", true);
  const [rightOpen, setRightOpen] = usePreference<boolean>("iglass.ui.right-open", true);
  const [leftWidth, setLeftWidth] = usePreference<number>("iglass.ui.left-width", 224);
  const [rightWidth, setRightWidth] = usePreference<number>("iglass.ui.right-width", 300);
  const [leftTab, setLeftTab] = useState("layers");
  const [tool, setTool] = useState("select");
  const [orbitSensitivity, setOrbitSensitivity] = useState(() => { try { return Number(localStorage.getItem("iglass.orbit-sensitivity")) || 0.8; } catch { return 0.8; } });
  useEffect(() => { try { localStorage.setItem("iglass.orbit-sensitivity", String(orbitSensitivity)); } catch {} }, [orbitSensitivity]);
  const [modal, setModal] = useState("");
  const [feedback, setFeedback] = useState("");
  const [tag, setTag] = useState("Interaction");
  const [takeName, setTakeName] = useState("");
  const [compare, setCompare] = useState<Take | null>(null);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [followScroll, setFollowScroll] = useState(true);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const boardRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void studio.load();
  }, []);
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const wheel = (ev: WheelEvent) => {
      ev.preventDefault();
      if (ev.ctrlKey || ev.metaKey) studio.session({ zoom: Math.max(0.15, Math.min(2, studio.get().zoom * Math.exp(-ev.deltaY * 0.005))) });
      else setPan(p => ({ x: p.x - ev.deltaX, y: p.y - ev.deltaY }));
    };
    board.addEventListener("wheel", wheel, { passive: false });
    return () => board.removeEventListener("wheel", wheel);
  }, []);
  useEffect(() => {
    if (followScroll && layout.sections.length) setPan(p => ({ ...p, y: -(s.signals.scroll ?? 0) * Math.max(0, layout.height - layout.viewport) * s.zoom }));
  }, [s.signals.scroll, followScroll]);
  const seek = (time: number, playing = false) => {
    if (clock.source === "scroll") studio.session({ signals: { ...signals, scroll: scrollAtClock(doc, s.profileId, clock.id, time / doc.duration) }, playing });
    else studio.session({ playhead: time, playing });
  };
  useEffect(() => {
    if (!s.playing) return;
    let id = 0, last = performance.now();
    const tick = (now: number) => {
      const st = studio.get(), d = st.workspace.document;
      const c = clocksOf(d).find(c => c.id === st.clockId) ?? clocksOf(d)[0];
      const inputs = sectionSignals(d, st.profileId, st.signals);
      if (c.source === "scroll") {
        const range = scrollRange(d, st.profileId, c.sectionId);
        if (range.end <= range.start) { studio.session({ playing: false }); studio.fail("This scope has no scroll travel. Pin the section and set its scroll distance, add another section, or choose Time."); return; }
      }
      const next = Math.min(d.duration, clockTime(d, c.id, st.playhead, inputs) + (now - last) / 1000);
      last = now;
      if (c.source === "scroll") studio.session({ signals: { ...inputs, scroll: scrollAtClock(d, st.profileId, c.id, next / d.duration) }, playing: next < d.duration });
      else studio.session({ playhead: next, playing: next < d.duration });
      if (next < d.duration) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [s.playing]);
  useEffect(() => {
    const key = (ev: KeyboardEvent) => {
      const editing = (ev.target as HTMLElement)?.closest(
        "input,textarea,select,[contenteditable=true]",
      );
      if (ev.key === "Escape") {
        if (studio.hasGesture()) studio.cancelGesture();
        else if (modal) setModal("");
        else if (compare) setCompare(null);
        else { (document.activeElement as HTMLElement)?.blur?.(); studio.select([]); }
        return;
      }
      if (editing || modal || compare) return;
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") {
        ev.preventDefault();
        ev.shiftKey ? studio.redo() : studio.undo();
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s") {
        ev.preventDefault();
        void studio.save();
      }
      if (ev.key === "Delete" || ev.key === "Backspace") {
        ev.preventDefault();
        studio.execute(
          { type: "remove", ids: studio.get().selection },
          "Delete selection",
        );
        studio.select([]);
      }
      if (!ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        const shortcut = { v: "select", h: "hand", r: "orbit", c: "camera", p: "path" }[ev.key.toLowerCase()];
        if (shortcut) { ev.preventDefault(); setTool(shortcut); }
      }
      if (ev.key === " ") {
        ev.preventDefault();
        studio.session({ playing: !studio.get().playing });
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "d") {
        ev.preventDefault();
        duplicate();
      }
    };
    const blur = () => studio.cancelGesture();
    addEventListener("keydown", key);
    addEventListener("blur", blur);
    return () => {
      removeEventListener("keydown", key);
      removeEventListener("blur", blur);
    };
  }, [doc, s.selection, modal, compare]);
  useEffect(() => {
    if (modal || compare) {
      studio.cancelGesture();
      studio.session({ playing: false });
    }
  }, [modal, compare]);
  useEffect(() => {
    if (!modal) return;
    document.querySelector(".project-menu")?.removeAttribute("open");
    const focusable = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          ".modal button:not(:disabled),.modal input,.modal textarea,.modal select",
        ),
      );
    const previous = document.activeElement as HTMLElement;
    const first =
      focusable().find(
        (e) => e.tagName === "INPUT" || e.tagName === "TEXTAREA",
      ) ?? focusable()[0];
    first?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const nodes = focusable(),
        index = nodes.indexOf(document.activeElement as HTMLElement);
      e.preventDefault();
      nodes[
        (index + (e.shiftKey ? -1 : 1) + nodes.length) % nodes.length
      ]?.focus();
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [modal]);
  const addPositionKey = () => {
    if (!entity) return;
    try {
      const p = evaluateEntity(doc, entity, s.profileId, s.playhead, signals);
      studio.batch(
        positionKeyCommands(
          doc,
          entity,
          s.profileId,
          clockTime(doc, pathClockId(doc, entity, s.profileId), s.playhead, signals),
          num(p, "x"),
          num(p, "y"),
        ),
        "Add position key",
      );
      setTool("path");
    } catch (e) {
      studio.fail(String(e));
    }
  };
  const command = (c: Command, label?: string) => studio.hasGesture() ? studio.previewCommands([c]) : studio.execute(c, label);
  const batch = (commands: Command[], label: string) => studio.hasGesture() ? studio.previewCommands(commands) : studio.batch(commands, label);
  const patch = (values: Props, target = entity) => {
    if (!target) return;
    target = s.workspace.document.entities.find(e => e.id === target!.id) ?? target;
    try {
      const commands = values.layout !== undefined
        ? layoutChangeCommands(s.workspace.document, target, String(values.layout), s.profileId, s.playhead, signals)
        : editProperties(s.workspace.document, target, values, s.profileId, s.playhead, signals, s.editMode, clock.id);
      batch(commands, "Adjust " + target.name);
    }
    catch (error) { studio.fail(error instanceof Error ? error.message : String(error)); }
  };
  const selectLayer = (id: string, extend = false) => {
    studio.select(extend ? [...new Set([...s.selection, id])] : [id]);
    const box = layout.sections.find(b => b.id === id);
    if (box) setPan(p => ({ ...p, y: -box.top * s.zoom }));
  };
  const addSection = (afterId?: string) => {
    try {
      const result = insertSection(s.workspace.document, afterId ?? sectionFor(doc, entity)?.id);
      studio.batch(result.commands, "Insert section");
      studio.select([result.id]);
      const box = pageLayout(studio.get().workspace.document, s.profileId).sections.find(b => b.id === result.id);
      if (box) setPan(p => ({ ...p, y: 40 - box.top * s.zoom }));
    } catch (error) { studio.fail(String(error)); }
  };
  const insertionParent = () => sectionFor(doc, entity)?.id ?? doc.entities.filter(e => e.kind === "section").at(-1)?.id;
  const add = (kind: Kind, componentId?: string) => {
    const e = makeEntity(kind, doc.entities.length % 4);
    e.parentId = insertionParent();
    if (kind === "component") {
      const c = COMPONENTS.find((c) => c.id === componentId) ?? COMPONENTS[0];
      e.componentId = c.id;
      e.name = c.name;
      Object.assign(e.props, c.defaults, { width: 320, height: 200 });
    }
    studio.execute({ type: "insert", entities: [e] }, `Insert ${e.name}`);
    studio.select([e.id]);
  };
  const duplicate = () => {
    const state = studio.get();
    const result = duplicateSelection(
      state.workspace.document,
      state.selection,
    );
    studio.batch(result.commands, "Duplicate selection");
    studio.select(result.selection);
  };
  const fit = () => {
    if (boardRef.current) {
      studio.session({
        zoom: Math.max(
          0.2,
          Math.min(
            0.9,
            (boardRef.current.clientWidth - 100) / profile.width,
            (boardRef.current.clientHeight - 90) / profile.height,
          ),
        ),
      });
      setPan({ x: 0, y: 0 });
    }
  };
  useEffect(() => {
    if (s.loaded) fit();
  }, [s.loaded, s.profileId]);
  const startGesture = (
    ev: ReactPointerEvent<HTMLElement>,
    e: Entity,
    resize = false,
  ) => {
    if ((ev.target as HTMLElement).closest("a")) ev.preventDefault();
    if (tool === "hand") return;
    if (
      (ev.target as HTMLElement).isContentEditable &&
      document.activeElement === ev.target
    )
      return;
    if (tool === "orbit" && e.kind === "scene") {
      studio.select([e.id]);
      return;
    }
    ev.stopPropagation();
    if (ev.button !== 0) return;
    ev.preventDefault();
    const selected = ev.shiftKey
      ? [...new Set([...s.selection, e.id])]
      : s.selection.includes(e.id)
        ? s.selection
        : [e.id];
    studio.select(selected);
    if (e.kind === "section") return;
    const origin = { x: ev.clientX, y: ev.clientY };
    const targets = selected.map((id) => ({
      entity: doc.entities.find((x) => x.id === id)!,
      values: evaluateEntity(
        doc,
        doc.entities.find((x) => x.id === id)!,
        s.profileId,
        s.playhead,
        signals,
      ),
    }));
    studio.beginGesture();
    ev.currentTarget.setPointerCapture(ev.pointerId);
    const target = ev.currentTarget;
    const move = (event: PointerEvent) => {
      const dx = (event.clientX - origin.x) / s.zoom,
        dy = (event.clientY - origin.y) / s.zoom;
      const snap = (v: number) =>
        event.shiftKey ? Math.round(v / 8) * 8 : Math.round(v);
      try {
        const commands = targets.flatMap(t => {
          const parent = doc.entities.find(e => e.id === t.entity.parentId);
          const flow = parent && str(staticValues(parent, s.profileId), "layout", "free") !== "free";
          const x = flow || effectiveTrack(doc, t.entity, "translateX", s.profileId) ? "translateX" : "x", y = flow || effectiveTrack(doc, t.entity, "translateY", s.profileId) ? "translateY" : "y";
          const values: Props = resize ? { width: Math.max(24, snap(num(t.values, "width") + dx)), height: Math.max(16, snap(num(t.values, "height") + dy)) }
            : { [x]: snap(num(t.values, x) + dx), [y]: snap(num(t.values, y) + dy) };
          return editProperties(s.workspace.document, t.entity, values, s.profileId, s.playhead, signals, s.editMode, clock.id);
        });
        studio.previewCommands(commands);
      } catch (error) { studio.fail(String(error)); }

    };
    const finish = (event: PointerEvent) => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", finish);
      target.removeEventListener("pointercancel", cancel);
      if (target.hasPointerCapture(event.pointerId))
        target.releasePointerCapture(event.pointerId);
      studio.commitGesture();
    };
    const cancel = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", finish);
      target.removeEventListener("pointercancel", cancel);
      studio.cancelGesture();
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", finish);
    target.addEventListener("pointercancel", cancel);
  };
  const textEdit = (e: Entity, text: string) => {
    if (e.copyId && scope === "base") {
      const atom = doc.copy.find((a) => a.id === e.copyId)!;
      command({ type: "copy", atom: { ...atom, text } }, "Edit copy");
    } else patch({ text }, e);
  };
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1]);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, data: b64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const kind: Kind = file.name.toLowerCase().endsWith(".glb")
        ? "scene"
        : file.type.startsWith("video")
          ? "video"
          : file.name.endsWith(".svg")
            ? "svg"
            : "image";
      const asset = {
        id: uid("asset"),
        name: file.name,
        url: data.url,
        hash: data.hash,
        type:
          kind === "scene"
            ? ("model" as const)
            : (kind as "image" | "svg" | "video"),
      };
      const e = makeEntity(kind);
      e.parentId = insertionParent();
      e.name = file.name;
      e.props[kind === "scene" ? "modelUrl" : "src"] = data.url;
      studio.batch(
        [
          { type: "asset", asset },
          { type: "insert", entities: [e] },
        ],
        "Import asset",
      );
      studio.select([e.id]);
    } catch (error) {
      studio.fail(String(error));
    } finally {
      setBusy(false);
    }
  };
  const group = () => {
    try {
      const r = groupSelection(doc, s.selection);
      studio.batch(r.commands, "Group selection");
      studio.select(r.selection);
    } catch (e) {
      studio.fail(String(e));
    }
  };
  const ungroup = () => {
    try {
      const r = ungroupSelection(doc, s.selection[0]);
      studio.batch(r.commands, "Ungroup selection");
      studio.select(r.selection);
    } catch (e) {
      studio.fail(String(e));
    }
  };
  const align = (mode: "left" | "center" | "right") => {
    const values = s.selection.map((id) => {
      const e = doc.entities.find((e) => e.id === id)!;
      return { e, p: evaluateEntity(doc, e, s.profileId, s.playhead) };
    });
    if (!values.length) return;
    if (
      values.some((v) =>
        ["track", "signal"].includes(ownerOf(doc, v.e, "x", s.profileId)),
      ) ||
      new Set(values.map((v) => v.e.parentId)).size > 1
    ) {
      studio.fail("Align static elements sharing a parent.");
      return;
    }
    const left = Math.min(...values.map((v) => num(v.p, "x"))),
      right = Math.max(...values.map((v) => num(v.p, "x") + num(v.p, "width")));
    studio.batch(
      values.map((v) => ({
        type: "patch",
        id: v.e.id,
        scope,
        values: {
          x:
            mode === "left"
              ? left
              : mode === "right"
                ? right - num(v.p, "width")
                : (left + right - num(v.p, "width")) / 2,
        },
      })),
      "Align selection",
    );
  };
  const createVariant = () => {
    studio.take("Before look exploration");
    const scene = doc.entities.find((e) => e.kind === "scene");
    if (scene)
      studio.batch(
        [
          {
            type: "patch",
            id: scene.id,
            scope,
            values: { roughness: 0.18, metalness: 0.65, key: 4.5, rotateZ: 8 },
          },
          {
            type: "patch",
            id: "headline",
            scope,
            values: { color: "#163b34" },
          },
        ].filter((c) => doc.entities.some((e) => e.id === c.id)) as Command[],
        "Explore reflective look",
      );
    studio.take("Reflective look");
  };
  const layerOrder = (parentId?: string): Entity[] => doc.entities.filter(e => e.parentId === parentId).flatMap(e => [e, ...layerOrder(e.id)]);
  const layerDepth = (e: Entity): number => e.parentId ? 1 + layerDepth(doc.entities.find(p => p.id === e.parentId)!) : 0;
  const leftContent = () => {
    if (s.tab === "motion") return <MotionActions document={doc} selection={s.selection} profileId={s.profileId} clockId={clock.id} time={s.playhead} signals={signals} onCommand={command} onError={message => studio.fail(message)} />;
    if (s.tab === "copy")
      return (
        <>
          <div className="panel-heading">
            Copy workspace{" "}
            <button
              aria-label="Add copy"
              onClick={() =>
                command({
                  type: "copy",
                  atom: {
                    id: uid("copy"),
                    name: "New fragment",
                    text: "Your next idea.",
                    variants: [],
                  },
                })
              }
            >
              <Plus size={16} />
            </button>
          </div>
          <p className="panel-hint">
            Shared fragments. Every linked instance stays in sync.
          </p>
          {doc.copy.map((a) => (
            <article className="copy-card" key={a.id}>
              <input
                aria-label="Fragment name"
                value={a.name}
                onChange={(ev) =>
                  command({
                    type: "copy",
                    atom: { ...a, name: ev.target.value },
                  })
                }
              />
              <textarea
                aria-label={a.name + " copy"}
                value={a.text}
                onChange={(ev) =>
                  command({
                    type: "copy",
                    atom: { ...a, text: ev.target.value },
                  })
                }
              />
              <div className="row">
                <button
                  onClick={() => {
                    const e = makeEntity("text");
                    e.copyId = a.id;
                    e.name = a.name;
                    studio.execute({ type: "insert", entities: [e] });
                    studio.select([e.id]);
                  }}
                >
                  Insert ↗
                </button>
                <button
                  onClick={() =>
                    command({
                      type: "copy",
                      atom: { ...a, variants: [...a.variants, a.text] },
                    })
                  }
                >
                  Save variant
                </button>
              </div>
              {a.variants.map((v, i) => (
                <button
                  className="variant"
                  key={i}
                  onClick={() =>
                    command({ type: "copy", atom: { ...a, text: v } })
                  }
                >
                  {v}
                </button>
              ))}
            </article>
          ))}
        </>
      );
    if (s.tab === "components")
      return (
        <>
          <div className="panel-heading">
            Component shelf <Grid2X2 size={16} />
          </div>
          <p className="panel-hint">
            Versioned building blocks for this composition.
          </p>
          {COMPONENTS.map((c) => (
            <button
              className="component-card"
              key={c.id}
              onClick={() => add("component", c.id)}
            >
              <div className={"component-preview " + c.id}>
                <span>
                  {c.id === "stat-card"
                    ? "12 months"
                    : c.id === "hero-reference"
                      ? "◇"
                      : "＋"}
                </span>
              </div>
              <strong>
                {c.name}
                <Plus size={13} />
              </strong>
              <p>{c.description}</p>
              <small>{c.capabilities.join(" · ")}</small>
            </button>
          ))}
          <div className="capability-note">
            Custom code components use explicit adapters. Arbitrary source
            import is not enabled.
          </div>
        </>
      );
    if (s.tab === "takes")
      return (
        <>
          <div className="panel-heading">
            Takes & discovery <GitBranch size={16} />
          </div>
          <button className="wide-action" onClick={() => setModal("take")}>
            <Plus size={15} /> Capture current Take
          </button>
          <button className="wide-action subtle" onClick={createVariant}>
            <Sparkles size={15} /> Explore reflective look
          </button>
          {s.workspace.takes.length === 0 && (
            <p className="panel-hint">
              Capture a Take to preserve this direction and compare
              alternatives.
            </p>
          )}
          {s.workspace.takes.map((t) => (
            <article className="take-card" key={t.id}>
              <strong>
                {t.name}
                {s.workspace.acceptedTakeId === t.id && <Check size={14} />}
              </strong>
              <small>
                {new Date(t.createdAt).toLocaleTimeString()} ·{" "}
                {t.document.entities.length} elements
              </small>
              <div className="row">
                <button onClick={() => setCompare(t)}>Compare</button>
                <button onClick={() => studio.restore(t)}>Restore</button>
                <button onClick={() => studio.acceptTake(t.id)}>Accept</button>
              </div>
            </article>
          ))}
          <div className="panel-heading divider">
            Feedback history <MessageSquare size={15} />
          </div>
          {s.workspace.episodes
            .filter((e) =>
              (e.note + " " + e.tag + " " + e.profileId)
                .toLowerCase()
                .includes(filter.toLowerCase()),
            )
            .slice()
            .reverse()
            .map((e) => (
              <button
                className="episode-item"
                key={e.id}
                onClick={() =>
                  download(e.id + ".json", JSON.stringify(e, null, 2))
                }
              >
                <span>
                  {e.tag} · {e.playhead.toFixed(1)}s
                </span>
                <p>{e.note || "State captured"}</p>
                <small>{e.profileId} · download episode ↗</small>
              </button>
            ))}
        </>
      );
    return (
      <>
        <div className="panel-heading">
          {s.tab === "looks" ? "Scene objects" : "Composition"}
          <button aria-label="Insert frame" onClick={() => add("frame")}>
            <Plus size={16} />
          </button>
        </div>
        <div className="mini-tabs">
          <button
            className={leftTab === "layers" ? "active" : ""}
            onClick={() => setLeftTab("layers")}
          >
            Layers
          </button>
          <button
            className={leftTab === "relations" ? "active" : ""}
            onClick={() => setLeftTab("relations")}
          >
            Relations
          </button>
          <button
            className={leftTab === "assets" ? "active" : ""}
            onClick={() => setLeftTab("assets")}
          >
            Assets
          </button>
        </div>
        {leftTab === "relations" ? (
          <Relationships
            document={doc}
            selection={s.selection}
            profileId={s.profileId}
            time={s.playhead}
            signals={signals}
            canvasRef={boardRef}
            onCommand={command}
          />
        ) : leftTab === "layers" ? (
          <>
            <div className="page-title">
              <Frame size={14} />
              <span>Page 01</span>
              <small>
                {profile.width} × {Math.round(layout.height)}
              </small>
            </div>
            <button className="wide-action" onClick={() => addSection()}>+ Add section below</button>
            {entity?.kind === "section" && <div className="section-reorder"><button onClick={() => studio.batch(moveSection(doc, entity.id, -1), "Move section up")}>↑ Move section</button><button onClick={() => studio.batch(moveSection(doc, entity.id, 1), "Move section down")}>↓ Move section</button></div>}
            {layerOrder()
              .filter(
                (e) =>
                  (s.tab !== "looks" || e.kind === "scene") &&
                  e.name.toLowerCase().includes(filter.toLowerCase()),
              )
              .map((e) => {
                const Icon = kindIcon[e.kind];
                return (
                  <div
                    className={
                      "layer " + (s.selection.includes(e.id) ? "active" : "")
                    }
                    key={e.id}
                    style={{ paddingLeft: 14 + layerDepth(e) * 14 }}
                  >
                    <button
                      className="layer-select"
                      onClick={ev => selectLayer(e.id, ev.shiftKey)}
                    >
                      <Icon size={14} />
                      <span>{e.name}</span>
                    </button>
                    <button
                      className="eye-button"
                      aria-label={"Toggle " + e.name}
                      onClick={() =>
                        command({
                          type: "patch",
                          id: e.id,
                          scope,
                          values: {
                            visible:
                              evaluateEntity(doc, e, s.profileId, s.playhead)
                                .visible === false,
                          },
                        })
                      }
                    >
                      {evaluateEntity(doc, e, s.profileId, s.playhead)
                        .visible === false ? (
                        <EyeOff size={12} />
                      ) : (
                        <Eye size={12} />
                      )}
                    </button>
                  </div>
                );
              })}
            <div className="insert-grid">
              {(
                ["text", "frame", "button", "scene", "image", "line"] as Kind[]
              ).map((kind) => {
                const Icon = kindIcon[kind];
                return (
                  <button key={kind} onClick={() => add(kind)}>
                    <Icon size={18} />
                    <span>
                      {kind === "scene"
                        ? "3D model"
                        : kind[0].toUpperCase() + kind.slice(1)}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <button
              className="wide-action"
              onClick={() => uploadRef.current?.click()}
            >
              <Upload size={14} /> Import asset
            </button>
            {doc.assets.map((a) => (
              <button
                className="asset-card"
                key={a.id}
                onClick={() => {
                  const e = makeEntity(a.type === "model" ? "scene" : a.type);
                  e.parentId = insertionParent();
                  e.props[a.type === "model" ? "modelUrl" : "src"] = a.url;
                  e.name = a.name;
                  studio.execute({ type: "insert", entities: [e] });
                  studio.select([e.id]);
                }}
              >
                {a.type === "model" ? <Box size={25} /> : <Image size={25} />}
                <span>
                  {a.name}
                  <small>{a.type} · click to insert</small>
                </span>
              </button>
            ))}
          </>
        )}
        <div className="sidebar-bottom">
          <span className="tiny-label">WORKING CONTEXT</span>
          <p>
            {s.profileId === "desktop"
              ? "Base composition"
              : "Mobile art direction"}
          </p>
          <small>
            {s.profileId === "desktop"
              ? "Edits apply to the base."
              : "Edits create explicit overrides."}
          </small>
        </div>
      </>
    );
  };
  return (
    <div className="app">
      <header className="topbar">
        <div className="project-control">
          <span className="brand-symbol" title="Pose Studio 0.3.0">i</span>
          <input aria-label="Project name" value={doc.name} onChange={ev => command({ type: "document-name", name: ev.target.value })} />
          <span className="saved" title={s.status}><span />{s.status}</span>
        </div>
        <div className="tool-group" aria-label="Canvas tools">
          <button aria-label="Select tool" title="Select / move · V" className={tool === "select" ? "active" : ""} onClick={() => setTool("select")}><MousePointer2 size={17} /></button>
          <button aria-label="Pan tool" title="Pan workspace · H · two-finger scroll" className={tool === "hand" ? "active" : ""} onClick={() => setTool("hand")}><Hand size={17} /></button>
          <button aria-label="Turntable tool" title="Turntable · R · rotate the model" className={tool === "orbit" ? "active" : ""} onClick={() => setTool("orbit")}><Rotate3D size={17} /></button>
          <button aria-label="Camera orbit tool" title="Camera orbit · C · change viewpoint" className={tool === "camera" ? "active" : ""} onClick={() => setTool("camera")}><Camera size={17} /></button>
          <button aria-label="Edit motion path" title="Motion path · P" className={tool === "path" ? "active" : ""} onClick={() => setTool(tool === "path" ? "select" : "path")}><Move size={17} /></button>
        </div>
        <div className="profile-switch">
          <select aria-label="Responsive profile" value={s.profileId} onChange={e => studio.session({ profileId: e.target.value })}>
            {doc.profiles.map(p => <option key={p.id} value={p.id}>{p.name} · {p.width}px</option>)}
          </select>
          <button aria-label="Edit responsive profile" title="Responsive profile settings" onClick={() => setModal("profile")}><SlidersHorizontal size={15} /></button>
        </div>
        <div className="zoom-controls">
          <button aria-label="Zoom out" onClick={() => studio.session({ zoom: Math.max(.15, s.zoom - .1) })}>−</button>
          <button aria-label="Fit composition" title="Fit composition in canvas" onClick={fit}>{Math.round(s.zoom * 100)}%</button>
          <button aria-label="Zoom in" onClick={() => studio.session({ zoom: Math.min(2, s.zoom + .1) })}>+</button>
        </div>
        <div className="history-controls">
          <button aria-label="Undo" title="Undo" disabled={!s.canUndo} onClick={() => studio.undo()}><Undo2 size={16} /></button>
          <button aria-label="Redo" title="Redo" disabled={!s.canRedo} onClick={() => studio.redo()}><Redo2 size={16} /></button>
        </div>
        <div className="panel-controls">
          <button aria-label="Toggle layers panel" title="Show / hide workspace panel" aria-pressed={leftOpen} onClick={() => setLeftOpen(!leftOpen)}><PanelLeft size={16} /></button>
          <button aria-label="Toggle inspector panel" title="Show / hide inspector" aria-pressed={rightOpen} onClick={() => setRightOpen(!rightOpen)}><PanelRight size={16} /></button>
        </div>
        <details className="project-menu">
          <summary aria-label="Project actions" title="Feedback, help and version"><CircleHelp size={17} /></summary>
          <div><strong>Pose Studio 0.3.0</strong><button onClick={() => setModal("evaluate")}><MessageSquare size={14} />Evaluate / feedback</button><button onClick={() => setModal("help")}>Help & shortcuts</button></div>
        </details>
        <button className="header-action" aria-label="Open Takes" title="Takes" onClick={() => { studio.session({ tab: "takes" }); setLeftOpen(true); }}><GitBranch size={16} /></button>
        <button className="export-button" onClick={() => setModal("export")}>Export <ArrowUpRight size={14} /></button>
      </header>
      <div className="workspace" style={{ gridTemplateColumns: `${leftOpen ? Math.max(180, Math.min(360, leftWidth)) : 0}px ${leftOpen ? 6 : 0}px minmax(0, 1fr) ${rightOpen ? 6 : 0}px ${rightOpen ? Math.max(260, Math.min(440, rightWidth)) : 0}px` }}>
        <aside className="left-panel" hidden={!leftOpen} aria-label="Workspace navigation">
        <div className="tabs">
          {tabs.map(([id, label]) => (
            <button
              className={s.tab === id ? "active" : ""}
              key={id}
              onClick={() => {
                studio.session({ tab: id });
                if (id === "looks") {
                  const scene = doc.entities.find((e) => e.kind === "scene");
                  if (scene) studio.select([scene.id]);
                }
              }}
            >
              {label}
              {id === "takes" && s.workspace.takes.length > 0 && (
                <small>{s.workspace.takes.length}</small>
              )}
            </button>
          ))}
        </div>

          <input
            className="search"
            placeholder="Find an element…"
            aria-label="Find element"
            value={filter}
            onChange={(ev) => setFilter(ev.target.value)}
          />
          <div className="left-scroll">{leftContent()}</div>
        </aside>
        {leftOpen ? <ResizeHandle label="Resize layers panel" value={leftWidth} min={180} max={360} onChange={setLeftWidth} /> : <div />}
        <main className="center">
          {(tool === "orbit" || tool === "camera" || doc.bindings.length > 0 || clocksOf(doc).some(c => c.source === "scroll")) && <div className="canvas-context">            {(tool === "orbit" || tool === "camera") && <label className="orbit-speed">Drag speed<input aria-label="Rotation sensitivity" type="range" min="0.1" max="2" step="0.1" value={orbitSensitivity} onChange={e => setOrbitSensitivity(Number(e.target.value))} /></label>}
            {(doc.bindings.length > 0 || clocksOf(doc).some(c => c.source === "scroll")) && (
              <div
                className="toolbar-signals"
                title={`Live inputs · Pointer ${Math.round(signals.pointerX * 100)}% / ${Math.round(signals.pointerY * 100)}%`}
              >
                <label>
                  Scroll
                  <input
                    aria-label="Preview scroll progress"
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={signals.scroll}
                    onChange={(e) =>
                      studio.session({
                        signals: { ...signals, scroll: Number(e.target.value) },
                      })
                    }
                  />
                </label>
                {layout.sections.length > 0 && <label className="scroll-follow"><input type="checkbox" checked={followScroll} onChange={e => setFollowScroll(e.target.checked)} />Follow scroll</label>}
              </div>
            )}
</div>}
          {tool === "path" && (
            <div className="path-strip">
              <span>
                {pathAvailability(doc, entity, s.profileId) ??
                  "Path anchors · page coordinates"}
              </span>
              <button
                disabled={!!pathAvailability(doc, entity, s.profileId)}
                onClick={addPositionKey}
              >
                <Plus size={12} />
                Add position key
              </button>
              <small>{clock.source === "scroll" ? `${(position / doc.duration * 100).toFixed(1)}%` : `${position.toFixed(2)}s`}</small>
            </div>
          )}
          {s.error && (
            <div className="error-banner" role="alert">
              {s.error}
              <button
                aria-label="Dismiss error"
                onClick={() => studio.clearError()}
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div
            className={"canvas-board tool-" + tool}
            ref={boardRef}
            onPointerDown={(ev) => {
              if (tool === "hand" || ev.button === 1) {
                ev.preventDefault();
                const start = { x: ev.clientX, y: ev.clientY },
                  base = { ...pan };
                const el = ev.currentTarget;
                el.setPointerCapture(ev.pointerId);
                const move = (e: PointerEvent) =>
                  setPan({
                    x: base.x + e.clientX - start.x,
                    y: base.y + e.clientY - start.y,
                  });
                const end = () => {
                  el.removeEventListener("pointermove", move);
                  el.removeEventListener("pointerup", end);
                };
                el.addEventListener("pointermove", move);
                el.addEventListener("pointerup", end);
              } else if (ev.target === ev.currentTarget) studio.select([]);
            }}
          >
            <div
              className="artboard-position"
              style={{
                width: profile.width * s.zoom,
                height: layout.height * s.zoom,
                transform: `translate(${pan.x}px,${pan.y}px)`,
              }}
            >
              <div className="artboard-label">
                <span>
                  01 <b>{profile.name}</b>
                </span>
                <span>
                  {profile.width} × {Math.round(layout.height)}
                </span>
              </div>
              <div
                style={{
                  transform: `scale(${s.zoom})`,
                  transformOrigin: "top left",
                }}
              >
                <PageRenderer
                  document={doc}
                  profileId={s.profileId}
                  time={s.playhead}
                  selection={s.selection}
                  signals={signals}
                  onSignalsChange={(signals) => studio.session({ signals })}
                  editor
                  sceneInteractive={tool === "orbit" || tool === "camera"}
                  sceneNavigation={tool === "camera" ? "camera" : "model"}
                  navigationTool={tool === "hand"}
                  orbitSensitivity={orbitSensitivity}
                  onBackground={() => studio.select([])}
                  onInsertSection={addSection}
                  onSelectSection={id => selectLayer(id)}
                  onPointerDown={startGesture}
                  onText={textEdit}
                  onSceneChange={(e, p) => patch(p, e)}
                />
                {tool === "path" && entity && (
                  <PathEditor
                    document={doc}
                    entity={entity}
                    profileId={s.profileId}
                    playhead={clockTime(doc, pathClockId(doc, entity, s.profileId), s.playhead, signals)}
                    scroll={signals.scroll}
                    zoom={s.zoom}
                    onSeek={time => {
                      const id = pathClockId(doc, entity, s.profileId), c = clocksOf(doc).find(c => c.id === id);
                      studio.session({ clockId: id, playing: false, ...(c?.source === "scroll" ? { signals: { ...signals, scroll: scrollAtClock(doc, s.profileId, id, time / doc.duration) } } : { playhead: time }) });
                    }}
                    onBegin={() => studio.beginGesture()}
                    onPreview={(commands) => studio.previewCommands(commands)}
                    onCommit={() => studio.commitGesture()}
                    onCancel={() => studio.cancelGesture()}
                    onBatch={batch}
                    onError={(message) => studio.fail(message)}
                  />
                )}
              </div>
            </div>
            <div className="canvas-hint">
              {tool === "hand"
                ? "Drag to pan the workspace"
                : tool === "orbit"
                  ? "Turntable · drag the selected model to rotate it"
                  : tool === "camera" ? "Camera orbit · drag the selected model to change viewpoint"
                  : tool === "path"
                    ? "Drag path points · arrows nudge · Delete removes · Esc cancels"
                    : "Drag to move · Alt-click selects behind · Double-click text · Esc cancels / deselects"}
            </div>
          </div>
          <div className="selection-bar">
            <span>
              {s.selection.length
                ? s.selection.length === 1
                  ? entity?.name
                  : `${s.selection.length} elements`
                : "Nothing selected"}
            </span>
            <div>
              <button aria-label="Align left" onClick={() => align("left")}>
                <AlignLeft size={14} />
              </button>
              <button aria-label="Align center" onClick={() => align("center")}>
                <AlignCenter size={14} />
              </button>
              <button aria-label="Align right" onClick={() => align("right")}>
                <AlignRight size={14} />
              </button>
              <button
                aria-label="Group selection"
                disabled={s.selection.length < 2}
                onClick={group}
              >
                <Group size={14} />
              </button>
              <button
                aria-label="Ungroup selection"
                disabled={entity?.kind !== "frame" || s.selection.length !== 1}
                onClick={ungroup}
              >
                <Ungroup size={14} />
              </button>
              <button
                aria-label="Duplicate selection"
                disabled={!s.selection.length}
                onClick={duplicate}
              >
                <Copy size={14} />
              </button>
              <button
                aria-label="Delete selection"
                disabled={!s.selection.length}
                onClick={() => {
                  command(
                    { type: "remove", ids: s.selection },
                    "Delete selection",
                  );
                  studio.select([]);
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <Timeline
            document={doc}
            selection={s.selection}
            profileId={s.profileId}
            playhead={s.playhead}
            signals={signals}
            playing={s.playing}
            clockId={clock.id}
            onClockSelect={clockId => studio.session({ clockId, playing: false })}
            editMode={s.editMode}
            onEditMode={editMode => studio.session({ editMode })}
            onSeek={time => seek(time)}
            onPlay={() => seek(position >= doc.duration ? 0 : position, !s.playing)}
            onCommand={command}
            onBatch={batch}
            onSelect={(id) => studio.select([id])}
          />
        </main>
        {rightOpen ? <ResizeHandle label="Resize inspector panel" value={rightWidth} min={260} max={440} direction={-1} onChange={setRightWidth} /> : <div />}
        <aside className="right-panel" hidden={!rightOpen}>
          <Inspector
            document={doc}
            entity={entity}
            profileId={s.profileId}
            playhead={s.playhead}
            signals={signals}
            onCommand={command}
            onPatch={patch}
            onBatch={batch}
            onSeekTrack={(time, clockId) => {
              const source = clocksOf(doc).find(c => c.id === clockId);
              studio.session({ clockId, playing: false, ...(source?.source === "scroll" ? { signals: { ...signals, scroll: scrollAtClock(doc, s.profileId, clockId, time / doc.duration) } } : { playhead: time }) });
            }}
          />
        </aside>
      </div>
      <input
        ref={uploadRef}
        type="file"
        hidden
        accept=".glb,.png,.jpg,.jpeg,.webp,.avif,.svg,.mp4,.webm"
        onChange={(ev) => {
          if (ev.target.files?.[0]) void upload(ev.target.files[0]);
          ev.target.value = "";
        }}
      />
      <input
        ref={importRef}
        type="file"
        hidden
        accept=".json"
        onChange={(ev) => {
          const f = ev.target.files?.[0];
          if (f)
            void f.text().then(async (t) => {
              setBusy(true);
              try {
                studio.importWorkspace(await importProject(JSON.parse(t)));
                setModal("");
              } catch (error) {
                studio.fail(String(error));
              } finally {
                setBusy(false);
              }
            });
          ev.target.value = "";
        }}
      />
      {(!s.loaded || busy) && (
        <div className="busy">
          {s.loaded ? "Preparing your files…" : "Opening workspace…"}
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) setModal("");
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal}
          >
            <button
              className="modal-close"
              aria-label="Close dialog"
              onClick={() => setModal("")}
            >
              <X size={18} />
            </button>
            {modal === "take" && (
              <>
                <span className="tiny-label">PRESERVE A DIRECTION</span>
                <h2>Capture a Take.</h2>
                <p>
                  Keep this composition exactly as it is. Explore from here.
                </p>
                <input
                  autoFocus
                  aria-label="Take name"
                  placeholder={"Take " + (s.workspace.takes.length + 1)}
                  value={takeName}
                  onChange={(e) => setTakeName(e.target.value)}
                />
                <button
                  className="primary"
                  onClick={() => {
                    studio.take(takeName);
                    setTakeName("");
                    setModal("");
                    studio.session({ tab: "takes" });
                  }}
                >
                  Capture Take <GitBranch size={15} />
                </button>
              </>
            )}
            {modal === "evaluate" && (
              <>
                <span className="tiny-label">EXACT STATE. YOUR REACTION.</span>
                <h2>What would you change?</h2>
                <p>
                  {entity?.name ?? "Composition"} · {profile.name} ·{" "}
                  {s.playhead.toFixed(2)}s
                </p>
                <div className="feedback-tags">
                  {[
                    "Interaction",
                    "Typography",
                    "Framing",
                    "Lighting",
                    "Motion",
                    "Missing capability",
                  ].map((t) => (
                    <button
                      key={t}
                      className={t === tag ? "active" : ""}
                      onClick={() => setTag(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <textarea
                  aria-label="Feedback"
                  rows={4}
                  placeholder="What feels right? What gets in the way?"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                />
                <small>
                  Includes this composition, selected elements, phase, profile,
                  recent commands and measured DOM boxes. No video or pixels are
                  captured.
                </small>
                <button
                  className="primary"
                  onClick={() => {
                    const geometry = measurePage(
                      boardRef.current?.querySelector<HTMLElement>(
                        ".composition-page",
                      ) ?? null,
                    );
                    studio.episode(
                      feedback,
                      tag,
                      geometry,
                      doc.relationships.map((r) => ({
                        relationshipId: r.id,
                        ...readRelationship(r, geometry),
                      })),
                    );
                    setFeedback("");
                    setModal("");
                    studio.session({ tab: "takes" });
                  }}
                >
                  Save feedback <Check size={15} />
                </button>
              </>
            )}
            {modal === "export" && (
              <>
                <span className="tiny-label">CONTINUE BEYOND THE STUDIO</span>
                <h2>Your composition, retained.</h2>
                <button
                  className="export-option"
                  onClick={() => {
                    download(
                      "iglass-project.json",
                      JSON.stringify(s.workspace, null, 2),
                    );
                  }}
                >
                  Project JSON <span>Fast snapshot · asset references</span>
                  <Download size={17} />
                </button>
                <button
                  className="export-option"
                  onClick={async () => {
                    setBusy(true);
                    try {
                      download(
                        "iglass-project-portable.json",
                        JSON.stringify(await portableWorkspace(s.workspace)),
                      );
                    } catch (e) {
                      studio.fail(String(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Portable project{" "}
                  <span>Includes imported asset bytes and Takes</span>
                  <Download size={17} />
                </button>
                <button
                  className="export-option"
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await exportRuntime(doc);
                    } catch (e) {
                      studio.fail(String(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Runtime package{" "}
                  <span>Static website · shared renderer · no editor</span>
                  <ArrowUpRight size={17} />
                </button>
                <button
                  className="export-option"
                  onClick={() => importRef.current?.click()}
                >
                  Open project <span>Restore a Studio JSON package</span>
                  <Upload size={17} />
                </button>
                <details className="recovery-list"><summary>Recovery copies · {readRecoveries().length}</summary>
                  <p>Each window keeps its own copy. Download one to inspect or reopen it using Open project. Existing edits remain undoable.</p>
                  {readRecoveries().map(copy => <button className="export-option" key={copy.id} onClick={() => download(`iglass-recovery-${copy.at}.json`, JSON.stringify(copy.workspace, null, 2))}>
                    {copy.workspace.document.name}<span>{copy.at ? new Date(copy.at).toLocaleString() : "Legacy recovery"} · revision {copy.workspace.document.revision}</span><Download size={17} />
                  </button>)}
                </details>
                <small>
                  Standalone output is available. Framer host verification
                  remains pending.
                </small>
              </>
            )}
            {modal === "profile" && (
              <>
                <span className="tiny-label">RESPONSIVE ART DIRECTION</span>
                <h2>{profile.name} profile</h2>
                <p>
                  Set the composition frame. Element overrides remain authored
                  independently.
                </p>
                <label>
                  Width
                  <input
                    aria-label="Profile width"
                    type="number"
                    min={200}
                    max={5000}
                    value={profile.width}
                    onChange={(e) => {
                      const width = Number(e.target.value);
                      if (width >= 200 && width <= 5000)
                        command(
                          { type: "profile", profile: { ...profile, width } },
                          "Resize profile",
                        );
                    }}
                  />
                </label>
                <label>
                  Height
                  <input
                    aria-label="Profile height"
                    type="number"
                    min={200}
                    max={10000}
                    value={profile.height}
                    onChange={(e) => {
                      const height = Number(e.target.value);
                      if (height >= 200 && height <= 10000)
                        command(
                          { type: "profile", profile: { ...profile, height } },
                          "Resize profile",
                        );
                    }}
                  />
                </label>
                <button
                  className="primary"
                  onClick={() => {
                    setModal("");
                    fit();
                  }}
                >
                  Done <Check size={15} />
                </button>
              </>
            )}
            {modal === "help" && (
              <>
                <span className="tiny-label">
                  COMPOSE THROUGH DIRECT MANIPULATION
                </span>
                <h2>A workspace for discovery.</h2>
                <p>
                  Select an element, drag it into place, and adjust its
                  properties. Mobile edits create overrides. Driven numeric
                  edits record a keyframe at the playhead.
                </p>
                <p>
                  Shift-click for multiple selection. Drag the corner to resize.
                  Ctrl/Cmd Z to undo, D to duplicate, S to save. Escape cancels
                  a gesture, then clears selection. V selects, H pans, R turns the model, C orbits the camera, P edits paths. Space plays the selected clock. Two-finger scroll pans; pinch zooms. Drag inspector labels to scrub; Shift is coarse and Alt is fine.
                </p>
                <p>
                  Import a GLB, image or video from Assets. Capture Takes before
                  exploring. Evaluate retains your reaction with the exact
                  composition.
                </p>
                <small>
                  Built-in components and GLB imports work now. The original
                  Hero is preserved as a reference; live legacy-host adaptation,
                  advanced optics and autonomous experiments remain future work.
                </small>
              </>
            )}
          </section>
        </div>
      )}
      {compare && (
        <div className="compare-overlay">
          <header>
            <div>
              <span className="tiny-label">SYNCHRONISED COMPARISON</span>
              <h2>{compare.name} / Working composition</h2>
            </div>
            <button onClick={() => setCompare(null)}>
              <X size={20} />
            </button>
          </header>
          <div className="compare-pair">
            {[compare.document, doc].map((d, i) => (
              <div key={i}>
                <span>{i ? "Working composition" : compare.name}</span>
                <div
                  className="compare-stage"
                  style={{
                    width: profile.width * 0.42,
                    height: profile.height * 0.42,
                  }}
                >
                  <div
                    style={{
                      transform: "scale(.42)",
                      transformOrigin: "top left",
                    }}
                  >
                    <PageRenderer
                      document={d}
                      profileId={s.profileId}
                      time={s.playhead}
                      signals={signals}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <input
            type="range"
            aria-label="Comparison time"
            min={0}
            max={doc.duration}
            step={0.01}
            value={s.playhead}
            onChange={(ev) =>
              studio.session({
                playhead: Number(ev.target.value),
                playing: false,
              })
            }
          />
          <div className="diff-list">
            {diffDocuments(compare.document, doc).map((v, i) => (
              <p key={i}>{v}</p>
            ))}
            {!diffDocuments(compare.document, doc).length && (
              <p>No authored differences.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
