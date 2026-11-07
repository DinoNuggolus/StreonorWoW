-- AUTHORED fixture, no real account data. Full schema-1 account snapshot.
StreonorDockDB = {
 ["settings"] = { ["estimates"] = "auto" },
 ["probe"] = { ["build"] = "fixture", ["combatReadable"] = false },
 ["cooldownLearned"] = { ["build"]="fixture", ["items"]={}, ["groups"]={}, ["pools"]={} },
 ["export"] = {
  ["schema"]=1, ["profileId"]="opaque-fixture", ["revision"]=7, ["savedAt"]=1794085200,
  ["page"]={ ["index"]=2, ["count"]=3 },
  ["slots"]={
   { ["kind"]="spell", ["id"]=8921, ["name"]="Moonfire", ["iconFileID"]=136096, ["chord"]="ALT-CTRL-SHIFT-1" },
   { ["kind"]="item", ["id"]=118, ["name"]="Minor Healing Potion", ["count"]=4, ["iconFileID"]=134829, ["chord"]="ALT-CTRL-SHIFT-2", ["endsAt"]=1794085320, ["source"]="est", ["extra"]="ignored" },
   {kind="item",id=999,name="Unknown item",count=1,source="used"},
   {kind="empty"}, {kind="empty"}, {kind="empty"}, {kind="empty"}, {kind="empty"},
   {kind="empty"}, {kind="empty"}, {kind="empty"}, {kind="empty"}, {kind="empty"}, {kind="empty"}, {kind="empty"},
  },
  ["readouts"]={ {kind="item",itemID=118,name="Minor Healing Potion",iconFileID=134829,count=4,endsAt=1794085320,source="game"}, {kind="empty"}, {kind="empty"} },
  ["player"]={moneyCopper=123456,freeBagSlots=16},
 },
}
-- Normally in a DIFFERENT SavedVariablesPerCharacter file; included to test independent assignments.
StreonorDockCharDB={profileId="opaque-fixture",revision=7,currentPage=2,pages={
 {slots={{kind="empty"}},readouts={{kind="empty"}}},
 {slots={{kind="spell",id=8921},{kind="item",id=118}},readouts={{kind="item",itemID=118}}},
 {slots={},readouts={}},
}}
