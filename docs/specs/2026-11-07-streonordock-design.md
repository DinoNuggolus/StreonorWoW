# StreonorDock addon: design (v1)

Status: DRAFT for user review. Nothing implemented. Background: [../../../docs/wow-to-desktop-data-path.md](../../../docs/wow-to-desktop-data-path.md), [../../../docs/streonor-s15-findings.md](../../../docs/streonor-s15-findings.md).

## Intent (what we understood)
The user wants a WoW: Forever druid controlled from the Streonor S15: each of the 15 LCD keys fires one reserved key chord, shows its spell/item icon, and (later) shows counts, plus the three panels show gold / free bag space. Drag-and-drop into a 15-slot in-game panel should be the single source of truth for what each key does and what its icon is. No memory reading, no automation of gameplay, no restricted (secret) combat data exported.

## Scope of this sub-project
**In:** the WoW addon `StreonorDock` (own repo, `type: original`, private).
**Out (separate sub-projects, each gets its own spec):** the Streonor plugin that reads the export and draws keys/panels; the live bridge (chat-log tail or pixel strip); druid form/page logic; the key-sending profile in Streonor.

## Controller contract (user direction, 2026-11-07)
- **Character profiles live in the addon** (`StreonorDockDB`, per character). The Streonor side is profile-agnostic: key N always sends chord N, whatever character or spec is active.
- **Keys**: 15 fixed plugin actions (`Dock Key 1..15`). Each draws the icon/count the export gives for slot N and, on a physical press, sends only its chord (focus-guarded, one press = one chord, reusing the held-key checks of the user's existing `bridge.ps1`). The plugin picks the export of the most recently saved character (newest `export.time`).
- **Strip**: 3 display-only slots (`5,0` `5,1` `5,2`, Information panels). Each panel is one of: (a) a WoW value chosen in the addon, or (b) a stock Streonor system-monitor widget (GPU temp, RAM, ...), swappable in the Streonor app at any time with no addon involvement.
- **WoW panel metrics (only ordinary, non-secret values)**: gold, free bag slots, count of a dragged item, later maybe durability / currency. Never cooldowns, health, names or any value `issecretvalue` flags. In the addon, a small 3-slot "readout" row (list of metrics + drag an item for its count) sets `panels[1..3]`.
- **Honest limit**: with the snapshot (SavedVariables) route, WoW panel values are only as fresh as the last `/reload`/logout, and the plugin shows their age/STALE. Useful live panels need the deferred live bridge. So system-metric panels are the practical default for the strip until that is decided.

## Pages (user direction, 2026-11-07)
- Each character has an ordered list of **pages**. A page = 15 key slots + 3 readout slots = 18 slots (user said "18 slot pages"; assumed to mean this).
- **Paging**: next, previous, and home (page 1). A page never visited is created fresh (empty); a visited page returns exactly as left. Pages persist per character in `StreonorDockDB`.
- **Binding the pager**: next/prev/home are registered as Blizzard key bindings (`Bindings.xml`, shown under the addon's header in the game's Key Bindings screen; BindPad already ships one on this client), so the user picks the keys there, and they can also be set from the addon's own menu via the same binding API.
- **Combat limit (important)**: swapping which spell/item the 15 secure buttons hold rewrites secure attributes, which is blocked in combat, and secure snippets (the usual workaround) are reported broken. So **paging works out of combat only** in v1; in combat the pager prints "paging unavailable in combat". If mid-combat paging matters (druid forms), it needs a separate design (e.g. one page per fixed chord set), and we'd want a capability probe of secure state handling first.
- The export carries only the **current page** plus `page={index,count}`; the chords stay the same (chord N = slot N of the current page), so the Streonor buttons never change. The plugin may show the page number on a strip panel or key overlay.

## Behavior
1. **Panel**: movable frame, 3 columns x 5 rows (mirrors the device grid: rows 0-4, cols 0-2). Slot N maps to device key N (row-major).
2. **Assign**: drag a spell (spellbook) or item (bag) onto a slot out of combat; stores kind + id; right-click clears. Combat: edits disabled, queued assignments not supported in v1.
3. **Fire**: each slot is a `SecureActionButtonTemplate` button (`type=spell` by name / `type=item` by `item:<id>`), so the key press runs the real action through Blizzard's secure path.
4. **Bindings**: per-slot chord applied with override bindings (`SetOverrideBindingClick`) on login and after combat. Override bindings are not written to `bindings-cache.wtf`, so no WTF files are edited. Before binding, the addon warns in chat if a chord already maps to another action.
5. **Export**: `StreonorDockDB` holds, per character, `export = { version, character, realm, time, slots[1..15]={kind,id,name,iconFileID,chord,count}, player={gold,freeSlots}, panels[1..3]={metric,itemID,value} }`. Values refresh in memory on bag/money events; the game writes them to disk at `/reload`, logout or exit. The plugin treats data older than a threshold as stale.
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
2. ~~Per-character layout~~ **Decided**: profiles are baked into the addon, per character; Streonor buttons are fixed.
3. **v1 = one page of 15 slots** (druid form/page switching deferred). Implied by the above; say if not.
3b. **Strip v1**: ship system-metric panels (GPU/RAM) from the Streonor app first, and add WoW-value panels once live data exists? (Recommended.)
4. **Lua tooling**: no Lua runtime is installed. The client is Lua **5.1**, so the proposal is a Lua 5.1-compatible interpreter (LuaJIT, or Lua 5.1 binaries) so `luac -p`/syntax checks and Core.lua tests match the game; Lua 5.4 would accept code the client rejects. (Approval needed for the download; I'd first look for an official winget package.)

## Testing
- TDD for `Core.lua` with plain Lua tests (needs decision 4).
- In-game checklist for UI/secure behavior: assign spell/item, press chord fires it, combat blocks edits, `/reload` writes export, export parses.
- Deploy only via `scripts\deploy.ps1`; verify no errors in the Lua error frame.

## Risks
Unknown API differences on this custom client (verify with `/dump` and `/sdock probe`), override bindings uncovered by the guides, chord not delivered by the device, secure-attribute behavior for druid-form spells, SavedVariables write timing and the reported beta persistence bug (snapshot only; tell the user it may be the client if data does not persist).

## Resolved decisions and amendments (2026-11-07, supersede earlier text where they conflict)
Approved by the user in chat: Set B chords; manual out-of-combat pages; build the 3 readout (strip) slots now but leave them unpopulated.

1. **Chords (final)**: `ALT-CTRL-SHIFT-` + `1 2 3 4 5 6 7 8 9 0 - = [ ] \` for key slots 1..15. Audit: no overlap with Skyir's old bindings (`docs/skyir-keybind-audit.md`). Still verified in game via `/sdock chords` (effective overrides + ordinary bindings).
2. **Pages in v1**: yes. Max 10 pages per character. Previous at page 1 stays on page 1; next past the last existing page creates a fresh page up to the max; home = page 1. Page changes are blocked in combat (message printed). Pager keys are Blizzard key bindings (`Bindings.xml`). Spec lines saying "v1 = one page" are void.
3. **Identity**: no character names in the export (unit names can be sealed). Layouts live in `SavedVariablesPerCharacter: StreonorDockCharDB`; each character gets a random opaque `profileId`. The account-wide `StreonorDockDB.export` holds the last-saved character's snapshot: `{schema, profileId, revision, savedAt (server time), page={index,count}, slots[1..15], readouts[1..3]}`. Empty slot = `{kind="empty"}`. The plugin must label the controller as "saved snapshot" and show age; icons may lag edits until `/reload`/logout (accepted).
4. **Sanitizing**: the WoW adapter (`Export.lua`) strips/guards secret values with `issecretvalue` BEFORE calling Core; Core never sees a secret and never calls WoW APIs (injected `now`, `issecret` predicate and data-provider tables). If a reading becomes unavailable its field is removed (not kept stale).
5. **Binding mechanism**: only temporary override bindings (`SetOverrideBindingClick`) in v1. The `SetBinding`/`SaveBindings` fallback is NOT used silently; if overrides fail the probe reports it and stops. Secure buttons must call `RegisterForClicks` per `ActionButtonUseKeyDown`, clear stale attributes when a slot's kind changes, and right-click clearing must not fire the action.
6. **Readout slots (3 per page, strip)**: each readout is `empty` or `{kind="item", itemID}`; drag an item from a bag onto the slot (out of combat), right-click clears. Unpopulated by default. Display = icon + item count + cooldown.
7. **Item cooldown display (internal timer)**:
   - Primary: read `C_Item.GetItemCooldown(itemID)` (start, duration); when plain and duration > 1.5 s, record `endsAt = start + duration` and **learn** the item's cooldown length.
   - Fallback when the API gives nothing/secret (combat): if the item was ready and a use is detected (`BAG_UPDATE_COOLDOWN` with sealed data, or a press of a key slot holding the same item), start an internal timer `endsAt = now + learnedDuration`. If the length is not yet learned, show "CD ?" and learn on the next readable observation.
   - Always label source: `game` vs `est` (estimate). Never claimed exact. Spell cooldowns are NOT supported (sealed) and not attempted.
   - Pure logic in Core (`CooldownTracker`, injected `now`); WoW event wiring in the adapter.
8. **Live countdown limit**: the in-game readout shows the live countdown; the exported snapshot carries `endsAt`/`source` and only updates on save, so the controller cannot show a live countdown until a live route exists.
9. **Codex review items adopted**: export includes `schema`, `revision`, `page`, stable empty slots, time units (server seconds); refresh on assignment, page change, login and logout; late metadata callbacks must not overwrite a reassigned slot (match by current slot identity).

## Amendment 2: press-activated item cooldown timers (2026-11-07, supersedes decision 7)
User correction: auto-starting an estimate from sealed events cannot see an in-combat potion press and can show false cooldowns. New model:
1. **Timers belong to the item, keyed by `itemID`**, with an absolute end time. Any key slot or readout slot (any page, any profile) showing that item displays the same timer; paging away and back just recomputes `endsAt - now`. Timers keep running across page changes.
2. **Every key slot has dormant timer capability.** It is active only when the slot holds an item that has a use-cooldown. Spells and empty slots never get timers.
3. **Pressing the key starts the timer** (the chord goes to our own secure button; its `PostClick` handler runs in combat and records the press). Start only if: slot is an item, bag count > 0 (readable), and the item's timer is not already running. The addon sees the press itself; the controller is not needed for detection.
4. **Duration source, in order**: (a) live game data `C_Item.GetItemCooldown` when readable (authoritative, also in combat if not sealed); (b) the item's base cooldown if an API exists (probe `C_Spell.GetSpellBaseCooldown` on `C_Item.GetItemSpell(itemID)`; do not assume); (c) a duration learned the first time a cooldown is observed, persisted per `itemID`; (d) unknown -> show "USED" with elapsed time instead of a made-up countdown ("CD ?").
5. **Reconcile with the game**: whenever the game data is readable (out of combat, `PLAYER_REGEN_ENABLED`, bag/cooldown events), it overrides the estimate; so failed uses, shared cooldowns and uses made outside our buttons self-correct after combat.
6. **Labels**: `game` vs `est`; estimates are shown as estimates.
7. **First thing to test in game**: whether `C_Item.GetItemCooldown` is actually sealed in combat. Its docs carry no secret flag, so it may be readable and the estimate path unnecessary. If readable, estimates stay off by default (a setting).
8. **Known limits**: potions of different items often share one cooldown (v1 tracks per item; group tracking later); display-only readout slots can only mirror a timer started by a press or by readable game data; the exported snapshot carries `endsAt` and `source`, so the controller can count down live from the absolute time but learns about new uses only at save.
