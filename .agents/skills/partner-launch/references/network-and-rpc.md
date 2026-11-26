# Choose network access without a technical questionnaire

Read when checking network connectivity or when the partner has no RPC service.
This is an agent task, not another intake stage. Keep the logo → appearance →
preview → hosting sequence and requested partner identity.

## Start with the app's existing defaults

The app already selects public RPC fallbacks from `RPC_URLS_BY_CHAIN` in
`src/config/constants.ts`; chains without an override use installed
`viem/chains` metadata through `src/config/wagmi.ts`. Inspect the current source
instead of asking the partner to supply an endpoint or choose a vendor. Say,
when relevant: “You don't need to bring an RPC service. I'll check the public
connections included with the app.” Public services may have rate or traffic
limits; do not promise production capacity from a successful probe.

Use active network IDs from authoritative partner discovery, not invented
contracts or a network picker the creator must configure. Requested networks
in a brief are activation requests, not enabled trading lanes. With pending
approval, read-only display metadata uses zero contract/collateral addresses
and can show a different network from the request. Never treat a successful
display-network RPC check as approval or proof of requested-network support.
Do not change the partner ID to `global` to make a diagnostic pass.

## Check the right connection

Separate these causes before attempting a fix:

- **Blockchain RPC:** wallet/contract reads use the selected chain's endpoints.
- **Application REST/WebSocket:** markets, orders and subscriptions use
  `src/config/apiEndpoints.ts`. Changing an RPC cannot grant backend origin
  access or fix its CORS/WebSocket permissions.
- **Partner approval:** discovery supplies active chains/contracts. An empty
  response is the expected read-only coming-soon state, not a missing RPC.
- **WalletConnect:** optional QR/mobile pairing has its own public project ID;
  missing setup remains deferred and does not block preview or hosting.

For genuinely active lanes, inspect `npm run smoke:rpc -- --help` and list the
public targets with `npm run smoke:rpc -- --list`. Run its bounded read-only
probe using the actual frontend origin, for example:

```sh
npm run smoke:rpc -- --origin <actual-frontend-origin> --chain <active-chain-id> --timeout-ms 5000 --concurrency 2
```

Replace placeholders yourself; do not ask the partner for CLI arguments. The
probe checks chain identity, available read methods/contract data and CORS
headers. It sends no transactions. Check all results: an incomplete check is
not a pass. A terminal Origin-header probe is diagnostic evidence; browser
reads from the actual local/published origin are separate verification. Do not
mistake either for backend REST/WebSocket approval or financial integration.

Skip active-contract smoke checks for pending partners: the current diagnostic
loads display lanes with zero addresses there, so its contract result cannot
verify activation. Record the limitation and continue branding and publication.
Record RPC evidence in `DEPLOYMENT.md` without adding a fifth final status.
For custom endpoints, inspect how output handles credentials before running a
listing or JSON report; URLs can contain keys in their paths as well as queries.
Never print or store credential-bearing endpoint URLs in notes or logs.

## If the defaults fail or a custom endpoint is requested

Check the actual failing endpoint, chain ID and browser error. Allow the existing
fallbacks to run; do not replace working defaults merely because one upstream
is unavailable. If no configured endpoint works, consult the chain's current
official network/RPC documentation and recommend a documented public HTTPS
option first. For Polygon, start with its
[official RPC reference](https://docs.polygon.technology/pos/reference/rpc-endpoints/);
use the equivalent official source for other chains. Check chain identity,
required reads and browser access before calling an alternative usable. Do not
maintain a second hardcoded endpoint list in this skill or invent URL patterns.

If an owned managed service is needed for capacity or access, suggest one
compatible provider from current official chain/provider documentation, explain
why and check its current terms. Handle routine setup; the creator only takes
over for signup/login/MFA, required account consent or spending approval. Never
ask for a secret API key in chat or embed a server secret in a static app. A
browser-public endpoint must be intended for that use, with provider-supported
origin restrictions and limits where available. A secret-only service needs a
separately authorized server integration, not a secret hidden in a Vite variable.

This checkout has no partner RPC environment setting. Do not invent `VITE_RPC_URL`,
claim a supplied endpoint was applied, or write an ignored setting that the app
never reads. If a custom integration is requested, inspect the current supported
configuration, implement the necessary change under `AGENTS.md` with public
partner configuration in `src/config/partners`, and update runtime consumers,
diagnostics and documentation together. Report any unimplemented integration
plainly. Preserve backend/TEE authority and contract discovery throughout.
