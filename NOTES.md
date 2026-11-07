# StreonorWoW dev log

## 2026-11-07 controller plugin 0.1.0 (current run; no git writes)

- Implementing explicit supplied brief in this working tree; design and implementation
  already authorized. All source/tests/docs/scripts stay inside StreonorWoW. No commit/add,
  deployment, profile edits, game-file reads, external download or real input sends.
- Read workspace/project docs, full design amendments, addon Core/Export/Cooldown and
  tests/README/NOTES, SDK manifest/received/sent events, spike and scratchpad mock harness.
  Installed LocalAI/Star Citizen reference reads were denied by sandbox; not bypassed.
- Plan: docs/implementation-plan.md. Architecture/file/config/checklist: README.md.
- Parser RED missing module -> GREEN 14 tests: assignments, mixed table keys, decimal/hex,
  Lua escapes, comments/long strings, nil, malformed/executable expressions rejected,
  5 MiB/depth64/entry200000 limits, BOM, safe __proto__ own properties.
- Reader RED missing module -> GREEN 4 tests: authored full schema-1 fixture, allowlist,
  mismatch, corrupt/partial retry + recovery, newest-account fixture discovery, size limit.
  Test fixture's initial retry hook incorrectly repaired every corruption; fixed test to
  repair once, then verified corrupt input becomes NO DATA.
- Presentation RED missing module -> GREEN 3 tests: clock mapping/expiry, source labels,
  empty/stale/status/escape/clamp; stable initials, icon signature/size/SVG restrictions.
- Input RED missing module -> GREEN 5 tests: exact Core.lua chord comparison, all 15 VK/scan
  sequences through real PS dry-run; syntax; focus and physical-conflict refusal; duplicate,
  overlap, timeout suppression and EOF release. PS `Sequence` is a reserved keyword:
  syntax test caught it, renamed function Send-ChordSequence.
- Host RED missing entrypoint -> GREEN: real PowerShell ClientWebSocket connects to Node
  RFC6455 loopback mock; registers, fragmented inbound event, 15 keys/3 readouts/Status images,
  repeated-down suppression, chord up/down, fixture redraw, corrupt snapshot and continued
  input, settings cannot remap, disappearance cancels image updates.
- Added manifest + original generated PNG, config, test runner and reproducible manifest/icon
  script. Existing deploy-plugin.ps1 reviewed and reused by explicit -Name, never executed.
- Ruling: three physical strip regions cannot hold four Information actions. Status is an
  alternative to one readout; recommended Readout1, Readout2, Status. User can swap freely.
- Ruling: reject overlapping held slots (showAlert), never queue; avoids shared modifier
  release races. Suppress repeats after timeout/refusal until keyUp. Tradeoff: rapid
  simultaneous button presses are refused. Fixed mapping never uses export chord strings.
- Ruling: source is schema1 account export, not older draft character exports. USED has no
  exported press timestamp, so no fabricated elapsed time. Player values do not replace
  amended item readouts. Unknown metadata is omitted, not retained or invented.
- Ruling: endsAt/savedAt server seconds map to file mtime local anchor; age takes the maximum
  of mtime age and export wall-clock age. Clock skew can warn early; copied files can shift
  cooldowns. Documented, not claimed exact. No new timer starts from a controller press.
- Review fixes: asynchronous bounded host-display outbox keeps safety loop responsive;
  release attempts all owned keys even if one SendInput fails; JSON log truncation retains
  valid JSON. Input itself is never queued for later replay.
- Fresh reviewer spawn failed in service (no rollout found for thread). Final review is
  self-review against brief; project manager must review uncommitted changes.
- Preliminary full target-runtime run: Node20.8.1, 29 tests passed / 0 failed. Final dual
  runtime results and any extra review regression tests will be appended below.
- Final review regression: three valid 400 KiB cached icons reproduced a Node stdin
  backpressure shutdown (host integration RED). Coalesce pending images by context and
  flush on drain; input bypasses the display queue. Host integration GREEN with large
  icons. PS host output uses a bounded asynchronous outbox; the release loop stays live.
- Added actual stat/read/stat rewrite race test, age/threshold/future-clock checks, flat
  parser entry limit and extra Lua numeric/escape cases, inert local SVG + pluggable icon
  source checks. Added MIT LICENSE for original work.
- FINAL verification: `powershell.exe -NoProfile -File scripts/run-tests.ps1`:
  Node v26.13.0 **32 passed, 0 failed**; bundled Node v20.8.1 **32 passed, 0 failed**.
  Includes PowerShell parser, real helper dry-run, real loopback mock host, large-icon
  backpressure regression. Evidence: tests/verification.txt. `git diff --check` clean
  (only Git line-ending/environment-access warnings). All new JS also syntax-checked
  under Node20; scripts parsed with PowerShell parser before handoff.

### Remaining real-world verification

All device/game/actual Windows input behavior is unverified. See README staged checklist
and exhaustive assumptions: scan positions/layout/OEM and ALT behavior; process filename,
focus/physical-state API and UIPI; S15 protocol ordering/pixels/unplug/restart; game schema
persistence/secret guards/save clocks; copied files/mtime resolution; no live uses between
saves; simultaneous holds refused; forced helper termination cannot guarantee cleanup.
Fallback icons are expected until pictures are supplied locally. No fresh external reviewer.


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
