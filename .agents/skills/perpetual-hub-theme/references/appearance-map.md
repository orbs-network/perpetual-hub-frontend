# Appearance map

Read the sections relevant to the task. Recheck the source paths before editing;
this guide describes the current single-theme implementation.

## Palette effects

The source palette is `defaultPartner.theme` in `src/config/partners/default.ts`,
either a literal object or the result of `createTheme` in
`src/config/partners/themeFromSeeds.ts`. The generator works in OKLCH. It derives
surface levels from `background`, action colors from `accent`, and trading
states from `long`/`short`. Filled trade-action foregrounds are derived against
their fills independently of the green/red side-toggle text.
`checkThemeContrast` reports selected text and action pairs, including semantic
fills and hover. All checked pairs are required; this is not a complete
rendered-interface accessibility audit. The literal default preserves existing
visuals rather than serving as a contrast-compliance baseline. See
[palette generation and preview](palette-preview.md) for thresholds and review.
The token table below applies to both.
`applyThemeColors` in `src/config/partners/index.ts` converts ordinary colors to
space-separated RGB channels (`--color-base: 7 5 13`), which utilities in
`tailwind.config.js` consume with opacity support. Some non-CSS consumers, such
as Lightweight Charts, read the original color strings directly.

| Token family | Main effects and consumers |
| --- | --- |
| `base`, `surface`, `raised`, `hover`, `active` | App/page layers, panels, cards, menu surfaces and state backgrounds. Body uses `base`, and uses `surface` below the existing 1000px CSS breakpoint. `surface` luminance determines native light/dark color scheme and wallet/toast theme selection. `base` supplies runtime browser `theme-color`. |
| `input-bg`, `tooltip-bg`, `modal-bg`, `badge-bg`, `tab-active`, `tab-inactive` | Input, tooltip, modal, badge and tab-specific surfaces; chart tooltip background also uses `tooltip-bg`. |
| `content`, `content-secondary`, `content-muted` | Foreground hierarchy, secondary labels and muted/disabled information. These also affect chart labels and wallet controls. |
| `content-inverse` | Foreground on primary/accent fills, including normal/themed primary buttons and RainbowKit accent. Keep separate from semantic-fill foregrounds. |
| `content-on-up`, `content-on-down`, `content-on-warning`, `content-on-long` | Generated foregrounds for positive, destructive and yellow buttons, the checked Radix switch (`up`) and explorer switch thumb (`long`). They are solved against their matching fills and supported hover states; one shared inverse color cannot cover all semantic actions. The literal default keeps these white to preserve existing visuals. |
| `edge`, `edge-subtle` | Panel/control boundaries, separators, chart axes and chart grid. |
| `button-primary`, `button-primary-hover` | Normal primary buttons; RainbowKit accent. These do not set every themed button fill. |
| Raw `button-primary-bg`, `button-primary-bg-hover`, `button-primary-border`, `button-primary-disabled-bg`, `button-primary-disabled-border` | Complete CSS fills/borders for `themed` and `themedTradeLong` variants in `src/components/ui/button.tsx`, including header Connect. Coordinate with ordinary primary colors and foreground. |
| `button-secondary`, `button-secondary-hover`, `button-secondary-border` | Secondary action states and themed secondary outlines. |
| `long`, `long-hover`, `short`, `short-hover` | Trading side semantics, relevant action states and chart/order interactions. Preserve readable distinction between buy/long and sell/short. |
| Raw `trade-long-active-bg`/`border`, `trade-short-active-bg`/`border`, `trade-side-inactive-bg`/`border`; `trade-side-long-text`, `trade-side-short-text`, `trade-long-text`, `trade-short-text` | Side-toggle active/inactive styling and action text. Inspect `src/components/trading-page/order-form/SideToggle.tsx` and button variants rather than assuming all order actions use the same fill. |
| `up`, `up-light`, `down`, `down-light` | Readable profit/loss and Long/Short labels, PnL/status distinction, chart candles/volume and trade markers. Generated lightness is adjusted for neutral/tinted text backgrounds. Separate from trading-action `long`/`short` even when their colors match. |
| `order-book-bid-depth`, `order-book-ask-depth` | Bid/ask depth fills. Check rows and values remain legible over the fills. |
| `accent-primary`, `accent-secondary`, `accent-tertiary` | Accent surfaces/details, chart drawings and area line. Generated token-logo fallbacks also use `accent-primary` and `content-inverse`. |
| `warning`, `link`, `focus`, `spinner`, `slider-active`, `selection` | Semantic warning, links, focus indication, loading, slider and selection states. |
| `scrollbar`, `scrollbar-hover` | Explicit `.page-scrollbar` styling; other scrollbars are hidden by existing global CSS. |
| `logo-color` | Desktop header brand text. Does not recolor external logo images. |
| `overlay`, `shadow-card`, `shadow-modal`, `shadow-glow` | Complete CSS backdrop/shadow values, passed through without RGB conversion. |

### Value formats

Use six-digit hex for ordinary colors. Do not use shorthand hex, CSS custom
property expressions, gradients or HSL as ordinary palette values; the existing
converter is not a general CSS color parser. Existing `rgb()`/`rgba()` inputs
convert only their first three channels, dropping alpha from CSS variables.
Consumers reading the original palette string may behave differently. Do not
change this conversion behavior incidentally while adjusting a palette.

The exact raw-key set in `src/config/partners/index.ts` is:

```text
button-primary-bg
button-primary-bg-hover
button-primary-border
button-primary-disabled-bg
button-primary-disabled-border
trade-long-active-bg
trade-long-active-border
trade-short-active-bg
trade-short-active-border
trade-side-inactive-bg
trade-side-inactive-border
shadow-card
shadow-modal
shadow-glow
overlay
```

Raw values are inserted into their CSS properties directly. Use a value accepted
by that property: a background can accept a gradient, while a border-color cannot.
The contrast report composites supported raw `rgba(...)` fills over known app
surfaces. For ordinary tokens it matches RGB conversion by ignoring embedded
alpha, then handles known utility-opacity states separately. Custom backgrounds,
component opacity and unsupported raw values need rendered checks; passing the
report does not establish whole-app readability.

## Logo, name and metadata consumers

| Field or file | What it changes |
| --- | --- |
| `name` | Header accessible name and responsive text-only fallback; document title; wallet app name; points and position-share branding. It does not rename the backend partner ID. |
| `logoUrl` | Compact app icon. Header and points sharing omit it when empty; text-only header/drawer names remain visible. Also fallback for wallet app icon and position share. |
| `wordmarkUrl` | Full horizontal brand lockup. Header uses it at 24px high/max 112px wide; navigation drawer at 28px high/max 128px. When present, header and position-share card suppress separate brand-name text. Mobile header hides the extra name only when a logo is present; text-only names remain visible. |
| `favicon` | Browser icon through build and runtime code; preferred wallet app icon in `src/config/wagmi.ts`. Supported MIME inference covers `.svg`, `.png`, `.webp`; inspect handling if another format is requested. |
| `previewImageUrl`, `previewImageType` | Configured OG/Twitter image, large-image card and OG MIME metadata through `vite.config.ts` and runtime `applyTheme`. This is a social card asset, not a replacement for the compact icon. |
| `docsUrl`, `supportUrl`, `policyUrls` | Footer, referral documentation and terms acceptance links. Blank policy URLs hide footer links and render plain labels in terms acceptance. Update when requested; branding alone does not establish new legal URLs. |
| `index.html` | Initial description, `og:title`/description and Twitter title/description are authored separately from config. The build plugin always writes document title and `theme-color` from the configured name/base, plus configured favicon/image tags. The checked-in initial theme-color also matches the current default base. Check `dist/index.html`, especially after a name change or removal of an old image. |
| Explorer breadcrumbs | `src/pages/RollupExplorerPage.tsx` and `src/pages/RollupDetailPage.tsx` read `partner.name` for the application breadcrumb label. They follow a configured product rename automatically; preserve the existing navigation links. |

`src/components/trading-page/TradePageTitle.tsx` deliberately replaces the browser
tab title with the live price and symbol while trading, then restores the
configured application title on unmount. Preserve that behavior during a rename;
a live trading title is not evidence that the configured name failed to apply.

Asset paths start at the public root: `public/brand/logo.svg` becomes
`/brand/logo.svg`, not `/public/brand/logo.svg`. Confirm both desktop and mobile
layouts; a wide image can fit the desktop slot while clipping on mobile.
An external SVG/PNG rendered with `<img>` retains its own colors, so a palette
edit is not a logo recoloring operation.

`src/components/Footer.tsx` contains the separate Orbs infrastructure credit
`/orbs-white-logo.svg` and its website link. This is not `partner.logoUrl`.
Light themes darken that credit with `brightness-0`; inspect it when changing
surfaces instead of automatically replacing it with the application brand.

## Integrations and limits

- **Chart:** `src/components/trading-chart/chartOptions.ts` maps native grid,
  axes, crosshair, fonts and local-time labels. `src/lib/chart/engine.ts` styles
  candle/bar/area series; `indicators.ts` maps study series and pane legends.
  `drawingTools.ts` maps drawing strokes, fills, selection and anchors.
  `ChartOverlayLayer.tsx`, `tradeMarkers.ts` and `hooks/useLightweightChart.ts`
  cover account/order/fill visuals. `src/components/TradingChart.tsx` subscribes
  to applied colors and renders the required renderer attribution. Preserve
  order/position interactions and license attribution while changing appearance.
  `controlStyles.ts` shares the compact trigger and dropdown styles used by
  `ChartTypeMenu.tsx`, `IndicatorMenu.tsx` and Draw in `ChartToolbar.tsx`.
  All three use the same surface, foreground, border, hover, accent, focus and
  shadow tokens. The dropdowns support the fullscreen chart's portal container.
  `src/stores/chartPreferencesStore.ts` persists chart type, periods, studies and
  drawing geometry/locks, but no palette or financial data. Restored charts and
  drawings continue to use the single configured theme.
- **Branding before approval:** `npm run dev` automatically renders the real UI
  read-only when validated discovery returns no active chains, with a permanent
  coming-soon toast. The same pending state applies in production. Wallets and
  account actions are disabled, and the navbar chain selector and wallet connection
  buttons are hidden; this cannot verify the wallet picker or funded
  overlays. Connection and validation errors retain Retry; see
  [preview guidance](palette-preview.md).
- **Wallet dialog:** `src/App.tsx` selects RainbowKit light/dark from `surface`,
  sets its primary accent and inverse text, and adds detailed light-mode surface,
  border and text overrides. Not every dark-mode RainbowKit color is mapped.
  The full-screen WalletConnect "All Wallets" sheet (seen on mobile) is styled by
  the WalletConnect library and stays dark under a light palette.
  Wallet branding in `src/config/wagmi.ts` uses `name` and `favicon ?? logoUrl`.
  Relative wallet icon paths resolve against the current browser origin; no
  deployment-origin setting belongs in the partner appearance or environment.
- **Toasts:** `src/components/ToastContainer.tsx` selects its light/dark scheme
  from the applied surface and uses app tokens for its classes.
- **PNG exports:** `src/components/bottom-tabs/PositionShareModal.tsx` uses
  `wordmarkUrl ?? logoUrl` and `partner.theme.surface`. Points use the compact logo
  in `src/pages/points/PointsPageView.tsx`; `shareImage.ts` also uses the configured
  surface and embeds fonts. These exports read configured values directly, so
  temporary applied-color previews do not guarantee matching export backgrounds.
  Position-share referral links also use the current browser origin.
- **Fonts/geometry:** `src/index.css` declares bundled Inter fonts but body uses a
  system font stack. Chart labels default to Inter/Arial in `chartOptions.ts`.
  `--radius` affects mapped Tailwind radii, while explicit radius utilities and
  third-party settings have their own geometry. A palette does not configure these.
- **Other CSS tokens:** The shadcn HSL variables in `src/index.css` are separate
  from the partner RGB variables. Inspect the consuming component if a requested
  surface still uses them; do not globally replace them without checking scope.
- **Intrinsic imagery:** QR white backgrounds and chain/token assets have their
  own colors. Keep QR contrast and actual network/token identification intact.
- **Feature flags:** `themedOrderButtons`, `pillTradingAccountActions`,
  `orderSizeInlineCounterpart` and referral-code behavior are
  configuration options with behavioral/layout effects. `componentClassNames`
  currently allows side-button radius styling. They are not palette tokens;
  do not enable them incidentally during a color or logo edit.

## Finding consumers and verification anchors

```sh
rg -n 'useAppliedThemeColors|partner\.theme|getThemeColorScheme' src
rg -n 'logoUrl|wordmarkUrl|favicon|previewImage|partner\.name' src vite.config.ts index.html
rg -n 'Perpetual Hub' src index.html
rg -n 'button-primary|trade-long|order-book-bid-depth' src tailwind.config.js
```

There is no automated test suite or token-coverage check. Inspect
`src/config/partners/index.ts` for CSS conversion and scheme application,
`vite.config.ts` and generated `dist/index.html` for static metadata,
`src/components/header` for accessible brand rendering, and the chart/share
consumers above for appearance and export behavior.

During a rename, check that backend identity still comes from `VITE_PARTNER`,
the trading tab restores the configured title after unmount, and explorer
breadcrumbs use the requested product name. Type, lint and build checks do not
prove every color has sufficient contrast or every image fits; desktop/mobile
visual review remains necessary for visible edits.
