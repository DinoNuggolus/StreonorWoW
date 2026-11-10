# Replacing the old StreonorDock plugin with the renamed one

The plugin id changed to `io.github.dinonuggolus.streonordock` (folder `io.github.dinonuggolus.streonordock.sdPlugin`).
Streonor stores key placements by action id, so placements made with the old plugin do **not** carry over. The old
and new plugin can be installed side by side (different folders and ids); only the new one should stay.

## 1. Install the new plugin
1. Quit Streonor completely (tray icon > Exit), so it does not hold the plugin folder.
2. Extract the release zip and double-click `Install StreonorDock Plugin.bat` (developers can run
   `scripts\deploy-plugin.ps1 -Name io.github.dinonuggolus.streonordock.sdPlugin` instead). It copies the plugin to
   `%APPDATA%\HotSpot\StreamDock\plugins\`, backs up an existing copy of the same name and never touches the old folder
   or your profiles.
3. Start Streonor.

## 2. Place the keys (S15 in landscape)
Open your S15 profile in Streonor. The new plugin appears as category **StreonorDock** with 15 actions
**Dock Key 1 ... Dock Key 15** (and nothing else). Drag each action onto the physical key so the keyboard looks like this
from the front, left to right:

| Row | Keys |
|---|---|
| Top | Dock Key 11 - 12 - 13 - 14 - 15 |
| Middle | Dock Key 6 - 7 - 8 - 9 - 10 |
| Bottom | Dock Key 1 - 2 - 3 - 4 - 5 |

Dock Key 1 is bottom-left, numbering goes right, then up; Dock Key 15 is top-right. The in-game bar uses the same
arrangement while *Mirror controller layout* is on (Settings > Bar > Layout).

## 3. Remove the old plugin
1. In the profile, delete the old placements (the old actions sit in a second **StreonorDock** category that also
   offers *Dock Readout* and *Dock Status* entries). Optionally keep them until the new keys work.
2. Quit Streonor completely.
3. In `%APPDATA%\HotSpot\StreamDock\plugins\` find the StreonorDock folders:
   `Get-ChildItem "$env:APPDATA\HotSpot\StreamDock\plugins" -Directory | Where-Object Name -like '*streonordock*'`
   There will be two. **Delete the one whose name does not start with `io.github.dinonuggolus`.**
   Do not touch any other plugin folder.
4. Start Streonor again.

## 4. Check
1. Start WoW, `/reload` once so the addon writes the icon export.
2. The 15 keys should show your spell, item and macro icons (an empty slot is black; a question mark means the icon is
   not known yet). Press each key once: one press = one use.
3. If the keys stay black: confirm the addon is enabled, `/sdock export` shows resolved icons, and the plugin log in
   `%APPDATA%\HotSpot\StreamDock\plugins\io.github.dinonuggolus.streonordock.sdPlugin\logs` mentions the export file.

Reverting: the previous plugin folder is also kept by `deploy-plugin.ps1` backups under the workspace `_backups` folder.
