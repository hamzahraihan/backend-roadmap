# Design: Herdr Credential-Scoped AI Quota / Context / Cache Plugin

Date: 2026-09-07
Status: Approved design (awaiting spec review)
Target repo: standalone `herdr-quota-context-cache` (new repo, publishable via `herdr-plugin` topic)
Stack: TypeScript / Node
Herdr baseline: `min_herdr_version = "0.8.0"`, platforms `linux, macos, windows`

## 1. Purpose

A Herdr plugin that tracks credential-scoped AI quota, context usage, and prompt-cache efficiency for 8 agents — Claude, Codex, Grok, Agy (Antigravity), OpenCode, Pi, omp (Oh My Pi), and Devin — and renders them inside Herdr's per-agent sidebar list (`rows_by_agent`) plus an optional detail pane.

Success criteria:
- Each open agent pane shows 3 readable rows: identity/quota, context/cache, workspace location — without removing Herdr's native `state_icon` / `tab`.
- Subscription panes show plan windows (remaining % + reset ETA). API-key / custom-backend panes show backend + session spend, never mislabeled as subscription quota.
- Missing data hides its token (Herdr elides absent variants); failures retain last-good snapshot.
- Install/repair/uninstall is fully reversible via one `configure` action.

## 2. Non-goals

- No resident minute-by-minute countdown; ETAs recomputed on agent events or manual refresh.
- No credential refresh, write, or upload. No browser cookie / keychain writes (Keychain Safe Storage read-only for OpenCode Go browser import only).
- No Copilot or other provider collectors unless an explicit route + collector is added later.
- No shipping of `config.toml` UI directly (Herdr plugin v1 cannot ship UI config); the plugin prints/applies the snippet and calls `herdr server reload-config`.

## 3. Architecture

```
herdr-quota-context-cache/
  herdr-plugin.toml            # manifest: build, startup, actions, events, panes
  package.json                 # type: module, node >=22.12
  bin/
    ensure-watch.ts            # singleton guard, spawns watch detached
    watch.ts                   # 15s poll loop daemon (the engine)
    configure.ts               # --check / --apply / --uninstall
    refresh.ts                 # one-shot refresh [--provider …] [--force] [--json]
    limits-pane.ts             # interactive overlay pane
    cli.ts                     # debugging only, not in manifest
  src/
    herdr/client.ts            # socket/CLI client, one request per connection
    herdr/types.ts             # typed Herdr responses (no runtime)
    credentialRouter.ts        # (harness, providerID, auth-kind) -> subscription | paygo
    health.ts                  # time-aware health + ETA formatting (pure)
    badges.ts                  # numbers -> display strings (pure)
    config.ts                  # user config with validation
    collectors/
      claude.ts codex.ts grok.ts agy.ts opencode.ts pi.ts omp.ts devin.ts
```

Runtime env (injected by Herdr): `HERDR_SOCKET_PATH`, `HERDR_BIN_PATH`, `HERDR_PLUGIN_ID`, `HERDR_PLUGIN_ROOT`, `HERDR_PLUGIN_STATE_DIR`, `HERDR_PLUGIN_CONFIG_DIR`, `HERDR_PLUGIN_CONTEXT_JSON`, plus `HERDR_WORKSPACE_ID/TAB_ID/PANE_ID`. All manifest commands run with plugin dir as cwd. Snapshots under `HERDR_PLUGIN_STATE_DIR`; never upload usage data.

Manifest sketch:

```toml
id = "herdr-quota-context-cache"
name = "Quota Context Cache"
version = "0.1.0"
min_herdr_version = "0.8.0"
description = "Credential-scoped quota, context, and prompt-cache in Herdr per-agent list for Claude, Codex, Grok, Agy, OpenCode, Pi, omp, Devin."
platforms = ["linux", "macos", "windows"]

[[build]]
command = ["npm", "ci"]
[[build]]
command = ["npm", "run", "build"]

[[startup]]
command = ["node", "dist/ensure-watch.js"]

[[actions]]
id = "configure"
title = "Install / repair agent quota"
contexts = ["workspace"]
command = ["node", "dist/configure.js", "--apply"]

[[actions]]
id = "refresh"
title = "Refresh agent quota"
command = ["node", "dist/refresh.js"]

[[events]]
on = "agent.settled"
command = ["node", "dist/refresh.js"]

[[events]]
on = "pane.focus"
command = ["node", "dist/refresh.js"]

[[panes]]
id = "limits"
title = "Agent Quota"
placement = "overlay"
command = ["node", "dist/limits-pane.js"]
```

## 4. Credential-scoped routing (approved: subs vs API key)

The agent in a pane and the account paying are separate. Router inputs per pane: harness session provider (`providerID` / `model_provider` / `message.provider` / deployment env / `config.toml base_url`) + auth kind (`auth.json` credential kind / OAuth vs API key / env).

| Harness | Subscription auth -> limit account | API-key / custom -> paygo backend label |
|---|---|---|
| Claude Code | Claude login -> Claude | API key, Bedrock, Vertex, Foundry, gateway -> backend spend, hide Claude windows |
| Codex | ChatGPT login -> Codex | `model_provider` custom / API key -> backend spend |
| Grok | Grok OAuth (`~/.grok/auth.json`) -> Grok SuperGrok | `~/.grok/config.toml [model.*] base_url` custom -> endpoint host (openai, ollama, …) |
| Agy | Agy OAuth -> Agy | n/a (no paygo route v1) |
| OpenCode | `opencode-go` -> OpenCode Go; OpenAI/Codex OAuth -> Codex; `xai-oauth` -> Grok; `anthropic`+OAuth -> Claude | any other `providerID` (e.g. deepseek) -> backend spend |
| OMP / Pi | `opencode-go` -> OpenCode Go; `xai-oauth` -> Grok; `anthropic`+OAuth -> Claude; `openai`/`openai-codex`+OAuth -> Codex | API-key backends -> session burn grouped by `message.provider` |
| Devin | `DEVIN_API_TOKEN` -> Devin (official REST endpoint, pinned during implementation) | missing token -> `N/A`, context/cache from pane metadata only |

Rule: same provider id with API key is never routed to subscription by name alone. Unimplemented subscription (e.g. Copilot) is not presented as API spend.

## 5. Collectors (local sources of truth)

| Agent | Quota source | Context source | Cache source |
|---|---|---|---|
| Claude Code | statusLine JSON `rate_limits.five_hour` + `seven_day`; `~/.claude.json` `cachedUsageUtilization` fallback | session transcript token rollup | `cache_creation` / `cache_read` tokens, hit% |
| Codex | `codex app-server --stdio account/rateLimits/read` (weekly by duration); rollout `rate_limits` in `event_msg` fallback | rollout `token_count` | cached tokens where recorded |
| Grok | `~/.grok/auth.json` key -> weekly billing contract (`currentPeriod.type==weekly`, `creditUsagePercent`, `end`) | `~/.grok/sessions/**/signals.json` | prompt-cache fields if present, else hidden |
| Agy | statusLine `quota` object (`gemini-*`, `3p-*` pools), conservative aggregate; local 127.0.0.1 probe | session usage | cache fields if present |
| OpenCode | Go: `opencode.ai` via `OPENCODE_GO_COOKIE` or Chromium Keychain import; else SQLite estimate; OAuth routes reuse Codex/Grok/Claude collectors | `~/.local/share/opencode/opencode.db` | cache tokens + cost where recorded |
| Pi | subscription routes above; session jsonl for routing | `~/.pi/agent/sessions/**/*.jsonl` + `models.db` window | cache + cost where recorded |
| omp | subscription routes above | `~/.omp/agent/sessions/**/*.jsonl` + `models.db` + `agent.db` credential kind | cache + cost where recorded |
| Devin | Devin REST API with `DEVIN_API_TOKEN` only (exact endpoint pinned during implementation from official Devin docs) | pane metadata | hidden v1 unless API returns it |

Only network calls: Grok credits, OpenCode Go usage, Devin usage — each skipped when its credential is absent.

## 6. Sidebar: visible inside per-agent list

Canonical `rows_by_agent` keys (case-sensitive): `claude`, `codex`, `grok`, `agy`, `opencode`, `omp`, `pi`, `devin`. `configure --apply` adds brand-colored projections and never replaces user-owned overrides; `configure --uninstall` removes only plugin-owned rows and restores prior Claude/Agy statusLine commands and removes the Grok hook file.

Standard 3-row layout (approved):

```toml
[ui.sidebar.agents.rows_by_agent]
claude   = [["state_icon", "workspace", "tab"], [{token="$quota_provider", fg="#D97757"}, "$quota_5h", "$quota_week"], ["$context", "$cache"]]
codex    = [["state_icon", "workspace", "tab"], [{token="$quota_provider", fg="#7AA2F7"}, "$quota_week"], ["$context", "$cache"]]
grok     = [["state_icon", "workspace", "tab"], [{token="$quota_provider", fg="#E8E8E8"}, "$quota_week"], ["$context", "$cache"]]
agy      = [["state_icon", "workspace", "tab"], [{token="$quota_provider", fg="#6EE7B7"}, "$quota_5h", "$quota_week"], ["$context", "$cache"]]
opencode = [["state_icon", "workspace", "tab"], [{token="$quota_provider", fg="#FFFFFF"}, "$quota_5h", "$quota_week"], ["$context", "$cache"]]
omp      = [["state_icon", "workspace", "tab"], [{token="$quota_provider", fg="#F97316"}, "$quota_week"], ["$context", "$cache"]]
pi       = [["state_icon", "workspace", "tab"], [{token="$quota_provider", fg="#FFFFFF"}, "$quota_week"], ["$context", "$cache"]]
devin    = [["state_icon", "workspace", "tab"], [{token="$quota_provider", fg="#A78BFA"}, "$quota_week"], ["$context", "$cache"]]
```

Tokens reported via `herdr pane report-metadata --source herdr-quota --token quota_provider=Claude …`. Herdr joins cells with `·`; each window publishes exactly one styled variant so absent data hides cleanly (e.g. no `$quota_5h` for Codex/Grok).

Display formats:
- Quota: `5h 89% (42m)` / `7d 24% (3d 4h)`; paygo: `deepseek · Σ 425k $0.04`.
- Context: `⛁ 13% (130k)` or count-only if window unknown.
- Cache (approved: prompt-cache stats): `cache 42k 76%`; hidden if harness records none.
- Topic behavior: keep Herdr native title; do not inject AI status titles.

Time-aware health (shared by all providers):

```text
time_left  = (reset_at - now) / window_duration
quota_left = remaining_percent / 100
health     = quota_left / time_left
```

- green `health >= 1` (on pace), amber `health < 1` (behind pace), red `health < 1` and `<20%` remains, amber fallback when reset missing/expired. Brand `fg` on `$quota_provider` never encodes health.

Reset ETA: minutes <1h, `Xh Ym` <1d, `Xd Yh` above. Toasts (opt-in `ui.toast`) fire once per window at 50/20/10/5% remaining.

## 7. Detail pane + actions

- `limits` overlay pane: per-billing-provider blocks (subscription windows with bars + reset + open-pane share incl. `closed/other` bucket; paygo backends with rolling 24h/7d/30d, per-model breakdown, pane share). Auto-refresh 15s, `r` refresh, `q` quit.
- `configure --check/--apply/--uninstall [--watch-interval-seconds N]`: validates CLIs, chains prior Claude/Agy statusLine (backup + forward stdin, preserve stdout/stderr/exit), installs silent Grok global hook (`PostToolUse` during turns; `Stop/StopFailure/StopCancelled` at end calling collector directly), restarts note for existing Grok sessions, then `herdr server reload-config`.
- `refresh [--provider …] [--force] [--json]`: force-fetch Codex/Grok, republish Claude/Agy snapshots; bound to `prefix+shift+r` snippet + `agent.settled` / `pane.focus` events (update after settle, not while `working`).

## 8. Error handling

- Provider failure -> retain last-good snapshot, mark stale; never blank on transient error; `N/A` only when no snapshot ever (e.g. Devin without token, Claude before first statusLine emission).
- `configure --apply` stops before changing settings if prior statusLine cannot be chained safely.
- Session unresolvable -> clear `$context` rather than showing another session's numbers.
- Private-mode / quota persistence errors are non-fatal.

## 9. Testing & rollout

- `npm test` with fixture sessions per agent (subs + paygo + missing-credential cases), health-formula unit tests, router tests.
- Manual smoke: `herdr plugin link . --enabled`, `herdr plugin action invoke herdr-quota-context-cache.configure`, open 8 panes, `refresh`, verify rows + overlay.
- Publish: public repo + `herdr-plugin` topic + `herdr-plugin.toml` at root; `herdr plugin install owner/repo`.
- Docs: README first sentence states 8-agent coverage; documents exact sources, remaining-% semantics, retained values, reversible setup.

## 10. Decisions locked

Standalone repo / subs-vs-key / prompt-cache stats / TypeScript / Devin API-token with graceful N/A / 3-row sidebar layout.
