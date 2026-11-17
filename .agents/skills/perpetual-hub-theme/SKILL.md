---
name: perpetual-hub-theme
description: Configure the single Perpetual Hub frontend theme and branding, including colors, button states, chart styling, logos, wordmarks, favicon and social preview metadata. Use for appearance changes or explaining their impact in the perpetual-hub-frontend repository.
---

# Perpetual Hub theme and branding

Apply this skill from the Perpetual Hub frontend repository root. Read its
`AGENTS.md` and `docs/changelog.md` first. Paths below are relative to that root.
If the current workspace is a different app, do not transplant these instructions.

## Configuration model

The app has **one checked-in appearance** in `src/config/partners/default.ts`.
Edit `defaultPartner.theme` for colors and the surrounding fields for branding.
`ThemeColors` and `PartnerConfig` in `src/config/partners/types.ts` define the
contract. Preserve the existing default theme until a requested change calls for
modifying it; this skill does not choose a new design by itself.

`VITE_PARTNER` supplies the backend identity, not a theme selector.
`createPartnerConfig(id)` combines that validated environment value with the
single appearance. The frontend origin is taken from the current browser page;
it is not a build-time input or a partner configuration field.
Startup chain discovery supplies chains only. A visual change does not require
changing the ID, chain API, contracts, collateral, API/WS endpoints, WalletConnect
project ID or signing/account/order logic. Do not restore partner preset registries
or add light/dark switching unless the user asks for them.

Read [references/appearance-map.md](references/appearance-map.md) for the token
effects, exact asset consumers, third-party limits and metadata exceptions relevant
to the requested change. Use the source as authority if it has evolved.

## Change a palette

1. Identify the requested surfaces and states before editing. For example,
   primary action color affects normal, themed, hover, border, disabled and
   foreground tokens; it is not a single universal accent field.
2. Edit the complete existing `theme` object in `default.ts`. Keep all required
   keys. Prefer existing semantic tokens in components instead of adding literal
   colors or new one-off flags. Search consumers with `rg` when a token's effect
   is unclear.
3. Use **six-digit hex** (`#6675f7`) for ordinary color tokens. The CSS converter
   does not expand shorthand hex; ordinary `rgba(...)` loses alpha when converted
   to RGB channel variables. Keep opacity in consuming utilities or use an
   appropriate raw token. Raw keys are listed in the reference.
4. Coordinate `button-primary`/hover with the raw `button-primary-*` fill,
   border and disabled states. Preserve long/short and up/down meaning while
   checking contrast for text, focused controls, disabled actions and chart badges.
5. Keep changes in configuration when tokens suffice. If a requested font,
   radius or new component style needs implementation changes, inspect
   `src/index.css`, `tailwind.config.js` and the actual component; those properties
   are not all controlled by `theme`.

Theme application runs in `src/main.tsx` before rendering. In
`src/config/partners/index.ts`, `applyTheme` updates CSS variables and metadata;
`applyThemeColors` publishes color changes through `useAppliedThemeColors` to
React consumers, including the chart and wallet modal. Keep that shared path;
do not replace it with a separate palette per component.

Adding a token requires a real UI consumer and corresponding `ThemeColors` key.
Add a Tailwind mapping if utilities consume it. If it must retain a complete CSS
value, update `RAW_KEYS` and use it as a complete CSS value rather than wrapping
it in `rgb(var(...))`. Review token consumers and component literal colors with
`rg`; this repository has no automated token-coverage check.

## Add or replace branding assets

Put supplied assets in `public/`, for example `public/brand/logo.svg`, and use
root paths such as `/brand/logo.svg` in `defaultPartner`. Keep actual partner
configuration in `src/config/partners` and the existing public package; the skill
itself should not become a second configuration source.

Configure the fields needed by the task:

```ts
// Fields within the existing defaultPartner object; retain its other fields.
name: 'Example Exchange',
logoUrl: '/brand/logo.svg',          // Compact icon; keep even with a wordmark.
wordmarkUrl: '/brand/wordmark.svg',  // Optional full brand lockup.
favicon: '/brand/favicon.png',
previewImageUrl: '/brand/social-preview.png',
previewImageType: 'image/png',
```

These are example paths, not assets to create automatically. Inspect supplied
files and ensure the paths exist. For SVG, retain a valid `viewBox` and check
padding and intrinsic proportions; for raster images, check transparent edges
and resolution at the rendered sizes. Use compact and horizontal assets for
their intended slots. Do not stretch a square logo into a wordmark.

The header image is guarded by `logoUrl` even when it uses `wordmarkUrl`.
`logo-color` colors header text, not a logo loaded through `<img>`; edit the asset
when its baked-in colors need changing. Keep accessible names tied to `name`.
Inspect both headers, wallet metadata, position sharing and points sharing—the
same logo field does not render identically everywhere.

Review `index.html` when changing the brand name, descriptions or social images.
The build plugin in `vite.config.ts` always sets document title and theme-color
from the configured name and `theme.base`; it also updates configured favicon
and social-image tags. Descriptions and OG/Twitter titles remain separately
authored in `index.html`. Explorer breadcrumbs read `partner.name` directly.
Search old display-name literals and review translations during a full rename.
Inspect generated `dist/index.html` after building; a runtime-only change does
not update what a social crawler reads from static HTML. Use the user's actual
public asset URL when an absolute social-image URL is needed; do not invent a
deployment origin or deploy to obtain one.

Wallet icon URLs and referral links derive their origin from the current browser
page. Do not add a deployment-origin field to the appearance object or environment.
The local development proxy removes the browser Origin header from HTTP
forwarding. Its WebSocket handshake uses the backend's fixed approved Origin,
`https://perps.orbs.network`; this service header does not configure the frontend
host. Production uses direct requests with the browser's actual origin.
Footer policy/support links and infrastructure credit are separate from the app logo.
Policy URLs may stay blank: footer links are then hidden and terms acceptance
uses plain text labels. Set real document URLs in `defaultPartner.policyUrls`
when requested; do not invent policy content or use unrelated legal documents.

## Verify and hand off

For implementation changes, run the repository-required checks:

```sh
npm run check:public
npm run typecheck
npm run lint
npm run build
```

Supply required `VITE_PARTNER` through the local build environment; the current
temporary chain fixture uses `global`. Optional
`VITE_WALLETCONNECT_PROJECT_ID` is documented in `.env.example`. API/WS URLs remain
fixed source constants, and Binance market data always uses mainnet without an
environment selector. Local Vite development always uses the proxy and has no
proxy toggle. Do not add browser-network mocks to make verification pass.

There is no automated test suite. Inspect the palette consumers, applied CSS
variables, generated HTML and rendered controls directly. Check that each new
token has a real production consumer and that component colors still use the
shared theme. Passing type, lint and build checks does not establish visual
contrast, correct image proportions or financial correctness.

Browser-check desktop and mobile: header and navigation drawer proportions,
normal/hover/focus/disabled controls, dialogs, wallet selection, chart toolbar and
account overlays, and requested share cards. Check console errors, broken asset
requests, clipping and overflow. For a light palette, inspect chart labels,
wallet dialog and footer credit separately. Verify QR codes
remain readable if nearby branding changes. Report inaccessible authenticated
or funded states as coverage gaps rather than fabricating them.

Record the completed change, checks and gaps in `docs/changelog.md`. Report which
appearance fields changed and what they affect. A theme change does not authorize
committing, pushing, publishing or deploying.
