import { validateWorkspace, type Workspace } from "./model";
export interface Recovery { id: string; workspace: Workspace; at: number; serverVersion?: number }
const prefix = "iglass-studio-recovery:";
/** Each tab writes only its own slot. Other tabs and legacy copies remain untouched. */
export function writeRecovery(id: string, workspace: Workspace, serverVersion: number): boolean {
  try { localStorage.setItem(prefix + id, JSON.stringify({ workspace, at: Date.now(), serverVersion })); return true; }
  catch { return false; }
}
export function readRecoveries(): Recovery[] {
  const copies: Recovery[] = [];
  try {
    const keys = ["iglass-studio-recovery", "iglass-studio-conflicted-recovery"];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    for (const id of keys) try {
      const raw = localStorage.getItem(id);
      if (!raw) continue;
      const data = JSON.parse(raw);
      const workspace = validateWorkspace(data.workspace ?? data);
      copies.push({ id, workspace, at: data.at ?? 0, serverVersion: data.serverVersion });
    } catch { /* One corrupt copy must not hide intact copies. */ }
  } catch { /* Browser may deny all local storage. */ }
  return copies.sort((a, b) => b.at - a.at);
}
