---
name: partner-launch
description: Customize, check, publish or update a partner-owned dPERPS frontend from the official source, with durable local files and a separate trading-activation handoff. Use after cloning the repository from a partner launch brief.
---

# Launch a partner website

Use this checkout as the sole app. Preserve trading UI, API clients, wallet and
signing flows, exact numeric formats, translations and server authority. Do not
scaffold a replacement. A launch request authorizes its own-account publication
within the stated cost limits; this skill alone authorizes no deployment,
purchase, commit, push or team message. API-only integrations do not need hosting.

## Read the brief and current code

Read `AGENTS.md`, `README.md`, `docs/changelog.md`, `package.json`, `.env.example`,
`src/config/partners/environment.ts`, `src/api/partnerChains.ts` and
`src/config/apiEndpoints.ts`. Read the adjacent
[`perpetual-hub-theme` skill](../perpetual-hub-theme/SKILL.md) for branding.
Use current source and instructions when behavior changes; do not invent a
replacement command, variable or discovery endpoint to make an old brief work.

Use the exact permanent folder in the brief. Reuse its customized official
checkout; preserve local changes, Git metadata and unrelated files. Do not scan
the disk, reset, reinitialize Git or work in a temporary chat folder. For updates,
read `DEPLOYMENT.md` first; if the customized folder is missing, ask for its
backup/notes rather than silently starting a new app or hosting site.

Explain permission/browser popups in plain words. Confirm the UI name/colors
and use the logo file dragged into chat or its supplied local path. Copy agreed
assets into `public/`; offer text-only branding when there is no logo. Portal
defaults are not confirmed branding. Keep identity separate from appearance.

## Tools and public configuration

Use **Node.js 22.12 or newer**, compatible with `package.json`; CI currently uses
Node 22. Reuse installed tools. If Node is absent, install a compatible supported
LTS in the user's home via the current official
[nvm instructions](https://github.com/nvm-sh/nvm#installing-and-updating), using
`METHOD=script`. Put any user-space Git first on `PATH` before nvm. Do not require
sudo, Homebrew, an admin password or Apple developer tools. Keep CLI installs in
the user's home. Git preparation must happen before cloning, as the brief says.

Write the supplied partner values into ignored `.env.local`, preserving unrelated
settings. Verify `git check-ignore .env.local`. The current settings are:

```dotenv
VITE_PARTNER=THE_PARTNER_ID_FROM_THE_BRIEF
VITE_WALLETCONNECT_PROJECT_ID=
```

Use the requested ID for a preview, preserving its exact spelling. Before actual
trading use the team-confirmed assigned ID. Never switch to `global`, copy its
configuration/contracts, invent addresses or mock browser responses to bypass
unavailability. Never copy private or machine-wide configuration into this repo.

All `VITE_` values become public browser assets. The optional WalletConnect/Reown
project ID must belong to this partner; it is a public project ID, not a secret.
If absent, explicitly leave it blank and report QR/mobile pairing as pending;
do not retain another app's ID. Check shell/mode-file precedence without dumping
the environment. Restart development and rebuild after changing build settings.
API/WS endpoints currently come from source, not extra invented env variables.
Keep passwords, tokens, keys, seed phrases and onboarding signatures/proofs out
of chat, code, commits, build output, notes and backups. Real environment files
and provider login state stay local and ignored.

## Check and publish

Install from the lockfile, including build tools even under production npm
settings, then run all four checks with the intended partner environment:

```sh
npm ci --include=dev
npm run check:public
npm run typecheck
npm run lint
npm run build
```

Fix/report failed checks before publishing. Do not change partner identity to
make a check pass. The current app has no automated test suite; these checks
do not establish financial correctness or trading activation.

Handle hosting without requiring the creator to pick a provider. Reuse the
verified account/site in `DEPLOYMENT.md` or the local provider link. Resolve
conflicting/stale links with the user before upload. Create a new site only
when no intended site exists. Guide signup, passwords, login and MFA through
the user's own browser; never create credentials for them or request tokens in
chat. No GitHub account, fork, source push or continuous deployment is required.

Default to Netlify's free option only if it fits **the current account and terms**.
At every launch/update, read [current pricing](https://www.netlify.com/pricing/)
and linked usage/terms documentation; inspect the account's actual plan, including
legacy plans. Explain commercial-use eligibility, deployment/traffic consumption,
pauses, overages, recharge and upgrade triggers in plain words. Record the date,
source links and decision in `DEPLOYMENT.md`. Do not rely on remembered prices
or fixed quotas in this file. If pricing cannot be verified, prepare locally and
report publication pending. Ask before spending, upgrades, auto-recharge, paid
features, DNS changes or a paid alternative.

Before the final build, preserve existing `public/_redirects` rules and add this
SPA catch-all **last**, without forcing rewrites of real assets:

```text
/* /index.html 200
```

Verify the rule exists in `dist/_redirects`. Read the current
[Netlify CLI guide](https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/)
and [deploy flags](https://cli.netlify.com/commands/deploy/). Inspect account/team,
site ownership, `netlify status` and the linked site ID. Provider state such as
`.netlify/` must be ignored. Check local provider configuration for unintended
functions/plugins; this is a static `dist/` upload. Use the verified ID in both
commands below, replacing the placeholder before running:

```sh
netlify deploy --dir=dist --no-build --site <verified-site-id>
# Check the draft before publishing the same reviewed build to the same site.
netlify deploy --dir=dist --no-build --site <verified-site-id> --prod
```

Do not upload source, real env files or dependencies. If the build changes after
draft checks, repeat those checks before production. Return the stable site URL,
not just the deploy-specific draft URL. Dashboard env edits do not alter an
already built upload; rebuild with the intended values.

**Never run `npm run deploy` or `scripts/deploy.mjs` for a partner:** its fixed
Orbs project is not the creator's target.
Use Vercel only if the creator already has a paid account; verify current pricing and their project, follow its current CLI guide and `vercel.json`, and run `vercel logout` after success or failure.

## Verify the actual website and activation separately

Check the draft and stable production origin in a browser: HTTPS, intended
branding/metadata/assets, desktop/mobile layout, keyboard access, direct route
loads and refreshes, and console/network errors. Check actual browser REST/CORS
and WebSocket access separately when discovery permits. A working local proxy,
an HTTP-only probe or a reachable page is not hosted access approval. Check
WalletConnect pairing separately when configured. Use an empty wallet for an
optional connection test, or skip it. Do not sign messages/terms, approve tokens,
trade, deposit or withdraw for a hosting check.

Track these states independently:

- **Website published: URL** only after verifying the stable production site.
  Otherwise say draft ready, not published, or publication pending.
- **Trading activation pending** until the team confirms the assigned partner
  ID, enabled networks and authoritative discovery/configuration, approves the
  exact published browser origin for REST/CORS and WebSockets, and applicable
  live connectivity checks pass. Record each unresolved item.

Query the exact registry-check URL from the brief, if provided, without inventing
an endpoint. A response marked `mock: true` is informational even when enabled;
it confirms neither assignment nor real activation. Missing/unreachable/disabled
status or a placeholder contact must not stall customization, build or preview.
Use the supplied contact for the creator's handoff; do not ask the creator to
verify team-only facts or message the team without authorization.

At this source version, `fetchPartnerChains` is an explicitly temporary fixture
for `global` only. Other requested partners remain unavailable until the real
discovery integration and activation exist. Preserve that screen; static checks
may be all that is possible. Record blocked checks instead of claiming success.
Give the creator the final URL to add in the portal and send for team approval;
saving a website there grants no access.

## Durable record and future updates

Keep customized source in the permanent folder. Create a private source backup
before updates and after launch at
`~/Documents/dPERPS/backups/<folder-name>-source-YYYYMMDD-HHmm.tar.gz` (or the user's
authorized private destination). Exclude real env files, credentials/proofs,
`.git`, provider/session state, `node_modules` and build output. Retain the
lockfile, public `.env.example`, licenses and all local customizations. Do not
upload this backup to a new service without authorization.

Write private, ignored **`DEPLOYMENT.md` in the project root** using this format.
Replace descriptions with actual values; record configured status, never secrets:

```markdown
# Deployment
- Project / requested and confirmed Partner ID / requested networks:
- Permanent source folder / upstream repository and exact commit / local changes:
- Tool versions and paths:
- Branding choices and original/copied asset paths:
- Provider / account and team / verified site ID / stable production URL:
- Last draft URL / deployment ID and date:
- Pricing checked at / official sources / actual plan and spending decision:
- Public build variables: names and configured/blank status only:
- Checks: source/type/lint/build; draft/live HTTPS/assets/routes/mobile/keyboard:
- Browser REST/CORS / WebSocket / WalletConnect: passed, pending or blocked + why:
- Website published: URL or pending reason:
- Trading activation pending: team contact, assignment/discovery/network/origin tasks:
- Private backup path and date:

## Next update
Update my dPERPS app in <actual-permanent-folder>. Read AGENTS.md,
.agents/skills/partner-launch/SKILL.md and DEPLOYMENT.md. Back up my source,
preserve my branding, run the checks and redeploy to the same recorded site and
stable URL. Report the link and remaining team work.
```

Future explicit updates reuse this source and verified site; do not create a new
one or automatically pull upstream. Review requested upstream changes, preserve
customizations, back up first, rerun checks and the draft/live sequence. Update
the notes and source changelog. If build scripts, Node requirements, env settings,
discovery or hosting procedure change, update this skill in the **same change**.

Finish in plain language: “Here's your link”, “Here's where your files and backup
are”, and “Here's what still needs the team”. Include the actual future-update
prompt from the notes and keep publication separate from activation.
