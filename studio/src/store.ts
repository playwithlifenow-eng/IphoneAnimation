import { INSTRUMENT_VERSION } from "./capabilities";
import { readRecoveries, writeRecovery } from "./recovery";
import { useSyncExternalStore } from "react";
import {
  applyCommand,
  entityClockId,
  clone,
  uid,
  validateWorkspace,
  type StudioDocument,
  type Workspace,
  type Command,
  type EventRecord,
  type Props,
  type Episode,
  type Take,
} from "./model";
import { seedDocument } from "./seed";
interface State {
  signals: Record<string, number>;
  clockId: string;
  editMode: "key" | "offset";
  workspace: Workspace;
  selection: string[];
  profileId: string;
  playhead: number;
  playing: boolean;
  tab: string;
  zoom: number;
  status: string;
  error: string;
  loaded: boolean;
  preview: StudioDocument | null;
  canUndo: boolean;
  canRedo: boolean;
  events: EventRecord[];
}
let state: State = {
  signals: { pointerX: 0.5, pointerY: 0.5, scroll: 0 },
  clockId: "page",
  editMode: "key",
  workspace: { version: 1, document: seedDocument(), takes: [], episodes: [] },
  selection: ["headline"],
  profileId: "desktop",
  playhead: 0,
  playing: false,
  tab: "compose",
  zoom: 0.7,
  status: "Opening workspace…",
  error: "",
  loaded: false,
  preview: null,
  canUndo: false,
  canRedo: false,
  events: [],
};
const listeners = new Set<() => void>();
interface HistoryEntry {
  document: StudioDocument;
  parentId?: string;
  workspace?: Workspace;
}
const historyEntry = (whole = false): HistoryEntry => ({
  document: clone(state.workspace.document),
  parentId: state.workspace.workingParentTakeId,
  ...(whole ? { workspace: clone(state.workspace) } : {}),
});
let past: HistoryEntry[] = [];
let future: HistoryEntry[] = [];
let serverVersion = 0;
let timer: ReturnType<typeof setTimeout>;
let activeSave: Promise<void> | null = null;
let pending = false;
let gestureBase: StudioDocument | null = null;
const emit = () => listeners.forEach((fn) => fn());
const update = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  emit();
};
const writerId = uid("writer");
function backup(): boolean {
  const saved = writeRecovery(writerId, state.workspace, serverVersion);
  if (!saved) update({ error: "Browser recovery storage is unavailable or full. Export your project; server saving remains available." });
  return saved;
}
function scheduleSave() {
  if (!state.loaded) return;
  backup();
  clearTimeout(timer);
  timer = setTimeout(() => void save(), 450);
}
function event(label: string, type: string) {
  return [
    ...state.events,
    {
      at: new Date().toISOString(),
      revision: state.workspace.document.revision,
      label,
      type,
    },
  ].slice(-120);
}
function replaceDocument(next: StudioDocument, label: string, type: string) {
  if (next === state.workspace.document) return;
  past.push(historyEntry());
  past = past.slice(-100);
  future = [];
  update({
    workspace: { ...state.workspace, document: next },
    selection: state.selection.filter((id) =>
      next.entities.some((e) => e.id === id),
    ),
    canUndo: past.length > 0,
    canRedo: false,
    error: "",
    preview: null,
  });
  update({ events: event(label, type) });
  scheduleSave();
}
function save(): Promise<void> {
  clearTimeout(timer);
  if (activeSave) {
    pending = true;
    return activeSave;
  }
  activeSave = (async () => {
    do {
      pending = false;
      const workspace = state.workspace;
      update({ status: "Saving…" });
      try {
        const res = await fetch("/api/workspace", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspace, expectedVersion: serverVersion }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Save failed");
        serverVersion = data.version;
        if (state.workspace !== workspace) pending = true;
        backup();
        update({ status: pending ? "Saving…" : "Saved locally" });
      } catch (error) {
        pending = false;
        update({
          status: backup() ? "Recovery copy saved" : "Unsaved · export your project",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } while (pending);
  })().finally(() => {
    activeSave = null;
  });
  return activeSave;
}
export const studio = {
  get: () => state,
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  async load() {
    const copies = readRecoveries();
    const local = copies[0];
    try {
      const r = await fetch("/api/workspace");
      if (!r.ok) throw new Error("Local project service unavailable.");
      const data = await r.json();
      serverVersion = data.version ?? 0;
      let workspace = data.workspace
        ? validateWorkspace(data.workspace)
        : state.workspace;
      let recovered = false;
      let conflict = false;
      if (local && local.at > (data.updatedAt ?? 0)) {
        if (local.serverVersion === serverVersion && copies.filter(c => c.at > (data.updatedAt ?? 0) && JSON.stringify(c.workspace) !== JSON.stringify(workspace)).length === 1) {
          workspace = validateWorkspace(local.workspace);
          recovered = true;
        } else if (
          JSON.stringify(local.workspace) !== JSON.stringify(workspace)
        ) {
          conflict = true;
        }
      }
      update({
        workspace,
        loaded: true,
        status: recovered
          ? "Recovered unsynced edits"
          : data.workspace
            ? "Saved locally"
            : "New workspace",
        error: conflict
          ? "Another window saved newer changes. Its version is open; your separate recovery copy is available in Export."
          : "",
      });
      if (recovered || !data.workspace) scheduleSave();
    } catch (error) {
      if (local) {
        try {
          update({ workspace: validateWorkspace(local.workspace) });
        } catch {}
      }
      update({
        loaded: true,
        status: local ? "Browser recovery only" : "Unsaved · project service unavailable",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
  execute(command: Command, label: string = command.type) {
    if (gestureBase) this.cancelGesture();
    try {
      replaceDocument(
        applyCommand(state.workspace.document, command),
        label,
        command.type,
      );
    } catch (error) {
      update({ error: error instanceof Error ? error.message : String(error) });
    }
  },
  batch(commands: Command[], label: string) {
    if (gestureBase) this.cancelGesture();
    try {
      let next = state.workspace.document;
      for (const command of commands) next = applyCommand(next, command);
      if (next !== state.workspace.document)
        next = { ...next, revision: state.workspace.document.revision + 1 };
      replaceDocument(next, label, "batch");
    } catch (error) {
      update({ error: error instanceof Error ? error.message : String(error) });
    }
  },
  select(ids: string[]) {
    update({
      ...(ids[0] && ids[0] !== state.selection[0] ? { clockId: entityClockId(state.workspace.document, state.workspace.document.entities.find(e => e.id === ids[0])) } : {}),
      selection: ids.filter((id) =>
        state.workspace.document.entities.some((e) => e.id === id),
      ),
      error: "",
    });
  },
  session(
    patch: Partial<
      Pick<
        State,
        "profileId" | "playhead" | "playing" | "tab" | "zoom" | "signals" | "clockId" | "editMode"
      >
    >,
  ) {
    if (patch.profileId && gestureBase) this.cancelGesture();
    update(patch);
  },
  clearError() {
    update({ error: "" });
  },
  fail(error: string) {
    update({ error });
  },
  undo() {
    if (gestureBase) {
      this.cancelGesture();
      return;
    }
    const previous = past.pop();
    if (!previous) return;
    future.push(historyEntry(!!previous.workspace));
    update({
      workspace: {
        ...(previous.workspace ?? state.workspace),
        workingParentTakeId: previous.parentId,
        document: {
          ...previous.document,
          revision: state.workspace.document.revision + 1,
        },
      },
      canUndo: past.length > 0,
      canRedo: true,
      events: event("Undo", "undo"),
    });
    scheduleSave();
  },
  redo() {
    if (gestureBase) {
      this.cancelGesture();
      return;
    }
    const next = future.pop();
    if (!next) return;
    past.push(historyEntry(!!next.workspace));
    update({
      workspace: {
        ...(next.workspace ?? state.workspace),
        workingParentTakeId: next.parentId,
        document: {
          ...next.document,
          revision: state.workspace.document.revision + 1,
        },
      },
      canUndo: true,
      canRedo: future.length > 0,
      events: event("Redo", "redo"),
    });
    scheduleSave();
  },
  hasGesture: () => gestureBase !== null,
  beginGesture() {
    gestureBase = clone(state.workspace.document);
    update({ playing: false });
  },
  previewGesture(patches: { id: string; values: Props; scope: string }[]) {
    if (!gestureBase) return;
    try {
      let doc = gestureBase;
      for (const p of patches) doc = applyCommand(doc, { type: "patch", ...p });
      update({ preview: doc });
    } catch (error) {
      update({ error: String(error) });
    }
  },
  previewCommands(commands: Command[]) {
    if (!gestureBase) return;
    try {
      let d = gestureBase;
      for (const c of commands) d = applyCommand(d, c);
      update({ preview: d });
    } catch (e) {
      update({ error: String(e) });
    }
  },
  commitGesture(label = "Transform selection") {
    const base = gestureBase,
      preview = state.preview;
    gestureBase = null;
    if (!base || !preview) {
      update({ preview: null });
      return;
    }
    const a = clone(base),
      b = clone(preview);
    a.revision = 0;
    b.revision = 0;
    if (JSON.stringify(a) === JSON.stringify(b)) {
      update({ preview: null });
      return;
    }
    replaceDocument(
      { ...preview, revision: state.workspace.document.revision + 1 },
      label,
      "gesture",
    );
  },
  cancelGesture() {
    gestureBase = null;
    update({ preview: null });
  },
  take(name: string) {
    const take: Take = {
      id: uid("take"),
      name: name.trim() || `Take ${state.workspace.takes.length + 1}`,
      createdAt: new Date().toISOString(),
      parentId: state.workspace.workingParentTakeId,
      document: clone(state.workspace.document),
    };
    update({
      workspace: {
        ...state.workspace,
        takes: [...state.workspace.takes, take],
        workingParentTakeId: take.id,
      },
    });
    scheduleSave();
    return take;
  },
  restore(take: Take) {
    this.cancelGesture();
    replaceDocument(
      {
        ...clone(take.document),
        revision: state.workspace.document.revision + 1,
      },
      `Restore ${take.name}`,
      "restore",
    );
    update({ workspace: { ...state.workspace, workingParentTakeId: take.id } });
    scheduleSave();
  },
  acceptTake(id: string) {
    if (!state.workspace.takes.some((t) => t.id === id)) return;
    update({ workspace: { ...state.workspace, acceptedTakeId: id } });
    scheduleSave();
  },
  episode(
    note: string,
    tag: string,
    geometry: unknown[],
    probes: unknown[] = [],
  ) {
    this.cancelGesture();
    const ep: Episode = {
      id: uid("episode"),
      createdAt: new Date().toISOString(),
      document: clone(state.preview ?? state.workspace.document),
      profileId: state.profileId,
      playhead: state.playhead,
      selection: [...state.selection],
      signals: clone(state.signals),
      note,
      tag,
      events: clone(state.events),
      geometry,
      probes,
      environment: {
        userAgent: navigator.userAgent,
        viewport: [innerWidth, innerHeight],
        dpr: devicePixelRatio,
        implementation: INSTRUMENT_VERSION,
        capture: "targeted-dom-geometry",
        timeOrigin: performance.timeOrigin,
      },
      capture: {
        still: "unavailable — no pixel capture performed",
        originalVideo: "not-recorded",
        replay: "document-and-controlled-time",
      },
    };
    update({
      workspace: {
        ...state.workspace,
        episodes: [...state.workspace.episodes, ep],
      },
    });
    scheduleSave();
    return ep;
  },
  importWorkspace(data: unknown) {
    try {
      const w = validateWorkspace(data);
      past.push(historyEntry(true));
      future = [];
      update({
        workspace: {
          ...w,
          document: {
            ...w.document,
            revision: state.workspace.document.revision + 1,
          },
        },
        selection: [],
        preview: null,
        playing: false,
        canUndo: true,
        canRedo: false,
        error: "",
      });
      scheduleSave();
    } catch (error) {
      update({ error: error instanceof Error ? error.message : String(error) });
    }
  },
  reset() {
    replaceDocument(
      { ...seedDocument(), revision: state.workspace.document.revision + 1 },
      "Open starter composition",
      "reset",
    );
  },
  save,
};
export const useStudio = () =>
  useSyncExternalStore(studio.subscribe, studio.get);
