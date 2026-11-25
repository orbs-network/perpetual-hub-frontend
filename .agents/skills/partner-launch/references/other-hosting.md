# Other providers and self-hosting

Read this only when the creator chose another provider, their own infrastructure,
or a build they will host themselves. Apply the shared requirements in
[hosting-and-activation.md](hosting-and-activation.md). Keep setup after the
branded preview and reuse the same source folder, provider, site and URL on updates.

## Deploy to the chosen host when possible

Use the selected provider's current official static-site/Vite documentation and
the existing project configuration. The [Vite deployment guide](https://vite.dev/guide/static-deploy)
describes the static `dist/` output; `vite preview` is a local check, not a
production server. Do not scaffold a different application or imply every host
can be deployed to with the tools available in this session.

Use an already-connected tool or documented CLI/API, reusing authorization and
verifying the actual account and owned project before writes. Handle routine
setup yourself. For missing/expired authorization, offer the provider's real
login flow; the creator completes personal authentication and MFA. Do not ask
for credentials in chat, require manually copied tokens, or treat network and
permission errors as expired login. If direct deployment cannot be completed,
explain the specific limitation and prepare the build handoff below without
silently switching to Netlify.

Check the actual plan and current commercial-use terms, not just whether an
account exists. For example, if Vercel is chosen, read its
[current plan documentation](https://vercel.com/docs/plans/hobby) and eligibility
before using the existing project. Ask before any paid change. Follow the
repository's `vercel.json` where applicable and run `vercel logout` after every
deployment attempt and verification, including failure.

Use the host's actual naming rules and authoritative create/name response for
availability. Do not require `.netlify.app` or infer availability from DNS or a
404. If a requested name is unavailable, ask for another or use a generated name
only when delegated. Record the actual accepted stable URL and site ID; do not
invent a provider suffix. Reuse a supplied existing address without purchasing
a domain or changing DNS.

Configure the host's documented SPA fallback to `index.html` for application
routes while serving real assets normally. Netlify `_redirects` syntax is not a
universal routing configuration. Check the app's asset and router base before
using a subpath; do not promise support without verifying direct routes,
refreshes and assets at that path. Prefer the provider's HTTPS root address
when no path was requested. Keep API/WebSocket/WalletConnect settings build-time;
the local Vite proxy is not part of a static deployment.

Deploy the checked build to the verified intended project, using a draft when
available. Run the [shared live checks](hosting-and-activation.md#verify-the-actual-website-and-activation-separately)
from the actual published origin, including separate REST and WebSocket checks.
The page loading alone does not verify trading access.

## Prepare a build the creator can host

Use this path when self-hosting was requested or direct deployment is unavailable.
Do not create another hosting account/site or deploy elsewhere. Finish branding,
preview and all four required source/build checks. Inspect the production build
locally; no local result proves hosted connectivity.

Provide the absolute path to `dist/` and a portable archive of its contents in
the permanent project folder, outside `dist/`. Include only the public build,
with no source, `.env` files, credential/session state or dependencies. Keep the
archive ignored and do not overwrite unrelated files. This artifact is separate
from the private source backup.

Put concise instructions in ignored `DEPLOYMENT.md`: serve the build contents
over HTTPS; configure the chosen host's SPA fallback and real asset handling;
record the intended URL/path, required build settings by name/status only and
any known provider-specific steps. Explain that a changed build-time value needs
a rebuild. If no host was chosen, describe these requirements without inventing
commands, an account or a hostname.

Use the usual four-status handoff: **Website: publication pending — build ready**,
trading activation pending/unverified as appropriate, hosted REST/WebSocket
not tested and optional wallet pairing deferred/blocked as observed. Link the
build and notes. Make the single next action upload the build to the chosen host,
or the specific account/access action needed if the creator wants agent deployment.
Do not report publication or send an address callback for an unverified site.
When a real URL is available, verify it with the shared live checks before
reporting publication or submitting its address through an authorized callback.
