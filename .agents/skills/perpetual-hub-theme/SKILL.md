---
name: perpetual-hub-theme
description: Generate and preview a complete Perpetual Hub palette from a primary brand color and dark/light preference, or update its logos and branding. Use for appearance changes in the perpetual-hub-frontend repository.
---

# Perpetual Hub theme and branding

Work from this repository root. Read `AGENTS.md` and `docs/changelog.md` first.
Use the existing application, components, translations and shared theme path.
For a partner launch, the adjacent
[`partner-launch` skill](../partner-launch/SKILL.md) owns onboarding, hosting and
activation; this skill owns palette generation, branding and visual review.
When called during a launch, reuse its branding intake, accepted choices and
finalization delegation; do not start another questionnaire or approval round.

## Start with the partner's choices

Reuse choices, assets and delegation already supplied. For a new brand, ask
together for missing choices the partner has not delegated: app name, logo file
or local path (text-only is fine), primary brand color or brand guide if
available, and dark or light preference. Do not ask for individual
theme tokens or insist on colors before showing a preview.

If choices are missing, use these defaults and explain them with the preview:

- Primary color: exact supplied hex; otherwise a suitable color from the logo
  (describe image-derived colors as approximate); otherwise `#6675f7`.
- Appearance: requested dark or light; otherwise dark. Choose the page background
  yourself: `#07050d` for dark or `#f6f7f9` for light unless one was supplied.
- Trading colors: default green Long/Buy/profit, red Short/Sell/loss and amber
  warning. Brand accents must not replace these meanings.
- No logo: use the existing name/text fallback and remove the old app's logo,
  favicon and social branding as applicable; do not invent a partner logo.

For later restyles, preserve existing choices outside the requested change.
Changing an accent alone does not imply changing the current background or logo.

## Generate, preview, adjust, then apply

Read [references/palette-preview.md](references/palette-preview.md) for seed
selection, generation, contrast validation, real-app preview links and the
adjustment loop. `createTheme(seeds, overrides?)` derives the full palette; never
ask a partner to configure buttons, backgrounds, borders, charts or dialogs one
by one. Resolve contrast adjustments yourself and show their visual effect.

Read the relevant sections of
[references/appearance-map.md](references/appearance-map.md) before editing
colors or assets. It maps shared tokens to actual components and records
third-party and share-export limits. For logos, names, favicons or metadata,
also read [references/branding-assets.md](references/branding-assets.md).

Show the actual application with the proposed branding on reachable screens
before finalizing; disclose any blocked in-app branding checks. Offer changes
in plain terms, such as a lighter page, softer accent or larger logo. Apply
requested adjustments, rerun the affected checks and show the revised preview.
Continue until the partner accepts the result or has explicitly asked you to
choose and finalize it. An unanswered preview is not acceptance. Local
candidate edits are reversible; visual acceptance does not authorize publishing.

## Configuration and implementation boundaries

The app has **one checked-in appearance** in `src/config/partners/default.ts`.
Set `defaultPartner.theme` with `createTheme` for a new palette and surrounding
fields for branding. The checked-in default remains literal until a requested
restyle. `ThemeColors` and `PartnerConfig` in `src/config/partners/types.ts` define
the contract. Keep public partner configuration in `src/config/partners` and
assets in `public/`; do not turn skill files into another configuration source.

`VITE_PARTNER` is the backend identity, not a theme selector.
`createPartnerConfig(id)` combines it with the single appearance. Chain discovery
supplies chains only. A visual change does not require changing identity,
contracts, collateral, API/WS endpoints, WalletConnect ID or signing/account/order
logic. The frontend origin comes from the current browser page. Do not add
partner presets, a runtime light/dark switch or deployment-origin settings unless
requested.

Theme application runs in `src/main.tsx` before rendering. In
`src/config/partners/index.ts`, `applyTheme` updates CSS variables and metadata;
`applyThemeColors` publishes colors through `useAppliedThemeColors` to React,
including the chart and wallet dialog. Use this shared path for consistent
buttons, backgrounds, borders, charts and dialogs. Do not create per-component
palettes or hardcoded brand colors. Preserve chart order/position interactions.
The generator supplies separate foregrounds for accent actions (`content-inverse`)
and semantic fills (`content-on-up`, `content-on-down`, `content-on-warning`,
`content-on-long`); use each with its matching fill instead of sharing one inverse
text color across unrelated actions. These are generated roles, not extra intake
questions.

For a narrow token adjustment, pass an override to `createTheme`; preserve all
required keys in a literal theme. Keep normal/hover/disabled fills, borders and
foregrounds coordinated. Overrides are an implementation detail, not onboarding
questions. Use six-digit hex for ordinary tokens. Raw CSS tokens and their alpha
handling are listed in the appearance map. Add a token only for a real consumer;
update its type, conversion and Tailwind mapping as needed. Fonts, geometry and
feature flags are separate from palette generation; change them only as requested.

Change the generator only for a general defect, record it in the changelog, and
recheck dark and light palettes plus the original seeds `#07050d` / `#6675f7`.
Do not alter the checked-in default appearance incidentally. Its literal palette
preserves existing visuals and is not a contrast-compliance baseline; generated
themes must pass their own checks.

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
