# StreonorDock controller plugin 0.1.0

Minimal Streonor S15 / WoW: Forever plugin: 15 fixed chord senders whose keys show only an icon.

Each key is one 144x144 icon filling the **entire** key. No text, count, timer, status, border, inset or overlay.
Empty = blank (black). Assigned but unresolved (or icon file missing) = an icon-only question-mark glyph. The icons come
from the StreonorDock addon's saved data (SavedVariables), which WoW writes only on `/reload` or logout, so keys update at
the next save. Missing, unreadable, garbled or unsupported data blanks the keys; chord sending is never affected.
There are no readout/status actions, cooldown or count displays, press timers, estimates, or log handling. The plugin never
reads or deletes WoW chat or combat logs. Obsolete placed actions (old Readout/Status) are inert: they render nothing.
Not deployed; real input and hardware are unverified.

Source: `src/io.github.dinonuggolus.streonordock.sdPlugin/`. No npm packages, downloads, telemetry, external network or game writes.
The only socket is the SDK's loopback WebSocket to Streonor. Runtime writes are limited to the plugin's own `logs/`.

## Install and first use (user-operated)

1. Run `powershell -NoProfile -File scripts/run-tests.ps1`.
2. Edit `plugin/config.json` if needed (`savedVariablesPath` for the account-wide `.../WTF/Account/<account>/SavedVariables/StreonorDock.lua`
   when auto-detection fails). Close Streonor, run `scripts/deploy-plugin.ps1 -Name io.github.dinonuggolus.streonordock.sdPlugin`, restart Streonor.
3. Use the S15 in landscape. Manually place Dock Key 1 at bottom-left, Dock Key 2-5 across the bottom to the right, Dock Key 6-10 across
   the middle and Dock Key 11-15 across the top (Dock Key 15 top-right). The actions are stable slot numbers; the plugin never rewrites
   your device profile. Keep Mirror controller layout ON in the addon for the same arrangement in game.
4. Each press makes one use attempt. Reload or logout after assignment changes to update controller icons.

Diagnostics: the deployed plugin's `logs/streonordock.jsonl` (capped 1 MiB + one `.previous`).

## Config reference

| Key | Default | Meaning |
|---|---|---|
| `savedVariablesPath` | empty | Explicit account-wide saved data file; never written |
| `gamePath` | `G:\World of Warcraft\_forever_` | Auto-detect `WTF/Account/*/SavedVariables/StreonorDock.lua` (newest mtime wins) |
| `iconDir`, `iconFallbackDirs` | 144 px library, then 72 px library, then old cache | Local icon folders, `<iconFileID>.png/.jpg/.svg` |
| `embedIcons` | true | false = never embed icons (question-mark tiles) |
| `gameProcess` | `Wow.exe` | Foreground process filename guard |
| `fireOn` | `press` | `press` or `release`: when the one short tap is sent |
| `pollIntervalMs` | 1000 | Export file change check (icon sync only; 250-60000) |

## Export contract (schema 2)

Read from the account SavedVariables table `StreonorDockDB.export`:

```lua
StreonorDockDB.export = {
  schemaVersion = 2,
  enabled = true,            -- false blanks all keys; chords keep working
  profileId = "opaque",      -- string
  page = 1,                  -- integer 1..10
  icons = {                  -- keys 1..15 (stable positions, never compacted)
    { iconFileID = 136096 }, -- resolved icon
    { unresolved = true },   -- assigned, icon not known yet: question-mark glyph
    {},                      -- empty: blank
  },
}
```

No action IDs, timestamps, revision or telemetry are read. Bad entries blank only their key; a bad envelope or unknown
`schemaVersion` blanks all. A transitional **schema 1** export (`schema = 1`, `slots[i].iconFileID`) is read for icons only.

## Architecture and file map

| File (under plugin source unless stated) | Responsibility |
|---|---|
| `manifest.json`, `images/icon.png` | 15 Keypad actions; original generated grid icon |
| `lib/luatable.js` | Non-executing Lua data grammar, 5 MiB / depth 64 / 200,000 entries |
| `lib/exportReader.js` | Locate/read/validate the export (schema 2, transitional 1), retry on rewrite |
| `lib/icons.js` | Icon file lookup, validation and size cap (data URI) |
| `lib/render.js` | Full-bleed 144x144 tile: icon, blank, or question glyph |
| `lib/chords.js` | Fixed ALT-CTRL-SHIFT chord plans |
| `plugin/index.js` | Host events, file-change check, redraw, tap routing |
| `plugin/sender.ps1` | Loopback WebSocket relay and guarded scan-code sender |
| `scripts/` | Icon cache/library builders, `check-icons.js`, deploy, tests runner |

## Input behavior

Slot 1..15 sends `ALT-CTRL-SHIFT-` plus `1 2 3 4 5 6 7 8 9 0 - = [ ] \`. Down: left Ctrl, Shift, Alt, key; up in reverse. Foreground must match
`gameProcess`; held physical modifiers or the target key refuse the press (nothing queued, no overlay). One held slot at a time. Focus loss,
stop, EOF, host disconnect and parent death release owned keys. Pager chords are never sent. No macro, sequence, delayed press or replay.

## Tests and test-only controls

Run `scripts/run-tests.ps1` (Node 26 and bundled Node 20.8.1). Tests use authored fixtures, create/remove their own `tests/tmp-*` directories,
never read game files, and never call SendInput. `STREONORDOCK_CONFIG` overrides the config path; `STREONORDOCK_DRY_RUN=1` passes `-DryRun` to the helper.
`tests/minimal.test.js` also greps `lib/` and `plugin/` to prove no game-log reads or deletions.

### Full icon library (automatic icons, no per-icon step)

Two sets, both outside the plugin folder (so `deploy-plugin.ps1` never copies or wipes them) and git-ignored (Blizzard
artwork: never commit or publish), one `<FileDataID>.png` per pack icon the listfile maps (30,386 each):
- `icon-library-144/` (`iconDir`): 144 px, 256-colour palette PNGs, median ~10.8 KB, max ~14 KB, hard cap 20 KB (~309 MiB).
- `icon-library/` (first `iconFallbackDirs` entry): the 72 px set (<= 9.5 KB, ~240 MiB); then the older `icon-cache/`.

Lookup order per slot: 144 px, then 72 px, then old cache, then the question-mark tile. A file over 20 KB
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
to the question-mark tile.

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
3. Restart Streonor. Keys show the real icons; slots with no cached file keep the
   coloured initial tile.
4. New slots/items later: log in, `/reload` so the addon re-exports, re-run step 2, restart
   Streonor.

Why small: each tile is one `setImage` data-URI message. 256x256 icons made ~80 KB messages and the
host showed blank tiles (text too). Cache files above 12 KB are refused (logged as `iconSkipped`)
and the plugin falls back to the question-mark tile; any tile over 40,000 chars is redrawn
text-only (`tileTooLarge`). `--size N` changes the size (0 = copy unchanged), `--force` rebuilds.
Set `"embedIcons": false` in `plugin\config.json` to switch icons off (text-only tiles).

Licensing: the artwork is Blizzard's, redistributed by the pack author for personal,
non-commercial use. `icon-cache/`, the pack and the listfile stay local and must never be
committed or published (`.gitignore` blocks `icon-cache/` and all image/zip types).


## One press = one tap (`fireOn`)

Each physical key press sends the game exactly **one** chord tap: down, ~30 ms, up (`sender.ps1 -TapMs`, default 30), so the game never
sees a long-held chord. Config `fireOn`: `"press"` (default; tap when the key goes down) or `"release"` (tap when it comes up).
A second `keyDown` for a key that is still held (auto-repeat) is ignored until its `keyUp`; a tap is never queued twice; a stray
`keyUp` does nothing. The focus and physical-conflict guards still apply (a refused tap sends nothing and queues nothing). The 2 s
safety release remains for the low-level `chord` command. The addon side acts on the down edge only (see the StreonorDock README,
`/sdock clicks`).

