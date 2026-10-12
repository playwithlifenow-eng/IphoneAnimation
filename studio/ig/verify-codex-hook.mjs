// Real Codex host integration harness. The loopback model fixture emits fixed,
// harmless tool calls; it does not use a remote model or delegate agent work.
import { spawn, execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';

const here = realpathSync.native(dirname(fileURLToPath(import.meta.url))), studio = resolve(here, '..'), root = resolve(studio, '..');
const output = resolve(studio, 'test-results/ig-hook');
mkdirSync(output, { recursive: true });
const codex = execFileSync('where.exe', ['codex'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0];
const mode = process.argv[2] ?? 'inspect';
const host = spawn(codex, ['app-server'], { cwd: root, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
let next = 0;
const pending = new Map();
host.stderr.on('data', () => {});
createInterface({ input: host.stdout }).on('line', line => {
  try { const msg = JSON.parse(line); const p = pending.get(msg.id); if (p) { pending.delete(msg.id); msg.error ? p.reject(Error(JSON.stringify(msg.error))) : p.resolve(msg.result); } } catch {}
});
function rpc(method, params) {
  const id = ++next;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(Error(`RPC timeout: ${method}`)); }, 20000);
    pending.set(id, { resolve: x => { clearTimeout(timer); resolve(x); }, reject: e => { clearTimeout(timer); reject(e); } });
    host.stdin.write(JSON.stringify({ id, method, params }) + '\n');
  });
}
try {
  await rpc('initialize', { clientInfo: { name: 'ig-hook-verification', version: '1.0.0' }, capabilities: { experimentalApi: true } });
  host.stdin.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n');
  let listing = await rpc('hooks/list', { cwds: [root, studio] });
  writeFileSync(resolve(output, 'hooks-list-before.json'), JSON.stringify(listing, null, 2));
  console.log(JSON.stringify(listing.data.map(e => ({ cwd: e.cwd, hooks: e.hooks.map(h => ({ key: h.key, trustStatus: h.trustStatus, currentHash: h.currentHash })), errors: e.errors })), null, 2));
  if (mode === 'test') assert(listing.data.every(e => e.errors.length === 0 && e.hooks.length === 1 && e.hooks[0].enabled && e.hooks[0].trustStatus === 'trusted'), 'The one project hook must be trusted before testing; review its definition with /hooks.');
  if (mode === 'trust') {
    const hooks = listing.data[0].hooks.filter(h => h.source === 'project' && h.eventName === 'preToolUse');
    assert.equal(hooks.length, 1);
    const hook = hooks[0];
    assert.match(hook.command, /codex-pre-tool-use\.mts/);
    const result = await rpc('config/value/write', {
      keyPath: `hooks.state.${JSON.stringify(hook.key)}.trusted_hash`,
      value: hook.currentHash, mergeStrategy: 'upsert',
    });
    writeFileSync(resolve(output, 'hook-trust-write.json'), JSON.stringify(result, null, 2));
    listing = await rpc('hooks/list', { cwds: [root, studio] });
    writeFileSync(resolve(output, 'hooks-list-trusted.json'), JSON.stringify(listing, null, 2));
    assert(listing.data.every(entry => entry.hooks.some(h => h.key === hook.key && h.trustStatus === 'trusted')));
    console.log('Exact installed hook definition trusted.');
  }
} finally { host.kill(); }

if (mode === 'test') {
  const runDir = resolve(output, new Date().toISOString().replaceAll(':', '-'));
  mkdirSync(runDir, { recursive: true });
  const token = `IG_HOOK_${Date.now()}`;
  const marker = resolve(runDir, 'BLOCKED_COMMAND_EXECUTED.txt');
  const calls = [
    { id: 'call_ig_allowed', cmd: `git status --short; Write-Output '${token}_ALLOWED'; (Get-Location).Path`, workdir: root },
    { id: 'call_ig_blocked', cmd: `Set-Location -LiteralPath '${root.replaceAll("'", "''")}'; Set-Content -LiteralPath '${marker.replaceAll("'", "''")}' -Value '${token}_SHOULD_NOT_EXIST'`, workdir: root },
  ];
  const evidence = { token, codex, version: execFileSync(codex, ['--version'], { encoding: 'utf8' }).trim(), calls, requests: [], modelToolOutputs: [], marker };
  let requestCount = 0;
  const server = createServer(async (req, res) => {
    try {
      let body = ''; for await (const chunk of req) body += chunk;
      const request = JSON.parse(body);
      evidence.requests.push({ url: req.url, toolNames: request.tools?.map(t => t.name ?? t.type) });
      for (const item of request.input ?? []) if (item.type === 'function_call_output') evidence.modelToolOutputs.push(item);
      const index = requestCount++;
      const call = calls[index];
      const item = call ? { type: 'function_call', id: `fc_${index}`, call_id: call.id, name: 'exec_command', arguments: JSON.stringify({ cmd: call.cmd, workdir: call.workdir, max_output_tokens: 1000 }) }
        : { type: 'message', id: 'msg_done', role: 'assistant', content: [{ type: 'output_text', text: 'Controlled hook verification finished.' }] };
      const response = { id: `resp_${index}`, object: 'response', status: 'completed', output: [item], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      for (const event of [
        { type: 'response.created', response: { ...response, status: 'in_progress', output: [] } },
        { type: 'response.output_item.added', output_index: 0, item },
        { type: 'response.output_item.done', output_index: 0, item },
        { type: 'response.completed', response },
      ]) res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      res.end();
    } catch (error) { res.writeHead(500); res.end(String(error)); }
  });
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  const port = server.address().port;
  const args = [
    '-c', 'model_provider="ig_hook_fixture"',
    '-c', 'model_providers.ig_hook_fixture.name="IG local deterministic hook fixture"',
    '-c', `model_providers.ig_hook_fixture.base_url="http://127.0.0.1:${port}/v1"`,
    '-c', 'model_providers.ig_hook_fixture.wire_api="responses"',
    '-c', 'model_providers.ig_hook_fixture.requires_openai_auth=false',
    '-c', 'mcp_servers.node_repl.enabled=false', '-c', 'features.apps=false',
    'app-server'];
  evidence.args = args;
  try {
    const child = spawn(codex, args, { cwd: studio, env: { ...process.env, RUST_LOG: 'warn,codex_hooks=trace' }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stderr.on('data', d => { stderr += d; });
    let serial = 0, finish;
    const waiting = new Map(), completed = new Promise(ok => { finish = ok; });
    createInterface({ input: child.stdout }).on('line', line => {
      const message = JSON.parse(line);
      if (message.id != null && waiting.has(message.id)) {
        const callback = waiting.get(message.id); waiting.delete(message.id); callback(message);
      } else {
        // Keep lifecycle evidence; do not persist full model prompts.
        if (/hook|item\/(started|completed)|turn\/(started|completed)|error/.test(message.method ?? '')) stdout += line + '\n';
        if (message.method === 'turn/completed') finish(message.params);
      }
    });
    const request = (method, params) => new Promise((ok, fail) => {
      const id = ++serial;
      waiting.set(id, msg => msg.error ? fail(Error(JSON.stringify(msg.error))) : ok(msg.result));
      child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    });
    const timer = setTimeout(() => { child.kill(); finish({ timedOut: true }); }, 90000);
    try {
      await request('initialize', { clientInfo: { name: 'ig-hook-fixture', version: '1.0.0' }, capabilities: { experimentalApi: true } });
      child.stdin.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n');
      const config = await request('config/read', { cwd: studio, includeLayers: true });
      evidence.effectiveHooks = config.config?.hooks;
      evidence.effectiveFeature = config.config?.features?.hooks;
      const started = await request('thread/start', { cwd: studio, ephemeral: true, approvalPolicy: 'never', sandbox: 'workspace-write', experimentalRawEvents: true });
      evidence.threadId = started.thread.id;
      await request('turn/start', { threadId: started.thread.id, input: [{ type: 'text', text: 'Execute the fixed harmless hook-verification tool calls.', text_elements: [] }] });
      evidence.turn = await completed;
      evidence.exitCode = evidence.turn.turn?.status === 'completed' ? 0 : 1;
    } finally { clearTimeout(timer); child.kill(); }
    writeFileSync(resolve(runDir, 'host-events.jsonl'), stdout);
    writeFileSync(resolve(runDir, 'host-stderr.txt'), stderr);
    evidence.markerExists = existsSync(marker);
    const receiptDir = resolve(output, 'receipts');
    evidence.receipts = existsSync(receiptDir) ? readdirSync(receiptDir).map(f => ({ path: resolve(receiptDir, f), ...JSON.parse(readFileSync(resolve(receiptDir, f), 'utf8')) })).filter(r => ['call_ig_allowed', 'call_ig_blocked'].includes(r.input?.tool_use_id) && JSON.stringify(r.input).includes(token)) : [];
    evidence.hookEvents = stdout.split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(m => /^hook\//.test(m.method));
    writeFileSync(resolve(runDir, 'results.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify({ runDir, exitCode: evidence.exitCode, markerExists: evidence.markerExists, receipts: evidence.receipts.map(r => ({ path: r.path, decision: r.decision, reason: r.reason })), hookEvents: evidence.hookEvents }, null, 2));
    assert.equal(evidence.exitCode, 0);
    assert(evidence.receipts.some(r => r.decision === 'allow' && r.guardInvoked));
    assert(evidence.receipts.some(r => r.decision === 'deny' && r.guardInvoked && r.reason.startsWith('WRONG_CWD')));
    assert.equal(evidence.markerExists, false);
    assert(JSON.stringify(evidence.modelToolOutputs).includes(`${token}_ALLOWED`));
    assert(JSON.stringify(evidence.modelToolOutputs).includes('IG guard: WRONG_CWD'));
    assert(evidence.modelToolOutputs.some(o => o.call_id === 'call_ig_allowed' && o.output.includes(studio)), 'The allowed call must actually run in Studio, even when tool workdir is root.');
    assert.equal(evidence.hookEvents.filter(e => e.method === 'hook/completed' && e.params.run.status === 'completed').length, 1);
    assert.equal(evidence.hookEvents.filter(e => e.method === 'hook/completed' && e.params.run.status === 'blocked').length, 1);
    assert(!stdout.split('\n').filter(Boolean).map(l => JSON.parse(l)).some(e => e.method === 'item/started' && e.params.item.type === 'commandExecution' && e.params.item.id === 'call_ig_blocked'), 'The denied tool must never start.');
    writeFileSync(resolve(output, 'latest.json'), JSON.stringify({ runDir, passed: true }, null, 2));
    console.log('PASS: real Codex PreToolUse allowed one operation and blocked the wrong-package synthetic operation.');
  } finally { server.closeAllConnections(); await new Promise(ok => server.close(ok)); }
}
