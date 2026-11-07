# Publish checklist: StreonorDock (private -> public)

Gate: do NOT make anything public until the user says the addon is functional in game (Stage 0 and Stage 1 of the staged in-game checklist pass) and approves publishing. Making a repo public is the user's decision; agents never flip visibility.

Purpose of publishing: a public repo is needed to apply for ForeverDB API access (https://foreverdb.net/developers). Send the user's message to the maintainer too (see session notes): ask about offline storage and about shipping a derived table.

## Before flipping visibility
1. **Function**: staged in-game checklist results recorded in the repo `NOTES.md` (what passed, what failed, build number).
2. **Licence/provenance**: MIT LICENSE present; no BindPad code copied (techniques only); no code from the ForeverBeacon sample; `CooldownData.lua` header cites sources (classicdb.ch, Wowhead, Forever guides) and is clearly marked unverified until confirmed. If ForeverDB data is added later, follow its terms (visible credit, no resale, offline/redistribution permission in writing).
3. **Secrets and personal data scan** across the whole git history (not just the tree): game account names (e.g. the WTF account folder), Battle.net names, email addresses, API keys/tokens, local absolute paths, character names. Rewrite or squash history if anything is found.
4. **Commit authorship**: check `git log --format='%an <%ae>'`; commits by Codex/sandbox accounts or private-relay emails should be reviewed and normalised (squash to a clean history if wanted).
5. **Repo ownership**: the working copy is owned by a different Windows account (git "dubious ownership"); re-own or re-clone before pushing.
6. **Third-party content**: nothing from the AddOns folder, WTF, Streonor install, or other users' addons in the repo. `reference-sample` files stay out of the public repo.
7. **Docs**: README (install path `...\_forever_\Interface\AddOns\StreonorDock`, commands, known limits, "saved snapshot" caveat), CHANGELOG, retest-lines-when-interface-changes list, link to the Forever rules the addon follows.
8. **Terms**: re-read Blizzard's UI Add-On Development Policy (free, no obfuscation, no ads/donation prompts in game, nothing harmful) and confirm the addon complies; note that no official Forever rule on companion apps was found.
9. **Streonor plugin** stays a separate repo/decision; do not publish it with the addon.
10. **Final**: user explicitly approves; then `gh repo create` public (or change visibility) from the user's session/instruction.
