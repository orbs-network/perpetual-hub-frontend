# Perpetual Hub frontend

Standalone white-label perpetual futures trading UI built with React, TypeScript
and Vite. This repository contains the browser application and public partner
configuration. It installs and builds without a sibling monorepo checkout.

## Run locally

Use Node.js 22.12 or newer.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open the local URL printed by Vite. The example selects the `global` backend
partner with the generic Perpetual Hub appearance and the public production API.
Local development always proxies API and WebSocket traffic through Vite to the
public endpoints in `src/config/apiEndpoints.ts`. Production builds and previews
use those same endpoints directly.
Trading actions use the configured backend;
connecting a wallet and signing requests have their normal live meaning.

## Configure the partner and chains

This app has one partner and one appearance. Set the required `VITE_PARTNER` in
`.env.local` (or your hosting build environment) to the backend partner ID. The
value is used directly for API headers, WebSocket subscriptions, referral scope
and signing keys; there is no preset registry, alias or fallback identity.
Set the required `VITE_APP_ORIGIN` to the public frontend origin accepted by the
backend. The local proxy sends it as its upstream Origin header; wallet metadata
also uses it as a fallback outside the browser. It does not select the API host.
Missing or invalid required values fail the build. Changes require a rebuild.

Keep the existing default theme in `src/config/partners/default.ts` for now.
The agent can configure its theme tokens there later. `VITE_PARTNER` selects
only the backend identity; chain discovery does not configure the appearance.
The current configuration has one palette and no theme-switching control.

Agents changing colors, logos, fonts or branding metadata should use
[$perpetual-hub-theme](.agents/skills/perpetual-hub-theme/SKILL.md). The skill maps
the configuration to UI surfaces and explains asset placement and verification.

At startup, `src/api/partnerChains.ts` calls the async `fetchPartnerChains(partnerId)`
boundary. For now it is an explicitly temporary mock API, serving the existing
`global` Arbitrum lane from the `registry` in
`packages/partner-config/src/registry.ts`.
Other IDs return an unavailable state rather than borrowing that lane. Replace
this function's mock transport with the partner-ID API once its endpoint and
response contract are available. The response is `{ partnerId, chains }`; each
chain provides its ID, display name, contract address, collateral address,
symbol and decimals. Wallet/RPC metadata is looked up by ID in the installed
`viem/chains` catalog; no local network registry is needed. Networks absent from
that catalog are rejected during discovery.

The app validates the response and waits before constructing wallets or
mounting trading/account queries. Empty, malformed, mismatched or failed
responses show a retry screen. The chain selector, wallet networks and active
contract/collateral scope all use the returned chains. `?chain=` selects only
among those chains; unsupported selections fall back to the first returned
chain. Account/order validation still belongs to the backend/TEE.

Public partner configuration lives in `packages/partner-config/src` (shared
chain types and temporary response) and `src/config/partners` (the single theme,
logo, feature flags and initialization). Assets belong in `public/`.

| Variable | Purpose |
| --- | --- |
| `VITE_PARTNER` | Required backend partner ID, used directly; the example and temporary mock use `global`. |
| `VITE_APP_ORIGIN` | Required public frontend origin, such as `https://perps.orbs.network`; no path, credentials, query or fragment. |
| `VITE_WALLETCONNECT_PROJECT_ID` | Your own optional WalletConnect project ID for QR/mobile wallet pairing. Injected browser wallets remain available without it. |

These deployment inputs are validated once through
`src/config/partners/environment.ts` in both Vite and the browser. The environment
example lists every supported user setting. An empty WalletConnect project ID
leaves injected wallets available.

API and WebSocket URLs are defined once in `src/config/apiEndpoints.ts`.
To target another backend, change those constants and restart or rebuild the app.
Binance market data always uses mainnet, configured in source without an
environment selector.

`VITE_` values are public browser configuration. Keep actual environment files
and credentials out of version control. Branding, backend endpoints and contract
addresses cannot be switched by URL parameters. The public `?chain=` parameter
selects among chains returned for the configured partner.

## Trading chart

The chart uses Apache-2.0 `klinecharts` 10.1.0 with Binance-first candles and the
existing backend candle fallback. It retains all 14 intervals, live updates,
fill markers, PNL/privacy and liquidation lines, pending order badges,
cancellation, limit-form previews, tick-rounded order/TP/SL repricing and
rollback after a failed update.

The toolbar uses app-styled timeframe/type dropdowns, indicators and parameters,
drawing tools with per-symbol restoration and locking, and desktop fullscreen.
Keyboard users can navigate the dropdowns, close them with Escape and adjust a
focused order badge by one price increment with Arrow Up/Down. Controls wait
for the selected symbol/timeframe history before using its scale.

Indicator/drawing choices use KLineChart's catalog; legacy proprietary studies
and saved layouts are not portable. The dependency's license ships at
`public/licenses/klinecharts.txt`.

## Public application boundary

The app includes trading, portfolio/history, rewards/referrals, points,
optional bridging and the public rollup explorer. Administration screens,
operator APIs, internal BI/telemetry, runtime backend/brand selectors, test-wallet
connectors, private deployment tooling and the proprietary chart bundle are
excluded. The read-only `/api/v1/admin/config` endpoint remains because the
public trading UI needs its market, fee and risk-display configuration.

Backend and TEE validation remain authoritative. Display math does not authorize
orders. Domain submission prices remain exact 1e18 values with explicit price
conversion, market tick rounding and the existing signing/mutation flows.

## Verify

```sh
npm run check:public
npm run typecheck
npm run lint
npm run build
```

CI runs these checks from this repository alone with the partner ID and public
app origin from the environment example.
A read-only RPC reachability check is also available with `npm run smoke:rpc`.
The repository has no automated test suite or recorded financial regression
fixtures. Source, type, lint and build checks do not establish financial parity
with the current backend/TEE.

For visible changes, check desktop, mobile, keyboard use and fullscreen in a
real browser. Financial changes need an independent integration check against
the current authority. A funded end-to-end order/TP/SL scenario still needs an
explicitly configured isolated backend and funded test wallet.

## Build and host

```sh
npm run build
npm run preview
```

Host `dist/` on a static host with SPA fallback to `index.html`. The checked-in
`vercel.json` provides that rewrite and the Vite build settings for Vercel. Set
the public build variables for your own host/project.

## Deploy to Vercel

Install the Vercel CLI with `npm install --global vercel`, then run from the
repository root:

```sh
npm run deploy -- --dry-run
npm run deploy -- --build-only
npm run deploy
```

`--dry-run` prints the target and plan without running commands or logging in.
`--build-only` pulls production settings and builds locally without publishing;
the resulting Vercel output is saved to `.vercel/local-builds/frontend`.
The default command requires an interactive yes/no production confirmation,
then builds locally and publishes the prebuilt static output to project
`prj_RuNXiM0iYR0PRNn47ElA3M46GsLS` in organization
`team_t6YZC010wIUd8yFGN6mkglL9`. Shell project settings and an existing local
Vercel link cannot change that target; pulled project settings are checked too.

The script checks the public-source boundary before authentication and stages
the current tracked and nonignored untracked source, including uncommitted
edits. Real environment files, Git metadata, dependencies and cached builds are
excluded from staging. Only the three public variables listed above are loaded,
in this order: shell, `.env.production.local`, `.env.local`, `.env.production`,
`.env`, then pulled Vercel production values. The first defined value wins; an
explicitly empty WalletConnect ID disables pairing. A redacted pulled value
must be supplied locally. Values are validated by Vite and are not printed or
uploaded as runtime environment settings.

Authentication uses your Vercel CLI session, with interactive login when needed;
the script ignores `VERCEL_TOKEN` and `VERCEL_TOKEN_*`. Once authentication starts,
both publishing and build-only runs clean up temporary staging and run
`vercel logout` on success or failure. Dry runs and declined confirmations do
not run Vercel commands.

The source package retains the monorepo's declared MIT license. Third-party
notices remain with their assets, including the chart and bundled Inter fonts.
