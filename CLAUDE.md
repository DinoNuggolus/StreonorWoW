# StreonorWoW

- type: original (controller-side project; not a WoW addon, so no `src\<Addon>` layout)
- status: 0.1.0 controller plugin implemented, host-tested; uncommitted, not deployed
- Goal: Streonor S15 profile for a WoW: Forever druid. 15 LCD keys (grid rows 0-4) + 3 Information panels (`5,0` `5,1` `5,2`).
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
  No pager keys, automation, queues/replays, or controller-started cooldowns.
- Information panels are display-only. Show STALE when data is old; never present estimates as exact.
- Edit source here, deploy by script. Do not edit the deployed copy.

## Current controller implementation (2026-11-07)

`src/io.github.dinonuggolus.streonordock.sdPlugin/` is the real plugin. See [README.md](README.md)
for architecture, configuration, installation and staged verification; [NOTES.md](NOTES.md)
for progress and decisions. `docs/implementation-plan.md` records this run's plan.

- CommonJS / Node 20.8.1, zero dependencies. `lib/` holds parser, reader, icons, renderer,
  chord plans; `plugin/index.js` routes host events; `plugin/sender.ps1` is both loopback
  WebSocket relay and guarded scan-code sender. Only its own logs directory is written.
- Account-wide `StreonorDockDB.export` schema 1 is authoritative; per-character
  StreonorDockCharDB is never the controller source. The addon converts endsAt to server seconds.
- Saved snapshot only: /reload/logout updates; Status displays age/page; stale/invalid data
  does not disable chords. Readouts are items, not the earlier proposed gold/bags panels.
- 15 Keypad actions, 3 Readout actions + alternative Dock Status Information action.
  S15 has only 3 Information regions, so all four cannot be placed simultaneously.
- Run `scripts/run-tests.ps1` for Node 26 + bundled Node20. Fixture tests never read game
  files or send real input. Loopback mock-host communication uses the actual PS relay.
- Deployment utility is reused only by explicit name: `scripts/deploy-plugin.ps1
  -Name io.github.dinonuggolus.streonordock.sdPlugin`. It was not run. Never deploy or edit profiles
  as an incidental test. Current run forbids all git writes; manager commits after review.
- Reading references outside this repo is permitted, but this run's sandbox denied installed
  LocalAI/Star Citizen plugin reads. Readable spike/scratchpad and SDK used instead.

## Historical spike result
Verified with a simulated host (not hardware yet): register -> willAppear -> setImage (key + panel), keyDown -> icon change (x0 -> x1), panel reads `state\state.json` every second. See NOTES.md.
