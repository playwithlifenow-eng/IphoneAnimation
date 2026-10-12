import assert from 'node:assert/strict';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, writeFileSync, readFileSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'playwright';
import { json, guard, repoState, dependencies, fileHash, listeners } from './core.mts';
import { writerLock } from './store.mts';
const here = dirname(fileURLToPath(import.meta.url)), studio = resolve(here, '..'), cli = resolve(here, 'cli.mts');
const data = resolve(process.env.LOCALAPPDATA!, 'iGlass/IG'), dbPath = resolve(data, 'operations.sqlite');
const p = json(resolve(data, 'pose-registration.json'));
const runDir = resolve(studio, 'test-results/ig', new Date().toISOString().replaceAll(':', '-'));
mkdirSync(runDir, { recursive: true });
const results: any[] = [], run = promisify(execFile);
const save = () => writeFileSync(resolve(runDir, 'results.json'), JSON.stringify({ at: new Date().toISOString(), host: process.env.COMPUTERNAME ?? 'Windows target', runDir, results }, null, 2));
const pass = (name: string, evidence: any) => { results.push({ name, passed: true, evidence }); save(); console.log('PASS ' + name); };
async function command(args: string[], cwd = studio, success = true) {
  try { const r = await run(process.execPath, ['--disable-warning=ExperimentalWarning', cli, ...args, '--json'], { cwd, timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
    assert(success, 'expected refusal'); return JSON.parse(r.stdout);
  } catch (e: any) { if (success || !e.code || e.code !== 2) throw e; return { refused: true, message: e.stderr }; }
}
const identity = async () => await (await fetch('http://127.0.0.1:5173/api/ig/identity')).json() as any;
async function stopOwned() {
  const live = await identity(), db = new DatabaseSync(dbPath, { readOnly: true });
  const recorded = db.prepare('SELECT * FROM services WHERE project_id=?').get(p.id) as any; db.close();
  assert.equal(live.token, recorded.token); assert.equal(live.pid, recorded.pid); assert.deepEqual(listeners(5173), [live.pid]);
  // Only this runner's recorded instance, verified immediately before the test stop.
  process.kill(live.pid);
  for (let i = 0; i < 20 && listeners(5173).length; i++) await new Promise(ok => setTimeout(ok, 250));
  assert.deepEqual(listeners(5173), []); return live;
}
try {
  const originalWorkspace = await (await fetch('http://127.0.0.1:5173/api/workspace')).text();
  const before = repoState(studio), manifestHash = fileHash(resolve(studio, 'package.json')), lockHash = fileHash(resolve(studio, 'package-lock.json'));
  await stopOwned();
  const first = await command(['START', 'POSE', '--no-open']); assert.equal(first.action, 'started'); pass('1. correct target, stopped service', first);
  const second = await command(['START', 'POSE', '--no-open']); assert.equal(second.action, 'reused'); assert.equal(second.pid, first.pid); pass('2. already running, reused same PID', second);
  const system = await command(['START', 'POSE', '--no-open'], 'C:/Windows/System32'); assert.equal(system.pid, first.pid);
  assert.throws(() => guard(p, 'C:/Windows/System32'), /WRONG_CWD/); pass('3. System32 resolves to registered target; direct wrong-cwd guard refuses', system);
  assert(existsSync(resolve(p.root, 'package.json'))); const heroBefore = fileHash(resolve(p.root, 'package.json'));
  const other = await command(['START', 'POSE', '--no-open'], p.root); assert.equal(other.pid, first.pid); assert.equal(fileHash(resolve(p.root, 'package.json')), heroBefore);
  assert.throws(() => guard(p, p.root), /WRONG_CWD/); pass('4. another valid npm package cwd (Hero) safely bound; guard refuses raw target', other);
  const conflictDir = resolve(runDir, 'port-conflict'), conflictManifest = resolve(runDir, 'conflict.json');
  const occupied = createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html>Unrelated HTTP 200</html>'); });
  await new Promise<void>(ok => occupied.listen(0, '127.0.0.1', ok));
  const conflictPort = (occupied.address() as any).port;
  writeFileSync(conflictManifest, JSON.stringify({ ...p, id: 'fixture-port-conflict', port: conflictPort }));
  execFileSync(process.execPath, [cli, 'REGISTER', '--data', conflictDir, '--manifest', conflictManifest], { cwd: studio, stdio: 'pipe' });
  try { const refused = await command(['START', 'POSE', '--no-open', '--data', conflictDir], studio, false); assert.match(refused.message, /PORT_CONFLICT/);
    assert.equal(await (await fetch(`http://127.0.0.1:${conflictPort}`)).text(), '<html>Unrelated HTTP 200</html>'); pass('5. unrelated occupied port refused; unrelated service survives', { port: conflictPort, ...refused });
  } finally { await new Promise<void>(ok => occupied.close(() => ok())); }
  assert(before.dirty); assert.equal(repoState(studio).dirty, before.dirty); pass('6. dirty worktree preserved', { before: before.dirty, after: repoState(studio).dirty });
  const fixture = resolve(runDir, 'dependency-fixture'), fixtureStudio = resolve(fixture, 'studio'); mkdirSync(fixtureStudio, { recursive: true });
  for (const f of ['package.json', 'package-lock.json']) copyFileSync(resolve(studio, f), resolve(fixtureStudio, f));
  execFileSync('git', ['init', '-b', p.branch, fixture], { stdio: 'pipe' });
  execFileSync('git', ['-C', fixture, 'remote', 'add', 'origin', p.remote]);
  execFileSync('git', ['-C', fixture, 'add', 'studio/package.json', 'studio/package-lock.json']);
  execFileSync('git', ['-C', fixture, '-c', 'user.name=IG fixture', '-c', 'user.email=fixture@localhost', 'commit', '-m', 'isolated dependency fixture'], { stdio: 'pipe' });
  const fs = repoState(fixtureStudio), fixtureData = resolve(runDir, 'dependency-state'), fixtureManifest = resolve(runDir, 'dependency-registration.json');
  writeFileSync(fixtureManifest, JSON.stringify({ ...p, id: 'fixture-dependencies', root: fs.root, studio: fs.studio, commonDir: fs.commonDir }));
  execFileSync(process.execPath, [cli, 'REGISTER', '--data', fixtureData, '--manifest', fixtureManifest], { cwd: studio, stdio: 'pipe' });
  const missing = await command(['START', 'POSE', '--no-open', '--data', fixtureData], studio, false); assert.match(missing.message, /DEPENDENCIES_MISSING/);
  const staleManifest = json(resolve(fixtureStudio, 'package.json')); staleManifest.dependencies.react = '99.0.0'; writeFileSync(resolve(fixtureStudio, 'package.json'), JSON.stringify(staleManifest));
  const stale = await command(['START', 'POSE', '--no-open', '--data', fixtureData], studio, false); assert.match(stale.message, /DEPENDENCIES_STALE/);
  assert(!existsSync(resolve(fixtureStudio, 'node_modules'))); pass('7. missing and stale dependencies blocked without install', { missing, stale });
  const twin = await Promise.all([command(['START', 'POSE', '--no-open']), command(['START', 'POSE', '--no-open'])]);
  assert(twin.every(r => r.pid === first.pid && r.action === 'reused')); pass('8a. concurrent repeated starts reuse one instance', twin);
  const old = await stopOwned(), restarted = await command(['START', 'POSE', '--no-open']); assert.equal(restarted.action, 'started'); assert.notEqual(restarted.instance, old.instance);
  pass('8b. owned service restart, durable state retained', { previous: { pid: old.pid, instance: old.instance }, restarted });
  const interrupted = spawn(process.execPath, [cli, 'START', 'POSE', '--no-open'], { cwd: studio, windowsHide: true, stdio: 'ignore' });
  let runningId: string | undefined;
  for (let i = 0; i < 50; i++) { await new Promise(ok => setTimeout(ok, 50)); const db = new DatabaseSync(dbPath, { readOnly: true });
    const row = db.prepare("SELECT id FROM tasks WHERE outcome='running'").get() as any; db.close(); if (row) { runningId = row.id; break; } }
  assert(runningId); interrupted.kill(); await new Promise(ok => interrupted.once('exit', ok));
  const recovered = await command(['START', 'POSE', '--no-open']); assert.equal(recovered.pid, restarted.pid);
  const check = new DatabaseSync(dbPath, { readOnly: true }); assert.equal((check.prepare('SELECT outcome FROM tasks WHERE id=?').get(runningId!) as any).outcome, 'interrupted'); check.close();
  pass('8c. runner crash releases mutex; next command reconciles unfinished task', { interruptedTask: runningId, recovered });
  const browser = await chromium.launch({ headless: true, executablePath: resolve(process.env.LOCALAPPDATA!, 'ms-playwright/chromium-1228/chrome-win64/chrome.exe') });
  try { const page = await browser.newPage({ viewport: { width: 1536, height: 864 } }), errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:5173'); await page.getByRole('button', { name: 'Compose', exact: true }).waitFor();
    await page.getByLabel('Parent frame', { exact: true }).waitFor(); assert.equal(await page.locator('vite-error-overlay').count(), 0);
    assert((await page.locator('body').innerText()).includes('Choreography')); assert.equal(await page.title(), 'iGlass Composition Studio');
    const fromBrowser = await page.evaluate(async () => await (await fetch('/api/ig/identity')).json()); assert.equal(fromBrowser.pid, restarted.pid);
    assert.equal(fromBrowser.studio, p.studio); assert.equal(fromBrowser.branch, p.branch); assert.deepEqual(errors, []);
    await page.screenshot({ path: resolve(runDir, 'pose-browser.png') });
    pass('9. rendered browser is intended Pose app; no uncaught errors or Vite overlay', { url: page.url(), title: await page.title(), identity: fromBrowser, errors });
  } finally { await browser.close(); }
  const beforeStatus = new DatabaseSync(dbPath, { readOnly: true }); const eventCount = (beforeStatus.prepare('SELECT count(*) n FROM events').get() as any).n; beforeStatus.close();
  const status = await command(['STATUS']); assert.equal(status.service.state, 'ready');
  const afterStatus = new DatabaseSync(dbPath, { readOnly: true }); assert.equal((afterStatus.prepare('SELECT count(*) n FROM events').get() as any).n, eventCount); afterStatus.close();
  pass('10. STATUS is live and does not append ledger events', status);
  const unlock = await writerLock(data), source = new DatabaseSync(dbPath), backup = resolve(runDir, 'operations-backup.sqlite');
  try { source.exec(`VACUUM INTO '${backup.replaceAll("'", "''")}'`); } finally { source.close(); await unlock(); }
  const restored = new DatabaseSync(backup, { readOnly: true });
  assert.equal((restored.prepare('PRAGMA integrity_check').get() as any).integrity_check, 'ok');
  const taskCount = (restored.prepare('SELECT count(*) n FROM tasks').get() as any).n; assert(taskCount > 8); assert.equal((restored.prepare('SELECT count(*) n FROM events').get() as any).n, eventCount); restored.close();
  pass('11. consistent SQLite snapshot opens independently with registry/tasks/events', { backup, taskCount, eventCount });
  assert.equal(fileHash(resolve(studio, 'package.json')), manifestHash); assert.equal(fileHash(resolve(studio, 'package-lock.json')), lockHash);
  assert.equal(await (await fetch('http://127.0.0.1:5173/api/workspace')).text(), originalWorkspace);
  pass('12. package files and actual saved workspace unchanged', { manifestHash, lockHash });
  writeFileSync(resolve(studio, 'test-results/ig/latest.json'), JSON.stringify({ runDir, passed: results.length }, null, 2));
  console.log(`VERIFIED ${results.length} checks. Evidence: ${runDir}`);
} catch (e) { results.push({ passed: false, error: (e as Error).stack }); save(); console.error(e); process.exitCode = 1; }
