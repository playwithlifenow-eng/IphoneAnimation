import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { seedDocument } from "../src/seed";
const memory = new Map<string, string>();
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  memory.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => memory.set(k, v),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ version: 0, workspace: null }),
    })),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("editing transactions", () => {
  it("branches Takes from the restored ancestor and restores lineage with undo", async () => {
    const { studio } = await import("../src/store");
    await studio.load();
    const a = studio.take("A");
    studio.execute({
      type: "patch",
      id: "headline",
      scope: "base",
      values: { x: 100 },
    });
    const b = studio.take("B");
    studio.restore(a);
    const c = studio.take("C");
    expect(c.parentId).toBe(a.id);
    studio.undo();
    expect(studio.get().workspace.workingParentTakeId).toBe(b.id);
    expect(studio.get().workspace.takes).toHaveLength(3);
  });
  it("can undo a whole project import without losing prior Takes", async () => {
    const { studio } = await import("../src/store");
    await studio.load();
    const original = studio.take("Keep me");
    studio.importWorkspace({
      version: 1,
      document: { ...seedDocument(), name: "Imported" },
      takes: [],
      episodes: [],
    });
    expect(studio.get().workspace.takes).toHaveLength(0);
    studio.undo();
    expect(studio.get().workspace.takes[0].id).toBe(original.id);
    expect(studio.get().workspace.document.name).not.toBe("Imported");
    studio.redo();
    expect(studio.get().workspace.document.name).toBe("Imported");
    expect(studio.get().workspace.takes).toHaveLength(0);
  });

  it("awaits the newest state when saves overlap", async () => {
    const { studio } = await import("../src/store");
    await studio.load();
    const replies: ((r: unknown) => void)[] = [];
    const sent: any[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: { body: string }) => {
        sent.push(JSON.parse(init.body));
        return new Promise((resolve) => replies.push(resolve));
      }),
    );
    const first = studio.save();
    studio.execute({
      type: "patch",
      id: "headline",
      scope: "base",
      values: { x: 310 },
    });
    const second = studio.save();
    expect(first).toBe(second);
    replies[0]({ ok: true, json: async () => ({ version: 1 }) });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(sent).toHaveLength(2);
    expect(sent[1].expectedVersion).toBe(1);
    expect(
      sent[1].workspace.document.entities.find((e: any) => e.id === "headline")
        .props.x,
    ).toBe(310);
    replies[1]({ ok: true, json: async () => ({ version: 2 }) });
    await Promise.all([first, second]);
    expect(studio.get().status).toBe("Saved locally");
    expect(
      JSON.parse(memory.get("iglass-studio-recovery")!).serverVersion,
    ).toBe(2);
  });

  it("commits a whole pointer gesture once and discards a cancelled gesture", async () => {
    const { studio } = await import("../src/store");
    await studio.load();
    studio.beginGesture();
    studio.previewGesture([
      { id: "headline", scope: "base", values: { x: 100 } },
    ]);
    studio.previewGesture([
      { id: "headline", scope: "base", values: { x: 130 } },
    ]);
    expect(
      studio.get().workspace.document.entities.find((e) => e.id === "headline")!
        .props.x,
    ).toBe(78);
    studio.commitGesture();
    expect(studio.get().workspace.document.revision).toBe(1);
    studio.undo();
    expect(
      studio.get().workspace.document.entities.find((e) => e.id === "headline")!
        .props.x,
    ).toBe(78);
    expect(studio.get().canUndo).toBe(false);
    studio.redo();
    studio.beginGesture();
    studio.previewGesture([
      { id: "headline", scope: "base", values: { x: 250 } },
    ]);
    studio.cancelGesture();
    expect(
      studio.get().workspace.document.entities.find((e) => e.id === "headline")!
        .props.x,
    ).toBe(130);
    expect(studio.get().preview).toBeNull();
  });
  it("retains Takes independently of later editing and can undo their restoration", async () => {
    const { studio } = await import("../src/store");
    await studio.load();
    const take = studio.take("first");
    studio.execute({
      type: "patch",
      id: "headline",
      scope: "base",
      values: { x: 250 },
    });
    expect(
      take.document.entities.find((e) => e.id === "headline")!.props.x,
    ).toBe(78);
    studio.restore(take);
    expect(
      studio.get().workspace.document.entities.find((e) => e.id === "headline")!
        .props.x,
    ).toBe(78);
    studio.undo();
    expect(
      studio.get().workspace.document.entities.find((e) => e.id === "headline")!
        .props.x,
    ).toBe(250);
  });
  it("never silently replays a stale recovery over another writer", async () => {
    const { studio } = await import("../src/store");
    const document = seedDocument();
    document.name = "Newer server work";
    const workspace = { version: 1, document, takes: [], episodes: [] };
    memory.set(
      "iglass-studio-recovery",
      JSON.stringify({
        workspace: {
          ...workspace,
          document: { ...document, name: "Local unsynced" },
        },
        at: 300,
        serverVersion: 1,
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ version: 2, workspace, updatedAt: 200 }),
      })),
    );
    await studio.load();
    expect(studio.get().workspace.document.name).toBe("Newer server work");
    expect(studio.get().error).toContain("separate recovery");
    expect(
      JSON.parse(memory.get("iglass-studio-conflicted-recovery")!).document
        .name,
    ).toBe("Local unsynced");
  });
});
