# Publish and verify a partner site

Read this before any hosting setup or deployment, in the final launch-setup
phase after local branding review in `../SKILL.md`. Complete the final build-time
configuration and source checks before uploading. Paths and commands are
relative to the app repository root. This procedure supplies no additional
publication authorization. Complete the branded preview and visual checks even when finalization was
delegated upfront. Defer Netlify signup/login, account linking, name availability
checks and project creation until this final phase; do not interrupt
branding or preview review with hosting setup.

When the partner already requested a launch and accepted the design or delegated
finalization, continue through draft upload, production publication and live
checks without another general deployment-confirmation question. Keep the
account, ownership and spending requirements below.

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
pauses, overages, recharge and upgrade triggers in plain words when relevant to
the actual plan. Give the partner a short cost summary and any decision they
must make; keep detailed pricing evidence, the date and source links in
`DEPLOYMENT.md`. Do not rely on remembered prices
or fixed quotas in this file. If pricing cannot be verified, prepare locally and
report publication pending. Ask before spending, upgrades, auto-recharge, paid
features, DNS changes or a paid alternative.

## Choose and verify the Netlify address

Use a Netlify-provided address such as `https://your-brand.netlify.app`. Collect
its preferred name at the end, after branded-preview acceptance or delegated
finalization in `../SKILL.md`, reusing a supplied choice or delegation. Explain that the partner chooses
`your-brand` and the address ends in **`.netlify.app`**. This launch flow does not offer custom-domain
purchases or DNS setup. See Netlify's current
[project naming guidance](https://docs.netlify.com/manage/projects/customize-project-name-and-cover-image/).

For a new site:

1. Accept the name alone or its full `https://name.netlify.app` URL, including
   an optional trailing slash. Trim outer whitespace, normalize case, and extract
   the single hostname label. Validate it against current Netlify naming rules.
   Reject non-root paths, query strings, fragments,
   credentials, extra subdomains and other suffixes; explain the expected form
   and ask for a valid name rather than silently changing the requested name.
2. Check the requested name through Netlify's authenticated project-name
   validation in the verified partner account. If no separate availability
   check is exposed, the intended project's create/name operation is the
   authoritative check. Confirm availability only when Netlify accepts that
   name for this project. A browser 404, DNS lookup failure, or an empty search
   of the partner's own projects does not establish global availability.
   Do not create throwaway projects just to probe or reserve names.
3. If available, use that name for the intended project and continue the
   authorized deployment without another confirmation. If taken, say so
   plainly and ask: “That address is unavailable. What other
   `name.netlify.app` would you like, or should I use a generated address?”
   Check the next supplied choice with Netlify before proceeding. Do not
   silently replace an explicitly requested name while a reply is pending.
4. If the partner chooses a generated address, or already delegated URL choice,
   accept Netlify's generated project name and show the actual resulting URL.
   Recheck any provider-reported collision; avoid repeated guessed-name retries.
   Authentication, account limits and network errors mean verification is
   pending, not that the name is taken. Continue independent local work while
   login or a naming reply is pending.
5. Verify the actual project ID, ownership and stable `.netlify.app` hostname
   returned by Netlify; record the requested name, accepted/generated name and
   confirmed URL in `DEPLOYMENT.md`. A name remains tentative until Netlify
   accepts it. Use the selected stable origin in wallet allowlists and the team
   activation handoff, separately from deploy-specific draft origins.

For an existing intended site, reuse its recorded ID and stable URL. Do not ask
for another name or create a replacement site on ordinary updates. A requested
rename must apply to that same verified owned project; explain that its URL will
change, repeat the provider availability check, and update wallet allowlists,
activation-origin notes and `DEPLOYMENT.md` for the actual new URL.

## Remove the Netlify hosting badge

For the verified partner project, turn off the **Powered by Netlify badge**
as part of deployment setup. In the current Netlify UI, use **Project
configuration > General > Powered by Netlify badge**, switch it off and save.
Check the [current badge documentation](https://docs.netlify.com/manage/projects/powered-by-netlify-badge/)
and follow current labels if they change. The setting applies to that project
for all visitors and takes effect on the next request without a rebuild.

Use the project-wide setting, not the visitor-only **Hide this badge** action;
a local dismissal does not remove it for other visitors. If the setting is
locked or unavailable on the actual plan, explain the limitation and ask before
any paid change. Do not upgrade automatically or claim the badge was removed.
Record the result or blocker in `DEPLOYMENT.md`.

Verify the draft where applicable and stable public site on desktop and mobile
using a clean/private browser session without a saved badge dismissal. Check a
direct route as well as the landing page. Confirm the Netlify hosting badge is
absent; preserve the app's own branding and required chart attribution.

## Build and upload the selected site

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
loads and refreshes, absence of the Netlify hosting badge in a clean session,
and console/network errors. Check actual browser REST/CORS
and WebSocket access separately when discovery permits. A working local proxy,
an HTTP-only probe or a reachable page is not hosted access approval. Check
WalletConnect pairing separately when already configured and reachable. Check
actual draft/production origins against available allowlist records; if this
requires a Reown login, leave that check pending and provide written origin-setup
instructions instead of opening a wallet-account browser walkthrough. If no ID
is configured, publish with it blank, mark pairing deferred and include the
[written wallet follow-up](../SKILL.md#walletconnect-follow-up) at the end. Do not
start a Reown account/browser walkthrough to complete a hosting check. Use an empty wallet
for an optional connection test, or skip it. Do not sign messages/terms, approve tokens,
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
for `global` only. Other requested partners return no active chains until the real
discovery integration and activation exist. A validated empty chain response
shows the branded UI read-only with a permanent coming-soon toast; it does not
grant trading access. Its clock toast is permanent at the top right; the navbar
chain selector and all wallet connection buttons are hidden. Explain this as an
expected pending-activation state, not as a setup error or a missing WalletConnect
ID. This happens automatically for local and built/hosted
sites; use `npm run dev` for branding review without changing the requested ID.
Verify the coming-soon state for an empty response or Retry for connection or
validation errors.
Record account/wallet/trading checks as blocked instead of claiming activation.
Give the creator the final URL to add in the portal and send for team approval;
saving a website there grants no access.
