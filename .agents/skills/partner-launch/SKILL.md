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

## Keep the partner's flow simple

Handle the launch end to end, loading the adjacent theme skill yourself. The
partner does not need to invoke another skill, edit configuration, run commands
or choose technical tools. Reuse the brief, supplied files and earlier answers.
Introduce the flow in one sentence: “We'll add your branding, review your app,
then choose its website address and publish it.”

Keep questions in this order, asking only for missing, undelegated choices:

1. **Logo:** request the file or local path; offer text-only branding. Wait for
   that reply or a skip before asking about appearance.
2. **Appearance:** ask dark/light and primary color together. Include the app
   name here only if it is still missing. Offer to choose sensible defaults.
3. **Preview:** show the actual branded app, explain any coming-soon notice,
   and allow adjustments. Apply changes until accepted or finalization is delegated.
4. **Website address:** only after design review, ask for `name.netlify.app` or
   a generated address. Then handle Netlify availability, account setup and login.
5. **Published link and handoff:** verify the website, report activation status,
   and leave any missing WalletConnect setup as concise written instructions.

Skip answered/delegated questions. On updates, reuse the accepted branding and
recorded site; collect only the requested changes. Keep progress messages short,
state the current step and next action, and explain browser/login popups when
needed. Keep implementation details, public theme tokens and check results in
local notes rather than turning them into tasks for the partner.

Complete the local branded preview and visual checks before any Netlify
signup/login, linking, availability check or site creation, including when
finalization was delegated upfront. Then proceed after acceptance or delegation.
Reuse supplied address choices when that stage arrives. A missing WalletConnect project ID stays blank
through publication; do not ask for it or open Reown during launch.

A launch request already authorizes publication within its scope. Once the
design is accepted or finalization is delegated and checks pass, continue through
hosted draft, production and live verification without asking again whether to
deploy. If the partner asked you to choose and finish, show the preview and
continue without an extra design-approval question. Otherwise, an unanswered
preview is not acceptance.

Pause only for required missing information or action: the source/partner ID,
a reserved design choice, an invalid/taken requested address, conflicting site
ownership, hosting login/MFA or costs outside the authorized limit. Continue
independent local work while waiting. Keep website publication and trading
activation separate. Do not ask the partner to resolve team-only approval facts.

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

## Tools and public configuration

Use **Node.js 22.12 or newer**, compatible with `package.json`; CI currently uses
Node 22. Reuse installed tools. If Node is absent, install a compatible supported
LTS in the user's home via the current official
[nvm instructions](https://github.com/nvm-sh/nvm#installing-and-updating), using
`METHOD=script`. Put any user-space Git first on `PATH` before nvm. Do not require
sudo, Homebrew, an admin password or Apple developer tools. Keep CLI installs in
the user's home. Git preparation must happen before cloning, as the brief says.

Before the first local preview, install dependencies from the lockfile,
including build tools even under production npm settings:

```sh
npm ci --include=dev
```

Do this locally while collecting branding; it is not a partner question or a
Netlify setup step. Confirm the dev server can start before promising a link.

Write the supplied partner values into ignored `.env.local`, preserving unrelated
settings. Verify `git check-ignore .env.local`. The current settings are:

```dotenv
VITE_PARTNER=THE_PARTNER_ID_FROM_THE_BRIEF
VITE_WALLETCONNECT_PROJECT_ID=
```

Use the requested ID for a preview, preserving its exact spelling. Before actual
trading use the team-confirmed assigned ID. Never switch the partner ID to
`global`, copy its contracts into partner configuration, invent tradable
addresses or mock browser responses. Use the automatic read-only state below
for visual review while approval is pending. Never copy private or machine-wide
configuration into this repo.

All `VITE_` values become public browser assets. The optional WalletConnect/Reown
project ID must belong to this partner; it is a public project ID, not a secret.
If absent, explicitly leave it blank for the preview and published build, and
record QR/mobile pairing as deferred. Do not ask for it, open Reown in a browser,
or wait for account creation during the launch. Provide the written follow-up
below instead. Do not clear an existing partner-owned ID or retain another app's ID.
Check shell/mode-file precedence without dumping the environment. Restart
development and rebuild after changing build settings.
API/WS endpoints currently come from source, not extra invented env variables.
Keep passwords, tokens, keys, seed phrases and onboarding signatures/proofs out
of chat, code, commits, build output, notes and backups. Real environment files
and provider login state stay local and ignored.

## Brand, preview and revise

For a new launch, finish this review before the first hosted draft build. For an
update, reuse accepted branding from `DEPLOYMENT.md` and ask only about requested
changes. Follow the
[`perpetual-hub-theme` skill](../perpetual-hub-theme/SKILL.md) for palette generation,
assets, contrast checks and local preview mechanics.

1. **Ask for the logo first.** Reuse a logo already supplied; otherwise ask:
   “Please attach your logo or give its local file path. You can also choose
   text-only branding.” Wait for the logo reply or an explicit skip/delegation
   before asking the appearance question. Keep this question focused on the
   logo; do not bundle colors, theme mode, hosting or wallet setup into it.
2. **Ask about theme and colors next.** After the logo is supplied or skipped,
   inspect any supplied asset and ask only for missing, undelegated choices:
   “Do you prefer a dark or light theme? What primary brand color or brand-guide
   hex should I use, or should I suggest one from your logo?” If there is no
   logo, offer the default brand color instead of logo-derived colors. Label
   image-derived suggestions as approximate. Do not ask for individual tokens
   or repeat choices already supplied with the logo or brief. If the app name is
   still missing, include “What name should appear in the app?” in this same
   appearance question; reuse a supplied name or explicit naming delegation.
3. If colors are omitted or delegated, take a suitable primary color from the
   supplied logo, identifying it as approximate, or use `#6675f7`. Use the chosen
   mode, with dark as the default when the partner has no preference. The theme
   skill supplies the background defaults and derives the complete palette;
   retain recognizable green Long/profit and red Short/loss colors. Say which
   choices were supplied and which were inferred or defaulted. Missing colors
   or a logo must not stall a preview; offer text-only branding when no logo is
   available, and do not invent a partner logo.

   Portal defaults are not confirmed branding. Keep Netlify setup until after
   review, and missing wallet setup in the written final handoff.

4. Copy supplied assets into `public/` and apply the actual name, logo, favicon
   and metadata locally through the theme skill before showing the app. Keep
   identity (`VITE_PARTNER`) separate from appearance. Use generated palettes
   through the shared theme configuration, not per-component color edits.
5. Generate a working local preview of the branded application, with the actual
   name/logo on reachable screens and proposed palette. Check desktop and mobile
   yourself. Share a clickable local app link; use screenshots when the partner
   cannot open it. Color swatches alone are not an application preview. One
   coherent proposal is enough unless useful alternatives remain open. Run
   `npm run dev` with the original requested partner ID and use the actual reported port. A validated
   empty discovery response automatically shows the real UI read-only with
   public market data, display-only metadata and a permanent coming-soon toast;
   the navbar chain selector and connection buttons are hidden, and wallets,
   accounts and financial actions are disabled. Before showing that state,
   explain in plain words: “You can review the design now. The coming-soon
   notice is expected until the team activates trading; wallet connections
   will appear after activation.” The notice has a clock icon at the top right
   and cannot be dismissed. No preview flag or partner action is needed to
   preview the design.
   Connection failures and invalid responses still show Retry; resolve or
   report those blockers. Do not change the identity, configure tradable
   fallback contracts or mock browser responses. Report private/funded states
   and the wallet picker as unverified while approval is pending. A failed
   public data feed remains a real error, not fake candles.
6. Invite adjustments before finalizing: “Here is your branded preview. Would
   you like changes to the logo, primary color, or dark/light theme, or should I
   use this version?” Apply requested changes, rerun contrast/visual checks and
   show the revised preview until accepted. Leave the preview ready while the
   reply is pending; silence is not acceptance. An explicit instruction to choose
   defaults and finish, or to skip review, permits completing the authorized
   work without another approval. A general launch/publication request alone
   does not select an unseen design.
7. Persist the chosen generated palette. Clear temporary seed-preview colors
   with `?themePreview=reset`, then verify the saved appearance without preview
   parameters so the build matches the accepted design. Record real discovery.
   An empty-chain result means trading activation is pending: local and hosted
   sites show the real UI read-only with a permanent coming-soon toast. Connection failures
   or invalid discovery still show Retry. A visual preview is not evidence of
   approval. Record the choices, supplied/defaulted inputs,
   final theme seed colors, asset paths and review outcome in `DEPLOYMENT.md`
   using [references/deployment-record.md](references/deployment-record.md).

Later restyles use the theme skill on its own, then rerun the checks and the
publication procedure for the same recorded site and URL; do not repeat URL
selection on an update unless the partner requests a rename.

## Netlify setup at the end

Complete the branded preview and local visual checks first, even when the
partner delegated finalization upfront. Once that preview is accepted or its
finalization is delegated, begin Netlify signup/login, account linking, address
availability checks and site creation. Do not open the Netlify dashboard or
ask hosting questions during logo collection, color selection or preview review. Reuse
supplied choices and existing site records without repeating questions.

Ask for the preferred address only if it is still missing and not delegated:
“What address would you like, such as `your-brand.netlify.app`? It must end in
`.netlify.app`; I can also use a generated name.” Explain that they choose the
part before `.netlify.app`, not a domain to buy. Reuse an existing site's URL on
updates unless a rename is requested.

Read [references/hosting-and-activation.md](references/hosting-and-activation.md)
before account/site setup and availability checking. Follow its available/taken/
generated-name handling, current-plan and ownership requirements. Missing
WalletConnect setup does not hold up URL selection or publication.

## Check and publish

Use a supplied partner-owned WalletConnect ID if available, otherwise leave it
blank and continue. Restart the local preview if build-time settings changed.
Dependencies must already be installed for the preview. If their manifests or
lockfile changed, reinstall with `npm ci --include=dev`. Run all four checks with
the final saved branding and partner environment before uploading. Earlier
preview checks do not replace these final checks:

```sh
npm run check:public
npm run typecheck
npm run lint
npm run build
```

Fix failed checks before publishing; if they cannot pass, report the specific
blocker and leave publication pending. Do not change partner identity to
make a check pass. The current app has no automated test suite; these checks
do not establish financial correctness or trading activation.

For authorized hosting work, read
[references/hosting-and-activation.md](references/hosting-and-activation.md) before
setting up an account/site, uploading a draft or publishing. It owns current-plan
verification, Netlify name availability and selection, removing the Netlify
hosting badge, static SPA setup, draft/live checks and separate activation
handoff. Keep publication pending when authorization or required checks are
missing; local branding review needs no deployment.

## Record and hand off

Read [references/deployment-record.md](references/deployment-record.md) for the
private backup procedure, ignored `DEPLOYMENT.md` format and same-site updates.
Back up customized source before an update and after launch. Keep publication
and trading activation separate; record blocked checks rather than claiming
success. If build scripts, Node requirements, env settings, discovery or hosting
procedure change, update this skill and relevant references in the same change.

Finish with the actual results in this order:

- **Website:** the verified stable clickable URL, or the precise publication blocker.
- **Trading:** active only when verified; otherwise explain the expected
  coming-soon state and give the actual URL/contact for the team handoff.
- **Files:** the permanent source folder, private backup and a ready-to-copy
  future-update prompt using those actual records.
- **Optional mobile-wallet setup:** only the relevant written follow-up below.

Do not call the app ready for trading just because the website is published.
If an actual API/CORS error prevents hosted market data from loading, say so
separately; a coming-soon notice does not prove connectivity. Keep detailed
technical evidence in `DEPLOYMENT.md`, with a short partner-facing explanation.

## WalletConnect follow-up

A missing ID does not hold up publication. At the end, read
[references/walletconnect-follow-up.md](references/walletconnect-follow-up.md)
and provide its concise written instructions using the actual published origin
and permanent source folder. Do not open Reown or start an account walkthrough.
If an owned ID is already configured, include only genuinely pending origin or
pairing checks. Explain that wallet setup and team activation are separate;
connection controls remain hidden until approval.
