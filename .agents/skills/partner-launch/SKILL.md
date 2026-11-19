---
name: partner-launch
description: Onboard a dPERPS partner, collect branding preferences, preview and revise their app, then check, publish or update their own site. Use after cloning the official repository from a partner launch brief; keeps durable local files and a separate trading-activation handoff.
---

# Launch a partner website

Use this checkout as the sole app. Preserve trading UI, API clients, wallet and
signing flows, exact numeric formats, translations and server authority. Do not
scaffold a replacement. A launch request authorizes its own-account publication
within the stated cost limits; this skill alone authorizes no deployment,
purchase, commit, push or team message. API-only integrations do not need hosting.

## One request covers branding and deployment

Handle the launch end to end. Load the adjacent theme skill yourself; the partner
does not need to invoke a second skill or manage the handoff. Reuse the brief,
files and earlier answers. Ask once for missing branding preferences the partner
has not delegated. On a new Netlify launch, include their preferred
`name.netlify.app` address in that intake; updates retain the recorded URL. Use
the documented defaults for omitted or delegated choices. Choose routine
implementation, palette, build and hosting details yourself.

Show the branded preview and allow adjustments as described below. If the
partner explicitly asks you to choose and finish, keep the preview available
and complete the authorized launch without waiting for design approval. Once
the design is accepted or finalization is delegated and the checks pass, proceed
through the hosted draft, production deployment and live verification. Do not
ask again whether to deploy an already requested launch.

Ask again only for information or action needed to proceed: a missing partner
identity/source location, a taken or invalid requested Netlify name, an
unresolved account/site ownership conflict,
login/MFA in the partner's browser, their own wallet project ID for requested
QR/mobile pairing, a design choice they reserved for review, or spending/DNS
changes outside the authorized scope. Continue independent local
work while such input is pending. Publication and trading activation remain
separate.

A partner who wants minimal interaction can use this request in the agent chat
opened on their permanent checkout, together with their launch brief:

> Use partner-launch to brand and deploy my app. Use my supplied logo and
> preferences, choose sensible defaults for anything missing, and make technical
> decisions yourself. You may finalize the design without another approval.
> Use free hosting; ask before spending money.

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
read `DEPLOYMENT.md` and [the backup procedure](references/deployment-record.md)
first; back up before edits. If the customized folder is missing, ask for its
backup/notes rather than silently starting a new app or hosting site.

Stay on the branch already checked out in the permanent folder. Do not create or
switch branches, and do not ask the partner about Git branches; the `AGENTS.md`
`codex/` branch rule applies to upstream contributors, not partner launches.
Make routine technical choices yourself and explain them afterwards in plain words.

Explain permission/browser popups in plain words.

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
If absent, guide setup below; if skipped or unavailable, explicitly leave it
blank and report QR/mobile pairing as pending. Do not retain another app's ID.
Check shell/mode-file precedence without dumping the environment. Restart
development and rebuild after changing build settings.
API/WS endpoints currently come from source, not extra invented env variables.
Keep passwords, tokens, keys, seed phrases and onboarding signatures/proofs out
of chat, code, commits, build output, notes and backups. Real environment files
and provider login state stay local and ignored.

## Guide mobile wallet setup

When a new launch has no WalletConnect project ID, raise it with the first
missing-input questions and explain: “To offer QR codes and links that open
visitors' mobile wallet apps, we need a project ID from your own Reown account.
I'll walk you through getting it and handle the app settings. Installed browser
wallets such as MetaMask still work if you skip this.” Do not just ask a nontechnical
partner to supply an unexplained ID. Reuse this app's partner-owned project on
updates rather than making them create another one.

Guide the partner in small steps, using the current official interface:

1. Open [Reown Dashboard](https://dashboard.reown.com/) in their browser. Let
   them sign up or sign in and complete any email/MFA steps themselves. Verify
   the current free option and limits against [pricing](https://reown.com/pricing)
   and their account; ask before any paid plan or charge.
2. In their own team/account, create a project named after their app. The
   [official walkthrough](https://reown.com/blog/how-reown-analytics-helps-onchain-teams-grow-faster-and-smarter)
   uses **+ Project → AppKit → app name → Create**; follow current labels if
   these change. This obtains an ID for the existing RainbowKit integration;
   keep the app's current wallet libraries and configuration.
3. Open the project and copy the value labelled **Project ID**. Ask them to
   share that public ID, or read it from the authorized browser. Explain that
   it is different from their dPERPS partner ID and needs no wallet recovery
   phrase, private key or account password.
4. Set `VITE_WALLETCONNECT_PROJECT_ID` in ignored `.env.local` yourself, check
   precedence, restart the preview and rebuild before uploading. The partner
   should not need to edit files or run commands.
5. Once the actual draft and stable site URLs exist, guide the partner through
   the project's allowed-domain/origin settings using the
   [relay guide](https://docs.reown.com/cloud/relay). Supply the exact website
   origins yourself (scheme and host, plus port if present, without a path).
   Include each draft and production origin used for pairing; retain
   needed existing entries on updates. Localhost and `127.0.0.1` are permitted
   by the relay; allowlist changes can take 15 minutes to apply.
6. Check the WalletConnect QR/mobile options locally and on the hosted site;
   distinguish a visible option from a successful real pairing. Follow the
   connection-only checks in [hosting-and-activation.md](references/hosting-and-activation.md).
   Record setup and pairing as passed, pending or blocked, including when
   partner discovery prevents reaching the wallet UI.

If signup or a reply is pending, continue independent branding/build work. If
the partner skips setup, continue the launch with an explicitly blank ID and
state the browser-wallet-only limitation. Never substitute a demo/shared ID or
claim QR/mobile pairing passed without checking it.

## Brand, preview and revise

For a new launch, finish this review before the first hosted draft build. For an
update, reuse accepted branding from `DEPLOYMENT.md` and ask only about requested
changes. Follow the
[`perpetual-hub-theme` skill](../perpetual-hub-theme/SKILL.md) for palette generation,
assets, contrast checks and local preview mechanics.

1. Reuse information in the brief and ask together for missing preferences the
   partner has not delegated, in plain words. For example: “What name should appear in the app? Please attach
   your logo or give its local file path (text-only is fine). What is your primary
   brand color or brand-guide hex, if you have one? Do you prefer a dark or light
   theme? What address would you like, such as `your-brand.netlify.app`? The
   address must end in `.netlify.app`; I can also use a generated name. I can
   choose sensible defaults for the design.” Explain that they choose the part
   before `.netlify.app`, not a domain to buy. Reuse a supplied address or explicit
   delegation instead of asking again. Do not ask for individual theme tokens.
   Portal defaults are not confirmed branding.
2. If colors are omitted or delegated, take a suitable primary color from the
   supplied logo, identifying it as approximate, or use `#6675f7`. Use the chosen
   mode, with dark as the default when the partner has no preference. The theme
   skill supplies the background defaults and derives the complete palette;
   retain recognizable green Long/profit and red Short/loss colors. Say which
   choices were supplied and which were inferred or defaulted. Missing colors
   or a logo must not stall a preview; offer text-only branding when no logo is
   available, and do not invent a partner logo.
3. Copy supplied assets into `public/` and apply the actual name, logo, favicon
   and metadata locally through the theme skill before showing the app. Keep
   identity (`VITE_PARTNER`) separate from appearance. Use generated palettes
   through the shared theme configuration, not per-component color edits.
4. Generate a working local preview of the branded application, with the actual
   name/logo on reachable screens and proposed palette. Check desktop and mobile
   yourself. Share the local app link and screenshots when local links cannot be opened; color
   swatches alone are not an application preview. One coherent proposal is
   enough unless useful alternatives remain open. Preserve the requested ID
   and genuine unavailable-discovery screen; explain when that prevents a full
   trading-screen preview. The current unavailable bootstrap also hides the
   app header/name/logo, so record in-app logo and header/drawer checks as
   blocked; an asset shown separately is not that review. Do not substitute
   `global` or mocked market/account data to make a prettier preview.
5. Invite adjustments before finalizing: “Here is your branded preview. Would
   you like changes to the logo, primary color, or dark/light theme, or should I
   use this version?” Apply requested changes, rerun contrast/visual checks and
   show the revised preview until accepted. Leave the preview ready while the
   reply is pending; silence is not acceptance. An explicit instruction to choose
   defaults and finish, or to skip review, permits completing the authorized
   work without another approval. A general launch/publication request alone
   does not select an unseen design.
6. Persist the chosen generated palette, reset temporary preview colors and
   verify the configured result. Record the choices, supplied/defaulted inputs,
   final theme seed colors, asset paths and review outcome in `DEPLOYMENT.md`
   using [references/deployment-record.md](references/deployment-record.md).

Later restyles use the theme skill on its own, then rerun the checks and the
publication procedure for the same recorded site and URL; do not repeat URL
selection on an update unless the partner requests a rename.

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

For authorized hosting work, read
[references/hosting-and-activation.md](references/hosting-and-activation.md) before
setting up an account/site, uploading a draft or publishing. It owns current-plan
verification, Netlify name availability and selection, static SPA setup, the
draft/live checks and separate activation
handoff. Keep publication pending when authorization or required checks are
missing; local branding review needs no deployment.

## Record and hand off

Read [references/deployment-record.md](references/deployment-record.md) for the
private backup procedure, ignored `DEPLOYMENT.md` format and same-site updates.
Back up customized source before an update and after launch. Keep publication
and trading activation separate; record blocked checks rather than claiming
success. If build scripts, Node requirements, env settings, discovery or hosting
procedure change, update this skill and relevant references in the same change.

Finish in plain language: “Here's your link”, “Here's where your files and backup
are”, and “Here's what still needs the team”. Include the actual future-update
prompt from the notes and keep publication separate from activation.
