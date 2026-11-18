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

Open `http://localhost:5174/`. The development server uses port 5174 and fails
instead of moving to another port if that listener is occupied.
The example selects the `global` backend
partner with the generic Perpetual Hub appearance and the public production API.
Local development always proxies API and WebSocket traffic through Vite to the
public endpoints in `src/config/apiEndpoints.ts`, removing the browser Origin
header from HTTP forwarding. The WebSocket proxy sends the backend's fixed
approved Origin, `https://perps.orbs.network`, to complete its handshake; this
service header does not configure the frontend host. Production builds and
previews use those same endpoints directly with the browser's actual origin.
Trading actions use the configured backend;
connecting a wallet and signing requests have their normal live meaning.

## Configure the partner and chains

This app has one partner and one appearance. Set the required `VITE_PARTNER` in
`.env.local` (or your hosting build environment) to the backend partner ID. The
value is used directly for API headers, WebSocket subscriptions, referral scope
and signing keys; there is no preset registry, alias or fallback identity.
Missing or invalid partner IDs fail the build. Changes require a rebuild.
Wallet icon URLs and referral links use the current browser origin; no frontend
deployment origin is configured at build time.

Keep the existing default theme in `src/config/partners/default.ts` for now.
The agent can configure its theme tokens there later. `VITE_PARTNER` selects
only the backend identity; chain discovery does not configure the appearance.
The current configuration has one palette and no theme-switching control.

Agents changing colors, logos, fonts or branding metadata should use
[$perpetual-hub-theme](.agents/skills/perpetual-hub-theme/SKILL.md). The skill maps
the configuration to UI surfaces and explains asset placement and verification.

For a partner-owned website launch or update, use
[$partner-launch](.agents/skills/partner-launch/SKILL.md). It maintains the build,
hosting, current-pricing checks, live verification, private `DEPLOYMENT.md` record
and separate trading-activation handoff alongside this code. Read `AGENTS.md`
explicitly after cloning. `CLAUDE.md` imports it, and `.claude/skills/partner-launch`
links to the same skill for Claude Code; there is only one procedure to maintain.
Changes to build scripts, Node requirements, env settings, discovery or hosting
must update the skill in the same change. A launch prompt carries partner data
and pre-clone safeguards rather than another copy of these steps.

At startup, `src/api/partnerChains.ts` calls the async `fetchPartnerChains(partnerId)`
boundary. For now it is an explicitly temporary mock API, serving the existing
`global` Arbitrum lane from the `registry` in
`src/config/partners/registry.ts`.
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

Public partner configuration lives in `src/config/partners`: chain types,
the temporary registry response, the single theme, logo, feature flags and
initialization. It is part of the app, without a separate local package.
Assets belong in `public/`.

`policyUrls.termsOfUse` and `policyUrls.privacyPolicy` are blank by default.
Blank values hide footer links and render plain labels in terms acceptance.
Configure document URLs in `src/config/partners/default.ts` when available.

| Variable | Purpose |
| --- | --- |
| `VITE_PARTNER` | Required backend partner ID, used directly; the example and temporary mock use `global`. |
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

The chart uses Apache-2.0 `lightweight-charts` 5.3.0 with Binance-first candles
and the existing backend candle fallback. It retains all 14 intervals, four
chart types, live updates, native fill markers, PNL/privacy and liquidation
lines, pending order badges, cancellation, limit-form previews, tick-rounded
order/TP/SL repricing and rollback after a failed update.

The toolbar provides a timeframe dropdown and compact chart-type, indicator and
drawing dropdowns with a shared appearance. The indicator dropdown provides
search, translated full names and editable parameters for all 27 application
indicators. The 11 drawing tools support per-symbol restoration and locking.
Desktop fullscreen is available. Keyboard users can navigate
the dropdowns, close them with Escape and adjust a focused order badge by one
price increment with Arrow Up/Down. Controls wait for the selected
symbol/timeframe history before using its scale. Indicators and drawings use
application-owned models; previous chart-engine layouts and native formats are
not imported.

Timeframe, chart type and indicator parameters are remembered per partner and
chain. Completed drawings and their locks are saved separately per symbol and
timeframe, including edits, deletion and clearing. Drafts are not saved. Display
preferences use validated, bounded browser storage and remain usable in memory
when storage is unavailable; account, order and position data are not stored
with chart preferences. Indicator inputs support up to 16 parameters, each no
greater than 100,000. Live market updates do not save preferences.

The renderer license ships at `public/licenses/lightweight-charts.txt`, with
its official copyright notice in `public/licenses/lightweight-charts-notice.txt`.
The chart displays that notice and a [TradingView link](https://www.tradingview.com/).
The ported indicator calculations retain their Apache-2.0 license and original
copyright attribution in `public/licenses/indicator-calculations.txt`.

## Public application boundary

The app includes trading, portfolio/history, rewards/referrals, points
and the public rollup explorer. Administration screens,
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

CI runs these checks from this repository alone with the partner ID from the
environment example.
A read-only RPC reachability check is also available with
`npm run smoke:rpc -- --origin <frontend-origin>`. Its CORS probes require the
origin of the frontend you want to check. Use `npm run smoke:rpc -- --list` to
list discovered RPC targets, or `--help` for options, without supplying an origin.
The repository has no automated test suite or recorded financial regression
fixtures. Source, type, lint and build checks do not establish financial parity
with the current backend/TEE.

For visible changes, check desktop, mobile, keyboard use and fullscreen in a
real browser. Financial changes need an independent integration check against
the current authority. A funded end-to-end order/TP/SL scenario still needs an
explicitly configured isolated backend and funded test wallet.

## Build and host

```sh
npm ci --include=dev
npm run build
npm run preview
```

Builds require dev dependencies, including Vite, TypeScript and Tailwind. Keep
`--include=dev` when installing for a build under `NODE_ENV=production` or an npm
configuration that omits dev dependencies. Only the generated `dist/` is hosted.

Host `dist/` on a static host with SPA fallback to `index.html`. The checked-in
`vercel.json` provides that rewrite, installs build dependencies explicitly and
sets the Vite build settings for Vercel. Set the public build variables for your
own host/project.

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
excluded from staging. Only the two public variables listed above are loaded,
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
