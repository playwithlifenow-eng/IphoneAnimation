import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  Undo2,
  Redo2,
  Plus,
  Maximize2,
  Play,
  Pause,
  MousePointer2,
  Hand,
  Download,
  Layers,
  Image,
  Box,
  Type,
  PanelLeftClose,
  PanelRightClose,
  X,
  ChevronDown,
  GitBranch,
  CircleHelp,
} from "lucide-react";
import { studio, useStudio } from "../store";
import { clone, num, uid, type Props, type Entity } from "../model";
import { makeEntity, COMPONENTS } from "../seed";
import { download } from "../export";
import { examples, makeProject, makeLink } from "./examples";
import {
  editProject,
  patchActor,
  duplicateBoard,
  removeActor,
} from "./editing";
import { instantiate } from "./registry";
import { clamp, evaluate } from "./engine";
import { Stage } from "./Stage";
import { Rack, Slider } from "./Rack";
import { useClock } from "./useClock";
import type { Artboard, Variant, VisualProject, Reference } from "./types";
import { exportIntent } from "./exportIntent";
import "./visual.css";
export default function VisualStudio() {
  const store = useStudio(),
    doc = store.preview ?? store.workspace.document,
    project = doc.visual;
  const [boardId, setBoardId] = useState(""),
    [selection, setSelection] = useState("product"),
    [stateId, setStateId] = useState(""),
    [view, setView] = useState({ x: 42, y: 96, z: 0.5 });
  const [drawer, setDrawer] = useState<"examples" | "assets" | "help" | "">(""),
    [query, setQuery] = useState(""),
    [hand, setHand] = useState(false),
    [wires, setWires] = useState(false),
    [connect, setConnect] = useState(""),
    [pin, setPin] = useState(false),
    [preview, setPreview] = useState(false),
    [left, setLeft] = useState(true),
    [right, setRight] = useState(true),
    [status, setStatus] = useState(""),
    [reference, setReference] = useState(false),
    [activeRef, setActiveRef] = useState(""),
    [refTime, setRefTime] = useState(0),
    [refDuration, setRefDuration] = useState(1),
    [busy, setBusy] = useState(false),
    [reduced, setReduced] = useState(
      matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  const viewport = useRef<HTMLDivElement>(null),
    upload = useRef<HTMLInputElement>(null),
    projectUpload = useRef<HTMLInputElement>(null),
    referenceUpload = useRef<HTMLInputElement>(null),
    previewScroll = useRef<HTMLDivElement>(null),
    refVideo = useRef<HTMLVideoElement>(null),
    referenceSvg = useRef<SVGSVGElement>(null),
    space = useRef(false),
    gestureCleanup = useRef<() => void>(() => {}),
    loaded = useRef(false);
  const board =
      project?.boards.find((b) => b.id === boardId) ?? project?.boards[0],
    variant = project?.variants.find((v) => v.id === board?.variantId);
  const smooth = variant?.instruments.find(
    (i) => i.definitionId === "smooth" && i.enabled,
  );
  const clock = useClock(smooth?.macroValues.weight ?? 0, reduced);
  const signals = {
    scroll: clock.progress,
    time: clock.progress,
    velocity: clock.velocity,
    pointerX: 0.5,
    pointerY: 0.5,
    reducedMotion: reduced,
  };
  const state = variant?.states.find((s) => s.id === stateId);
  const activeReference =
    variant?.references.find((r) => r.id === activeRef) ??
    variant?.references[0];
  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      void studio.load();
    }
  }, []);
  useEffect(() => {
    if (store.loaded && !store.workspace.document.visual) {
      studio.take("Before visual instruments");
      studio.execute(
        { type: "visual-project", project: makeProject() },
        "Open visual instrument workspace",
      );
    }
  }, [store.loaded, store.workspace.document.visual]);
  useEffect(() => {
    const m = matchMedia("(prefers-reduced-motion: reduce)"),
      f = () => setReduced(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  const mutate = (
    label: string,
    f: (p: VisualProject, v: Variant) => void,
    prev = false,
  ) =>
    editProject(
      label,
      (p) => f(p, p.variants.find((v) => v.id === board!.variantId)!),
      prev,
    );
  const fit = (all = false) => {
    if (!project || !viewport.current || !board) return;
    const bs = all ? project.boards : [board],
      minX = Math.min(...bs.map((b) => b.x)),
      minY = Math.min(...bs.map((b) => b.y)),
      maxX = Math.max(...bs.map((b) => b.x + b.width)),
      maxY = Math.max(...bs.map((b) => b.y + b.height)),
      r = viewport.current.getBoundingClientRect(),
      z = clamp(
        Math.min(
          (r.width - 64) / (maxX - minX),
          (r.height - 104) / (maxY - minY),
        ),
        0.15,
        1.2,
      );
    setView({
      x: (r.width - (maxX - minX) * z) / 2 - minX * z,
      y: 65 - minY * z,
      z,
    });
  };
  useEffect(() => {
    if (project && viewport.current && !boardId) {
      setBoardId(project.boards[0].id);
      setTimeout(() => fit(true), 50);
    }
  }, [project]);
  const select = (b: Artboard, id = "") => {
    if (studio.hasGesture()) studio.cancelGesture();
    setBoardId(b.id);
    if (b.id !== board?.id) setStateId("");
    if (id !== selection) setPin(false);
    if (connect && id && id !== connect) {
      mutate("Connect actors", (_p, v) =>
        v.links.push(makeLink(connect, id, "clearance")),
      );
      setConnect("");
      setWires(true);
    }
    setSelection(id);
  };
  const duplicate = () => {
    if (!board) return;
    let newId = "";
    mutate("Duplicate artboard", (p) => (newId = duplicateBoard(p, board)));
    setBoardId(newId);
    setSelection("");
    setStateId("");
    setTimeout(() => fit(true), 50);
  };
  const removeBoard = () => {
    if (!board || !project || project.boards.length < 2) return;
    mutate("Delete artboard", (p) => {
      p.boards = p.boards.filter((b) => b.id !== board.id);
      p.variants = p.variants.filter((v) =>
        p.boards.some((b) => b.variantId === v.id),
      );
    });
    setBoardId("");
  };
  const remove = () => {
    if (selection) mutate("Remove actor", (_p, v) => removeActor(v, selection));
    else removeBoard();
    setSelection("");
  };
  useEffect(() => {
    const key = (ev: KeyboardEvent) => {
      if (
        (ev.target as HTMLElement).closest(
          'input,textarea,select,[contenteditable="true"]',
        )
      )
        return;
      if (ev.code === "Space") {
        ev.preventDefault();
        space.current = true;
      }
      if (ev.key === "Escape") {
        gestureCleanup.current();
        studio.cancelGesture();
        setConnect("");
        setPin(false);
        setStateId("");
        if (preview) setPreview(false);
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") {
        ev.preventDefault();
        ev.shiftKey ? studio.redo() : studio.undo();
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "d") {
        ev.preventDefault();
        if (!selection) duplicate();
        else if (board)
          mutate("Duplicate actor", (_p, v) => {
            const e = clone(
              v.document.entities.find((e) => e.id === selection)!,
            );
            e.id = uid("actor");
            e.name += " copy";
            e.props.x = num(e.props, "x") + 36;
            delete e.copyId;
            v.document.entities.push(e);
            v.instruments
              .filter((i) => i.targetId === selection)
              .forEach((i) => {
                const c = clone(i);
                c.stableId = uid("instrument");
                c.targetId = e.id;
                delete c.beatId;
                v.instruments.push(c);
              });
            setSelection(e.id);
          });
      }
      if (ev.key === "Delete" || ev.key === "Backspace") {
        ev.preventDefault();
        remove();
      }
      if (ev.key === "f") fit(ev.shiftKey);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") space.current = false;
    };
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", up);
    };
  }, [board, project, selection, preview, connect]);
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const wheel = (ev: WheelEvent) => {
      if ((ev.target as HTMLElement).closest(".vi-drawer,.vi-reference"))
        return;
      ev.preventDefault();
      if (ev.ctrlKey || ev.metaKey) {
        const r = el.getBoundingClientRect(),
          x = ev.clientX - r.left,
          y = ev.clientY - r.top;
        setView((v) => {
          const z = clamp(v.z * Math.exp(-ev.deltaY * 0.006), 0.1, 2);
          return {
            z,
            x: x - ((x - v.x) * z) / v.z,
            y: y - ((y - v.y) * z) / v.z,
          };
        });
      } else setView((v) => ({ ...v, x: v.x - ev.deltaX, y: v.y - ev.deltaY }));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [!!project]);
  function pointerGesture(
    ev: PointerEvent<HTMLElement | SVGSVGElement>,
    move: (dx: number, dy: number) => void,
    label: string,
    semantic = true,
  ) {
    ev.preventDefault();
    ev.stopPropagation();
    gestureCleanup.current();
    const sx = ev.clientX,
      sy = ev.clientY,
      el = ev.currentTarget,
      pid = ev.pointerId;
    el.setPointerCapture(pid);
    if (semantic) studio.beginGesture();
    let cancelled = false;
    const mv = (e: globalThis.PointerEvent) => {
      if (
        e.pointerId === pid &&
        !cancelled &&
        (!semantic || studio.hasGesture())
      )
        move(e.clientX - sx, e.clientY - sy);
    };
    const clean = () => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key);
      if (el.hasPointerCapture(pid)) el.releasePointerCapture(pid);
    };
    const up = () => {
      clean();
      if (semantic && !cancelled) studio.commitGesture(label);
      gestureCleanup.current = () => {};
    };
    const cancel = () => {
      cancelled = true;
      clean();
      if (semantic) studio.cancelGesture();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("pointercancel", cancel, { once: true });
    window.addEventListener("keydown", key);
    gestureCleanup.current = cancel;
  }
  const actorDrag = (
    ev: PointerEvent<HTMLElement>,
    id: string,
    kind: "move" | "width" | "size" | "aperture",
    b: Artboard,
  ) => {
    if (space.current || hand) {
      const initial = view;
      pointerGesture(
        ev,
        (dx, dy) =>
          setView({ ...initial, x: initial.x + dx, y: initial.y + dy }),
        "Pan",
        false,
      );
      return;
    }
    const v = project!.variants.find((v) => v.id === b.variantId)!,
      e = v.document.entities.find((e) => e.id === id)!,
      p = { ...e.props, ...e.overrides[b.profile] },
      scope = stateId;
    setSelection(id);
    setBoardId(b.id);
    const computed = evaluate(v, b.profile, b.width, signals).actors[id],
      start = { ...p, ...(scope ? computed : {}) };
    pointerGesture(
      ev,
      (dx, dy) =>
        editProject(
          "Shape actor",
          (pr) => {
            if (kind === "aperture") {
              const inst = pr.variants
                .find((v) => v.id === b.variantId)!
                .instruments.find(
                  (i) => i.targetId === id && i.definitionId === "aperture",
                );
              if (inst)
                inst.macroValues.end = clamp(
                  (v.instruments.find((i) => i.stableId === inst.stableId)
                    ?.macroValues.end ?? 1) +
                    dx / view.z / num(p, "width"),
                  0.02,
                  1.5,
                );
            } else
              patchActor(
                pr,
                b,
                id,
                kind === "width"
                  ? {
                      width: clamp(num(start, "width") + dx / view.z, 40, 2400),
                    }
                  : kind === "size"
                    ? {
                        width: clamp(
                          num(start, "width") + dx / view.z,
                          40,
                          2400,
                        ),
                        height: clamp(
                          num(start, "height") + dy / view.z,
                          30,
                          2400,
                        ),
                      }
                    : {
                        x: num(start, "x") + dx / view.z,
                        y: num(start, "y") + dy / view.z,
                      },
                scope,
              );
          },
          true,
        ),
      "Shape " + e.name,
    );
  };
  const patch = (id: string, p: Props) => {
    if (!board) return;
    mutate("Edit actor", (pr) => patchActor(pr, board, id, p, stateId));
  };
  const addActor = (
    kind: Entity["kind"],
    src?: string,
    componentId?: string,
  ) => {
    if (!board) return;
    const e = makeEntity(kind);
    e.id = uid(kind);
    e.name =
      kind === "scene"
        ? "Imported model"
        : kind === "svg"
          ? "Shape"
          : kind === "text"
            ? "New idea"
            : kind === "component"
              ? "Proof card"
              : "New media";
    e.props = {
      ...e.props,
      x: 160,
      y: 150,
      width: kind === "scene" ? 500 : 400,
      height: kind === "scene" ? 540 : kind === "text" ? 150 : 300,
      ...(src ? { [kind === "scene" ? "modelUrl" : "src"]: src } : {}),
      ...(kind === "svg" ? { shape: 0, background: "#8467d6" } : {}),
    };
    e.overrides = { mobile: { x: 26, y: 350, width: 338 } };
    if (componentId) {
      e.componentId = componentId;
      Object.assign(
        e.props,
        COMPONENTS.find((c) => c.id === componentId)?.defaults,
      );
    }
    mutate("Add " + e.name, (_p, v) => {
      v.document.entities.push(e);
      if (kind === "scene") v.instruments.push(instantiate("orbit", e.id));
    });
    setSelection(e.id);
  };
  const importFile = async (file: File, asReference = false) => {
    setBusy(true);
    try {
      const raw = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1]);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const r = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, data: raw }),
        }),
        data = await r.json();
      if (!r.ok) throw new Error(data.error);
      const kind = /\.glb$/i.test(file.name)
        ? "scene"
        : /\.(mp4|webm)$/i.test(file.name)
          ? "video"
          : "image";
      if (asReference) {
        const ref: Reference = {
          id: uid("reference"),
          assetUrl: data.url,
          name: file.name,
          type: kind === "video" ? "video" : "image",
          timecode: 0,
          observation: "",
          inferredControl: "",
          fidelity: "partial",
          strokes: [],
        };
        mutate("Add reference", (_p, v) => v.references.push(ref));
        setReference(true);
        setActiveRef(ref.id);
      } else {
        addActor(kind, data.url);
        mutate("Register asset", (_p, v) =>
          v.document.assets.push({
            id: uid("asset"),
            url: data.url,
            type: kind === "scene" ? "model" : kind,
            name: file.name,
            hash: data.hash,
          }),
        );
      }
      setStatus("Imported " + file.name);
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  };
  const captureState = () => {
    if (!board || !variant) return;
    const result = evaluate(variant, board.profile, board.width, signals),
      id = uid("state");
    mutate("Capture scene state", (_p, v) => {
      v.states.push({
        id,
        name: `Moment ${v.states.length + 1}`,
        at: clock.progress,
        actors: board.profile === "desktop" ? clone(result.actors) : {},
        mobile: board.profile === "mobile" ? clone(result.actors) : {},
      });
      v.states.sort((a, b) => a.at - b.at);
      v.beats[0]?.stateIds.push(id);
    });
    setStateId(id);
  };
  const loadExample = (id: string) => {
    studio.take("Before " + id);
    studio.execute(
      { type: "visual-project", project: makeProject(id) },
      "Open " + id,
    );
    setBoardId("");
    setSelection(
      id === "olympic" ? "coast" : id === "shapes" ? "shape" : "product",
    );
    setStateId("");
    setDrawer("");
    clock.seek(0.36, true);
  };
  const arrangement = (style: string) => {
    if (!board) return;
    let newId = "";
    mutate("Fork " + style, (p) => {
      newId = duplicateBoard(p, board);
      const newB = p.boards.find((b) => b.id === newId)!,
        v = p.variants.find((v) => v.id === newB.variantId)!;
      v.name = style;
      newB.name = style + " · Desktop";
      const headline = v.document.entities.find((e) => e.id === "headline"),
        product = v.document.entities.find((e) => e.kind === "scene");
      if (style === "Editorial" && headline) {
        headline.props.fontFamily = "Georgia, serif";
        headline.props.fontWeight = 400;
        headline.props.fontSize = 100;
      }
      if (style === "Reversed") {
        for (const e of v.document.entities)
          e.props.x = 1200 - num(e.props, "x") - num(e.props, "width");
        v.links = v.links.filter((l) => l.kind !== "clearance");
      }
      if (style === "Close-up" && product) {
        product.props.scale = 1.4;
        product.props.rotateY = -65;
        product.props.x = 450;
      }
      v.instruments
        .filter((i) => i.definitionId === "orbit")
        .forEach(
          (i) => (i.macroValues.turn *= style === "Reversed" ? -1 : 0.65),
        );
    });
    setBoardId(newId);
    setSelection("");
    setStatus("Preset variation · no AI service used");
  };
  async function exportAll() {
    if (!project || !board) return;
    setBusy(true);
    setStatus("Capturing selected artboard and Story Beats…");
    try {
      await exportIntent(project, board, clock.progress, async (progress) => {
        clock.seek(progress, true);
        await new Promise((r) => setTimeout(r, 250));
        return document.querySelector<HTMLElement>(
          `[data-stage="${board.id}"]`,
        )!;
      });
      setStatus("Intent, captured storyboard & replay exported");
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  }
  if (!project || !board || !variant)
    return <div className="vi-loading">Opening visual instruments…</div>;
  return (
    <div
      className={`vi-app ${!left ? "hide-left" : ""} ${!right ? "hide-right" : ""}`}
    >
      <header className="vi-toolbar">
        <div className="vi-brand">
          <span>p</span>
          <strong>Pose Studio</strong>
          <small>Instruments</small>
        </div>
        <span className="vi-toolbar-divider" />
        <button
          onClick={() => setDrawer(drawer === "examples" ? "" : "examples")}
        >
          Examples <ChevronDown size={13} />
        </button>
        <button onClick={() => upload.current?.click()}>
          <Plus size={15} /> Import
        </button>
        <button
          aria-label="Undo"
          title="Undo · Ctrl & Z"
          disabled={!store.canUndo}
          onClick={() => studio.undo()}
        >
          <Undo2 size={16} />
        </button>
        <button
          aria-label="Redo"
          disabled={!store.canRedo}
          onClick={() => studio.redo()}
        >
          <Redo2 size={16} />
        </button>
        <div className="vi-toolbar-spacer" />
        <span className="vi-save">
          <i />
          {store.status}
        </span>
        <button
          aria-label="Project menu"
          onClick={() => setDrawer(drawer === "assets" ? "" : "assets")}
        >
          Project
        </button>
        <button
          onClick={() => {
            setPreview(true);
            setSelection("");
          }}
        >
          {" "}
          <Play size={14} /> Preview
        </button>
        <button
          className="vi-primary"
          disabled={busy}
          onClick={() => void exportAll()}
        >
          <Download size={14} /> Export intent
        </button>
      </header>
      {left ? (
        <aside className="vi-left">
          <div className="vi-panel-heading">
            <span>WORKSPACE</span>
            <button title="Collapse left panel" onClick={() => setLeft(false)}>
              <PanelLeftClose size={14} />
            </button>
          </div>
          <h2>{variant.document.name}</h2>
          <div className="vi-left-tabs">
            <button
              className={drawer !== "assets" ? "active" : ""}
              onClick={() => setDrawer("")}
            >
              <Layers size={13} /> Layers
            </button>
            <button
              className={drawer === "assets" ? "active" : ""}
              onClick={() => setDrawer("assets")}
            >
              <Image size={13} /> Assets
            </button>
          </div>
          <input
            className="vi-search"
            aria-label="Search layers"
            placeholder="Search layers…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="vi-layer-tree">
            {project.boards.map((b) => (
              <div key={b.id}>
                <button
                  className={
                    "vi-board-row " +
                    (b.id === board.id && !selection ? "selected" : "")
                  }
                  onClick={() => select(b)}
                >
                  <span>▱</span>
                  {b.name}
                  <small>{b.profile === "mobile" ? "↔" : ""}</small>
                </button>
                {b.id === board.id
                  ? variant.document.entities
                      .filter((e) =>
                        e.name.toLowerCase().includes(query.toLowerCase()),
                      )
                      .map((e, i) => (
                        <button
                          key={e.id}
                          className={
                            "vi-layer-row " +
                            (selection === e.id ? "selected" : "")
                          }
                          onClick={() => select(b, e.id)}
                          draggable
                          onDragStart={(ev) =>
                            ev.dataTransfer.setData("text/layer", e.id)
                          }
                          onDragOver={(ev) => ev.preventDefault()}
                          onDrop={(ev) => {
                            const id = ev.dataTransfer.getData("text/layer");
                            if (!id) return;
                            mutate("Reorder layers", (_p, v) => {
                              const old = v.document.entities.find(
                                (e) => e.id === id,
                              )!;
                              v.document.entities = v.document.entities.filter(
                                (e) => e.id !== id,
                              );
                              v.document.entities.splice(i, 0, old);
                            });
                          }}
                        >
                          <span>
                            {e.kind === "scene"
                              ? "◇"
                              : e.kind === "text"
                                ? "T"
                                : e.kind === "image"
                                  ? "▧"
                                  : e.kind === "video"
                                    ? "▷"
                                    : "□"}
                          </span>
                          {e.name}
                          <small>
                            {variant.instruments.filter(
                              (x) => x.targetId === e.id && x.enabled,
                            ).length || ""}
                          </small>
                        </button>
                      ))
                  : null}
              </div>
            ))}
          </div>
          <div className="vi-left-bottom">
            <button
              onClick={() => {
                setSelection("");
                setDrawer("assets");
              }}
            >
              <Plus size={14} /> Add actor
            </button>
            <button onClick={() => setReference(!reference)}>
              ▧ References <small>{variant.references.length || ""}</small>
            </button>
            <button onClick={() => setDrawer(drawer === "help" ? "" : "help")}>
              <CircleHelp size={14} /> Quick guide
            </button>
          </div>
        </aside>
      ) : null}
      <main
        className="vi-canvas"
        ref={viewport}
        onPointerDown={(ev) => {
          if (ev.target !== ev.currentTarget && !hand && !space.current) return;
          const initial = view;
          pointerGesture(
            ev,
            (dx, dy) =>
              setView({ ...initial, x: initial.x + dx, y: initial.y + dy }),
            "Pan",
            false,
          );
        }}
      >
        <div className="vi-canvas-top">
          <span>
            <i />
            {state
              ? `Editing ${state.name}`
              : connect
                ? `Connect ${connect} → select another actor`
                : "Compose freely"}
          </span>
          <div>
            {!left ? (
              <button onClick={() => setLeft(true)}>Layers</button>
            ) : null}
            <button
              className={wires ? "active" : ""}
              onClick={() => setWires(!wires)}
            >
              <GitBranch size={13} /> Connections
            </button>
            <button title="Toggle inspector" onClick={() => setRight(!right)}>
              <PanelRightClose size={14} />
            </button>
          </div>
        </div>
        <div
          className="vi-world"
          style={{
            transform: `translate(${view.x}px,${view.y}px) scale(${view.z})`,
          }}
        >
          {project.boards.map((b) => {
            const v = project.variants.find((v) => v.id === b.variantId)!;
            return (
              <section
                className={"vi-artboard " + (board.id === b.id ? "active" : "")}
                key={b.id}
                style={{
                  left: b.x,
                  top: b.y,
                  width: b.width,
                  height: b.height,
                }}
                data-artboard={b.id}
              >
                <div
                  className="vi-artboard-title"
                  onPointerDown={(ev) => {
                    select(b);
                    const start = { x: b.x, y: b.y };
                    pointerGesture(
                      ev,
                      (dx, dy) =>
                        editProject(
                          "Move artboard",
                          (p) =>
                            Object.assign(
                              p.boards.find((x) => x.id === b.id)!,
                              {
                                x: start.x + dx / view.z,
                                y: start.y + dy / view.z,
                              },
                            ),
                          true,
                        ),
                      "Move artboard",
                    );
                  }}
                >
                  <strong style={{ fontSize: 12 / view.z }}>{b.name}</strong>
                  <span style={{ fontSize: 9 / view.z }}>
                    {b.width} × {b.height}{" "}
                    {b.profile === "mobile" ? "· Linked to " + v.name : ""}
                  </span>
                </div>
                <Stage
                  variant={v}
                  board={b}
                  signals={signals}
                  active={board.id === b.id && !preview}
                  selection={board.id === b.id ? selection : undefined}
                  wires={wires}
                  pinMode={pin && board.id === b.id}
                  onSelect={(id) => select(b, id)}
                  onPatch={patch}
                  onDrag={(e, id, kind) => actorDrag(e, id, kind, b)}
                />
              </section>
            );
          })}
        </div>
        <div className="vi-canvas-controls">
          <button
            aria-label="Select tool"
            className={!hand ? "active" : ""}
            onClick={() => setHand(false)}
          >
            <MousePointer2 size={17} />
          </button>
          <button
            aria-label="Hand tool"
            className={hand ? "active" : ""}
            onClick={() => setHand(true)}
          >
            <Hand size={17} />
          </button>
          <span />
          <button
            onClick={() =>
              setView((v) => ({ ...v, z: clamp(v.z * 0.8, 0.1, 2) }))
            }
          >
            −
          </button>
          <button aria-label="Fit all artboards" onClick={() => fit(true)}>
            {Math.round(view.z * 100)}%
          </button>
          <button
            onClick={() =>
              setView((v) => ({ ...v, z: clamp(v.z * 1.25, 0.1, 2) }))
            }
          >
            ＋
          </button>
          <span />
          <button
            aria-label="Focus artboard"
            title="Focus artboard · F"
            onClick={() => fit()}
          >
            <Maximize2 size={16} />
          </button>
        </div>
        <span className="vi-touchpad-hint">
          Pan with two fingers · pinch to zoom · F to focus
        </span>
        {drawer ? (
          <div className="vi-drawer">
            <header>
              <h2>
                {drawer === "examples"
                  ? "Start with a movement"
                  : drawer === "help"
                    ? "Play the instruments"
                    : "Actors & arrangements"}
              </h2>
              <button aria-label="Close drawer" onClick={() => setDrawer("")}>
                <X size={17} />
              </button>
            </header>
            {drawer === "examples" ? (
              <div className="vi-example-grid">
                {examples.map((e) => (
                  <button key={e.id} onClick={() => loadExample(e.id)}>
                    <div style={{ background: e.colour }}>
                      <span>
                        {e.id === "shapes"
                          ? "△ ○ □"
                          : e.id === "olympic"
                            ? "↕"
                            : e.id === "morpho"
                              ? "◉"
                              : "◇"}
                      </span>
                    </div>
                    <strong>{e.name}</strong>
                    <small>{e.sub}</small>
                  </button>
                ))}
              </div>
            ) : drawer === "help" ? (
              <div className="vi-help">
                <p>
                  <b>1. Select an actor.</b> Switch its instruments on and move
                  their controls.
                </p>
                <p>
                  <b>2. Scrub the story.</b> Drag a beat edge to change its
                  span. Click a moment to edit its endpoint.
                </p>
                <p>
                  <b>3. Play with the product.</b> Drag to orbit. Release to
                  return smoothly. Shift & drag moves it.
                </p>
                <p>
                  <b>4. Compare.</b> Click an artboard title, then Ctrl & D.
                  Mobile shares its variant with scoped changes.
                </p>
                <p>
                  <b>5. Keep it.</b> Every gesture undoes once. Escape cancels.
                  Export includes captured frames.
                </p>
                <a href="?legacy">Open advanced legacy editor ↗</a>
              </div>
            ) : (
              <>
                <div className="vi-assets-grid">
                  <button onClick={() => addActor("text")}>
                    <Type />
                    Text
                  </button>
                  <button onClick={() => upload.current?.click()}>
                    <Image />
                    Media
                  </button>
                  <button
                    onClick={() =>
                      addActor("scene", "/assets/14_pro_oled_repaired.glb")
                    }
                  >
                    <Box />
                    Original iPhone
                  </button>
                  <button onClick={() => addActor("svg")}>△ Shape</button>
                  {COMPONENTS.filter((c) => c.id !== "hero-reference").map(
                    (c) => (
                      <button
                        key={c.id}
                        onClick={() => addActor("component", undefined, c.id)}
                      >
                        ▤ {c.name}
                      </button>
                    ),
                  )}
                </div>
                <h3>Arrangement variations</h3>
                <small>Scene presets · no remote AI</small>
                <div className="vi-variation-grid">
                  {["Editorial", "Reversed", "Close-up"].map((s) => (
                    <button key={s} onClick={() => arrangement(s)}>
                      {s}
                    </button>
                  ))}
                </div>
                <h3>Project</h3>
                <button
                  onClick={() =>
                    download(
                      "pose-project.json",
                      JSON.stringify(store.workspace, null, 2),
                      "application/json",
                    )
                  }
                >
                  Save project JSON
                </button>
                <button onClick={() => projectUpload.current?.click()}>
                  Open project JSON
                </button>
                <button
                  onClick={() => {
                    const original = clone(store.workspace.document);
                    delete original.visual;
                    mutate("Bring previous composition", (p) => {
                      const v = clone(variant);
                      v.id = uid("variant");
                      v.name = "Previous";
                      v.document = original;
                      v.instruments = [
                        instantiate("smooth"),
                        instantiate("stage"),
                      ];
                      v.states = [];
                      v.beats = [];
                      v.links = [];
                      p.variants.push(v);
                      p.boards.push({
                        ...board,
                        id: uid("board"),
                        variantId: v.id,
                        name: "Previous composition",
                        x: Math.max(...p.boards.map((b) => b.x + b.width)) + 60,
                      });
                    });
                  }}
                >
                  Add previous composition
                </button>
                <a href="?legacy">Advanced editor ↗</a>
              </>
            )}
          </div>
        ) : null}
        {reference ? (
          <div className="vi-reference">
            <header>
              <strong>Reference board</strong>
              <button onClick={() => referenceUpload.current?.click()}>
                ＋ Import
              </button>
              <button onClick={() => setReference(false)}>×</button>
            </header>
            {activeReference ? (
              <>
                <select
                  aria-label="Reference asset"
                  value={activeReference.id}
                  onChange={(e) => setActiveRef(e.target.value)}
                >
                  {variant.references.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <div className="vi-reference-media">
                  {activeReference.type === "video" ? (
                    <video
                      ref={refVideo}
                      src={activeReference.assetUrl}
                      controls
                      onLoadedMetadata={(e) =>
                        setRefDuration(e.currentTarget.duration)
                      }
                      onTimeUpdate={(e) =>
                        setRefTime(e.currentTarget.currentTime)
                      }
                    />
                  ) : (
                    <img
                      src={activeReference.still ?? activeReference.assetUrl}
                    />
                  )}
                  <svg
                    ref={referenceSvg}
                    viewBox="0 0 600 400"
                    onPointerDown={(ev) => {
                      const rect = ev.currentTarget.getBoundingClientRect(),
                        points: number[][] = [];
                      pointerGesture(
                        ev,
                        (dx, dy) => {
                          points.push([
                            ((ev.clientX + dx - rect.left) * 600) / rect.width,
                            ((ev.clientY + dy - rect.top) * 400) / rect.height,
                          ]);
                          mutate(
                            "Trace reference",
                            (_p, v) =>
                              (v.references.find(
                                (r) => r.id === activeReference.id,
                              )!.strokes = [
                                ...activeReference.strokes,
                                { points, colour: "#0071e3" },
                              ]),
                            true,
                          );
                        },
                        "Trace reference",
                      );
                    }}
                  >
                    {activeReference.strokes.map((s, i) => (
                      <polyline
                        key={i}
                        points={s.points.map((p) => p.join(",")).join(" ")}
                        stroke={s.colour}
                        strokeWidth="3"
                        fill="none"
                      />
                    ))}
                  </svg>
                </div>
                {activeReference.type === "video" ? (
                  <>
                    <input
                      aria-label="Reference timecode"
                      type="range"
                      min={0}
                      max={refDuration}
                      step={0.04}
                      value={refTime}
                      onChange={(e) => {
                        if (refVideo.current)
                          refVideo.current.currentTime = Number(e.target.value);
                      }}
                    />
                    <button
                      onClick={() => {
                        const video = refVideo.current!;
                        video.pause();
                        const canvas = document.createElement("canvas");
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        canvas.getContext("2d")!.drawImage(video, 0, 0);
                        mutate("Freeze reference frame", (_p, v) => {
                          const r = v.references.find(
                            (r) => r.id === activeReference.id,
                          )!;
                          r.still = canvas.toDataURL("image/png");
                          r.timecode = video.currentTime;
                        });
                      }}
                    >
                      Freeze {refTime.toFixed(2)}s
                    </button>
                  </>
                ) : null}
                <textarea
                  aria-label="Reference observation"
                  placeholder="What do you see?"
                  value={activeReference.observation}
                  onChange={(e) =>
                    mutate(
                      "Reference observation",
                      (_p, v) =>
                        (v.references.find(
                          (r) => r.id === activeReference.id,
                        )!.observation = e.target.value),
                    )
                  }
                />
              </>
            ) : (
              <p>
                Import an image or video. Freeze a frame and trace its movement.
              </p>
            )}
          </div>
        ) : null}
      </main>
      {right ? (
        <Rack
          variant={variant}
          board={board}
          selection={selection}
          stateId={stateId}
          pinMode={pin}
          onPin={() => setPin(!pin)}
          onConnect={() => {
            setConnect(selection);
            setWires(true);
          }}
          onDeleteBoard={removeBoard}
          onDuplicateBoard={duplicate}
          onFit={() => fit()}
        />
      ) : null}
      <footer className="vi-story">
        <div className="vi-story-toolbar">
          <button
            aria-label={clock.playing ? "Pause story" : "Play story"}
            onClick={clock.play}
          >
            {clock.playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <strong>Story</strong>
          <span className="vi-progress-label">
            {Math.round(clock.progress * 100)}%
          </span>
          <input
            aria-label="Story progress"
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={clock.progress}
            onChange={(e) => {
              setStateId("");
              clock.seek(Number(e.target.value), true);
            }}
          />
          <button onClick={captureState}>＋ Moment</button>
          <button
            onClick={() => {
              mutate("New Story Beat", (_p, v) => {
                const ids = v.instruments
                    .filter((i) => i.targetId === selection)
                    .map((i) => i.stableId),
                  id = uid("beat");
                v.beats.forEach(
                  (b) =>
                    (b.instrumentIds = b.instrumentIds.filter(
                      (i) => !ids.includes(i),
                    )),
                );
                v.instruments
                  .filter((i) => ids.includes(i.stableId))
                  .forEach((i) => (i.beatId = id));
                v.beats.push({
                  id,
                  name: selection ? "Move " + selection : "New movement",
                  start: Math.min(0.95, clock.progress),
                  end: Math.min(1, clock.progress + 0.3),
                  enabled: true,
                  strength: 1,
                  instrumentIds: ids,
                  stateIds: [],
                });
              });
            }}
          >
            ＋ Beat
          </button>
        </div>
        <div className="vi-story-content">
          <div className="vi-moments">
            {[...variant.states]
              .sort((a, b) => a.at - b.at)
              .map((s, i) => (
                <div
                  className={
                    "vi-moment " + (stateId === s.id ? "selected" : "")
                  }
                  key={s.id}
                >
                  <button
                    onClick={() => {
                      setStateId(s.id);
                      clock.seek(s.at, true);
                    }}
                  >
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <strong>{s.name}</strong>
                    <small>{Math.round(s.at * 100)}%</small>
                  </button>
                  <button
                    aria-label={`Move ${s.name} earlier`}
                    disabled={!i}
                    onClick={() =>
                      mutate("Reorder moments", (_p, v) => {
                        const sorted = [...v.states].sort(
                            (a, b) => a.at - b.at,
                          ),
                          a = v.states.find((x) => x.id === s.id)!,
                          b = v.states.find((x) => x.id === sorted[i - 1].id)!;
                        [a.at, b.at] = [b.at, a.at];
                      })
                    }
                  >
                    ←
                  </button>
                </div>
              ))}
            {!variant.states.length ? (
              <small>Capture a moment to shape the transition.</small>
            ) : null}
          </div>
          <div className="vi-beat-lanes">
            {variant.beats.map((beat) => (
              <div key={beat.id} className="vi-beat-track">
                <div
                  className={"vi-beat " + (!beat.enabled ? "bypassed" : "")}
                  style={{
                    left: beat.start * 100 + "%",
                    width: (beat.end - beat.start) * 100 + "%",
                  }}
                >
                  <button
                    aria-label={`${beat.name} enabled`}
                    onClick={() =>
                      mutate(
                        "Bypass compound beat",
                        (_p, v) =>
                          (v.beats.find((b) => b.id === beat.id)!.enabled =
                            !beat.enabled),
                      )
                    }
                  >
                    {beat.enabled ? "●" : "○"}
                  </button>
                  <span
                    onPointerDown={(ev) => {
                      const width = ev.currentTarget
                        .closest(".vi-beat-track")!
                        .getBoundingClientRect().width;
                      pointerGesture(
                        ev,
                        (dx) =>
                          mutate(
                            "Move beat",
                            (_p, v) => {
                              const b = v.beats.find((b) => b.id === beat.id)!,
                                duration = beat.end - beat.start;
                              b.start = clamp(
                                beat.start + dx / width,
                                0,
                                1 - duration,
                              );
                              b.end = b.start + duration;
                            },
                            true,
                          ),
                        "Move beat",
                      );
                    }}
                  >
                    {beat.name}
                  </span>
                  <input
                    type="range"
                    aria-label="Beat coupling"
                    min={0}
                    max={1}
                    step={0.01}
                    value={beat.strength}
                    onChange={(ev) =>
                      mutate(
                        "Beat coupling",
                        (_p, v) =>
                          (v.beats.find((b) => b.id === beat.id)!.strength =
                            Number(ev.target.value)),
                      )
                    }
                  />
                  <i
                    role="slider"
                    aria-label="Beat start"
                    onPointerDown={(ev) => {
                      const width = ev.currentTarget
                        .closest(".vi-beat-track")!
                        .getBoundingClientRect().width;
                      pointerGesture(
                        ev,
                        (dx) =>
                          mutate(
                            "Stretch beat",
                            (_p, v) =>
                              (v.beats.find((b) => b.id === beat.id)!.start =
                                clamp(
                                  beat.start + dx / width,
                                  0,
                                  beat.end - 0.03,
                                )),
                            true,
                          ),
                        "Stretch beat",
                      );
                    }}
                  />
                  <i
                    role="slider"
                    aria-label="Beat end"
                    onPointerDown={(ev) => {
                      const width = ev.currentTarget
                        .closest(".vi-beat-track")!
                        .getBoundingClientRect().width;
                      pointerGesture(
                        ev,
                        (dx) =>
                          mutate(
                            "Stretch beat",
                            (_p, v) =>
                              (v.beats.find((b) => b.id === beat.id)!.end =
                                clamp(
                                  beat.end + dx / width,
                                  beat.start + 0.03,
                                  1,
                                )),
                            true,
                          ),
                        "Stretch beat",
                      );
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </footer>
      {status || store.error ? (
        <div
          className={"vi-toast " + (store.error ? "error" : "")}
          role="status"
        >
          {store.error || status}
          <button
            onClick={() => {
              setStatus("");
              studio.clearError();
            }}
          >
            ×
          </button>
        </div>
      ) : null}
      {preview ? (
        <div className="vi-preview">
          <header>
            <strong>{variant.document.name}</strong>
            <span>Scroll to play · drag product to orbit</span>
            <button onClick={() => setPreview(false)}>Close preview ×</button>
          </header>
          <div
            className="vi-preview-scroll"
            ref={previewScroll}
            onScroll={(ev) => {
              const el = ev.currentTarget;
              clock.seek(
                el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight),
              );
            }}
          >
            <div
              style={{
                height: `${(variant.instruments.find((i) => i.definitionId === "stage" && i.enabled)?.macroValues.travel ?? 3) * 100}vh`,
                position: "relative",
              }}
            >
              <div className="vi-preview-sticky">
                <div
                  style={{
                    width: board.width,
                    height: board.height,
                    transform: `scale(${Math.min((innerWidth - 48) / board.width, (innerHeight - 80) / board.height)})`,
                    transformOrigin: "top center",
                  }}
                >
                  <Stage
                    variant={variant}
                    board={board}
                    signals={signals}
                    active
                    editor={false}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <input
        type="file"
        ref={upload}
        hidden
        accept=".glb,.png,.jpg,.jpeg,.webp,.svg,.mp4,.webm"
        onChange={(e) => {
          if (e.target.files?.[0]) void importFile(e.target.files[0]);
          e.target.value = "";
        }}
      />
      <input
        type="file"
        ref={referenceUpload}
        hidden
        accept="image/*,video/mp4,video/webm"
        onChange={(e) => {
          if (e.target.files?.[0]) void importFile(e.target.files[0], true);
          e.target.value = "";
        }}
      />
      <input
        type="file"
        ref={projectUpload}
        hidden
        accept=".json"
        onChange={async (e) => {
          if (e.target.files?.[0])
            try {
              studio.importWorkspace(
                JSON.parse(await e.target.files[0].text()),
              );
              setBoardId("");
            } catch (err) {
              setStatus(String(err));
            }
          e.target.value = "";
        }}
      />
    </div>
  );
}
