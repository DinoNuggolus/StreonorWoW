# StreonorDock addon: design (v1)

Status: DRAFT for user review. Nothing implemented. Background: [../../../docs/wow-to-desktop-data-path.md](../../../docs/wow-to-desktop-data-path.md), [../../../docs/streonor-s15-findings.md](../../../docs/streonor-s15-findings.md).

## Intent (what we understood)
The user wants a WoW: Forever druid controlled from the Streonor S15: each of the 15 LCD keys fires one reserved key chord, shows its spell/item icon, and (later) shows counts, plus the three panels show gold / free bag space. Drag-and-drop into a 15-slot in-game panel should be the single source of truth for what each key does and what its icon is. No memory reading, no automation of gameplay, no restricted (secret) combat data exported.

## Scope of this sub-project
**In:** the WoW addon `StreonorDock` (own repo, `type: original`, private).
**Out (separate sub-projects, each gets its own spec):** the Streonor plugin that reads the export and draws keys/panels; the live bridge (chat-log tail or pixel strip); druid form/page logic; the key-sending profile in Streonor.

## Behavior
1. **Panel**: movable frame, 3 columns x 5 rows (mirrors the device grid: rows 0-4, cols 0-2). Slot N maps to device key N (row-major).
2. **Assign**: drag a spell (spellbook) or item (bag) onto a slot out of combat; stores kind + id; right-click clears. Combat: edits disabled, queued assignments not supported in v1.
3. **Fire**: each slot is a `SecureActionButtonTemplate` button (`type=spell` by name / `type=item` by `item:<id>`), so the key press runs the real action through Blizzard's secure path.
4. **Bindings**: per-slot chord applied with override bindings (`SetOverrideBindingClick`) on login and after combat. Override bindings are not written to `bindings-cache.wtf`, so no WTF files are edited. Before binding, the addon warns in chat if a chord already maps to another action.
5. **Export**: `StreonorDockDB` holds, per character, `export = { version, character, realm, time, slots[1..15]={kind,id,name,iconFileID,chord,count}, player={gold,freeSlots} }`. Values refresh in memory on bag/money events; the game writes them to disk at `/reload`, logout or exit. The plugin treats data older than a threshold as stale.
6. **Never exported**: spell cooldowns/charges or any value the API marks secret. Item `count`, gold and free slots are ordinary values (to be confirmed in game, in and out of combat).
7. **Slash**: `/sdock` toggles panel, `/sdock export` reminds to `/reload`, `/sdock chords` lists chords and conflicts.

## Units
- `Core.lua` pure logic (slot model, validation, export builder); no WoW calls, unit-testable outside the game.
- `Panel.lua` UI and drag/drop; `Secure.lua` buttons + bindings (combat-lockdown aware); `Export.lua` collects unrestricted values into the DB; `Init.lua` events and slash.

## Constraints from the user's Forever addon rules (added 2026-11-07, see `../../../docs/forever-addon-rules/`)
- Lua **5.1** only (no `goto`, `//`, bitwise ops, `_ENV`, `io`, `os`, `require`). Load order = TOC. Every file starts `local addonName, ns = ...`; shared state on `ns`.
- TOC: `## Interface: 16001`, Title, Notes, Author, Version, `SavedVariables: StreonorDockDB`, Category, IconTexture; Addon Compartment entry optional (untested on Forever).
- `StreonorDockDB` is created/merged onto defaults **only inside `ADDON_LOADED`** for this addon. One event frame + handler table, no `OnUpdate` polling.
- Spell/item data: `C_Spell.GetSpellInfo` (returns a table) and `C_Item.GetItemInfo`; both may return nil until cached -> call the `Request...` loader and wait for `SPELL_DATA_LOAD_RESULT` / `ITEM_DATA_LOAD_RESULT`. Slot icons may therefore fill in late; export stores `iconFileID` only once known.
- **Secret values**: guard with `issecretvalue` before storing, branching or exporting. The export builder drops (sets nil) any secret field instead of erroring; secret values are never written to SavedVariables.
- **No combat log, no secure snippets** (snippet compilation was reported broken). Our secure buttons use plain `type`/`spell`/`item` attributes only. Override-binding behavior is **not covered** by the guides: add an in-game capability probe (`/sdock probe`) for `SetOverrideBindingClick`, `GetBindingAction`, `C_Spell`/`C_Item` presence, `issecretvalue`; fallback is BindPad-style `SetBinding` to a `CLICK` action.
- Do not call protected chat/waypoint functions or touch Blizzard unit frames. "Skin and inform": one press = one action, no automation.
- Combat: `InCombatLockdown()` check before showing/hiding/moving/binding; queue closures to `PLAYER_REGEN_ENABLED`.
- Slash command `/sdock` with help text. A Settings-API options panel is deferred to v1.1.
- Install target here is `G:\World of Warcraft\_forever_\Interface\AddOns\StreonorDock\` (live client 1.60.1.70790), via `scripts\deploy.ps1`; the guides' beta path `_classic_beta_` does not apply. The guides' notes were taken on older builds, so every claim above gets retested on this build.
- Deliver with the addon: the list of lines to retest if the interface number moves off 16001.

## Decisions needed from the user
1. **Default chords** (proposal, untested): Ctrl+Shift + `1 2 3 4 5 6 7 8 9 0 - = [ ] \`. Must be audited for conflicts (BindPad, Windows hotkeys, Scimitar numpad mappings) and the device must send them; F13-F24 are reported not to work in Forever. Alternative: any set you prefer.
2. **Per-character layout** (recommended, since this is for the druid) vs account-wide.
3. **v1 = one page of 15 slots**; druid form/page switching deferred. OK?
4. **Lua tooling**: no Lua runtime is installed. The client is Lua **5.1**, so the proposal is a Lua 5.1-compatible interpreter (LuaJIT, or Lua 5.1 binaries) so `luac -p`/syntax checks and Core.lua tests match the game; Lua 5.4 would accept code the client rejects. (Approval needed for the download; I'd first look for an official winget package.)

## Testing
- TDD for `Core.lua` with plain Lua tests (needs decision 4).
- In-game checklist for UI/secure behavior: assign spell/item, press chord fires it, combat blocks edits, `/reload` writes export, export parses.
- Deploy only via `scripts\deploy.ps1`; verify no errors in the Lua error frame.

## Risks
Unknown API differences on this custom client (verify with `/dump` and `/sdock probe`), override bindings uncovered by the guides, chord not delivered by the device, secure-attribute behavior for druid-form spells, SavedVariables write timing and the reported beta persistence bug (snapshot only; tell the user it may be the client if data does not persist).
