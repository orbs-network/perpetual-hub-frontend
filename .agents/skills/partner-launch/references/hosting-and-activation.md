# Publish and verify a partner site

Read this before any hosting setup or deployment, in the final launch-setup
phase after local branding review in the [main skill](../SKILL.md). Complete the
branded preview and visual checks even when finalization was delegated upfront.
Defer provider login, account linking, address availability checks and site
creation until this phase. Complete final build-time configuration and source
checks before uploading. This reference supplies no additional publication
authorization. Commands are relative to the app repository root.

When the partner requested a launch and accepted the design or delegated
finalization, continue through publication and live checks without another
general deployment-confirmation question. Respect a request to prepare a build
for the creator to host themselves instead.

## Follow the hosting choice

Use the provider or self-hosting preference supplied in the brief or chat.
On updates, reuse the verified account, site and URL in `DEPLOYMENT.md` and the
local provider link. Resolve conflicting/stale links before upload; create a
new site only when no intended site exists. Do not migrate providers or create
a replacement site merely because authorization expired or access is blocked.

For a new launch without a preference, recommend Netlify: “I'll use Netlify
unless you prefer another provider.” Continue the default workflow without a
separate mandatory provider-choice question. Reuse supplied choices; otherwise
combine this optional alternative with the late address question. Do not show a
long provider menu or require a GitHub account, fork, source push or continuous
deployment merely to upload a static build.

Read only the selected hosting procedure:

- **Netlify:** [netlify.md](netlify.md) owns CLI authentication, `.netlify.app`
  names, authoritative availability checks, project-wide badge removal and upload.
- **Another provider, existing infrastructure or self-hosting:**
  [other-hosting.md](other-hosting.md) owns adaptation, checked build delivery
  and the fallback when direct deployment is unavailable. Do not apply Netlify
  suffixes, badge settings, commands or redirect syntax to other hosts.

Use existing authenticated tools/CLI/API first and handle routine setup yourself.
Only hand off personal signup/login/MFA, required account consent or a spending
choice. Never ask for passwords, tokens or keys in chat. Inspect the current
account and intended site's ownership before writes; keep provider/session state
ignored and credentials out of source, public build variables, notes and backups.

## Check plan and costs

For the selected managed provider, read current official pricing, usage and terms
and inspect the actual account plan at each launch/update. Check commercial-use
eligibility, deployment/traffic consumption, pauses, overages, recharge and upgrade
triggers as relevant. Give a short cost summary and any decision the creator
must make; keep dated evidence and official source links in `DEPLOYMENT.md`.
For existing infrastructure, record known costs and any unknown usage exposure;
a build-only handoff does not require opening a provider account.

Do not rely on remembered prices or fixed quotas. If plan eligibility or costs
cannot be verified for a proposed deployment, prepare locally and report
publication pending. Ask before spending, upgrades, auto-recharge, paid features
or DNS changes. Do not automatically replace the chosen host with a paid or
alternate provider. Domain purchases and DNS setup are outside this launch flow.

## Build and publication boundaries

Upload only the checked static build, never source, real env files or dependencies.
If the build changes after draft checks, repeat checks before production. Use a
draft/staging deployment when supported, then publish the reviewed build to the
same verified owned site. If the host has no draft mode, inspect the production
build locally first and verify the live site immediately after the authorized
upload. Return the stable production URL rather than only a draft address.
Dashboard env edits do not change an already built upload; rebuild with the
intended values. Preserve existing routing and provider configuration, adapting
only what the chosen host requires.

**Never run `npm run deploy` or `scripts/deploy.mjs` for a partner:** its fixed
Orbs project is not the creator's target. For any Vercel deployment attempt,
run `vercel logout` after verification, including on failure.

## Verify the actual website and activation separately

Check the draft and stable production origin in a browser: HTTPS, intended
branding/metadata/assets, desktop/mobile layout, keyboard access, direct route
loads and refreshes, absence of the Netlify hosting badge in a clean session
when using Netlify, and console/network errors. Check actual browser REST/CORS
and WebSocket access from the actual published browser origin. If discovery
prevents an application-level test, report it as **not tested/blocked**; a
separately permitted read-only transport probe is only transport evidence, not
proof of an authenticated subscription or successful pairing. A working local proxy,
an HTTP-only probe or a reachable page is not hosted access approval. Check
WalletConnect pairing separately when already configured and reachable. Check
actual draft/production origins against available allowlist records; if this
requires a Reown login, leave that check pending and provide written origin-setup
instructions instead of opening a wallet-account browser walkthrough. If no ID
is configured, publish with it blank, mark pairing deferred and include the
[written wallet follow-up](../SKILL.md#walletconnect-follow-up) in `DEPLOYMENT.md`,
linked from the handoff. Do not start a Reown account/browser walkthrough to
complete a hosting check. Use an empty wallet
for an optional connection test, or skip it. Do not sign messages/terms, approve tokens,
trade, deposit or withdraw for a hosting check.

Track these states independently:

- **Website published: URL** only after verifying the stable production site.
  Otherwise say draft ready, not published, or publication pending.
- **Hosted connectivity:** report browser REST and WebSockets separately as
  verified, blocked, unavailable or not tested. Keep this independent of
  publication, activation and wallet pairing; do not infer missing origin approval
  from a generic network error.
- **Optional wallet pairing:** tested, deferred or blocked, with its own reason.
- **Trading activation pending** until the team confirms the assigned partner
  ID, enabled networks and authoritative discovery/configuration, approves the
  exact published browser origin for REST/CORS and WebSockets, and applicable
  live connectivity checks pass. Record each unresolved item.

Query the exact registry-check URL from the brief, if provided, without inventing
an endpoint. A response marked `mock: true` is informational even when enabled;
it confirms neither assignment nor real activation. Missing/unreachable/disabled
status or a placeholder contact must not stall customization, build or preview.
Use only a real supplied contact/tracking link for the creator's handoff. If none
is provided, explicitly report **activation contact not provided**; do not ask the creator to
verify team-only facts or message the team without authorization.

At this source version, `fetchPartnerChains` is an explicitly temporary fixture
for `global` only. Other requested partners return no active chains until the real
discovery integration and activation exist. A validated empty chain response
shows the branded UI read-only with a permanent coming-soon toast; it does not
grant trading access. Its permanent clock toast is at the top right on desktop; mobile uses a compact
status area below the navbar with reserved layout space. The chain selector and
wallet connection buttons are hidden. Market/configuration failures show a
separate connection message and failed-panel Retry controls, not endless loading. Explain this as an
expected pending-activation state, not as a setup error or a missing WalletConnect
ID. This happens automatically for local and built/hosted
sites; use `npm run dev` for branding review without changing the requested ID.
Verify the coming-soon state for an empty response or Retry for connection or
validation errors.
Record account/wallet/trading checks as blocked instead of claiming activation.
After stable-site verification, follow [address-callback.md](address-callback.md)
for any documented, authorized address-submission integration. Otherwise record
submission as not configured/blocked and supply only a real provided manual
route. Callback acknowledgement or saving an address in a portal grants no
access. Use the main skill's four-status handoff and one creator next action.
