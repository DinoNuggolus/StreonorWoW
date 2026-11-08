# StreonorDock controller plugin 0.1.0

15 fixed chord senders and icon/cooldown displays for Streonor S15 / WoW: Forever.

The displays are drawn from the StreonorDock addon's saved data file (SavedVariables). WoW writes
that file only when the game saves (`/reload`, logout), so the keys show what the addon saved last;
they update at the next save. If the file is missing or unreadable the keys draw neutral empty tiles
(the reason is logged) and key sending is unaffected.
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
6. Without a saved export the keys show neutral tiles. With a character, set up the
   StreonorDock addon and `/reload` or logout. Images should update within a polling interval.
   Buttons send fixed chords even when the saved data is missing; focus must be Wow.exe.

Read diagnostics in the **deployed** plugin's `logs/streonordock.jsonl` (one JSON object per
line); `.previous` is the preceding capped log. Example: `Get-Content <plugin>/logs/streonordock.jsonl -Tail 30`.
Source tests write logs only in the source plugin's own `logs/`. Each log file is capped at
1 MiB, with one prior file. Errors are bounded and repeated data-file failures are suppressed.
There is no property inspector and action settings cannot remap keys.

## Config reference

| Key | Default | Meaning |
|---|---|---|
| `savedVariablesPath` | empty | Explicit account-wide saved data file; never written |
| `gamePath` | `G:\World of Warcraft\_forever_` | Auto-detect beneath `WTF/Account/*/SavedVariables/StreonorDock.lua`; newest mtime wins |
| `iconDir` | empty | Plugin `icons/`; an absolute alternative or path relative to plugin root |


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

| `lib/render.js` | Pure escaped 144x144 SVG: icon, name, cooldown timer, page badge; Status shows the page |
| `lib/chords.js` | Fixed slot-to-chord/VK/scan plans, independently compared to addon Core.lua |
| `plugin/index.js` | Host arguments, lifecycle, shared tick, image deduplication, input routing and capped logs |
| `plugin/sender.ps1` | Loopback WebSocket relay + focus/modifier checks, scan-code SendInput and release lifecycle |
| `plugin/config.json` | Local configuration above |
| `tests/*.test.js`, `tests/mockhost.js` | Node built-in tests, authored fixture, actual PowerShell relay integration |
| `scripts/run-tests.ps1` | Runs the entire suite under Node 26 and bundled Node 20.8.1 |
| `scripts/build-manifest.js` | Reproduces manifest and icon with Node built-ins |
| `scripts/deploy-plugin.ps1` | Existing deployment utility, reused with explicit plugin name; not executed |

The shared one-second tick polls while contexts exist. Only changed SVGs are sent: item timers
redraw once a second while counting. The tick is cancelled when no actions are visible. No fs.watch dependency.
Registration, willAppear/willDisappear, keyDown/keyUp and didReceiveSettings follow the
[SDK event contract](https://sdk.key123.vip/en/guide/events-received.html);
[setImage](https://sdk.key123.vip/en/guide/events-sent.html) uses target 0 and SVG data URIs.
Host output backpressure does not block the helper's safety loop; a bounded asynchronous queue
holds display messages only, never input to replay.

## Saved data and timer meaning

Schema 1: `{schema,profileId,revision,savedAt,page={index,count},slots[1..15],readouts[1..3],player?}`.
Only `kind`, ordinary IDs/name/icon, and item `source` / `endsAt` reach rendering (counts and other fields are ignored).
Spells have no cooldown display. Unknown or odd fields are dropped; unknown schema fails soft.
The source exports `game`, `est`, or `used`: these become `game`, `est`, `USED`; a known source
without an end time shows `CD ?`. `USED` has no exported start time, so elapsed time cannot
honestly be reconstructed.

`savedAt` and `endsAt` are server seconds. At read time, the file's mtime (local milliseconds)
anchors `savedAt`: `serverNow = savedAt + max(0, (localNow - fileMtime)/1000)`.
Remaining is `max(0, endsAt - serverNow)`, display-clamped to one day. This lets an **existing**
timer count down; no new cooldowns are learned until the next save. A press never starts a
controller timer.
Files copied/restored with fresh mtimes can shift cooldown anchors; do a fresh `/reload`.
Timestamp precision, save delay, and clock skew make the mapping approximate.

Keys/readouts show a page badge and the item cooldown (`Ns game|est`, `USED`, `CD ?`). Missing or
invalid data draws neutral tiles with no banner. The Status region shows `StreonorDock` and, when data is
loaded, `Page N/M`. Player gold/bag fields are parsed by the addon export but not used here.

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

### Key look: icon only, full-bleed (144 px library)

A key with an icon draws ONLY the icon, full-bleed over the whole 144x144 tile (`preserveAspectRatio="xMidYMid slice"`):
no border, inset, name, `P1 . 1` caption, count badge, cooldown or timer. The press timers still exist in code but are no
longer drawn on key tiles (`legacySlot` in `lib/render.js` keeps the old overlay renderer for its tests).
- Empty slot: fully black tile, nothing on it.
- Filled slot whose icon cannot be found or is over the size cap: plain full-bleed coloured tile with the first letters
  of the name. This is the only text a key can show, so a missing icon is noticed.
- No snapshot yet: the neutral placeholder is unchanged. Money/currency readouts keep their own layout.

### Full icon library (automatic icons, no per-icon step)

Two sets, both outside the plugin folder (so `deploy-plugin.ps1` never copies or wipes them) and git-ignored (Blizzard
artwork: never commit or publish), one `<FileDataID>.png` per pack icon the listfile maps (30,386 each):
- `icon-library-144/` (`iconDir`): 144 px, 256-colour palette PNGs, median ~10.8 KB, max ~14 KB, hard cap 20 KB (~309 MiB).
- `icon-library/` (first `iconFallbackDirs` entry): the 72 px set (<= 9.5 KB, ~240 MiB); then the older `icon-cache/`.

Lookup order per slot: 144 px, then 72 px, then old cache, then the coloured initials tile. A file over 20 KB
(`MAX_EMBED_BYTES` in `lib/icons.js`) is skipped (logged as `iconSkipped`) and the next directory is tried, so a tile is
never blank. The plugin also redraws a tile text-only if its encoded message would exceed 40,000 characters (earlier
~50-75 KB payloads blanked tiles).

Runtime flow (all local, no network, no AI): `/reload` in game -> the addon rewrites `StreonorDock.lua` -> the plugin sees
the changed file and re-reads the slots -> looks up `<iconFileID>.png` as above -> draws it. Restart Streonor once after
deploying; afterwards just put any item or spell on a button and `/reload`.

Rebuild or extend (incremental, skips valid existing files, prints unresolved; no npm dependencies):
`node scripts\build-icon-library.js --size 144` (144 px set) and `node scripts\build-icon-library.js` (72 px set). Needs the
pack in `_staging\icon-pack\png\png_icons` and `_staging\listfile\community-listfile.csv`; options
`--size 72|144 --pack --listfile --library --workers N --force`. Check the current export: `node scripts\check-icons.js`
(pass `--dir` once per directory). Icons the pack lacks (3,499 listfile IDs have no pack file, mostly newer art) fall back
to the initials tile.

### Populating icons from the community pack (older per-export cache; superseded by the library)

The shipped config sets `iconDir` to `G:\WoWFOREVER_ADDONS\StreonorWoW\icon-cache` (outside the
plugin folder, so `deploy-plugin.ps1`'s `/MIR` never wipes it). Steps:

1. One-time downloads into `G:\WoWFOREVER_ADDONS\_staging\` (git-ignored, user-approved):
   the pack `png_icons.zip` from github.com/qcy-hash/wow-forever-icons-png (v1.0.0, 1.73 GiB,
   extracted to `icon-pack\png\png_icons\`; 30,386 PNGs named by icon name, 256x256) and
   `community-listfile.csv` from github.com/wowdev/wow-listfile (147 MB) in `listfile\`.
2. Run: `node scripts\build-icon-cache.js --listfile ..\_staging\listfile\community-listfile.csv`
   It reads every `iconFileID` in your newest `StreonorDock.lua` (read-only), maps ID to icon
   name via the listfile, shrinks only those PNGs to 72x72 (4-9 KB each) into `icon-cache\<ID>.png`, skips existing
   small files and prints resolved/unresolved IDs. The pack is never modified. Options: `--ids file.txt`,
   `--export path`, `--pack dir`, `--cache dir`, `--dry-run`.
3. Restart Streonor. Keys/readouts show the real icons; slots with no cached file keep the
   coloured initial tile.
4. New slots/items later: log in, `/reload` so the addon re-exports, re-run step 2, restart
   Streonor.

Why small: each tile is one `setImage` data-URI message. 256x256 icons made ~80 KB messages and the
host showed blank tiles (text too). Cache files above 12 KB are refused (logged as `iconSkipped`)
and the plugin falls back to the text/initials tile; any tile over 40,000 chars is redrawn
text-only (`tileTooLarge`). `--size N` changes the size (0 = copy unchanged), `--force` rebuilds.
Set `"embedIcons": false` in `plugin\config.json` to switch icons off (text-only tiles).

Licensing: the artwork is Blizzard's, redistributed by the pack author for personal,
non-commercial use. `icon-cache/`, the pack and the listfile stay local and must never be
committed or published (`.gitignore` blocks `icon-cache/` and all image/zip types).

## Staged verification when a character exists

1. Start with starter spell on key 1, bag item on key 2/readout 1; run `/sdock probe` and
   `/sdock chords` per the addon's own checklist. Focus WoW: each controller press must fire
   exactly once. Check both ActionButtonUseKeyDown settings and OEM slots 11..15.
2. Release, switch away from WoW, press: no input, showAlert. Hold a physical modifier first:
   refusal. Hold a controller key then switch focus or wait 2 seconds: no stuck modifiers;
   release before the next press. Confirm rapidly overlapping buttons are refused as documented.
3. `/reload`: verify icons and page number. Change pages out of combat,
   `/reload`, verify exported page matches; pager keys remain addon bindings.
4. Missing/invalid export: neutral tiles. Verify chord sending still works.
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
- File mtime anchors the saved cooldown end times closely enough; copied files, skewed clocks and same-size writes
  with unchanged mtimes cannot be resolved perfectly. No live data route exists.
- Rapid overlapping slots are intentionally refused. A physically lost keyUp leaves that slot
  suppressed until an up/context removal; timeout releases keys but never guesses another press.
- LocalAI/Star Citizen deployed references could not be read: sandbox denied access despite
  task permission. The readable spike and scratchpad mock, SDK and new tests informed this build.
- Fresh reviewer delegation failed in the tool service; final review was by the implementing agent.
  This does not replace project-manager review. No deployment, profile edit, git write or push occurred.

## Cooldown timers (press-started, plugin-side)

The saved data file only changes when the game saves, so a cooldown that starts mid-session can never
arrive through it. The plugin therefore starts its own timer:

- The addon exports, per item slot, the cooldown length it already knows: `cooldownSeconds`,
  `cooldownSource` (`learned` | `verified` | `table`) and, for items sharing a lock, `poolKey`
  (e.g. `pool:potion`). Unknown length = nothing exported = no timer. Spells get no timer (their
  cooldowns are sealed in combat). Extra fields are tolerated by schema 1.
- When the sender **accepts** a physical press (same one-press-one-chord rule; repeats, refused,
  unfocused, conflict and failed sends are not accepted) on an item slot with a known length, the
  plugin starts a countdown (absolute end time = now + length) shared by the `poolKey` (or the item).
  A press while that timer runs does not restart or extend it.
- While running, the key shows a big yellow number centered over the icon on a dark translucent
  backdrop: seconds under 90, `2m` from 90 s, `2h` from 90 min. It clears at zero. The shared redraw tick already
  runs once a second only while actions are visible.
- A cooldown that was running when the game saved (`endsAt`) is still shown for the remainder.

Honest limits: a press the game refuses (item not ready, out of range, dead, no target) can still
start a false timer; the planned fix is an optional combat-log confirmation (not built). The timer
lives in plugin memory and is lost when the plugin restarts. Lengths are only as good as the
addon's learned/shipped data.

## Chat/combat log cleanup

The addon turns on the client's own chat and combat file logging (see the StreonorDock README). Those
files (`Logs\WoWChatLog*.txt`, `Logs\WoWCombatLog*.txt`) grow quickly and contain other players' chat, so
the plugin deletes them for privacy once the game is done with them.

- Config (`plugin/config.json`): `deleteLogsOnLogout` (default `true`; set `false` to turn this off) and
  `logDir` (default `<gamePath>\Logs`).
- **Deleted:** only regular files directly inside that one directory whose names match exactly
  `^WoW(Chat|Combat)Log.*\.txt$`. Never any other file, never a directory, never anything in a subfolder;
  symlinks/junctions are not followed and the file's real path must stay inside the directory.
- **When:** at plugin start, and whenever the saved data file gets a newer modification time (the
  "logout detected" signal; `/reload` also rewrites it). Files are only deleted while **no Wow.exe process
  is running**: the relay counts processes by name (`Get-Process -Name Wow`, count only, no handle to the
  game is opened); if the check fails the plugin assumes the game is running. If anything is pending
  (game still running, or Windows refuses because WoW still holds a file: EBUSY/EPERM/EACCES), it retries
  every 30 s on one timer that stops once nothing is pending. A refused delete is never an error.
- **Caveat:** because deletion waits for the game to exit, logs stay readable for the whole session and
  disappear after you quit WoW (while the plugin is running).
- Each attempt is logged to `streonordock.jsonl` as counts only (`deleted`, `busy`, `skipped`, `errors`).

### Cooldown look (OmniCC style)

While an item timer runs, the key icon is desaturated and dimmed; a clockwise pie wedge starting at
12 o'clock restores full colour as time elapses; a big white number with a dark outline is centred
over the icon (OmniCC text: seconds under 90, then whole minutes `2m` from 90 s, whole hours `2h` from 90 min; never `m:ss`). When the timer ends the plain icon returns. The icon is
embedded once in `<defs>` and drawn twice with `<use>` (gray copy with an `feColorMatrix` saturate
filter, colour copy clipped by the wedge), so the payload stays at one icon; a translucent dim rect keeps
the state visible if a renderer ignores the filter. Keys without an icon use the same treatment on the
text tile. Sweeps use the press-timer length, or `cooldownSeconds` for a cooldown running at save time.
Spells intentionally have **no** timer (spell cooldowns are sealed in Forever).

Redraw cadence (one shared timer, cancelled when idle): `redrawIntervalMs` (default 1000), and
`fastRedrawIntervalMs` (500) only while a press timer has <= `fastRedrawWithinSeconds` (10) left.

## Money and currency readouts (Dock Readout 1..3)
Pick what a readout shows IN GAME: left-click readout slot 1/2/3 in the StreonorDock panel and choose
Empty, Money, or any currency the character has right now (Honor, tokens, ...). The S15 LCD strip is
view-only, so this cannot be done on the device. The panel saves the choice per character.

Each readout panel shows the currency icon (library lookup by iconFileID, like the keys), a short name and
one big plain value: money as `12g 34s 56c`, other currencies with thousands separators. No age, snapshot or
stale text. **Accuracy:** the number is exact at each `/reload` or logout (it is the addon's saved value). Between
saves the plugin ESTIMATES gains by reading the client chat log (`Logs\WoWChatLog.txt`) read-only and
incrementally: the player's own `You loot ...`, `Your share of the loot is ...`, `You receive currency: ...` and
honor-award lines add to the saved value within a few seconds. Spending (vendor purchases, repairs, mail,
auction) writes no chat line, so it shows only after the next `/reload`, which also replaces the estimate
with the true value and drops all pending deltas. Lines that are not clearly the player's own, or match no known
format, are ignored, never guessed. Chat/combat logs are deleted after the game exits (`deleteLogsOnLogout`);
set it to `false` temporarily to collect real samples for new rules.
Config (`plugin/config.json`): `liveEstimates` (default `true`; `false` = saved values only), `showEstimateMarker`
(default `false`; `true` prefixes `~` while a value is an estimate), optional `chatLogPath` (absolute).

### Spell timers

Spell keys now get the same press-started countdown and sweep as items, using `cooldownSeconds` from the
addon export (`cooldownSource` = `learned` | `base` | `category` | `table`; `verified`, `categorySeconds`,
`poolKey` optional). No known length = no timer. Spells with charges (`maxCharges` in the export) get **no** timer.
Pool/category sharing happens only when the export carries a `poolKey`. A press the game refuses (mana, range,
global cooldown, dead) can still start a false timer. Lengths come from the game's base cooldown or from out-of-combat
learning in the addon; run `/sdock cdprobe` in game to see what the addon reads.
