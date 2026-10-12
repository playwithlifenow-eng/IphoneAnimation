// Codex transport adapter only. Repository/package policy remains in core.mts:guard.
import { readFileSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { guard, fileHash, canonical } from './core.mts';
import type { Project } from './core.mts';

const here = dirname(fileURLToPath(import.meta.url));
const receiptId = randomUUID();
const receipts = resolve(here, '../test-results/ig-hook/receipts');
const receipt: Record<string, unknown> = {
  schema: 1, receiptId, at: new Date().toISOString(), pid: process.pid,
  adapter: 'studio/ig/codex-pre-tool-use.mts', guard: 'studio/ig/core.mts#guard',
};
let denied = false;
let reason = '';
let updatedCommand: string | undefined;
try {
  const input = JSON.parse(readFileSync(0, 'utf8').replace(/^\uFEFF/, ''));
  receipt.input = input;
  if (input.hook_event_name !== 'PreToolUse' || input.tool_name !== 'Bash')
    throw Error('INVALID_HOOK_EVENT: expected PreToolUse/Bash');
  receipt.guardSha256 = fileHash(resolve(here, 'core.mts'));
  receipt.adapterSha256 = fileHash(fileURLToPath(import.meta.url));
  // Use the same authoritative registry row as IG START/STATUS, read-only.
  const dbPath = resolve(process.env.LOCALAPPDATA!, 'iGlass/IG/operations.sqlite');
  const db = new DatabaseSync(dbPath, { readOnly: true });
  let project: Project;
  try {
    const row = db.prepare('SELECT manifest FROM projects WHERE alias=?').get('POSE') as { manifest: string } | undefined;
    if (!row) throw Error('POSE_NOT_REGISTERED');
    project = JSON.parse(row.manifest);
  } finally { db.close(); }
  receipt.registry = dbPath;
  receipt.projectId = project.id;
  if (process.platform !== 'win32' || process.versions.node.split('.')[0] !== '24' || canonical(process.execPath) !== canonical(project.node))
    throw Error('RUNTIME_MISMATCH: hook requires the registered Windows Node 24');
  receipt.runtime = { version: process.version, executable: process.execPath };
  const command = input.tool_input?.command;
  if (typeof command !== 'string' || !command.trim()) throw Error('MISSING_SHELL_COMMAND');
  let cwd = input.tool_input?.workdir ?? input.tool_input?.cwd ?? input.cwd;
  if (typeof cwd !== 'string' || !cwd) throw Error('MISSING_TOOL_CWD');
  // A root-based chat can explicitly select Studio before doing any work.
  // Only a literal, leading Set-Location statement qualifies; the same guard
  // still decides whether that target is the registered package.
  const leadingLocation = /^\s*Set-Location\s+-LiteralPath\s+'((?:[^']|'')+)'\s*;/i.exec(command);
  if (leadingLocation) cwd = resolve(cwd, leadingLocation[1].replaceAll("''", "'"));
  const commandBody = leadingLocation ? command.slice(leadingLocation[0].length) : command;
  receipt.effectiveCwd = cwd;
  receipt.guardInvoked = true;
  const state = guard(project, cwd);
  // The Windows Bash hook payload omits exec_command.workdir. Never treat the
  // session cwd as proof of the tool cwd: bind execution to the checked directory.
  // Direct directory overrides also go through the existing guard, not a copy.
  // This conservative syntax adapter does not claim to interpret arbitrary scripts.
  const redirects = /(?:\b(?:cd|chdir|sl|pushd|Set-Location|Push-Location)\s+(?:(?:-LiteralPath|-Path)\s+)?|\bgit(?:\.exe)?\s+(?:[^;|&\r\n]*?\s)?-C\s+|\b(?:npm|npx|pnpm|yarn)(?:\.cmd|\.exe)?\s+(?:[^;|&\r\n]*?\s)?(?:--prefix|--cwd|--dir|-C)(?:\s+|=))('(?:[^']|'')*'|"[^"]*"|[^\s;|&]+)/gi;
  const checkedTargets: string[] = [cwd];
  receipt.checkedTargets = checkedTargets;
  for (const match of commandBody.matchAll(redirects)) {
    const literal = match[1];
    if (/[$`]/.test(literal)) throw Error('DYNAMIC_TARGET: use a literal directory so the IG guard can check it');
    const path = literal.startsWith("'") ? literal.slice(1, -1).replaceAll("''", "'")
      : literal.startsWith('"') ? literal.slice(1, -1) : literal;
    const target = resolve(cwd, path);
    checkedTargets.push(target);
    receipt.checkedTargets = checkedTargets;
    guard(project, target);
  }
  // Preserve the on-disk Windows casing: Codex hook trust keys are case-sensitive.
  const boundCwd = realpathSync.native(cwd);
  const boundScript = `$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue'; Set-Location -LiteralPath '${boundCwd.replaceAll("'", "''")}';\n${commandBody}`;
  updatedCommand = `powershell.exe -NoLogo -NoProfile -NonInteractive -EncodedCommand ${Buffer.from(boundScript, 'utf16le').toString('base64')}`;
  receipt.executionBinding = { cwd: boundCwd, shell: 'Windows PowerShell', reason: 'Codex Bash input omits per-tool workdir' };
  receipt.observed = { root: state.root, studio: state.studio, commonDir: state.commonDir,
    remote: state.remote, branch: state.branch, packageName: state.packageName,
    commit: state.commit, manifestHash: state.manifestHash, lockHash: state.lockHash };
  reason = 'Existing IG repository/package guard passed';
} catch (error) {
  denied = true;
  reason = error instanceof Error ? error.message : String(error);
}
receipt.decision = denied ? 'deny' : 'allow';
receipt.reason = reason;
try {
  mkdirSync(receipts, { recursive: true });
  writeFileSync(resolve(receipts, `${receiptId}.json`), JSON.stringify(receipt, null, 2), { flag: 'wx' });
} catch (error) {
  denied = true;
  reason = `HOOK_EVIDENCE_WRITE_FAILED: ${String(error)}`;
}
console.log(JSON.stringify({ hookSpecificOutput: {
  hookEventName: 'PreToolUse',
  ...(denied ? { permissionDecision: 'deny', permissionDecisionReason: `IG guard: ${reason} [receipt ${receiptId}]` }
    : { permissionDecision: 'allow', updatedInput: { command: updatedCommand }, additionalContext: `IG guard passed [receipt ${receiptId}]` }),
} }));
