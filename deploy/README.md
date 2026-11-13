# ZCode usage limits in T3 Code — deployment kit

Shows the active ZCode promo plan (e.g. "ZCODE WEEKEND BUILD") in T3 Code's
**Usage → Limits** panel. Personal-use patches on top of the official release:
two small commits, one per repo, both on this fork.

- T3: branch `zcode-usage-limits-rel` (tag `v0.1.9` + usage-stats probe/mapper + version alignment)
- Adapter: [`Cassutti/zcode-acp` branch `start-plan-quota`](https://github.com/Cassutti/zcode-acp/tree/start-plan-quota) (`account/usage_stats` gains a `zcode` section read from the Start Plan gateway `billing/balance` endpoint)

## Prerequisites (PC2)

- Windows, **T3 Code (Beta) 0.1.9.x installed** (the kit hard-checks this — for a
  newer release, rebase `zcode-usage-limits-rel` onto the matching tag first)
- **ZCode desktop signed in** with the promo account (creates `~/.zcode/v2/credentials.json`
  with the account JWT and `onboarding-record.json` with the device id)
- Git, Node.js ≥ 20 on PATH (pnpm is installed automatically)

## Install

1. Close **T3 Code** completely.
2. Clone this repo on the kit branch and run the setup:

   ```bat
   git clone -c core.longpaths=true -b zcode-usage-limits-rel https://github.com/Cassutti/t3code.git
   cd t3code\deploy
   setup.cmd
   ```

   The script: clones/updates the adapter fork → `npm install` + build →
   `pnpm install` (~5 min) → builds the patched server bundle → rebuilds
   `server.asar` (official base + patched overlay, web client and natives kept
   byte-identical) → backs up and swaps it → points the ZCode ACP instance at
   the patched adapter.

3. Start T3 Code → **Usage → Limits** (or `/usage-limits`).

## Rollback

`restore.cmd` (T3 closed) — restores the official `server.asar` and the
original provider settings from the backups it created.

## After a T3 auto-update

The official updater overwrites `server.asar` (patch gone, app back to stock —
harmless). To re-apply: rebase `zcode-usage-limits-rel` onto the new release
tag, re-run `setup.cmd`.

## Files

| File                    | Role                                                |
| ----------------------- | --------------------------------------------------- |
| `setup.cmd`             | end-to-end setup (checks, clones, builds, installs) |
| `build-server-asar.cjs` | official asar → overlay patched dist → repack       |
| `patch-t3-settings.cjs` | rewires the ZCode ACP instance (dynamic id match)   |
| `restore.cmd`           | full rollback                                       |
