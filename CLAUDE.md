# StreonorWoW

- type: original (controller-side project; not a WoW addon, so no `src\<Addon>` layout)
- status: 0.1.0 controller plugin implemented, host-tested; uncommitted, not deployed
- Goal: Streonor S15 (landscape 5x3) profile for a WoW: Forever druid. 15 keys, each an icon-only full-bleed tile (Phase 1 removed the Information panels/readouts).
- Background: [../docs/streonor-s15-findings.md](../docs/streonor-s15-findings.md), [../docs/handoffs/2026-11-07-codex-streonor-s15.md](../docs/handoffs/2026-11-07-codex-streonor-s15.md)

## Layout
- `src\<plugin>.sdPlugin\` plugin source (Elgato-style; Node 20 bundled with Streonor; websocket via `plugin\bridge.ps1`).
- `scripts\deploy-plugin.ps1` copies a plugin into `%APPDATA%\HotSpot\StreamDock\plugins` (backs up first; restart Streonor to load).
- `scripts\set-state.ps1` writes `state\state.json`, the stand-in for WoW telemetry.
- `state\`, `_backups\`, `logs\` are git-ignored.

## Rules
- Never modify Streonor's install dir, firmware, or other plugins/profiles without the user's say-so (back up `profiles\` first).
- The retained spike sends no keystrokes. The approved real plugin sends the 15 fixed
  ALT-CTRL-SHIFT chords with focus/physical-state guards; one physical press = one chord.
  No pager keys, automation, queues/replays, timers or cooldown tracking.
- Keys show only the addon's exported icon (144x144, no text/count/timer/status/overlay). Never read or delete WoW chat/combat logs.
- Edit source here, deploy by script. Do not edit the deployed copy.

## Current controller implementation (2026-11-07)

`src/io.github.dinonuggolus.streonordock.sdPlugin/` is the real plugin. See [README.md](README.md)
for architecture, configuration, installation and staged verification; [NOTES.md](NOTES.md)
for progress and decisions. `docs/implementation-plan.md` records this run's plan.

- CommonJS / Node 20.8.1, zero dependencies. `lib/` holds parser, reader, icons, renderer,
  chord plans; `plugin/index.js` routes host events; `plugin/sender.ps1` is both loopback
  WebSocket relay and guarded scan-code sender. Only its own logs directory is written (nothing is ever deleted).
- Account-wide `StreonorDockDB.export` is authoritative, minimal schema 2: `{schemaVersion=2, enabled, profileId,
  page=1..10, icons[1..15]={iconFileID=n} | {unresolved=true} | {}}` (see README). Transitional schema 1 is read for
  icons only. /reload/logout updates; missing/garbled/disabled data blanks keys and never disables chords.
- 15 Keypad actions only. Obsolete Readout/Status actions placed in old profiles are inert (device profiles are never rewritten).
- Run `scripts/run-tests.ps1` for Node 26 + bundled Node20. Fixture tests never read game
  files or send real input. Loopback mock-host communication uses the actual PS relay.
- Deployment utility is reused only by explicit name: `scripts/deploy-plugin.ps1
  -Name io.github.dinonuggolus.streonordock.sdPlugin`. It was not run. Never deploy or edit profiles
  as an incidental test. Current run forbids all git writes; manager commits after review.
- Reading references outside this repo is permitted, but this run's sandbox denied installed
  LocalAI/Star Citizen plugin reads. Readable spike/scratchpad and SDK used instead.

## Historical spike result
Verified with a simulated host (not hardware yet): register -> willAppear -> setImage (key + panel), keyDown -> icon change (x0 -> x1), panel reads `state\state.json` every second. See NOTES.md.
