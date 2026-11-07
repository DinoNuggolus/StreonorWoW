# StreonorWoW dev log

## 2026-11-07 spike
Question: can a plugin get a key press, set a key icon, and show a live external value on an Information panel?

Built `io.github.dinonuggolus.wowspike.sdPlugin` (throwaway): action `Spike Key` (Keypad) and `Spike Panel (gold / bags)` (Information).

Verified (simulated StreamDock host, Streonor's bundled node20, protocol: `registerPlugin` -> `willAppear` -> `setImage`; `keyDown` -> redraw):
- key icon renders, press counter 0 -> 1
- panel renders gold + free bags from `state\state.json`, redraws each second
- fixed: PowerShell 5.1 `Set-Content -Encoding utf8` writes a BOM that broke `JSON.parse`; plugin now strips it and `set-state.ps1` writes BOM-free.

NOT yet verified on hardware: that the real host sends `keyDown` to Information-less keys the same way, panel pixel size/aspect, how the panel looks. Needs: restart Streonor, drag the two actions onto the WoW:FoReVeR profile (keys e.g. `0,0`; panel `5,0`), press the key, run `scripts\set-state.ps1 -Gold ... -FreeSlots ...` and watch the panel; then read `logs\spike.jsonl` in the deployed plugin folder.

Open: real telemetry bridge (WoW addon -> panel), druid action list, key chords, form/page behavior.
