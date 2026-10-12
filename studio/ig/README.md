# IG operational slice

From any PowerShell directory on this PC:

```powershell
IG START POSE
IG STATUS
```

`IG START POSE` binds to the registered checkout, checks repository/common Git directory/branch/package identity, runtime, installed dependency tree and native esbuild, then reuses the verified service or starts Vite with an explicit cwd and strict loopback port. It verifies the live identity, listener PID, transformed editor entry and workspace API, requests the default browser, and records a receipt. It does not fetch, checkout, reset, install packages, build, or stop existing processes. Missing/stale dependencies and incompatible listeners are blockers.

`IG STATUS --json` gives deeper live diagnostics. STATUS opens the operations database read-only, probes current state, and reports the last persisted verification separately from the current check. `IG EVIDENCE` reads recent tasks/events. `IG START POSE --no-open` suppresses browser opening for automation.

The registered target is the current `studio/ux-canvas-v2` worktree, not an automatically selected latest branch. Registration lives in `%LOCALAPPDATA%\iGlass\IG\operations.sqlite`. Compositions remain in the existing Studio `.studio-data` database. Node 24 is required; this installation was tested with 24.14.1, SQLite 3.51.2. Native TypeScript execution removes an extra compile/install step for the runner.

One-time installation from the intended Studio: `node ig/install.mts`. The installer creates `IG.cmd` in the existing `%USERPROFILE%\.local\bin` PATH entry. It refuses a different registered target; re-targeting needs an explicit migration. No PowerShell profile or system PATH changes are needed. Source must stay at its registered location.

All operational database writes enter the same runner path, serialized by a Windows named-pipe mutex. SQLite stores projects, tasks, append-only events, startup intents/services, latest observations, dependency receipts, and an undelivered event outbox. Startup intent is durable before spawn. A crashed runner releases its OS mutex; the next command marks unfinished tasks interrupted, waits out a recent pending start when needed, and re-probes before acting. The runner never kills processes.

The dev-only `/api/ig/identity` endpoint exposes local repository/process identity. Keep the existing loopback binding. Its instance UUID and startup token identify a local service instance; they are not an authentication system. A legacy server without the endpoint cannot be safely reused. HTTP 200 alone is insufficient.

The guard also runs through one repository-level Codex `PreToolUse` hook for native shell calls (`Bash`, including `exec_command`). The hook adapter reads the same registered POSE row and calls `core.mts:guard`; it does not duplicate that policy. Allowed Windows PowerShell commands are bound to the checked Studio directory because the observed hook payload omits the tool's separate `workdir`. From a repository-root chat, begin a shell command with `Set-Location -LiteralPath 'C:\Users\matth\Desktop\R3F Repo\IphoneAnimation-live\IphoneAnimation\studio';`. Explicit supported directory redirects are checked by the same guard. See [Immediate hook verification](IMMEDIATE-HOOK-REPORT.md) for test receipts, Windows behavior, and limits. Arbitrary MCP/Desktop Commander operations, indirect scripts, interactive follow-up input, and non-shell tools are outside this hook's coverage; this is not a universal enforcement boundary.

Verification: `node ig/verify.mts` from Studio. It uses isolated fixtures for occupied ports and missing/stale dependencies, safely binds commands launched from System32 and the Hero package root, validates concurrent starts, stops only a just-verified runner-owned instance for restart tests, tests runner crash recovery, checks the real browser UI, and verifies a consistent SQLite backup. It must be run when a runner-owned Pose service is already up. It leaves Pose running and does not edit compositions. Evidence is under ignored `test-results/ig/`; `latest.json` points to the completed run. Browser verification currently uses the inspected installed Chromium 1228 path.

Boundary: this is a local development launcher and operational evidence slice. It does not prove full Pose product acceptance, provide automatic dependency repair, run a background event dispatcher, implement arbitrary package mutations, or intercept all Astra/Work/Codex tools. Consistent backup/restore was tested; scheduled backups and off-machine retention remain incomplete.
