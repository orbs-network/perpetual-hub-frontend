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

For a new launch without a preference, inspect already-connected supported
tools and installed CLI status after the branded preview. Prefer a suitable
existing account only when ownership and intended use are established; login
alone is not authorization. Do not scan credential directories or install/login
to every provider merely to find an account. Ask one plain account-level question
if multiple eligible destinations remain ambiguous. Never use an internal,
Orbs-owned or shared organization without explicit authorization for this partner.

If no suitable account is available, recommend Netlify subject to current terms.
Explain the choice briefly, with no mandatory provider menu. If this unselected
default is unavailable/ineligible, consider Cloudflare Pages or another supported
static host using the same eligibility and ownership checks. Respect an explicit
provider choice; offer a specific alternative when it cannot be used rather than
silently switching. Use local preview/build delivery when access or terms remain
blocked. A temporary public preview is a separate opt-in path below, never the
default fallback for a permanent launch. No GitHub account, fork, source push or
continuous deployment is required merely to upload static files.

Read only the selected hosting procedure:

- **Netlify:** Read and follow the shared [Netlify hosting skill](https://github.com/orbs-network/agent-skills/blob/master/skills/netlify-hosting/SKILL.md) for account, cost, naming, deployment and hosting verification. Also follow [netlify.md](netlify.md) for this app's static `dist/` build, SPA redirects and app-specific checks. If the shared skill cannot be accessed, use the complete local Netlify procedure as a fallback and report that the shared skill was unavailable.
- **Cloudflare Pages:** [cloudflare-pages.md](cloudflare-pages.md) covers
  authorized Direct Upload, preview/production branches and SPA behavior.
- **Vercel:** [vercel.md](vercel.md) covers the verified project, local Build
  Output API artifact, matching build environments and required logout.
- **Another provider, existing infrastructure or self-hosting:**
  [other-hosting.md](other-hosting.md) owns adaptation, checked build delivery
  and the fallback when direct deployment is unavailable. Do not apply Netlify
  suffixes, badge settings, commands or redirect syntax to other hosts.

For an explicitly authorized registration-free public preview, read only
[Netlify's temporary-preview section](netlify.md#explicit-temporary-public-preview-without-signup).
Record its expiry/claim status and keep it separate from permanent publication.

Use existing authenticated tools/CLI/API first and handle routine setup yourself.
Only hand off personal signup/login/MFA, required account consent or a spending
choice. Never ask for passwords, tokens or keys in chat. Inspect the current
account and intended site's ownership before writes; keep provider/session state
ignored and credentials out of source, public build variables, notes and backups.

Load shared hosting guidance yourself; do not ask the creator to find, install
or invoke it. If the GitHub page cannot be read, try its official raw file once,
then use the local fallback and note the unavailable source in `DEPLOYMENT.md`.
Do not let repeated reference lookups stall an otherwise supported launch.
App-specific requirements remain in force: static upload, saved partner build
settings, preview before hosting, deferred missing WalletConnect and the four
independent final statuses. A shared procedure does not authorize extra steps.

For a permanent launch, an absent hosting account calls for guided signup, not an immediate build-only
handoff. Check the selected provider's current suitable plan, prepare its login
flow and explain the one action: “Sign in or create your account in this window;
I'll set up and publish the site afterward.” The creator completes signup,
verification and MFA; inspect the resulting account and resume when success is
observable. Do not ask them to create the site, connect GitHub, enter build
commands or configure redirects. Prefer existing sufficient tools and guide only
required personal account actions. Keep login awaiting the creator separate from
failed authentication, permission errors and provider outages. Do not silently
change hosts or claim publication while waiting. Prepare a build handoff if the
creator chooses self-hosting, declines signup or access remains unavailable after
the relevant login/access path; include the exact remaining action.

## Check plan and costs

For the selected managed provider, read current official pricing, usage and terms
and inspect the actual account plan at each launch/update. Check commercial-use
eligibility and applicable product/use restrictions for a trading frontend,
deployment/traffic consumption, pauses, overages, recharge and upgrade
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
upload. Confirm the actual build output from the current scripts/configuration
(currently `dist/`), preserve security headers and inspect public artifacts for
accidental secrets, private configuration or another partner's data before upload.
Record source revision/local changes, build settings/status and artifact provenance
so the deployed version can be identified. Return the stable production URL rather than only a draft address.
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

When a network/RPC issue appears, follow [network-and-rpc.md](network-and-rpc.md)
to distinguish it from backend access and pending approval. Use existing public
defaults and perform applicable diagnostics yourself. Do not turn a hosting or
activation error into a request for the creator's RPC credentials.

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
