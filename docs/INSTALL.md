# Install guide: StreonorDock addon + Streonor plugin (start to finish)

You will end up with a World of Warcraft: Forever action bar whose 15 buttons match the 15 keys of your **Streonor S15**:
press a key, the spell or item fires; the key shows its icon. Nothing on this page asks you to open a terminal or type a command (the only typing is `/reload` in the game chat, and you can use the on-screen button instead).

What you need: Windows, WoW: Forever, a Streonor S15, about 5 GB of free disk space while the icons are built (step 4,
optional but recommended).

---

## 1. Install Streonor
Install the Streonor app from the maker of your S15 and start it once, so it creates its folders and detects the S15.
(If it is already installed and working, skip this.)

## 2. Install the addon in WoW
1. Open the addon's page: <https://github.com/DinoNuggolus/Stream-Controller-Actionbar-for-Streonor-Dock> and click
   **Releases** on the right. Download `StreonorDock-<version>.zip`.
2. Right-click the zip, **Extract All...**.
3. You get a folder named **StreonorDock**. Copy it into your game's addon folder:
   `...\World of Warcraft\_forever_\Interface\AddOns\`
   Afterwards `...\AddOns\StreonorDock\StreonorDock.toc` must exist. Everything the addon needs is inside.

## 3. Install the plugin in Streonor
1. Open <https://github.com/DinoNuggolus/StreonorWoW>, **Releases**, download `StreonorDock-Plugin-<version>.zip`.
2. **Extract All...** to a folder (do not run it from inside the zip window).
3. Double-click **Install StreonorDock Plugin.bat**.
   * Windows may show a blue box *"Windows protected your PC"*. Click **More info**, then **Run anyway**. The file is a
     small text script; you can open it in Notepad first.
   * If Streonor is running, the installer asks before closing it. Answer **Y**.
   * It copies the plugin into Streonor's plugin folder, keeps a backup of any older copy, and changes nothing else.
   * When it asks *Start Streonor now?* answer **Y**.

## 4. Build the icon library (optional, but needed for real icons)
**Without this step the keys still work, but each key shows the spell/item NAME on a coloured tile instead of its icon.**
1. In the same extracted plugin folder double-click **Build Icon Library.bat**.
2. It tells you what it will download, from where, and how big it is (about 1.7 GB icon pack from
   `github.com/qcy-hash/wow-forever-icons-png` and about 150 MB listfile from `github.com/wowdev/wow-listfile`). Nothing
   is downloaded until you type **Y**.
3. Wait. It shows progress, checks your disk space first, and builds small key images (about 300 MB) in
   `%LOCALAPPDATA%\StreonorDock\icons`. It then deletes the large downloads.
4. You can close the window at any time and start it again later: finished downloads and icons are kept.
5. The icons are Blizzard artwork downloaded to your own PC for your own use. They are never part of this project.

## 5. Restart Streonor
Right-click the Streonor tray icon, **Exit**, then start Streonor again. (Streonor only loads plugins when it starts.)

## 6. Place Dock Key 1 to 15 on the S15
1. Turn the S15 to **landscape**.
2. In Streonor open your S15 profile. In the action list find the category **StreonorDock**: **Dock Key 1** to **Dock Key 15**.
3. Drag each action onto the key at the same spot, so the grid matches (left to right):

   | Row | Dock Keys |
   |---|---|
   | Top | 11 - 12 - 13 - 14 - 15 |
   | Middle | 6 - 7 - 8 - 9 - 10 |
   | Bottom | 1 - 2 - 3 - 4 - 5 |

   Dock Key 1 is **bottom-left**, Dock Key 15 is **top-right**. The on-screen bar in the game uses the same layout.

## 7. In the game
1. Start WoW: Forever and enable **StreonorDock** on the character select AddOns screen (restart the client if the
   addon does not appear).
2. The bar appears in the middle of the screen and a short tutorial explains the pieces. Click **Next** to go through it
   (**X** hides it for good; you can replay it in Settings).
3. Click the **padlock** in the bar's header to unlock it. Every button shows a **+**.
   * Drag a spell from your spellbook, an item from your bags or a macro from the macro window onto a button, **or**
   * click a button and choose from **Spells**, **Items** or **Macros**.
4. Click the padlock again to lock. Press a key on the S15 (or click the button): one press, one use.
5. The cog opens the settings (layout, look, visibility, pages, profiles).

## 8. The reload prompt
After you changed anything, locking shows a small window: *"Spells or items changed. Reload the UI now so the controller
shows the new icons?"*
* **Reload** reloads the interface. WoW then saves its data and the S15 keys update to the new icons.
* **Cancel** just closes it. Your changes are already active in the game; the keys update the next time you reload or log out.

## 9. If something is wrong
| Problem | What to do |
|---|---|
| Keys are black | Make sure the addon is enabled in game, then reload once (`/reload` in chat, or answer **Reload** at the prompt). Check that the Dock Keys are placed on the keys. Empty slots are black on purpose. |
| Keys show a name on a coloured tile, not an icon | The icon library is missing: run **Build Icon Library.bat** (step 4), restart Streonor, reload in game. |
| Keys show a question mark | The addon has not told the plugin the name or icon yet: reload once. If it stays, the spell/item data was not available in game yet; open the spellbook or bags, then reload. |
| A window says scripts are disabled / "execution policy" | Use the `.bat` files from this guide; they set what PowerShell needs themselves. Do not run the `.ps1` files by double-click. |
| Streonor does not list the StreonorDock actions | Quit Streonor completely from the tray icon and start it again. Check that the folder `io.github.dinonuggolus.streonordock.sdPlugin` exists in `%APPDATA%\HotSpot\StreamDock\plugins`. Run **Install StreonorDock Plugin.bat** again if not. |
| Windows blocks the `.bat` | **More info > Run anyway**. Or right-click the downloaded zip > Properties > tick **Unblock** > OK, then extract again. |
| Not enough disk space for the icons | Free about 6 GB on the drive that holds your user profile, run the builder again. |
| The game folder is not found | Create the file `plugin\config.local.json` inside the installed plugin folder with your game path, as described in the plugin README. |
| A key presses nothing in game | The game window must be in the foreground (the plugin only sends keys to WoW). In game `/sdock chords` lists conflicts with other keybinds. |

To remove everything: run **Uninstall StreonorDock Plugin.bat**, delete the **StreonorDock** addon folder, and delete
`%LOCALAPPDATA%\StreonorDock` if you built icons.
