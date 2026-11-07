# StreonorWoW dev log

## 2026-11-07 spike
Question: can a plugin get a key press, set a key icon, and show a live external value on an Information panel?

Built `io.github.dinonuggolus.wowspike.sdPlugin` (throwaway): action `Spike Key` (Keypad) and `Spike Panel (gold / bags)` (Information).

Verified (simulated StreamDock host, Streonor's bundled node20, protocol: `registerPlugin` -> `willAppear` -> `setImage`; `keyDown` -> redraw):
- key icon renders, press counter 0 -> 1
- panel renders gold + free bags from `state\state.json`, redraws each second
- fixed: PowerShell 5.1 `Set-Content -Encoding utf8` writes a BOM that broke `JSON.parse`; plugin now strips it and `set-state.ps1` writes BOM-free.

NOT yet verified on hardware: that the real host sends `keyDown` to Information-less keys the same way, panel pixel size/aspect, how the panel looks. Needs: restart Streonor, drag the two actions onto the WoW:FoReVeR profile (keys e.g. `0,0`; panel `5,0`), press the key, run `scripts\set-state.ps1 -Gold ... -FreeSlots ...` and watch the panel; then read `logs\spike.jsonl` in the deployed plugin folder.

## 2026-11-07 spike superseded by existing plugin
The user pointed out `<vendor>.localai.sdPlugin` (LocalAI Studio, profile "AI Contoller", device S15) already runs on the real hardware and covers all three spike questions, so the hardware test of `wowspike` was dropped and its deployed copy removed (source stays in `src\` as reference only).
- Keypad actions `restore` / `link`: handle `keyUp`, call `setImage` (144x144 SVG, colour = state), `showOk`/`showAlert` on result.
- `health` action (`Controllers: Information, SecondaryScreen, Keypad`) at `5,0`: redraws every 8s from a Python health script. Same pattern we need for WoW data.
- Architecture to copy: Node plugin spawns `transport.ps1` (websocket relay), polls external data on a timer, draws SVGs. Config in `plugin\config.json`.
- Not read by us (user-confirmed working, not observed by us): visual result on the device.
So the controller side is solved. The unsolved part is WoW -> desktop data (see open list).

Open: real telemetry bridge (WoW addon -> panel), druid action list, key chords, form/page behavior.
