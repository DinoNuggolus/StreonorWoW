# StreonorDock controller plugin 0.1.0

15 fixed chord senders and saved snapshot displays for Streonor S15 / WoW: Forever.
Built and tested locally without WoW or a device. **Not deployed; real input and hardware are unverified.**

Source: `src/io.github.dinonuggolus.streonordock.sdPlugin/`. No npm packages, downloads, telemetry, external
network, or game writes. The only socket is the SDK's loopback WebSocket to Streonor. Runtime
writes are restricted to that plugin folder's `logs/`. Tests use authored fixtures under `tests/`.

## Install and first use (user-operated; not performed by the implementation)

1. Review the source and run `powershell -NoProfile -File scripts/run-tests.ps1` from this repo.
2. Edit source `plugin/config.json` if needed. Set `savedVariablesPath` to the account-wide
   `.../WTF/Account/<account>/SavedVariables/StreonorDock.lua` when auto-detection fails or
   multiple accounts exist. Use JSON escaped backslashes or forward slashes. Restart after changes.
3. Close Streonor, then run `scripts/deploy-plugin.ps1 -Name io.github.dinonuggolus.streonordock.sdPlugin`.
   This is the existing opt-in deployment script: it backs up an existing plugin and copies
   this source. Inspect it before running; it is never invoked by the tests.
4. Restart Streonor. **First, drag Dock Key 1..15 from the StreonorDock category onto the
   profile in row-major order**, left to right, top to bottom: rows 0..4, columns 0..2.
5. Row 5 has **three** Information regions, so choose three of the four Information actions.
   Recommended initial layout: Dock Readout 1 at (5,0), Dock Readout 2 at (5,1), Dock Status
   at (5,2). Swap Status for Readout 3 to see all three items, or use a second Streonor profile
   layout. Stock system-monitor widgets remain swappable in any Information region.
6. Without a saved export, `NO DATA / STALE` is expected. With a character, set up the
   StreonorDock addon and `/reload` or logout. Images should update within a polling interval.
   Buttons send fixed chords even with missing or stale data; focus must be Wow.exe.

Read diagnostics in the **deployed** plugin's `logs/streonordock.jsonl` (one JSON object per
line); `.previous` is the preceding capped log. Example: `Get-Content <plugin>/logs/streonordock.jsonl -Tail 30`.
Source tests write logs only in the source plugin's own `logs/`. Each log file is capped at
1 MiB, with one prior file. Errors are bounded and repeated snapshot failures are suppressed.
There is no property inspector and action settings cannot remap keys.

## Config reference

| Key | Default | Meaning |
|---|---|---|
| `savedVariablesPath` | empty | Explicit account-wide snapshot file; never written |
| `gamePath` | `G:\World of Warcraft\_forever_` | Auto-detect beneath `WTF/Account/*/SavedVariables/StreonorDock.lua`; newest mtime wins |
| `iconDir` | empty | Plugin `icons/`; an absolute alternative or path relative to plugin root |
| `staleAfterSeconds` | 600 | Age threshold; nonnegative finite number, bounded at 365 days |
| `gameProcess` | `Wow.exe` | Foreground process filename; compared case-insensitively, no window-title matching |

Auto-detection reads only when the plugin has visible actions. It scans at most 4096 account
entries, never character SavedVariables; account `StreonorDockDB.export` already represents
the last saved character. `StreonorDockCharDB` is layout persistence, not the display source.

## Architecture and file map

| File (under plugin source unless stated) | Responsibility |
|---|---|
| `manifest.json`, `images/icon.png` | 15 Keypad actions, 3 readouts + alternative Status Information action; original generated grid icon |
| `lib/luatable.js` | Non-executing Lua data grammar, 5 MiB / depth 64 / 200,000 entries |
| `lib/exportReader.js` | One-second stat polling; bounded read and stat/read/stat verification, 3 attempts, schema-1 field allowlist |
| `lib/icons.js` | Bounded local icon sources, inert SVG subset, stable coloured initial fallback |
| `lib/render.js` | Pure escaped 144x144 SVG, counts, page, cooldown, stale/missing states |
| `lib/chords.js` | Fixed slot-to-chord/VK/scan plans, independently compared to addon Core.lua |
| `plugin/index.js` | Host arguments, lifecycle, shared tick, image deduplication, input routing and capped logs |
| `plugin/sender.ps1` | Loopback WebSocket relay + focus/modifier checks, scan-code SendInput and release lifecycle |
| `plugin/config.json` | Local configuration above |
| `tests/*.test.js`, `tests/mockhost.js` | Node built-in tests, authored snapshot, actual PowerShell relay integration |
| `scripts/run-tests.ps1` | Runs the entire suite under Node 26 and bundled Node 20.8.1 |
| `scripts/build-manifest.js` | Reproduces manifest and icon with Node built-ins |
| `scripts/deploy-plugin.ps1` | Existing deployment utility, reused with explicit plugin name; not executed |

The shared one-second tick polls while contexts exist. Only changed SVGs are sent: item timers
redraw once a second while counting; Status age uses seconds under a minute, minutes under an
hour, then hours/days. The tick is cancelled when no actions are visible. No fs.watch dependency.
Registration, willAppear/willDisappear, keyDown/keyUp and didReceiveSettings follow the
[SDK event contract](https://sdk.key123.vip/en/guide/events-received.html);
[setImage](https://sdk.key123.vip/en/guide/events-sent.html) uses target 0 and SVG data URIs.
Host output backpressure does not block the helper's safety loop; a bounded asynchronous queue
holds display messages only, never input to replay.

## Snapshot and timer meaning

Schema 1: `{schema,profileId,revision,savedAt,page={index,count},slots[1..15],readouts[1..3],player?}`.
Only `kind`, ordinary IDs/name/icon/count, and item `source` / `endsAt` reach rendering.
Spells have no cooldown display. Unknown or odd fields are dropped; unknown schema fails soft.
The source exports `game`, `est`, or `used`: these become `game`, `est`, `USED`; a known source
without an end time shows `CD ?`. `USED` has no exported start time, so elapsed time cannot
honestly be reconstructed. Missing counts remain absent, never fabricated as zero.

`savedAt` and `endsAt` are server seconds. At read time, the file's mtime (local milliseconds)
anchors `savedAt`: `serverNow = savedAt + max(0, (localNow - fileMtime)/1000)`.
Remaining is `max(0, endsAt - serverNow)`, display-clamped to one day. This lets an **existing**
snapshot timer count down; no new uses are learned until the next save. A press never starts a
controller timer. Age is the larger of elapsed time since mtime and local wall time minus
`savedAt`, clamped at zero. Clock skew therefore biases toward an older/stale warning.
Files copied/restored with fresh mtimes can shift cooldown anchors; do a fresh `/reload`.
Timestamp precision, save delay, and clock skew make the mapping approximate.

Keys/readouts show page badges and OLD SNAPSHOT above the threshold; missing/invalid data
shows NO DATA and STALE. Status always says SAVED SNAPSHOT and shows page and age.
Player gold/bag fields are parsed but deliberately not used for the three **item** readouts.

## Input behavior

Slot 1..15 sends `ALT-CTRL-SHIFT-` plus `1 2 3 4 5 6 7 8 9 0 - = [ ] \`.
Down: left Ctrl, left Shift, left Alt, key. Up: key, Alt, Shift, Ctrl. The OEM VKs are
BD/BB/DB/DD/DC; scans use US physical key positions (layout verification required).
One held slot at a time: overlaps are refused and showAlert, never queued. Repeated downs
are ignored until matching up, including after refusal or the 2-second release timeout.
Foreground must match gameProcess; held physical modifiers (including right variants/Windows)
or the chord's target key refuse the press. Focus loss releases owned keys. Up/release can run
without game focus so owned modifiers are not left held. Normal stop, stdin EOF, host disconnect
and monitored parent death also release. Abruptly killing the helper or Windows cannot run cleanup.
GetAsyncKeyState cannot distinguish a physical modifier pressed *after* our injected down;
avoid physically holding the same modifiers during a controller hold. Windows scheduling is
not real-time; the nominal 2-second timeout is checked on the helper loop.
Pager chords are never sent; bind paging inside WoW. No macro, sequence, delayed press or replay.

## Tests and test-only controls

Run `scripts/run-tests.ps1`. Node 26: `C:\Program Files\nodejs\node.exe`; target runtime:
`C:\Program Files (x86)\Streonor\node\node20.exe` (20.8.1). No installation needed.
Tests create/remove their own `tests/tmp-*` directories and never read game files.
Only the addon source Core.lua is read to cross-check chords. PS syntax is checked using
the PowerShell parser; compiled native definitions load, but **SendInput is never called**.
`STREONORDOCK_CONFIG` overrides the config path for fixture tests; `STREONORDOCK_DRY_RUN=1`
passes `-DryRun` to the helper and prints diagnostics to stdout. Helper `-DryRunGuard` can
simulate unfocused/conflicting states; it has no effect on real input. Do not set these for
normal deployment. All outbound host WebSocket traffic is tested through the real helper.

## Icons supplied later

Add `icons/<fileDataID>.png`, `.jpg`, or `.svg` inside the plugin, or configure `iconDir`.
Files over 512 KiB are ignored. PNG/JPEG signatures are checked. SVG accepts a deliberately
small shape subset; scripts, CSS, links, entities, and external resources are rejected.
No icon files are bundled yet; coloured initial tiles are expected. A community listfile CSV
maps FileDataIDs to names only: it does not supply the images. Obtain pictures separately
under suitable permissions and copy them locally; the plugin never downloads anything.

## Staged verification when a character exists

1. Start with starter spell on key 1, bag item on key 2/readout 1; run `/sdock probe` and
   `/sdock chords` per the addon's own checklist. Focus WoW: each controller press must fire
   exactly once. Check both ActionButtonUseKeyDown settings and OEM slots 11..15.
2. Release, switch away from WoW, press: no input, showAlert. Hold a physical modifier first:
   refusal. Hold a controller key then switch focus or wait 2 seconds: no stuck modifiers;
   release before the next press. Confirm rapidly overlapping buttons are refused as documented.
3. `/reload`: verify icons/counts, page number and snapshot age. Change pages out of combat,
   `/reload`, verify exported page matches; pager keys remain addon bindings.
4. Leave export untouched beyond staleAfterSeconds: OLD SNAPSHOT. Missing/invalid export:
   NO DATA. Verify chord sending still works in both states.
5. With a cooldown item, use it then save: displayed countdown follows exported end time,
   `game`/`est` label remains visible, reaches zero, and a later save corrects it. With unknown
   duration: USED; no made-up countdown. Test the addon's combat readability separately.
6. Verify all three panel regions, Status/readout swapping, actual pixel size/readability,
   device unplug, profile switching, Streonor restart and release behavior.

## Unverified assumptions and limitations

- Actual S15/host event ordering, SVG rendering, panel aspect/readability, app restart discovery,
  unplug behavior, and real Windows key delivery/UIPI are not tested without the device/game.
- US keyboard scan positions produce the intended OEM characters in this user's game layout;
  left ALT self-cast/layout hotkeys and overlays do not intercept them (test in game).
- Foreground process really is Wow.exe (configurable), matching by filename is sufficient for
  this local use, and GetAsyncKeyState reports the relevant physical state in the game desktop.
- Actual addon/API/export persistence, secret guards, item cooldown observations and save timing
  remain the addon's in-game checklist. Fixtures reproduce its current source, not an observed save.
- File mtime anchors the snapshot closely enough; copied files, skewed clocks and same-size writes
  with unchanged mtimes cannot be resolved perfectly. No live data route exists.
- Rapid overlapping slots are intentionally refused. A physically lost keyUp leaves that slot
  suppressed until an up/context removal; timeout releases keys but never guesses another press.
- LocalAI/Star Citizen deployed references could not be read: sandbox denied access despite
  task permission. The readable spike and scratchpad mock, SDK and new tests informed this build.
- Fresh reviewer delegation failed in the tool service; final review was by the implementing agent.
  This does not replace project-manager review. No deployment, profile edit, git write or push occurred.
