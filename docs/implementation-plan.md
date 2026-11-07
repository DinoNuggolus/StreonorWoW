# StreonorDock controller implementation plan

Goal: implement the supplied 2026-11-07 design and build brief, CommonJS Node 20.8+, zero dependencies.
Spec: docs/specs/2026-11-07-streonordock-design.md (including amendments); current addon Core/Export are the wire contract.

Authorized workflow: edit this working tree only, no git writes, deployment, game reads, or input sends during development. NOTES.md is the ledger.

1. Parser and reader: tests first; bounded Lua assignment/table parser; schema-1 allowlist; stable stat/read/stat polling and retry; authored full fixture.
2. Presentation: tests first; bounded local icons, safe SVG and server-clock cooldown math, snapshot labels and status.
3. Input: mapping tests first; fixed chords, PowerShell scan-code sender and loopback WebSocket relay, dry-run sequence/guard/release tests.
4. Host: minimal Node mock RFC6455 host, real PowerShell relay integration, lifecycle/redraw/fixture rewrite tests; one shared polling tick, image deduplication.
5. Manifest, config, test runner, deployment script review, user documentation; run all tests on both installed Node versions and review whole change.

Review focus: partial writes must not retain misleading data; malformed values cannot become SVG or commands; repeated/downstream lost key events cannot stick modifiers; overlapping slots must not release another chord's modifiers; empty/no-data contexts must not disable input.

Interfaces: parse(text)->assignment object; ExportReader.poll()->snapshot or null, view()->aged copy; render.slot/readout/status(snapshot, index, clock, resolver)->SVG; chords.plan(slot, down)->VK/scan steps; sender stdin accepts send/chord/release/stop and emits host messages plus bridge diagnostics.

Completed: all five tasks. Final suite Node26.13.0 32/32 and Node20.8.1 32/32; NOTES.md records review findings/fixes and limitations. No git writes or deployment.
