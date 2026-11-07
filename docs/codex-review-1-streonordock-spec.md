## A. Spec problems

References: **S** = [draft spec](G:/WoWFOREVER_ADDONS/StreonorWoW/docs/specs/2026-11-07-streonordock-design.md); **R** = [SystemPrompt.md](G:/WoWFOREVER_ADDONS/docs/forever-addon-rules/SystemPrompt.md); **V** = [value restrictions](G:/WoWFOREVER_ADDONS/docs/live-data-and-terms.md).

The API mirror returned **Access denied**. API conclusions below rely on the supplied documents and installed BindPad source; none were verified in game.

1. **Paging scope contradicts itself.** S20–24 defines persistent pages; S55 says single-page v1; S10 excludes form/page logic. Decide explicitly whether manual paging ships. Define previous-at-page-1 behavior and a maximum page count.

2. **Controller icons can describe the wrong action.** S24 changes the active page immediately, but S17/31 updates the desktop snapshot only after reload/logout. Assignment changes have the same problem. An age threshold cannot detect a just-edited layout. Snapshot displays must always say “saved snapshot”; accurate current-page icons need a verified live route. This undermines S6’s single-source-of-truth experience.

3. **Character identity conflicts with the export policy.** S31 exports `character`, while S16 prohibits names. V22 excludes unit names; R12 requires guarding before comparisons or printing. Define profile identity without relying on `UnitName` as a readable table key. Prefer `SavedVariablesPerCharacter` for layouts plus an opaque identifier in the snapshot, subject to agreeing the storage contract.

4. **Secret filtering is underspecified and conflicts with pure Core.** S36 prohibits WoW calls; S44 makes the export builder detect secrets. Sanitize recursively in the WoW adapter before Core receives values, or inject a predicate. Guard before type-dependent validation, concatenation, arithmetic, indexing, or logging. Explicitly remove previous values when readings become secret/unavailable; retaining them misrepresents freshness. R12; V3–7.

5. **Binding fallback changes persistence semantics.** S30 promises temporary overrides; S45 proposes `SetBinding`. BindPad explicitly calls `SaveBindings` ([source](</G:/World of Warcraft/_forever_/Interface/AddOns/BindPad/BindPad.lua:1527>)). That fallback can replace normal bindings and, if saved, persist them. Specify opt-in conflict handling and restoration; never silently switch mechanisms. Check conflicts against effective overrides as well as ordinary bindings.

6. **Secure click behavior is incomplete.** S29 omits `RegisterForClicks`, `useOnKeyDown`, modifier handling, and clearing obsolete attributes when changing kind or clearing slots. BindPad matches click direction to `ActionButtonUseKeyDown` ([source](</G:/World of Warcraft/_forever_/Interface/AddOns/BindPad/BindPad.lua:1900>)). Right-click clearing must not also execute an item/spell. These are capability risks under R21.

7. **Protected-frame lifecycle needs an explicit design.** S27/33 allows moving/toggling the panel; S47 queues changes, while S23/28 rejects combat paging/edits. Distinguish rejected operations from queued presentation/binding maintenance. Prefer separate editor widgets and persistent secure action buttons; test binding operation while the editor is hidden. Include initialization during combat and cache callbacks arriving during combat. R18.

8. **Export and cache contracts have gaps.** S31 lacks S24’s `page` field, stable empty-slot encoding, time units, revision, timestamp-refresh rules, count scope, and bag inclusion rules. Refresh on assignments, pages, initial login and snapshot shutdown—not only bag/money events. S43 also needs failed-load behavior and protection against late callbacks overwriting reassigned slots. R10/17.

## B. Risks ranked by likelihood × impact

Scores are engineering estimates, 1–5 each.

| Risk | Score | Cheap verification |
|---|---:|---|
| Snapshot icon/action mismatch after edits or paging | 5×5 | Save page 1; switch to page 2 without reload. Compare snapshot icon with the action actually cast. |
| Chord conflicts or modifier-sensitive secure attributes | 4×4 | `/sdock probe bindings` should report ordinary/effective mappings; manually press all 15 chords with editor shown/hidden. |
| Wrong click direction causes no action or duplicate activation | 3×5 | `/dump GetCVarBool("ActionButtonUseKeyDown")`; test both settings, including held and released keys. |
| Combat lifecycle causes blocked actions/taint | 3×5 | In combat, toggle, drag, clear, page and trigger delayed metadata completion; inspect errors and post-combat state. |
| Secret identity or metric enters persistence | 3×5 | `/sdock probe values` reports only availability and secrecy flags, before combat and during combat. Never print raw restricted values. |
| Drag ID/rank/cache mismatch | 3×4 | Drag two ranks and an uncached item; probe normalized cursor IDs and compare actual casts. |
| Wrong character or falsely fresh export | 3×4 | Save two characters, then idle/reload; inspect opaque profile IDs, revision and capture timestamps. |

The `/sdock probe` variants above are **proposed diagnostics**, not existing commands.

## C. Proposed layout and implementation plan

Create a separate `StreonorDock` addon repository, following workspace rules:

- `src/StreonorDock/`: `StreonorDock.toc`, `Bindings.xml`, `Core.lua`, `Secure.lua`, `Panel.lua`, `Export.lua`, `Init.lua`.
- `tests/`: pure Lua 5.1 tests and runner.
- Repository root: `CLAUDE.md`, pointer `AGENTS.md`, `NOTES.md`, `README.md`, `LICENSE`; `docs/` for schema and verification notes.

Ordered tasks:

1. **Resolve contract:** design/schema documentation. Define paging, identity, snapshot semantics, chords and metric scope. Verify contradictions above are removed.
2. **Write Core tests first:** `tests/*`, then `Core.lua`. Test slot bounds; invalid kinds/IDs; assign/replace/clear; independent page defaults; next/previous/home boundaries; page restoration; unchanged state on rejection; deterministic 15-slot/3-panel export; missing metadata; stale-field removal; revision/time injection; no input mutation; malformed saved-data recovery.
3. **Validate secure capabilities:** `Secure.lua`, diagnostic entry in `Init.lua`. Test one spell and one item with reserved modifiers, both click settings, hidden editor and combat. Stop dependency work if this fails.
4. **Implement persistence/events:** TOC and `Init.lua`. Initialize only in the addon’s `ADDON_LOADED`; use one event frame/handler table. Verify reload persistence and safe combat initialization.
5. **Implement actions/bindings:** `Secure.lua`, `Bindings.xml`. Apply validated attributes and bindings out of combat; clear obsolete attributes. Verify conflicts, empty slots and rejection behavior.
6. **Implement editor/pages:** `Panel.lua`, Core integration. Normalize cursor payloads, reject unsupported drops, handle late metadata by current slot identity. Verify edits never mutate secure state in combat.
7. **Implement sanitized export:** `Export.lua`, `Init.lua`. Pass only ordinary allowlisted data to Core. Verify schema, cache failures, timestamps and unavailable values.
8. **Package/deploy:** README, license, TOC and existing deployment script. Verify Lua 5.1 syntax/tests, then run checklist below. Find an existing compatible runtime first; installation remains a separate decision.

Every addon Lua file starts with the required namespace declaration.

## D. In-game checklist

1. **Load:** deploy through the workspace script; enable addon. Expected: Interface 16001, help works, no Lua errors.
2. **Assign:** drag spell, ranked spell, bag item and unsupported cursor type. Expected: correct IDs/icons; unsupported drops leave state intact.
3. **Replace/clear:** switch spell→item→empty. Expected: no residual action; right-click clear never casts.
4. **Activate:** press all chords; test editor shown/hidden and both key-down settings. Expected: one activation per physical press.
5. **Combat:** attempt edits, movement, toggle and paging. Expected: documented rejection/queue behavior; existing actions continue; no blocked-action errors.
6. **Pages:** next/previous/home and revisit populated pages. Expected: exact restoration and defined boundaries.
7. **Values/cache:** acquire/spend money, move/use items, encounter uncached metadata. Expected: correct scoped counts; unavailable values remain unavailable.
8. **Persistence:** reload, relog and switch characters. Expected: isolated layouts and correct snapshot identity/revision.
9. **Snapshot honesty:** edit without reload. Expected: desktop display remains explicitly labeled saved snapshot; after reload, it matches.
10. **Secrets:** run secrecy-only probes in/out of combat. Expected: restricted fields never enter export.

## E. Blocking questions before coding

1. Does v1 include manual out-of-combat pages, or exactly one page?
2. Are potentially mismatched saved-snapshot icons acceptable after edits/page changes, or must controller icons match immediately?
3. Is the proposed 15-chord set approved for reservation and hardware testing?

Runtime selection, strip widgets and the later plugin do not block the addon design.