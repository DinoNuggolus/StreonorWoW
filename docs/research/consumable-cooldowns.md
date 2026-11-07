# Consumable cooldown research (Codex, 2026-11-07)

Classic-era reference values from web sources, NOT confirmed on Forever. Everything is verified=false until tested in game.

**Classic reference values, researched November 7, 2026â€”not confirmed Forever values.** IDs below are representative, not an exhaustive item catalogue. HIGH applies to database-stated cooldowns; sharing relationships may have lower confidence.

| Category | Example item names | Item IDs (cited) | Cooldown seconds | Shared cooldown with other categories? | Confidence | Source URLs |
|---|---|---|---:|---|---|---|
| Health potions | Minor, Major Healing Potion | 118, 13446 | 120 | Ordinary potion group | HIGH duration | [Minor](https://classicdb.ch/?item=118), [Major](https://classicdb.ch/?item=13446) |
| Mana potions | Minor, Major Mana Potion | 2455, 13444 | 120 | Ordinary potion group | HIGH duration | [Minor](https://classicdb.ch/?item=2455), [Major](https://classicdb.ch/?item=13444) |
| Rejuvenation potions | Major Rejuvenation Potion | 18253 | 120 | Ordinary potion group | HIGH duration | [Database](https://classicdb.ch/?item=18253) |
| Utility potions | Limited Invulnerability; Free Action; Swiftness; Living Action | 3387, 5634, 2459, 20008 | 120 | Ordinary potion group | HIGH duration | [LIP](https://classicdb.ch/?item=3387), [FAP](https://classicdb.ch/?item=5634), [Swiftness](https://classicdb.ch/?item=2459), [Living Action](https://classicdb.ch/?item=20008) |
| Other ordinary potions | Magic Resistance; Lesser Stoneshield; Restorative; Dreamless Sleep | 9036, 4623, 9030, 12190 | 120 | Ordinary potion group | HIGH duration | [Resistance](https://classicdb.ch/?item=9036), [Stoneshield](https://classicdb.ch/?item=4623), [Restorative](https://classicdb.ch/?item=9030), [Sleep](https://classicdb.ch/?item=12190) |
| Protection potions | Greater Fire, Nature, Shadow Protection | 13457, 13458, 13459 | 120 | Ordinary potion group; see uncertainty below | HIGH duration | [Fire](https://classicdb.ch/?item=13457), [Nature](https://classicdb.ch/?item=13458), [Shadow](https://classicdb.ch/?item=13459) |
| Invisibility potion | Invisibility Potion | 9172 | 600 | Potion interaction duration UNKNOWN | HIGH duration | [Database](https://classicdb.ch/?item=9172) |
| Healthstones | Major Healthstone, including improved versions | 9421, 19012, 19013 | 120 | Other Healthstones; runes; separate from potions | HIGH duration; MEDIUM sharing | [Base](https://classicdb.ch/?item=9421), [Improved](https://classicdb.ch/?item=19012), [Improved](https://classicdb.ch/?item=19013) |
| Runes | Demonic Rune; Dark Rune | 12662, 20520 | 120 | Healthstone group; separate from potions | HIGH duration; MEDIUM sharing | [Demonic](https://classicdb.ch/?item=12662), [Dark](https://classicdb.ch/?item=20520) |
| Juju | Flurry, Power, Ember, Chill, Guile, Escape, Might | 12450, 12451, 12455, 12457, 12458, 12459, 12460 | 60 each | Mutual sharing and potion interaction UNKNOWN | HIGH duration | [Flurry](https://classicdb.ch/?item=12450), [Power](https://classicdb.ch/?item=12451), [Ember](https://classicdb.ch/?item=12455), [Chill](https://classicdb.ch/?item=12457), [Guile](https://classicdb.ch/?item=12458), [Escape](https://classicdb.ch/?item=12459), [Might](https://classicdb.ch/?item=12460) |
| Grenades/dynamite | Thorium Grenade; Dense Dynamite | 15993, 18641 | 60 | Explosives group; sapper interaction below | HIGH duration | [Grenade](https://classicdb.ch/?item=15993), [Dynamite](https://classicdb.ch/?item=18641) |
| Sappers | Goblin Sapper Charge | 10646 | 300 | Reportedly imposes 60 on other explosives | HIGH duration; MEDIUM interaction | [Database](https://classicdb.ch/?item=10646), [Wowhead reports](https://www.wowhead.com/classic/item=10646/goblin-sapper-charge) |
| Regeneration elixirs | Major Trollâ€™s Blood Potion | 20004 | UNKNOWN; no cooldown listed | UNKNOWN; do not classify by â€œPotionâ€ in its name | MEDIUM | [Database](https://classicdb.ch/?item=20004) |
| Bandages | Heavy Runecloth Bandage | 14530 | **0 item cooldown**; target receives 60-second Recently Bandaged debuff | Target restriction, not potion sharing | HIGH restriction | [Item](https://classicdb.ch/?item=14530), [First Aid guide](https://www.wowhead.com/classic/news/classic-wow-first-aid-guide-292193) |
| Ordinary food/drink | Baked Salmon; Morning Glory Dew | 13935, 8766 | **0 use cooldown** | No potion lockout | MEDIUM; tooltips list no cooldown | [Food](https://classicdb.ch/?item=13935), [Drink](https://classicdb.ch/?item=8766) |

Short separate trinket list, class-neutral: **Talisman of Ephemeral Power**, ID **18820**, **90 seconds**; **Barov Peasant Caller**, ID **14022**, **600 seconds**. Both HIGH for duration; cross-trinket lockouts UNKNOWN here. [Talisman database](https://classicdb.ch/?item=18820), [Barov database](https://classicdb.ch/?item=14022).

**Sharing and overlapping timers**

- Health and mana potions share the ordinary potion timer: consuming either prevents consuming the other until that timer expires. Rejuvenation and ordinary combat/utility potions belong to that same family. Foreverâ€™s Wowhead guide explicitly places Limited Invulnerability on the potion cooldown. [Forever guide](https://www.wowhead.com/forever/guide/classes/warlock/demonology/rotation-cooldowns-pve-dps).
- Protection potion cooldowns should be treated as ordinary potion cooldowns provisionally. Their long protection buffs are separate from the use timer; multiple active buffs do not establish independent cooldowns. Exact Forever cross-school interaction: **UNKNOWN**.
- Healthstones do **not** consume the potion timer. Using one while a potion cools down is possible if the Healthstone group is ready. Healthstone and Demonic Rune instead block each other, according to the Forever guide; whether Dark Rune has identical Forever behavior remains untested. [Forever guide](https://www.wowhead.com/forever/guide/classes/warlock/demonology/rotation-cooldowns-pve-dps).
- Grenades and dynamite share a timer. Classic sapper comments report a 300-second personal cooldown plus a 60-second explosives lockout. Reverse-direction behavior and Foreverâ€™s precise sapper interaction are **UNKNOWN**. [Classic reports](https://www.wowhead.com/classic/item=10646/goblin-sapper-charge).
- Invisibility has a documented 600-second duration, but the lockout imposed on other potions is **UNKNOWN** here. Do not propagate 600 seconds to every potion without testing.
- Equal Juju durations do not prove mutual sharing. Keep their timers separate until tested.

**Forever differences**

Blizzard specifically moved **Draught of Predatory Senses** onto the **Combat Potion cooldown**. Its numeric cooldown and ID were not verified here. The same historical beta thread listed Healthstone tracking problems; that is not proof of a current API failure. [Blizzard development notes](https://us.forums.blizzard.com/en/wow/t/wow-forever-beta-development-notes-%E2%80%93-updated-november-2/2360696).

A Forever druid guide reports Major Mana Potion as a two-minute cooldown with multiple uses possible during combat, matching vanilla behavior. This is community evidence, not in-game confirmation. Other numeric changes to the groups above: **UNKNOWN**. [Druid report](https://mobalytics.gg/wow-forever/classes/restoration-druid-guide-doublezug).

The Lua uses shared labels as references, not additional group entries. `shared=nil` means no relationship encoded, including UNKNOWN. Juju entries remain separate. Sapper cross-lockout needs logic beyond this schema. All durations are provisional Classic references; `0` means no item cooldown.

```lua
ns.CooldownGroups = {
  health_potion = { name = "Health potions", duration = 120, shared = "potion", verified = false, source = "https://classicdb.ch/?item=13446" },
  mana_potion = { name = "Mana potions", duration = 120, shared = "potion", verified = false, source = "https://classicdb.ch/?item=13444" },
  rejuvenation = { name = "Rejuvenation potions", duration = 120, shared = "potion", verified = false, source = "https://classicdb.ch/?item=18253" },
  utility_potion = { name = "Utility potions", duration = 120, shared = "potion", verified = false, source = "https://classicdb.ch/?item=3387" },
  protection = { name = "Protection potions", duration = 120, shared = "potion", verified = false, source = "https://classicdb.ch/?item=13457" },
  invisibility = { name = "Invisibility potion", duration = 600, shared = nil, verified = false, source = "https://classicdb.ch/?item=9172" },
  healthstone = { name = "Healthstones", duration = 120, shared = "stone_rune", verified = false, source = "https://classicdb.ch/?item=9421" },
  rune = { name = "Runes", duration = 120, shared = "stone_rune", verified = false, source = "https://classicdb.ch/?item=12662" },
  juju_flurry = { name = "Juju Flurry", duration = 60, shared = nil, verified = false, source = "https://classicdb.ch/?item=12450" },
  juju_power = { name = "Juju Power", duration = 60, shared = nil, verified = false, source = "https://classicdb.ch/?item=12451" },
  juju_ember = { name = "Juju Ember", duration = 60, shared = nil, verified = false, source = "https://classicdb.ch/?item=12455" },
  juju_chill = { name = "Juju Chill", duration = 60, shared = nil, verified = false, source = "https://classicdb.ch/?item=12457" },
  juju_guile = { name = "Juju Guile", duration = 60, shared = nil, verified = false, source = "https://classicdb.ch/?item=12458" },
  juju_escape = { name = "Juju Escape", duration = 60, shared = nil, verified = false, source = "https://classicdb.ch/?item=12459" },
  juju_might = { name = "Juju Might", duration = 60, shared = nil, verified = false, source = "https://classicdb.ch/?item=12460" },
  explosives = { name = "Grenades and dynamite", duration = 60, shared = "explosives", verified = false, source = "https://classicdb.ch/?item=15993" },
  sapper = { name = "Goblin Sapper Charge", duration = 300, shared = nil, verified = false, source = "https://classicdb.ch/?item=10646" },
  trolls_blood = { name = "Major Troll's Blood", duration = nil, shared = nil, verified = false, source = "https://classicdb.ch/?item=20004" },
  bandage = { name = "Bandages", duration = 0, shared = nil, verified = false, source = "https://classicdb.ch/?item=14530" },
  food_drink = { name = "Ordinary food and drink", duration = 0, shared = nil, verified = false, source = "https://classicdb.ch/?item=13935" },
  talisman = { name = "Talisman of Ephemeral Power", duration = 90, shared = nil, verified = false, source = "https://classicdb.ch/?item=18820" },
  barov = { name = "Barov Peasant Caller", duration = 600, shared = nil, verified = false, source = "https://classicdb.ch/?item=14022" },
}
ns.ItemGroups = {
  [118] = "health_potion", [13446] = "health_potion",
  [2455] = "mana_potion", [13444] = "mana_potion",
  [18253] = "rejuvenation",
  [3387] = "utility_potion", [5634] = "utility_potion",
  [2459] = "utility_potion", [20008] = "utility_potion",
  [9036] = "utility_potion", [4623] = "utility_potion",
  [9030] = "utility_potion", [12190] = "utility_potion",
  [13457] = "protection", [13458] = "protection",
  [13459] = "protection", [9172] = "invisibility",
  [9421] = "healthstone", [19012] = "healthstone",
  [19013] = "healthstone",
  [12662] = "rune", [20520] = "rune",
  [12450] = "juju_flurry", [12451] = "juju_power",
  [12455] = "juju_ember", [12457] = "juju_chill",
  [12458] = "juju_guile", [12459] = "juju_escape",
  [12460] = "juju_might",
  [15993] = "explosives", [18641] = "explosives",
  [10646] = "sapper", [20004] = "trolls_blood",
  [14530] = "bandage",
  [13935] = "food_drink", [8766] = "food_drink",
  [18820] = "talisman", [14022] = "barov",
}
```

**Unverified:** complete rank/variant coverage; Forever numeric overrides; Juju sharing; invisibility cross-lockout; sapper directionality; Trollâ€™s Blood use timer; trinket cross-lockouts.

Three highest-value in-game tests:

1. Use a health potion; inspect mana, protection and Healthstone cooldowns with `/dump C_Item.GetItemCooldown(13444)` and the corresponding IDs. Repeat with Healthstone versus rune.
2. Test sapperâ†’grenade and grenadeâ†’sapper from ready states; inspect IDs 10646, 15993 and 18641 immediately and after 60 seconds.
3. Use Invisibility Potion and inspect ordinary potions; then test two different Juju items. Record actual duration and cross-lockout separately.
