import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
export type Project = { id: string; alias: string; root: string; studio: string; commonDir: string; remote: string; branch: string; packageName: string; port: number; node: string };
export const json = (p: string) => JSON.parse(readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
export const hash = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
export const fileHash = (p: string) => hash(readFileSync(p));
export const canonical = (p: string) => realpathSync.native(p).replaceAll('\\', '/').toLowerCase();
export function git(cwd: string, ...args: string[]) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, timeout: 10000 }).trim();
}
export function repoState(studio: string) {
  const root = git(studio, 'rev-parse', '--show-toplevel');
  return { root: canonical(root), studio: canonical(studio), commonDir: canonical(resolve(studio, git(studio, 'rev-parse', '--git-common-dir'))),
    remote: git(root, 'remote', 'get-url', 'origin'), branch: git(root, 'branch', '--show-current'), commit: git(root, 'rev-parse', 'HEAD'),
    dirty: git(root, 'status', '--porcelain=v1'), packageName: json(resolve(studio, 'package.json')).name,
    manifestHash: fileHash(resolve(studio, 'package.json')), lockHash: fileHash(resolve(studio, 'package-lock.json')) };
}
export function guard(p: Project, cwd = p.studio) {
  if (canonical(cwd) !== canonical(p.studio)) throw Error(`WRONG_CWD: expected ${p.studio}; received ${cwd}`);
  const s = repoState(cwd);
  for (const key of ['root', 'studio', 'commonDir'] as const)
    if (s[key] !== canonical(p[key])) throw Error(`WRONG_REPOSITORY: ${key} does not match registered POSE`);
  for (const key of ['remote', 'branch', 'packageName'] as const)
    if (s[key] !== p[key]) throw Error(`WRONG_TARGET: ${key} expected ${p[key]}; observed ${s[key]}`);
  if (canonical(resolve(p.root, 'studio')) !== canonical(p.studio)) throw Error('WRONG_PACKAGE_PATH');
  const manifest = json(resolve(cwd, 'package.json'));
  if (manifest.scripts?.dev !== 'vite --host 127.0.0.1') throw Error('UNRECOGNISED_START_COMMAND: registered adapter expects vite --host 127.0.0.1');
  return s;
}
export function dependencies(studio: string) {
  try {
    const manifest = json(resolve(studio, 'package.json')), lock = json(resolve(studio, 'package-lock.json'));
    if (lock.name !== manifest.name || lock.lockfileVersion !== 3) throw Error('manifest/lock identity mismatch');
    for (const field of ['dependencies', 'devDependencies'])
      if (JSON.stringify(manifest[field]) !== JSON.stringify(lock.packages[''][field])) throw Error(`manifest/lock ${field} mismatch`);
    if (!existsSync(resolve(studio, 'node_modules/.package-lock.json'))) return { state: 'missing', reason: 'node_modules install metadata missing' };
    const installed = json(resolve(studio, 'node_modules/.package-lock.json'));
    for (const [path, entry] of Object.entries(installed.packages) as [string, any][]) {
      const expected = lock.packages[path];
      if (!expected || expected.version !== entry.version || expected.integrity !== entry.integrity) throw Error(`stale installed lock entry: ${path}`);
      const actual = json(resolve(studio, path, 'package.json'));
      if (actual.version !== expected.version) throw Error(`installed version mismatch: ${path}`);
    }
    for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }))
      if (!installed.packages[`node_modules/${name}`]) throw Error(`missing direct dependency: ${name}`);
    const npm = resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
    execFileSync(process.execPath, [npm, 'ls', '--all', '--json'], { cwd: studio, windowsHide: true, timeout: 30000, maxBuffer: 8 * 1024 * 1024, stdio: 'pipe' });
    execFileSync(process.execPath, ['--input-type=module', '-e', "import esbuild from 'esbuild'; esbuild.transformSync('const n: number = 1', {loader:'ts'});"], { cwd: studio, windowsHide: true, timeout: 10000, stdio: 'pipe' });
    return { state: 'current', reason: 'manifest, lock, installed versions, npm tree and esbuild probe agree' };
  } catch (e) { return { state: 'stale', reason: (e as Error).message.slice(0, 1200) }; }
}
export function implementationHash(studio: string) {
  return hash(['server.ts', 'vite.config.ts', 'ig/core.mts', 'ig/identity.mts'].map(p => p + fileHash(resolve(studio, p))).join('\n'));
}
export function powershell(script: string) {
  return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from("$ProgressPreference='SilentlyContinue'; " + script, 'utf16le').toString('base64')], { encoding: 'utf8', windowsHide: true, timeout: 15000 }).trim();
}
export function listeners(port: number): number[] {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('INVALID_PORT');
  const result = powershell(`$ErrorActionPreference='Stop'; @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object LocalPort -eq ${port} | Select-Object -ExpandProperty OwningProcess -Unique) | ConvertTo-Json -Compress`);
  return result ? [JSON.parse(result)].flat() : [];
}
export async function response(url: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(3000), redirect: 'error' });
  if (!r.ok) throw Error(`HTTP ${r.status}: ${url}`);
  return r;
}
