# Immediate stage: Codex PreToolUse hook

Verified on 3 October 2026. Scope is the Immediate stage only. Phase 1B was not started.

## Result

One synchronous project hook is enabled and trusted. It intercepts native Codex shell calls, including ordinary Git/npm/PowerShell operations that do not use IG. Both this Desktop chat and a fresh installed app-server exercised the host hook. The final integration run allowed the harmless operation, blocked the synthetic wrong-package operation before execution, and verified that its marker file was absent.

The adapter imports the existing `guard` from `studio/ig/core.mts` and reads POSE from the existing `operations.sqlite` registry, read-only, just as IG STATUS does. The existing guard was inspected first and was not changed. Its SHA-256 is `b9087e4f687336137173f7e780fcd735d8b8f00562596ae281b71f881f18e261`.

## Installed versions

At the successful final verification:

- Desktop: **26.930.21537**, build **12776**, production channel, from the app's version tool.
- Active/PATH CLI: **0.159.0-alpha.12.1**, `C:\Users\matth\AppData\Local\OpenAI\Codex\bin\be3fd7e5c1969ff6\codex.exe`, confirmed by `--version` and the process path.
- Hook runtime: registered Node **24.14.1**, `C:\Program Files\nodejs\node.exe`.

The first investigation on 2 October observed Desktop 26.928.31416/build 12553 and CLI 0.159.2. The installation changed between turns; those versions are not substituted for the final tested versions. The final app update check returned `busy`, so it establishes the installed version, not whether a further update is available.

## Files changed

- `.codex/config.toml`: one project `PreToolUse` declaration and explicit hooks feature setting.
- `studio/ig/codex-pre-tool-use.mts`: stdin/output adapter, same-guard invocation, Windows cwd binding, and individual JSON receipts.
- `studio/ig/verify-codex-hook.mjs`: repeatable real app-server integration fixture and hook discovery/trust tooling.
- `studio/ig/README.md`: current coverage and usage.
- `studio/ig/IMMEDIATE-HOOK-REPORT.md`: this report.
- `C:\Users\matth\.codex\config.toml`: only the exact hook's persisted trust state was added through Codex's config API.
- Ignored `studio/test-results/ig-hook/`: discovery metadata, generated protocol schemas, failed diagnostic runs, successful host events, and receipts.

The pre-existing `studio/tsconfig.json`, `studio/vite.config.ts`, and other untracked IG files were not changed by this task. Package manifests, lockfiles, the registry, and Pose compositions were not modified.

## Configuration

The repository `.codex/config.toml` is the appropriate scope: this hook binds operations to this registered Pose checkout. A global hook would incorrectly bind other projects to Pose. Hooks were already enabled by default; the project explicitly pins `features.hooks = true`.

```toml
[features]
hooks = true

[[hooks.PreToolUse]]
matcher = '^Bash$'

[[hooks.PreToolUse.hooks]]
type = 'command'
command = 'node --disable-warning=ExperimentalWarning "C:\Users\matth\Desktop\R3F Repo\IphoneAnimation-live\IphoneAnimation\studio\ig\codex-pre-tool-use.mts"'
command_windows = 'node --disable-warning=ExperimentalWarning "C:\Users\matth\Desktop\R3F Repo\IphoneAnimation-live\IphoneAnimation\studio\ig\codex-pre-tool-use.mts"'
timeout = 30
statusMessage = 'Checking the existing IG repository/package guard'
```

The handler is synchronous (default `async = false`). The exact definition is trusted under this user-config key:

```toml
[hooks.state.'C:\Users\matth\Desktop\R3F Repo\IphoneAnimation-live\IphoneAnimation\.codex\config.toml:pre_tool_use:0:0']
trusted_hash = "sha256:3781d62eea3910a419df6f6fd11e842e47f6ae02262c69fd1831c9601a3bd8c3"
```

`hooks/list` confirmed exactly one enabled, trusted project hook, with no errors, for both root and Studio. No trust-bypass switch or parallel guard was installed. Normal sandbox and approval checks still apply after the hook.

## Tests and evidence

The final deterministic fixture uses the real installed Codex app-server and a loopback Responses fixture emitting fixed tool calls. It does not invoke the adapter directly as a substitute for interception, use a remote model for decisions, or delegate work to a subagent.

Final run: `studio/test-results/ig-hook/2026-10-03T02-45-20.646Z/`.

| Input | Expected and observed result |
| --- | --- |
| `exec_command`: `git status --short; Write-Output '<unique-token>_ALLOWED'; (Get-Location).Path`, session cwd Studio but requested tool workdir repository root | Allowed. Existing guard passed. Hook rewrote the command to run in the checked Studio directory. Output confirmed Studio; exit 0. |
| `exec_command`: leading `Set-Location -LiteralPath '<repository-root>';` then `Set-Content` to a unique test marker | Blocked. Existing guard threw `WRONG_CWD`. Host emitted hook status `blocked`; no command-execution start event for this call; marker absent. |

Final receipts:

- Allow: `studio/test-results/ig-hook/receipts/a61fe3d4-46a1-4bea-ba1d-cd873d9d0f10.json`.
- Deny: `studio/test-results/ig-hook/receipts/31d776f7-9572-4e82-932f-774cac801be3.json`.
- Raw host events: `studio/test-results/ig-hook/2026-10-03T02-45-20.646Z/host-events.jsonl`.
- Inputs, results, receipts, hook events and tested CLI version: `studio/test-results/ig-hook/2026-10-03T02-45-20.646Z/results.json`.
- Latest passing run pointer: `studio/test-results/ig-hook/latest.json`.

These receipts share host thread `01a0ffa6-dd29-7cc2-a71a-730975766bda`, correlate via `tool_use_id` (`call_ig_allowed` / `call_ig_blocked`), name `PreToolUse` / `Bash`, record `guardInvoked: true`, and contain the guard hash above. The final adapter hash is `ef2840e9483dda3e412d732a1940246820dc81dcc3d85b31156783c1c442dfa9`.

This actual Desktop chat also demonstrated an ordinary `git status` allow and an ordinary `npm --prefix '..' --version` denial, with a trailing marker write prevented. Receipts `0aac0f2e-a64a-488d-804b-ba5e02894501` and `9077665c-23ff-4aa2-871f-e4ec6aa5a41c` are under the same receipts directory. They precede the final path-casing refinement; the fresh-host run above verifies the final adapter. The Desktop marker `DESKTOP_BLOCKED_COMMAND_EXECUTED_20261003.txt` was independently checked and was absent.

Rerun from a normal PowerShell terminal in Studio:

```powershell
node ig/verify-codex-hook.mjs test
```

The verifier requires the single hook to be trusted, asserts allow/block lifecycle events, checks actual execution cwd, and verifies the denied command never starts. A failed check does not replace `latest.json` with a passing result.

## Observed Windows behavior and limits

1. Configuration alone did not prove interception. The initially open Desktop turn produced no receipts. After the app changed/reloaded, this chat's hook ran. The final live and fresh-host tests provide execution evidence.
2. The initial command starting with a quoted absolute Node executable exited with code 1. Host events showed `failed`, and Codex still executed the tool. Using `node` plus the quoted script path successfully launched the adapter; the adapter checks the runtime against the registered executable. Runtime launch failures, imports that fail before the adapter runs, timeouts, untrusted hooks, and disabled hooks can therefore leave calls unprotected. This is not a fail-closed host sandbox.
3. The observed Windows `Bash` payload contains `tool_input.command` and session `cwd`, but omits per-tool `workdir`. The adapter must not equate those directories. It binds permitted execution to checked Studio through `updatedInput`, using noninteractive Windows PowerShell, and permits root-based chats to select Studio with an explicit leading literal `Set-Location -LiteralPath '...';`. The final test deliberately requests root as tool workdir and verifies actual execution stays in Studio.
4. Hook trust keys proved sensitive to path capitalization. A lowercase spelling of the same checkout was reported as untrusted and skipped. The adapter and verifier preserve on-disk Windows path casing. Opening the project through other spellings/aliases or moving it requires checking discovery and trust again.
5. The directory syntax adapter covers direct literal shell location changes, `git -C`, and common npm/npx/pnpm/yarn directory flags. The existing guard makes target-identity decisions. This is not a complete PowerShell or native-argument parser: indirect scripts, custom aliases, environment-driven targets, arbitrary explicit file paths, encoded/nested commands, and other target-selection syntax are not comprehensively analyzed. Some quoted text can be conservatively mistaken for a redirect. The wrapper standardizes Windows PowerShell behavior; it is not a transparent adapter for every shell/language.
6. This one `Bash` hook covers native Codex shell calls, including nested code-mode shell calls demonstrated in this chat. It does not cover MCP/Desktop Commander, `apply_patch`, other non-shell tools, external terminals, other projects, or later interactive `write_stdin` input. Preflight identity is checked before a command, not continuously while a process runs. It does not approve arbitrary command semantics or prevent changing the registered branch within an already admitted command.
7. Receipts contain command text and local paths and remain in ignored local test results. The hook definition's trust hash does not establish immutable script contents; receipts separately record source hashes.

The hook contract, native shell matcher, trust model and output shape were checked against [official OpenAI hook documentation](https://learn.chatgpt.com/docs/hooks). The Windows findings above were experimentally observed, not assumed from documentation.

No Phase 1B service, dependency repair, dispatcher, backup scheduler, or broader lifecycle-hook system was implemented.
