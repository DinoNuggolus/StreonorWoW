# foreverdb.net survey (Codex, 2026-11-07)

Read-only survey; values not verified in game.

**ForeverDB is promising for IDs and spell metadata, but this survey did not establish it as a reliable, complete source of Forever consumable use cooldowns or shared cooldown categories.** Missing cooldown text must remain **UNKNOWN**, not zero.

Read-only survey, 7 November 2026: no files changed, login, or bulk scraping.

**1. Contents and concrete item checks**

The site provides item and spell databases, consumables, professions, quests, dungeons, and search. Item pages contain use effects and acquisition sources; effects link to spell pages—for example [Healing Potion, spell 17534](https://foreverdb.net/spell/17534). The homepage advertises 22,779 items and 32,110 spells. [ForeverDB](https://foreverdb.net/)

Three readable consumable pages:

| Item and page URL | Item ID | Cooldown text exactly as shown | Shared cooldown/category |
|---|---:|---|---|
| [Major Healing Potion](https://foreverdb.net/item/13446) | 13446 | **None shown in retrieved page text** | Not stated |
| [Major Mana Potion](https://foreverdb.net/item/13444) | 13444 | **None shown in retrieved page text** | Not stated |
| [Goblin Sapper Charge](https://foreverdb.net/item/10646) | 10646 | **None shown in retrieved page text** | Not stated |

These pages show use effects, but no cooldown wording to quote. The linked Healing Potion spell page likewise supplied no cooldown field in the retrieved text. This establishes a presentation gap, not the actual Forever cooldown.

Embedded item/spell tooltips are explicitly supported through [`embed/tooltips.js`](https://foreverdb.net/embed/tooltips.js), including optional icons. They load on hover/tap unless icon, colour, or renaming options request data earlier. [Tooltip documentation](https://foreverdb.net/embed)

**2. API, exports, and access rules**

A documented, key-based JSON API exists:

- [Items](https://foreverdb.net/api/v1/items), [individual item example](https://foreverdb.net/api/v1/items/13446).
- [Spells](https://foreverdb.net/api/v1/spells), [individual spell example](https://foreverdb.net/api/v1/spells/17534).
- [Dataset metadata](https://foreverdb.net/api/v1/meta).

Documentation promises spell **icon and cooldown** fields. Lists support pagination up to 100 records. Access requires a Battle.net-linked account, application, and maintainer approval. Limits: 60 requests/minute and 10,000/day; throttled responses include `Retry-After`. In my words, its rules require visible linked credit wherever data is displayed, prohibit resale or claiming ownership, and require respecting limits. Offline storage and addon redistribution permission remain **UNKNOWN**. No published full export or ForeverDB source/data repository was verified. [API documentation and rules](https://foreverdb.net/developers)

[`robots.txt`](https://foreverdb.net/robots.txt) could not be retrieved through browsing or a direct request. Its directives are **UNKNOWN**. No separate scraping policy or general terms page was verified; absence of a retrieved prohibition is not permission.

**3. Provenance and currency**

ForeverDB says it extracts the **Forever client with Blizzard hotfixes applied**, automatically rebuilding after client updates and checks. Community observations supplement missing information; some quest, vendor, creature, and drop details use labelled CMaNGOS Classic fallback data. It says it does not copy other sites. [About and methodology](https://foreverdb.net/about)

The homepage lists **build 1.60.1.70862, 7 November 2026**, plus same-day hotfixes. However, retrieved item pages still contain beta wording, so site-wide freshness does not establish each item’s current verification. [Homepage](https://foreverdb.net/)

**4. Five cooldown comparisons**

| Consumable | Classic reference | ForeverDB result |
|---|---|---|
| [Major Healing Potion](https://classicdb.ch/?item=13446) | 120 s | UNKNOWN |
| [Major Mana Potion](https://classicdb.ch/?item=13444) | 120 s | UNKNOWN |
| [Major Healthstone](https://classicdb.ch/?item=9421) | 120 s | UNKNOWN; ForeverDB page retrieval failed |
| [Juju Power](https://classicdb.ch/?item=12451) | 60 s | UNKNOWN; ForeverDB page retrieval failed |
| [Goblin Sapper Charge](https://classicdb.ch/?item=10646) | 300 s | UNKNOWN |

The corresponding ForeverDB evidence is the three item pages above and attempted [Healthstone](https://foreverdb.net/item/9421) and [Juju](https://foreverdb.net/item/12451) pages. **No cooldown agreements or differences were established.** These Classic references provide comparison baselines, not proof of Forever behavior.

**5. Cheapest, polite route**

My recommendation is to [contact the maintainer](https://foreverdb.net/contact) first for one consumables-only export containing item ID, item-use spell ID, cooldown seconds, category ID/duration, icon filename/FileDataID, build, and provenance. This would avoid individual-page collection.

If unavailable, the documented API is the next candidate—but first request sample records and confirm item-level/shared cooldown coverage and offline-use permission. The user would need to apply for access and approve the proposed download and attribution arrangement. [Developer access](https://foreverdb.net/developers)

**Unverified:** complete coverage of runes, bandages, food and explosives; shared categories; item icon fields; icon filename versus numeric-ID format; actual API responses; robots rules; dump availability and reuse rights. Spell IDs are accessible, and spell icons are documented, but neither establishes a complete consumables table.