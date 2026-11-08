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

## 2026-11-07 press-based count ledger (plugin only)

- Added zero-dependency, pure `lib/countLedger.js` with snapshot baselines, accepted-press
  deductions, 0..999999 bounds, in-memory generation tokens and duplicate-ack suppression.
  Slots capture item identity before sending; acknowledgements from an older snapshot are
  discarded. Matching slots/readouts share item deductions (inventory totals).
- Schema finding: Export.lua rawProviders and Core.buildExport export kind/id (itemID for
  readouts), name/icon/count/source/endsAt, but NO consumable/reusable classification.
  Plugin `consumableItemIds` explicitly allowlists used-up items; default [] declines to
  guess. Configure known IDs to enable counting. Never infer from stack count or cooldown.
  Addon source was read only; exportReader's schema allowlist is unchanged.
- sender.ps1 now emits accepted with slot/pressId only after successful guarded down.
  Refusals echo pressId; repeats/releases emit no acceptance. No changes to chord sequence
  or guards. index.js correlates acceptance with captured identity, bounds pending requests,
  and catches ledger exceptions separately from sending; no queue/replay added.
- Rendering: plain baseline number, then ~N after accepted presses, including ~0; wider
  badge accommodates clamped large estimates. Status says "counts est since snapshot".
  Snapshot age and cooldown display continue independently; no press-started cooldowns.
- Reset choice: any different savedAt, normalized export content or file mtime clears ALL
  deductions and pending old acknowledgements, including intervening presses after savedAt.
  No server/local time comparison attempted. Missing/invalid exports clear estimates;
  unchanged age/stale polls preserve them. Plugin restart loses the ledger; no persistence.
- README documents classification setup, acceptance is not proof of game consumption,
  off-controller uses/gains invisible until reload, and spring-water sequence:
  reload 5 -> use 3 -> ~2 -> buy 5 -> still ~2 -> reload 7.
- Test-first: missing module/render markers and missing sender acknowledgements failed
  before implementation. Added 5 ledger tests; expanded real relay host test for held-down
  deduplication, overlap refusal, matching readout/status and snapshot reset. Existing
  guard tests now require no acceptance for unfocused/conflict and exactly one per hold.
  Added real host fault-injection test: throwing load/capture/view cannot block chords.
- FINAL: `powershell.exe -NoProfile -File scripts/run-tests.ps1` completed successfully:
  Node v26.13.0: 38 passed / 0 failed; Node v20.8.1: 38 passed / 0 failed.
  All original 32 tests remain green. `git diff --check` clean (line-ending warnings only).
- No staging/commit, deployment, device/game input, game/WTF edits or addon repo edits.
  Real S15 rendering, real SendInput and game consumption remain unverified. Manager review
  and consumable ID configuration remain before deployment; no consumables assumed by default.

## 2026-11-07 Icon cache from community pack
- Pack qcy-hash/wow-forever-icons-png v1.0.0 (png_icons.zip 1,854,471,605 B) extracted to
  _staging/icon-pack/png/png_icons: 30,386 PNG named by icon name, 256x256, max 132 KB < plugin
  512 KiB limit (no downscale, icons.js unchanged). Zip checked: no traversal, only .png.
- ID->name map: community-listfile.csv (147 MB) downloaded to _staging/listfile after user OK.
- scripts/build-icon-cache.js (+8 tests in tests/buildIconCache.test.js). Real run: 6 IDs in the
  export (132794, 132845, 133975, 134414, 1029587, 5172975): 6 copied, 0 unresolved.
- plugin/config.json iconDir = absolute icon-cache path (deploy /MIR copies src config; cache untouched).
- .gitignore: icon-cache/ and image/zip types (the two pre-existing tracked plugin icon.png unaffected).
- Unverified: how icons look on real S15 hardware.

## 2026-11-07 STALE redesign
- Cause of "red STALE after a while": the snapshot is the SavedVariables file, which WoW writes
  only on /reload or logout, so any play session ages it past the old 10 min threshold.
- Now: red banner only for missing/corrupt/schema-mismatch (NO SNAPSHOT) or age > staleAfterSeconds
  (default 43200 = 12 h, OLD SNAPSHOT <age>). Otherwise a muted "saved 14m" label (>= 1 min) on
  key/readout/status tiles; Status keeps the full "Age" line. ~N estimates, cooldown timers
  (absolute endsAt anchored to savedAt+mtime) and key sending are unchanged.
- The same file is also all the controller can show right after login: it holds the last
  logout/reload's data until the next save.

## 2026-11-08 startup / relay investigation
- Log evidence: the two "blank until /reload" starts (23:54, 01:02) logged `snapshotError: No saved
  snapshot`: the SavedVariables file did not exist yet (first-ever session; WoW writes it only on
  /reload or logout). Later starts load the file fine (verified: reader parses the real file).
- The `fatal ... "Wait"` relay deaths = host dropped the websocket without a close handshake
  (ReceiveAsync faulted as AggregateException). Now reported as `bridge:disconnected` ->
  log `hostDisconnected`, clean exit 0; Streonor starts a fresh plugin process.
- Race check: willAppear before the first poll draws NO SNAPSHOT, the immediate first tick then
  redraws every context (covered by existing host tests). Added: 30 s heartbeat that clears the
  per-context "last sent" cache so images a host dropped (page/profile change, sleep, restart) are
  re-sent; env STREONORDOCK_REDRAW_MS for tests.
- New log events: `firstAppear` {snapshot,error}, `snapshotLoaded` {file,savedAt,page,filled,ageSeconds,stale},
  `redrawAll` {reason,contexts}, `hostDisconnected`.

## 2026-11-08 snapshot presentation and stack counts removed
- User decision: no age labels, STALE/OLD/NO SNAPSHOT banners, 'snapshot' wording, Status age, `staleAfterSeconds`,
  or controller count badges / `~N` ledger / `consumableItemIds`. lib/countLedger.js and its tests deleted.
- Kept: SavedVariables file as the data pipe (icons, kinds, page, cooldown end times), graceful missing/corrupt
  handling (neutral tiles, logged), absolute-time cooldown countdowns, chord sending, heartbeat redraw, startup logs.
- Status shows 'StreonorDock' and 'Page N/M'. The earlier STALE-redesign notes above are superseded.

## 2026-11-08 Blank tiles after icons: shrink + guards
- Symptom (user, live): keys blank, text too. Cause not provable without the device: tiles embedded
  35-57 KB PNGs (setImage ~80+ KB after base64 + URL-encoding) as plain `href` inside an SVG data URI.
  Fixes together: icons shrunk to 72x72 by the builder (pure-Node scripts/png.js; pack untouched),
  max real setImage now ~13 KB; icons.js refuses embeds > 12 KB (logs iconSkipped, draws text tile);
  index.js redraws text-only if an encoded tile > 40,000 chars (logs tileTooLarge); <image> now uses
  xlink:href + xmlns:xlink (strict renderers ignore plain href); config embedIcons:false kill switch.
- Tests: tests/iconPayload.test.js (png codec, resolver skip/kill switch, real plugin vs size-limited
  mock host). Full run: Node 26.13.0 and 20.8.1 pass. Unverified on real S15 hardware: if tiles are
  still blank after a Streonor restart, set embedIcons:false to isolate (text should return).

## 2026-11-08 press-started plugin timers
- Root cause of "no timer ever": timers only reached the plugin via the saved file (written at
  /reload or logout) and slots carried no cooldown fields. Addon now exports cooldownSeconds/Source/poolKey
  (learned/verified/table only); plugin lib/pressTimers.js starts a timer on an accepted press.
- Removed the small USED / CD ? / "Ns est" labels; only the big countdown remains. Tests: tests/timers.test.js
  (injected clock) + host test with a dry-run accepted press.

## 2026-11-08 log cleanup
- lib/logCleanup.js + relay `procCount` command (process-name count only). Chose "never delete while Wow.exe runs,
  unknown = running" over relying on unlink success alone, because a game that opened the log with share-delete
  would otherwise lose a live log mid-session. Tests: tests/logCleanup.test.js (temp dirs, fake io, plugin dry-run).

## 2026-11-08 Full icon library
- scripts/build-icon-library.js (worker_threads, incremental): 30,386 pack PNGs -> icon-library/<ID>.png
  at 72 px via the shrink ladder (all <= 9.5 KB, hard limit 12 KB). Pack: 30,386 icons, all with an ID
  (0 without); listfile icon IDs 33,885, of which 3,499 have no pack file; no pack icon maps to more than
  one ID. 30,386 files, 240.2 MiB (about 314 MB on disk with clusters), ~30 s on 16 cores.
- plugin config: iconDir=icon-library, iconFallbackDirs=[icon-cache]; IconResolver searches dirs in order.
- scripts/check-icons.js: export slots vs library. Current export: 7/7 present.
- tests/iconLibrary.test.js: build mapping/incremental/worker path, check-icons, real-plugin runtime flow
  (rewrite export -> new icon, fallback dir, missing ID -> text tile) and a no-network source check.
- Unverified: appearance on real S15 hardware.

## 2026-11-08 OmniCC-style cooldown render
- lib/render.js `cooling()` (defs + two <use>, pie clipPath via `wedge(p)`), PressTimers.info/minLeft, lib/cadence.js,
  setTimeout chain in index.js. Tests: tests/sweep.test.js (66 plugin tests total). Spells still have no timer.
- Not verified on the real S15 renderer (filters/clipPath support unknown); preview HTML only checked by generation.

## 2026-11-08 Money/currency readouts and live estimates
- exportReader.cleanSlot accepts readout kinds money{copper} and currency{currencyID,name,iconFileID,quantity,maxQuantity}.
- lib/readout.js (tile body), lib/chatParser.js (rules table: loot-money, share-money, currency, honor; enUS strings),
  lib/chatTail.js (incremental read-only tail: first start = last 1 MB, partial lines kept, truncation/replace/delete reset,
  64 KB pending cap), lib/estimator.js (baseline = saved value; deltas with time >= savedAt+1s; dedupe by stamp+text;
  2000 deltas, 48 h). index.js polls the tail each 1 s tick; render.readout takes {estimator, marker}.
- Fixture tests/fixtures/WoWChatLog.authored.txt is AUTHORED from the client format strings, not a real log.
  TODO: user collects real samples (deleteLogsOnLogout=false for one session) to confirm formats and add quest/mail rules;
  new rules = one RULES entry in chatParser.js + fixture line + test.
- Known gaps: no spend/vendor/mail/quest lines yet (no chat format verified). Tests: tests/currency.test.js.
- Pre-existing: running node --test directly fails 4 chords/relay tests under the default PowerShell execution policy;
  scripts/run-tests.ps1 (-ExecutionPolicy Bypass) passes.

## 2026-11-08 sweep fix + OmniCC text
- Bug: the colour copy was layered over a gray copy, so semi-transparent icon pixels blended with gray and the wedge looked ~25% (path geometry itself was right: verified with isPointInFill). Now each region is drawn once: colour clipped to the elapsed wedge, gray (+dim) clipped to the remaining wedge (`render.wedge/rest`).
- Verified by rasterizing the preview in Chrome (per-octant saturation equals the ready icon exactly inside the elapsed wedge). Tests parse the generated clip paths and assert covered fraction + partition for 0/5/25/50/75/95/99/100%.
- `clock()` is now 89 / 2m (>=90 s) / 2h (>=90 min); font 54, 42 for 3 chars. 78 plugin tests.

## 2026-11-08 spell timers (plugin side)
- Reader parses cooldown fields for spells; PressTimers/render accept kind 'spell' (keys `spell:<id>`), maxCharges>1 = no timer. 81 plugin tests.

## 2026-11-08 icon-only full-bleed keys + 144 px library
- `lib/render.js` `tile()`: icon fills the whole 144x144 (slice); no rect, text, caption or cooldown. Empty = black tile. Unresolved or over-cap icon = coloured initials tile. The old overlay renderer is kept as `legacySlot` (sweep/timers/presentation tests use it); plugin timers are no longer drawn.
- `lib/icons.js`: new `uri()` (first usable data URI) used by tile(); `resolve()` (inset image) kept for readouts. `MAX_EMBED_BYTES` 12 KB -> 20 KB. Order 144 -> 72 -> old cache -> initials; over-cap files skipped with `iconSkipped`.
- `scripts/png.js`: median-cut palette PNG encoder (`encodePalette`, `shrinkPalette`). `build-icon-library.js --size 144` writes `icon-library-144` (256 colours; ladder 256/192/128/96/64/32, target 14 KB, cap 20 KB; a file that cannot fit is not written, so the 72 px set is used).
- Result: 30,386 files, 309.1 MiB, min 114 B, median 10,784 B, p90 12,617, p99 13,909, max 14,336; 0 over 20 KB, 0 over 16 KB (130 s).
- config: `iconDir` = icon-library-144; `iconFallbackDirs` = [icon-library, icon-cache].
- Tests: full-bleed geometry (one image, 0,0,144,144, slice, no text/rect), fallback order 144->72->text tile, empty black tile, size cap, real-library size sample. Old name/countdown host tests updated. 88 tests pass on Node 20.8.1.
- Verify: restart Streonor; keys show bare icons; a slot with a bogus ID shows a coloured initials tile.

## 2026-11-08 one press = one tap
- index.js sends `{kind:'tap'}` (sender.ps1: down, 30 ms, up, accepted/released 'tap'); config `fireOn` press|release. Old overlap-refusal host test removed (taps no longer overlap).
- Verified on a clean tree built from the index (HEAD + these changes): 88 tests on Node 26 and 20. Another session had uncommitted render/icon work in the same repo; only my hunks were committed.
