import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Check, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { PageRenderer } from "./PageRenderer";
import { ImportedComponent } from "./ImportedComponent";
import { studio } from "./store";
import { makeEntity, COMPONENTS } from "./seed";
import { COPY_ROLES, layoutDocument } from "./layout";
import { descendants, reparentSelection, reorderSection } from "./operations";
import { uid, type ComponentDefinition, type StudioDocument, type Take, type Entity, type Kind } from "./model";

function Thumbnail({ document: d, profileId = "desktop", time = 0, signals, label }: { document: StudioDocument; profileId?: string; time?: number; signals?: Record<string, number>; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(270), [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current!;
    const resize = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width)); resize.observe(element);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "80px" }); observer.observe(element);
    return () => { resize.disconnect(); observer.disconnect(); };
  }, []);
  const p = d.profiles.find(p => p.id === profileId) ?? d.profiles[0];
  const height = layoutDocument(d, p.id, time, signals).height;
  const scale = Math.min(width / p.width, 190 / height);
  return <div ref={ref} className="visual-thumbnail" role="img" aria-label={label} style={{ height: Math.max(100, Math.min(190, height * width / p.width)) }}>
    {visible && <div className="thumbnail-render" aria-hidden="true" ref={node => node?.setAttribute("inert", "")} style={{ width: p.width, height, transform: `scale(${scale})`, left: (width - p.width * scale) / 2 }}><PageRenderer document={d} profileId={p.id} time={time} signals={signals ?? { scroll: 0, pointerX: .5, pointerY: .5 }} /></div>}
  </div>;
}

export function TakeShelf({ takes, preferred, onCompare, onCapture, onExplore }: { takes: Take[]; preferred?: string; onCompare: (t: Take) => void; onCapture: () => void; onExplore: () => void }) {
  return <>
    <div className="panel-heading">Saved versions <span>{takes.length}</span></div>
    <button className="wide-action" onClick={onCapture}><Plus size={14} />Capture current Take</button>
    <button className="wide-action subtle" onClick={onExplore}>Explore reflective look</button>
    {takes.map(t => <article className="take-card" key={t.id}>
      <button className="take-preview-button" title="Compare with current composition" onClick={() => onCompare(t)}><Thumbnail document={t.document} profileId={t.profileId} time={t.playhead} signals={t.signals} label={`Preview of ${t.name}`} /></button>
      <div className="shelf-card-heading">
        <input key={t.name} aria-label={`Rename ${t.name}`} defaultValue={t.name} onBlur={e => { if (e.target.value.trim() !== t.name) studio.renameTake(t.id, e.target.value); }} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} />
        {preferred === t.id && <Check size={14} aria-label="Preferred version" />}
        <button title="Delete version · Undo restores it" aria-label={`Delete ${t.name}`} onClick={() => studio.deleteTake(t.id)}><Trash2 size={14} /></button>
      </div>
      <small>{new Date(t.createdAt).toLocaleTimeString()} · {t.profileId ?? "desktop"} · {(t.playhead ?? 0).toFixed(1)}s</small>
      <div className="take-actions"><button onClick={() => studio.restore(t)} title="Load this version into the canvas. Undo restores your previous edits.">Open for editing</button><button onClick={() => studio.acceptTake(t.id)} title="Mark this version as your preferred reference">{preferred === t.id ? "Preferred ✓" : "Mark preferred"}</button><button onClick={() => onCompare(t)}>Compare</button></div>
    </article>)}
    {!takes.length && <p className="panel-hint">Capture a version to keep a visual record of this composition.</p>}
  </>;
}

export function CopyShelf({ document: d, filter }: { document: StudioDocument; filter: string }) {
  return <>
    <div className="panel-heading">Copy workspace<button aria-label="Add copy" onClick={() => studio.execute({ type: "copy", atom: { id: uid("copy"), name: "New fragment", text: "Your next idea.", role: "body", section: "", variants: [] } }, "Add copy fragment")}><Plus size={16} /></button></div>
    <p className="panel-hint">Set a role and section. Deleting a fragment keeps its existing text on the canvas.</p>
    {d.copy.filter(a => `${a.name} ${a.text} ${a.section ?? ""}`.toLowerCase().includes(filter.toLowerCase())).map(a => <article className="copy-card" key={a.id}>
      <div className="shelf-card-heading"><input aria-label="Fragment name" value={a.name} onChange={e => studio.execute({ type: "copy", atom: { ...a, name: e.target.value } }, "Rename copy fragment")} /><button aria-label={`Delete copy ${a.name}`} title="Delete fragment · existing text stays on the canvas" onClick={() => studio.execute({ type: "remove-copy", id: a.id }, "Delete copy fragment")}><Trash2 size={14} /></button></div>
      <div className="copy-role-row"><select aria-label={`Copy role ${a.name}`} value={a.role ?? "body"} onChange={e => studio.execute({ type: "copy", atom: { ...a, role: e.target.value } }, "Set copy role")}>{Object.entries(COPY_ROLES).map(([id, r]) => <option key={id} value={id}>{r.label}</option>)}</select><input aria-label={`Copy section ${a.name}`} placeholder="Section" value={a.section ?? ""} onChange={e => studio.execute({ type: "copy", atom: { ...a, section: e.target.value } }, "Set copy section")} /></div>
      <textarea aria-label={a.name + " copy"} value={a.text} onChange={e => studio.execute({ type: "copy", atom: { ...a, text: e.target.value } }, "Edit shared copy")} />
      <div className="row"><button onClick={() => { const e = makeEntity("text"); e.copyId = a.id; e.name = a.name; Object.assign(e.props, COPY_ROLES[a.role ?? "body"]?.props); studio.execute({ type: "insert", entities: [e] }, "Insert linked copy"); studio.select([e.id]); }}>Insert ↗</button><button onClick={() => studio.execute({ type: "copy", atom: { ...a, variants: [...a.variants, a.text] } }, "Save copy variant")}>Save variant</button></div>
      {a.variants.map((v, i) => <div className="variant-row" key={i}><button className="variant" onClick={() => studio.execute({ type: "copy", atom: { ...a, text: v } }, "Use copy variant")}>{v}</button><button aria-label={`Delete variant ${i + 1} of ${a.name}`} title="Delete variant" onClick={() => studio.execute({ type: "copy", atom: { ...a, variants: a.variants.filter((_, n) => n !== i) } }, "Delete copy variant")}><Trash2 size={13} /></button></div>)}
    </article>)}
  </>;
}

export function ComponentShelf({ document: d, insert }: { document: StudioDocument; insert: (id: string) => void }) {
  const [source, setSource] = useState(""), [name, setName] = useState("");
  const [pending, setPending] = useState<ComponentDefinition | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [showRemoved, setShowRemoved] = useState(false);
  const entries = [...COMPONENTS, ...(d.components ?? []).map(c => ({ ...c, description: "Imported Framer component", capabilities: ["Live preview", "Props", "Responsive frame"] }))];
  const hidden = d.hiddenComponents ?? [];
  const importComponent = async () => {
    setBusy(true); setError(""); setPending(null);
    try {
      const r = await fetch("/api/components/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error);
      setPending({ id: uid("component"), name: name.trim() || "Framer component", sourceUrl: data.sourceUrl, bundle: data.bundle, importedAt: new Date().toISOString(), defaults: {} });
    } catch (e) { setError(String(e instanceof Error ? e.message : e)); } finally { setBusy(false); }
  };
  return <>
    <div className="panel-heading">Component shelf</div>
    <details className="component-import" open><summary>Import from Framer</summary><input aria-label="Component name" placeholder="Component name" value={name} onChange={e => setName(e.target.value)} /><textarea aria-label="Framer Copy Import" placeholder="Paste Framer’s Copy Import code or component URL" value={source} onChange={e => setSource(e.target.value)} /><button className="wide-action" disabled={busy || !source.trim()} onClick={() => void importComponent()}>{busy ? "Downloading and adapting…" : "Import and preview"}</button><small>Framer → Assets → component menu → Copy Import.</small>{error && <p role="alert">{error}</p>}
      {pending && <><div className="import-preview"><ImportedComponent definition={pending} values={{}} interactive onMetadata={controls => setPending(c => c ? { ...c, controls } : null)} /></div><button className="wide-action" onClick={() => { studio.execute({ type: "component", component: pending }, "Import Framer component"); setPending(null); setSource(""); }}>Add to shelf</button></>}
    </details>
    {entries.filter(c => !hidden.includes(c.id)).map(c => {
      const e = makeEntity("component"); e.componentId = c.id; e.name = c.name; e.props = { ...e.props, ...c.defaults, x: 0, y: 0, width: 320, height: 180 };
      const preview = { ...d, entities: [e], tracks: [], bindings: [], relationships: [], profiles: [{ id: "desktop", name: "Preview", width: 320, height: 200 }] };
      return <article className="component-shelf-card" key={c.id}><button className="take-preview-button" onClick={() => insert(c.id)} title={`Insert ${c.name}`}><Thumbnail document={preview} label={`Preview of ${c.name}`} /></button><div className="shelf-card-heading"><strong>{c.name}</strong><button aria-label={`Delete component ${c.name}`} title="Remove from shelf · placed instances remain" onClick={() => studio.execute({ type: "hide-component", id: c.id, hidden: true }, "Remove component from shelf")}><Trash2 size={14} /></button></div><button className="wide-action" onClick={() => insert(c.id)}><Plus size={13} />Insert</button></article>;
    })}
    {hidden.length > 0 && <details className="component-import" open={showRemoved} onToggle={e => setShowRemoved(e.currentTarget.open)}><summary>Removed from shelf ({hidden.length})</summary>{entries.filter(c => hidden.includes(c.id)).map(c => <button className="wide-action" key={c.id} onClick={() => studio.execute({ type: "hide-component", id: c.id, hidden: false }, "Restore component to shelf")}>Restore {c.name}</button>)}</details>}
  </>;
}

export function HierarchyControls({ document: d, entity: e }: { document: StudioDocument; entity: Entity }) {
  const blocked = new Set([e.id, ...descendants(d, e.id)]);
  const change = (parentId?: string) => { try { studio.batch(reparentSelection(d, [e.id], parentId), parentId ? "Change parent" : "Detach from parent"); } catch (error) { studio.fail(String(error)); } };
  const child = (kind: Kind) => { const c = makeEntity(kind); c.parentId = e.id; c.props.x = 24; c.props.y = 24; if (kind === "text") c.props.text = "Your text"; studio.execute({ type: "insert", entities: [c] }, "Add child"); studio.select([c.id]); };
  const siblings = d.entities.filter(a => a.parentId === e.parentId), index = siblings.findIndex(a => a.id === e.id);
  const reorder = (direction: -1 | 1) => {
    try {
      if (e.props.isSection && !e.parentId) studio.batch(reorderSection(d, e.id, direction), "Reorder section");
      else studio.execute({ type: "reorder", id: e.id, beforeId: direction === -1 ? siblings[index - 1]?.id : siblings[index + 2]?.id }, "Reorder layer");
    } catch (error) { studio.fail(String(error)); }
  };
  return <div className="hierarchy-controls"><label>Parent<select aria-label="Parent frame" value={e.parentId ?? ""} onChange={event => change(event.target.value || undefined)}><option value="">Page · no parent</option>{d.entities.filter(a => a.kind === "frame" && !blocked.has(a.id)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><div className="row"><button disabled={!e.parentId} onClick={() => change()}>Detach to page</button><button aria-label="Move layer up" disabled={index === 0} onClick={() => reorder(-1)}><ArrowUp size={13} /></button><button aria-label="Move layer down" disabled={index === siblings.length - 1} onClick={() => reorder(1)}><ArrowDown size={13} /></button></div>{e.kind === "frame" && <><strong>Children ({d.entities.filter(a => a.parentId === e.id).length})</strong><div className="row"><button onClick={() => child("text")}>+ Child text</button><button onClick={() => child("frame")}>+ Child frame</button><button onClick={() => child("button")}>+ Child button</button></div></>}</div>;
}

export function LayerTree({ document: d, selection, filter, scenesOnly = false }: { document: StudioDocument; selection: string[]; filter: string; scenesOnly?: boolean }) {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const drop = (event: React.DragEvent, parentId?: string) => {
    event.preventDefault(); event.stopPropagation();
    const id = event.dataTransfer.getData("studio-layer");
    if (!id) return;
    try { studio.batch(reparentSelection(d, [id], parentId), parentId ? "Move into frame" : "Move to page"); } catch (e) { studio.fail(String(e)); }
  };
  const render = (parentId?: string, depth = 0): React.ReactNode => d.entities.filter(e => e.parentId === parentId).map(e => {
    const children = d.entities.some(c => c.parentId === e.id);
    const matches = (!scenesOnly || e.kind === "scene") && (!filter || e.name.toLowerCase().includes(filter.toLowerCase()));
    return <div key={e.id}>{matches && <div className={`layer ${selection.includes(e.id) ? "active" : ""}`} style={{ paddingLeft: 8 + depth * 16 }} draggable onDragStart={event => event.dataTransfer.setData("studio-layer", e.id)} onDragOver={event => { if (e.kind === "frame") event.preventDefault(); }} onDrop={event => { if (e.kind === "frame") drop(event, e.id); }}>
      {children && <button aria-label={`Toggle children of ${e.name}`} onClick={() => setClosed(c => { const next = new Set(c); next.has(e.id) ? next.delete(e.id) : next.add(e.id); return next; })}>{closed.has(e.id) ? <ChevronRight size={12} /> : <ChevronDown size={12} />}</button>}
      <button className="layer-select" onClick={event => studio.select(event.shiftKey ? selection.includes(e.id) ? selection.filter(id => id !== e.id) : [...selection, e.id] : [e.id])}><span className="layer-kind">{e.kind === "frame" ? "▣" : e.kind === "text" ? "T" : "◇"}</span><span>{e.name}</span></button>
      <button title="Delete layer · Undo restores it" aria-label={`Delete layer ${e.name}`} onClick={() => studio.execute({ type: "remove", ids: [e.id] }, "Delete layer")}><Trash2 size={12} /></button>
    </div>}{(!closed.has(e.id) || !!filter) && render(e.id, depth + 1)}</div>;
  });
  return <div className="layer-tree"><div className="page-drop" onDragOver={e => e.preventDefault()} onDrop={e => drop(e)}>Page · drag here to detach</div>{render()}</div>;
}
