# Netlify hosting

Read this only when Netlify is the selected provider, after the branded preview.
Apply the shared ownership, cost, authorization and verification requirements in
[hosting-and-activation.md](hosting-and-activation.md).

## Keep authentication and setup inside the agent workflow

After the branded preview is finished and accepted or finalization is delegated:

1. Reuse the installed Netlify CLI, or prepare it in user space yourself. Read
   the [current CLI guide](https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/).
   Run `netlify status --json` or an equivalent read-only authenticated tool call.
   Inspect account/team, recorded site ID and ownership without printing token
   stores. An unlinked folder is not a failed login; a network error or wrong
   account is not proof that authorization expired.
2. Reuse valid authorization and the intended owned site without asking the
   partner to log in again. If a Netlify connector/MCP is already connected and
   sufficient, use it rather than adding a second authentication flow. Do not
   require installing another plugin or agent skill for this static upload.
3. Only when authorization is missing/expired, run `netlify login` yourself and
   give one clear handoff with its actual provider-generated login URL:
   “Open this link, sign in and authorize Netlify, then return here.” The partner
   completes signup, password entry, email verification and MFA in their browser.
   Never request passwords/tokens in chat or a manually generated access token.
   If the CLI opens a browser directly, identify that window instead of inventing
   a URL. Do not add a dashboard tour or ask them to create the project.
4. Resume when the CLI/tool confirms authorization; do not require an extra
   “done” reply if success is already observable. Verify the resulting account
   and intended site before continuing. Ask an account question only for genuine
   ownership ambiguity, access restrictions or a changed account. Do not loop
   through fresh login windows for network errors or an unresolved permission
   failure; explain the specific blocker and continue independent local work.
5. Handle account/plan inspection, project naming/creation, provider settings and
   deployment yourself. Use authenticated CLI/API capabilities with documented
   fields; fall back to agent-operated provider UI only for settings not exposed
   by the available tools. The creator only needs to take over for personal
   authentication, required account consent or a spending decision. If needed
   access/tools are unavailable, report that specific blocker rather than ask
   the partner to copy credentials, execute commands or navigate routine setup.

On future updates, use the same permanent folder, account, site ID and stable URL.
Reuse the saved authorized session when valid and repeat login only if required.
Do not repeat provider signup, URL selection or project creation, or switch
providers merely because a session expired. Keep only non-sensitive account/site
references in `DEPLOYMENT.md`; real authorization remains in the provider's
local credential store, never source, public build variables, notes or backups.

Use Netlify's free option only when the actual account and current terms fit
the launch. Read [current pricing](https://www.netlify.com/pricing/) and linked
terms, including the actual account's legacy plan if applicable. Apply the shared plan/spending checks in
[hosting-and-activation.md](hosting-and-activation.md#check-plan-and-costs).

## Choose and verify the Netlify address

Use a Netlify-provided address such as `https://your-brand.netlify.app`. Collect
its preferred name at the end, after branded-preview acceptance or delegated
finalization in the [main skill](../SKILL.md), reusing a supplied choice or delegation. Explain that the partner chooses
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
2. Check the requested name through authenticated CLI/API project-name
   validation in the verified partner account. If no separate availability
   check is exposed, the intended project's create/name operation is the
   authoritative check. Confirm availability only when Netlify accepts that
   name for this project. A browser 404, DNS lookup failure, or an empty search
   of the partner's own projects does not establish global availability.
   Do not create throwaway projects just to probe or reserve names. Prefer the
   documented [sites:create command](https://cli.netlify.com/commands/sites/)
   for creating the intended static project with its requested name and verified
   account slug. Read the installed version's help for the current options;
   handle CLI prompts yourself using recorded choices. Do not use `netlify init`
   or Git integration merely to upload `dist/`.
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
as part of deployment setup. Use a documented authenticated CLI/API capability
if exposed; do not guess a badge field or require a new token. Otherwise operate
the provider UI yourself with the existing authorized session. In the UI, use **Project
configuration > General > Powered by Netlify badge**, switch it off and save.
Check the [current badge documentation](https://docs.netlify.com/manage/projects/powered-by-netlify-badge/)
and follow current labels if they change. Do not give the partner a settings
walkthrough unless personal account access is the actual blocker. The setting applies to that project
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

Do not use anonymous/claim-later deployment for a durable partner launch. It
creates a temporary ownership/claim step rather than the verified owned site.
Do not upload source, real env files or dependencies. If the build changes after
draft checks, repeat those checks before production. Return the stable site URL,
not just the deploy-specific draft URL. Dashboard env edits do not alter an
already built upload; rebuild with the intended values.

Continue with the [shared live checks and activation handoff](hosting-and-activation.md#verify-the-actual-website-and-activation-separately).
