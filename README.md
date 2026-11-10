# StreonorDock plugin for Streonor (S15 controller)

Turns a Streonor S15 into 15 fixed World of Warcraft: Forever action keys: each key sends one chord
(`ALT-CTRL-SHIFT-1 ... \`) to the game and shows the **icon** of whatever you assigned to that slot in game.

**Requires the StreonorDock addon** (the on-screen bar, assignment and the icon export):
<https://github.com/DinoNuggolus/Stream-Controller-Actionbar-for-Streonor-Dock>

Each tile is a 144x144 icon filling the whole key: no text, count, timer or border. Empty slot = black. Assigned but
icon not known (or no icon file) = a question mark.

## Install (no commands needed)

1. Download `StreonorDock-Plugin-<version>.zip` from this repo's **Releases** page and extract the whole zip to a folder.
2. Double-click **Install StreonorDock Plugin.bat**. It asks before closing Streonor and before starting it again, backs up
   an older copy of this plugin, and changes nothing else (no profile, no other plugin). Windows may show a blue
   "Windows protected your PC" box for the `.bat`: click *More info*, then *Run anyway*.
3. In Streonor open your S15 profile. The category **StreonorDock** has **Dock Key 1 ... Dock Key 15**. With the S15 in
   **landscape**, drag them onto the keys, left to right:

   | Row | Keys |
   |---|---|
   | Top | 11 - 12 - 13 - 14 - 15 |
   | Middle | 6 - 7 - 8 - 9 - 10 |
   | Bottom | 1 - 2 - 3 - 4 - 5 |

   Dock Key 1 is bottom-left, Dock Key 15 top-right. The plugin never rewrites your device profile.
4. Install the StreonorDock addon in WoW (see its README), then `/reload` once in game. Keys update whenever WoW writes
   its saved data (reload or logout).

**Uninstall:** double-click **Uninstall StreonorDock Plugin.bat** (a backup copy is kept next to Streonor's plugins folder).

**Manual install** (if you prefer): copy the folder `io.github.dinonuggolus.streonordock.sdPlugin` into
`%APPDATA%\HotSpot\StreamDock\plugins\` while Streonor is closed.

## Icons

The plugin shows icons from image files named `<iconFileID>.png` (144x144, up to ~20 KB each) in the `icons` folder inside
the installed plugin folder (`%APPDATA%\HotSpot\StreamDock\plugins\io.github.dinonuggolus.streonordock.sdPlugin\icons`).
The release does **not** include game artwork. Without icon files every assigned key shows a question mark (chords still
work). The installer and updates never touch your `icons` folder. Point `iconDir` in `plugin\config.local.json` somewhere
else if you keep a library elsewhere.

## Troubleshooting

* **Keys are black:** the addon must be installed and enabled; `/reload` once; `/sdock export` in game should report
  resolved icons. Check the plugin log `logs\streonordock.jsonl` in the plugin folder.
* **Keys show question marks:** icon files are missing (see Icons).
* **Plugin not listed in Streonor:** Streonor only reads plugins at start - quit it completely (tray icon > Exit) and start it again.
* **"Running scripts is disabled" error:** use the `.bat` files; they start PowerShell with the needed switch for you.
* **WoW not found:** the plugin looks for `World of Warcraft\_forever_` on every drive. If yours is elsewhere create
  `plugin\config.local.json` in the plugin folder with `{"gamePath": "D:\\Games\\World of Warcraft\\_forever_"}`.

## Configuration

`plugin\config.json` ships portable defaults and is replaced on update; put your own values in
`plugin\config.local.json` (never shipped, never overwritten) - same keys, they win.

| Key | Default | Meaning |
|---|---|---|
| `savedVariablesPath` | empty | Explicit path of the account-wide `WTF/Account/<account>/SavedVariables/StreonorDock.lua` |
| `gamePath` | empty = auto-detect | Folder `...\World of Warcraft\_forever_`; auto-detect tries every drive |
| `iconDir`, `iconFallbackDirs` | empty = plugin `icons` | Local icon folders, `<iconFileID>.png/.jpg/.svg` |
| `embedIcons` | true | false = never embed icons (question-mark tiles) |
| `gameProcess` | `Wow.exe` | Foreground process the chords are only sent to |
| `fireOn` | `press` | `press` or `release`: when the one short tap is sent |
| `pollIntervalMs` | 1000 | Export file change check (icon sync only; 250-60000) |

## How it behaves

* **One press = one tap.** Down (~30 ms) then up, sent to the game only while `Wow.exe` is the foreground window; a held
  key never repeats. Held physical modifiers refuse the press. Focus loss, stop, host disconnect and parent exit release
  any keys the plugin holds. No macros, sequences, delayed or replayed presses.
* **No game-log access, no network.** It never reads or deletes WoW chat or combat logs; the only socket is Streonor's
  loopback WebSocket. Runtime writes are limited to its own `logs\`.
* **Export contract (schema 2)** read from `StreonorDockDB.export` in the account SavedVariables:

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

A transitional schema 1 export (`schema = 1`, `slots[i].iconFileID`) is read for icons only.

## For developers

```
src/io.github.dinonuggolus.streonordock.sdPlugin/   the plugin (manifest, plugin/, lib/, images/)
installer/                                         double-click installer (.bat + PowerShell)
scripts/run-tests.ps1                              tests on Node 26 and the Node 20 bundled with Streonor
scripts/deploy-plugin.ps1 -Name <id>.sdPlugin      one-way copy into Streonor's plugins folder (dev)
scripts/build-release.ps1                          builds dist\StreonorDock-Plugin-<version>.zip
```

* Build the release zip: `powershell -File scripts\build-release.ps1` (output in git-ignored `dist\`; contains only the
  plugin folder, installer scripts, README.txt and LICENSE - no tests, logs, icon libraries or game art).
* Tests use authored fixtures and temp folders, never read game files, never call SendInput, and never touch the real
  Streonor plugins folder. `STREONORDOCK_CONFIG` overrides the config path; `STREONORDOCK_DRY_RUN=1` runs the sender in dry-run.
* `scripts/build-icon-library.js`, `build-icon-cache.js`, `check-icons.js` are optional helpers for building your own
  local icon folders from artwork you are allowed to use. **Never commit or publish game artwork** (`.gitignore` blocks
  image types, `icon-*` folders and `dist/`).
* Layout: `lib/exportReader.js` (locate/read/validate the export), `lib/icons.js` (lookup, validation, size cap),
  `lib/render.js` (full-bleed tile), `lib/chords.js` (chord plans), `lib/gamePath.js` (install detection),
  `plugin/index.js` (host events, redraw, taps), `plugin/sender.ps1` (loopback WebSocket relay and guarded scan-code sender).
* Streonor associates `.sdPlugin` files with `Streonor.exe "%1"`; the release uses the installer instead because the
  accepted package layout of that association is not documented.

## License

MIT, see `LICENSE`.
