import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:net';
import { hash } from './core.mts';
export function openStore(path: string, readOnly = false) {
  const db = new DatabaseSync(path, { readOnly });
  if (!readOnly) {
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, alias TEXT UNIQUE NOT NULL, manifest TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, project_id TEXT REFERENCES projects(id), command TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT, outcome TEXT NOT NULL, receipt TEXT);
      CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY, task_id TEXT REFERENCES tasks(id), at TEXT NOT NULL, kind TEXT NOT NULL, evidence TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS services(project_id TEXT PRIMARY KEY REFERENCES projects(id), token TEXT NOT NULL, intent_at TEXT NOT NULL, pid INTEGER, identity TEXT);
      CREATE TABLE IF NOT EXISTS observations(project_id TEXT PRIMARY KEY REFERENCES projects(id), verified_at TEXT NOT NULL, evidence TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS dependency_receipts(project_id TEXT PRIMARY KEY REFERENCES projects(id), verified_at TEXT NOT NULL, evidence TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS outbox(event_seq INTEGER PRIMARY KEY REFERENCES events(seq), delivered_at TEXT);
      PRAGMA user_version=1;`);
  }
  return db;
}
// OS-owned mutex disappears on process death; no stale lock files or expiring live leases.
export async function writerLock(path: string) {
  const name = `\\\\.\\pipe\\ig-writer-${hash(path.toLowerCase()).slice(0, 24)}`;
  const deadline = Date.now() + 60000;
  while (true) {
    const server = createServer(socket => socket.end());
    try {
      await new Promise<void>((ok, fail) => { server.once('error', fail); server.listen(name, ok); });
      return () => new Promise<void>(ok => server.close(() => ok()));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EADDRINUSE' || Date.now() > deadline) throw Error('IG_BUSY: another controlled writer is active');
      await new Promise(ok => setTimeout(ok, 250));
    }
  }
}
