import { mkdirSync, existsSync, openSync, closeSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { openStore, writerLock } from './store.mts';
import { json, guard, dependencies, canonical, implementationHash, listeners, response, powershell } from './core.mts';
import type { Project } from './core.mts';
const args = process.argv.slice(2);
const option = (name: string) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const dataDir = resolve(option('--data') ?? resolve(process.env.LOCALAPPDATA ?? '.', 'iGlass/IG'));
const dbPath = resolve(dataDir, 'operations.sqlite');
const now = () => new Date().toISOString();
const pause = (n: number) => new Promise(ok => setTimeout(ok, n));
function runtime(p: Project) {
  if (process.platform !== 'win32' || process.versions.node.split('.')[0] !== '24' || canonical(process.execPath) !== canonical(p.node))
    throw Error(`RUNTIME_MISMATCH: registered Windows Node 24 at ${p.node}; observed ${process.version} at ${process.execPath}`);
  return `${process.version} | ${process.execPath} | SQLite ${process.versions.sqlite}`;
}
async function service(p: Project, state: ReturnType<typeof guard>) {
  const owners = listeners(p.port), url = `http://127.0.0.1:${p.port}`;
  if (!owners.length) return { state: 'stopped', health: 'not running', identity: null, owners, url };
  try {
    const identity = await (await response(`${url}/api/ig/identity`)).json() as any;
    const expected = { app: p.packageName, schema: 1, root: state.root, studio: state.studio, commonDir: state.commonDir,
      remote: p.remote, branch: p.branch, commit: state.commit, manifestHash: state.manifestHash, lockHash: state.lockHash,
      implementationHash: implementationHash(p.studio), node: process.version };
    for (const [key, value] of Object.entries(expected)) if (identity[key] !== value) throw Error(`identity mismatch: ${key}`);
    if (owners.length !== 1 || owners[0] !== identity.pid || canonical(identity.executable) !== canonical(p.node)) throw Error('listener PID/runtime mismatch');
    const html = await (await response(url)).text();
    if (!html.includes('/src/main.tsx') || !html.includes('id="root"')) throw Error('Pose editor entry missing');
    const entry = await (await response(`${url}/src/main.tsx`)).text();
    if (!entry.includes('createRoot')) throw Error('Pose editor entry failed transformation');
    const workspace = await (await response(`${url}/api/workspace`)).json() as any;
    if (!Number.isInteger(workspace.version) || !Object.hasOwn(workspace, 'workspace')) throw Error('Pose persistence health failed');
    return { state: 'ready', health: 'identity + PID + editor entry + workspace API verified', identity, owners, url };
  } catch (e) { return { state: 'conflict', health: (e as Error).message, identity: null, owners, url }; }
}
async function inspect(p: Project) {
  const state = guard(p), run = runtime(p), deps = dependencies(p.studio), svc = await service(p, state);
  const blockers = [...(deps.state === 'current' ? [] : [`DEPENDENCIES_${deps.state.toUpperCase()}: ${deps.reason}; repair explicitly from registered studio`]),
    ...(svc.state === 'conflict' ? [`PORT_CONFLICT: ${p.port}; PID ${svc.owners.join(',')}; ${svc.health}; nothing killed`] : [])];
  return { projectId: p.id, ...state, runtime: run, dependencies: deps, service: svc, checkedAt: now(), blockers };
}
function display(s: any, last: string | null) {
  if (args.includes('--json')) return console.log(JSON.stringify({ ...s, lastVerified: last }, null, 2));
  console.log(`POSE\nrepo: ${s.root}\nworktree: ${s.root}\nstudio: ${s.studio}\nbranch: ${s.branch}\ncommit: ${s.commit}\ndirty: ${s.dirty ? s.dirty.split('\n').length + ' entries (preserved)' : 'clean'}\nruntime: ${s.runtime}\ndependencies: ${s.dependencies.state}\nservice: ${s.service.state}\nport: ${s.service.url}\napp identity: ${s.service.identity?.app ?? 'unverified'}${s.service.identity ? ' / PID ' + s.service.identity.pid : ''}\nhealth: ${s.service.health}\nlast verified: ${last ?? 'none'}\nchecked now: ${s.checkedAt}\nblockers: ${s.blockers.join('; ') || 'none'}`);
}
async function main() {
  const command = args[0]?.toUpperCase();
  if (!['STATUS', 'START', 'REGISTER', 'EVIDENCE'].includes(command)) throw Error('Usage: IG STATUS [--json] | IG START POSE [--no-open] | IG EVIDENCE');
  if (command === 'START' && args[1]?.toUpperCase() !== 'POSE') throw Error('UNKNOWN_PROJECT: use IG START POSE');
  if (command === 'STATUS' || command === 'EVIDENCE') {
    if (!existsSync(dbPath)) throw Error('NOT_REGISTERED: run the IG installer once');
    const db = openStore(dbPath, true);
    try {
      if (command === 'EVIDENCE') { console.log(JSON.stringify({ tasks: db.prepare('SELECT * FROM tasks ORDER BY started_at DESC LIMIT 20').all(), events: db.prepare('SELECT * FROM events ORDER BY seq DESC LIMIT 100').all() }, null, 2)); return; }
      const row = db.prepare('SELECT manifest FROM projects WHERE alias=?').get('POSE') as any;
      if (!row) throw Error('POSE_NOT_REGISTERED');
      const last = db.prepare('SELECT verified_at FROM observations WHERE project_id=?').get(JSON.parse(row.manifest).id) as any;
      const s = await inspect(JSON.parse(row.manifest)); display(s, last?.verified_at ?? null);
      if (s.blockers.length) process.exitCode = 2;
    } finally { db.close(); }
    return;
  }
  mkdirSync(dataDir, { recursive: true });
  const unlock = await writerLock(realpathSync.native(dataDir));
  const db = openStore(dbPath);
  let taskId: string | undefined;
  const event = (kind: string, evidence: unknown) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const r = db.prepare('INSERT INTO events(task_id,at,kind,evidence) VALUES(?,?,?,?)').run(taskId ?? null, now(), kind, JSON.stringify(evidence));
      db.prepare('INSERT INTO outbox(event_seq) VALUES(?)').run(r.lastInsertRowid); db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  };
  try {
    if (command === 'REGISTER') {
      const path = option('--manifest'); if (!path) throw Error('REGISTER_REQUIRES_MANIFEST');
      const p = json(resolve(path)) as Project; guard(p); runtime(p);
      if (p.alias !== 'POSE' || !p.id || !Number.isInteger(p.port)) throw Error('INVALID_REGISTRATION');
      const old = db.prepare('SELECT manifest FROM projects WHERE alias=?').get(p.alias) as any;
      if (old && old.manifest !== JSON.stringify(p)) throw Error('ALREADY_REGISTERED_DIFFERENT_TARGET: explicit migration required');
      db.prepare('INSERT OR IGNORE INTO projects VALUES(?,?,?)').run(p.id, p.alias, JSON.stringify(p));
      event('project.registered', p); console.log('POSE registered: ' + p.studio); return;
    }
    const row = db.prepare('SELECT manifest FROM projects WHERE alias=?').get('POSE') as any;
    if (!row) throw Error('POSE_NOT_REGISTERED');
    const p = JSON.parse(row.manifest) as Project;
    // Mutex ownership proves any unfinished previous runner is no longer active.
    db.prepare("UPDATE tasks SET outcome='interrupted',finished_at=? WHERE outcome='running'").run(now());
    taskId = randomUUID();
    db.prepare('INSERT INTO tasks(id,project_id,command,started_at,outcome) VALUES(?,?,?,?,?)').run(taskId, p.id, 'START POSE', now(), 'running');
    event('command.received', { callerCwd: process.cwd(), boundCwd: p.studio, projectId: p.id });
    let s = await inspect(p); event('preflight', s);
    if (s.blockers.length) throw Error(s.blockers.join('; '));
    db.prepare('INSERT OR REPLACE INTO dependency_receipts VALUES(?,?,?)').run(p.id, now(), JSON.stringify({ manifestHash: s.manifestHash, lockHash: s.lockHash, runtime: s.runtime, result: s.dependencies }));
    let action = 'reused';
    if (s.service.state === 'stopped') {
      const previous = db.prepare('SELECT * FROM services WHERE project_id=?').get(p.id) as any;
      if (previous && Date.now() - Date.parse(previous.intent_at) < 30000) {
        event('reconcile.pending-start', previous);
        await pause(Math.max(0, 30000 - (Date.now() - Date.parse(previous.intent_at))));
        s = await inspect(p);
        if (s.blockers.length) throw Error(s.blockers.join('; '));
      }
      if (s.service.state === 'stopped') {
        const before = guard(p); // immediately before starting a process capable of local file writes
        if (before.manifestHash !== s.manifestHash || before.lockHash !== s.lockHash) throw Error('TARGET_CHANGED_DURING_PREFLIGHT');
        const token = randomUUID();
        db.prepare('INSERT OR REPLACE INTO services(project_id,token,intent_at) VALUES(?,?,?)').run(p.id, token, now());
        event('service.start-intent', { token, cwd: p.studio, executable: p.node, port: p.port });
        const log = resolve(dataDir, `service-${token}.log`), fd = openSync(log, 'a');
        let child;
        try { child = spawn(p.node, [resolve(p.studio, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(p.port), '--strictPort'],
          { cwd: p.studio, detached: true, windowsHide: true, stdio: ['ignore', fd, fd], env: { ...process.env, STUDIO_DATA_DIR: resolve(p.studio, '.studio-data'), IG_START_TOKEN: token } });
          await new Promise<void>((ok, fail) => { child!.once('spawn', ok); child!.once('error', fail); });
          child.unref();
        } finally { closeSync(fd); }
        db.prepare('UPDATE services SET pid=? WHERE project_id=?').run(child!.pid!, p.id);
        event('service.spawned', { pid: child!.pid, token, log }); action = 'started';
        const deadline = Date.now() + 45000;
        do {
          await pause(500); s.service = await service(p, guard(p));
          if (s.service.state === 'ready') break;
        } while (Date.now() < deadline);
        if (s.service.state !== 'ready') throw Error(`START_FAILED: ${s.service.health}; inspect ${log}; no unrelated process stopped`);
        if (s.service.identity.token !== token) throw Error('START_INSTANCE_MISMATCH');
      }
    }
    s.checkedAt = now();
    const identity = s.service.identity;
    db.prepare('UPDATE services SET pid=?,identity=? WHERE project_id=?').run(identity.pid, JSON.stringify(identity), p.id);
    db.prepare('INSERT OR REPLACE INTO observations VALUES(?,?,?)').run(p.id, now(), JSON.stringify(s));
    event('service.verified', { action, ...s.service });
    let browser = 'skipped (--no-open)';
    if (!args.includes('--no-open')) {
      try { powershell(`Start-Process '${s.service.url}' -ErrorAction Stop`); browser = 'default browser open requested'; }
      catch (e) { browser = 'OPEN_FAILED: ' + (e as Error).message; }
      event('browser.open', { url: s.service.url, result: browser });
    }
    const receipt = { taskId, projectId: p.id, action, url: s.service.url, pid: identity.pid, instance: identity.instance, branch: s.branch, commit: s.commit, dirty: Boolean(s.dirty), runtime: s.runtime, dependencies: s.dependencies.state, browser, verifiedAt: now() };
    db.prepare('UPDATE tasks SET finished_at=?,outcome=?,receipt=? WHERE id=?').run(now(), browser.startsWith('OPEN_FAILED') ? 'partial' : 'succeeded', JSON.stringify(receipt), taskId);
    event('command.completed', receipt);
    console.log(args.includes('--json') ? JSON.stringify(receipt, null, 2) : `POSE ready | ${action} PID ${identity.pid} | ${p.branch} | dependencies current | ${s.service.url}\n${browser} | receipt ${taskId}`);
    if (browser.startsWith('OPEN_FAILED')) process.exitCode = 2;
  } catch (e) {
    event('command.failed', { error: (e as Error).message });
    if (taskId) db.prepare('UPDATE tasks SET finished_at=?,outcome=?,receipt=? WHERE id=?').run(now(), 'blocked', JSON.stringify({ error: (e as Error).message }), taskId);
    throw e;
  } finally { db.close(); await unlock(); }
}
main().catch(e => { console.error('IG: ' + e.message); process.exitCode = 2; });
