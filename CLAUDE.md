# StreonorWoW

- type: original (controller-side project; not a WoW addon, so no `src\<Addon>` layout)
- status: spike (throwaway plugin `io.github.dinonuggolus.wowspike.sdPlugin`)
- Goal: Streonor S15 profile for a WoW: Forever druid. 15 LCD keys (grid rows 0-4) + 3 Information panels (`5,0` `5,1` `5,2`).
- Background: [../docs/streonor-s15-findings.md](../docs/streonor-s15-findings.md), [../docs/handoffs/2026-11-07-codex-streonor-s15.md](../docs/handoffs/2026-11-07-codex-streonor-s15.md)

## Layout
- `src\<plugin>.sdPlugin\` plugin source (Elgato-style; Node 20 bundled with Streonor; websocket via `plugin\bridge.ps1`).
- `scripts\deploy-plugin.ps1` copies a plugin into `%APPDATA%\HotSpot\StreamDock\plugins` (backs up first; restart Streonor to load).
- `scripts\set-state.ps1` writes `state\state.json`, the stand-in for WoW telemetry.
- `state\`, `_backups\`, `logs\` are git-ignored.

## Rules
- Never modify Streonor's install dir, firmware, or other plugins/profiles without the user's say-so (back up `profiles\` first).
- Spike plugin sends NO keystrokes. Real key output should use the stock hotkey action: one physical press = one key.
- Information panels are display-only. Show STALE when data is old; never present estimates as exact.
- Edit source here, deploy by script. Do not edit the deployed copy.

## Spike result so far
Verified with a simulated host (not hardware yet): register -> willAppear -> setImage (key + panel), keyDown -> icon change (x0 -> x1), panel reads `state\state.json` every second. See NOTES.md.
