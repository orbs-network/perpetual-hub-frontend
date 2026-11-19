# Generate and review a branded palette

## Resolve a few inputs

Translate the partner's choices into `ThemeSeeds` for
`src/config/partners/themeFromSeeds.ts`. The partner supplies a primary color and
an appearance preference, not a background token or a list of component colors.

| Choice | Seed or behavior |
| --- | --- |
| Primary brand color | `accent`: supplied six-digit hex; otherwise a suitable approximate logo color; otherwise `#6675f7`. Prefer a supplied brand guide over sampling an image. |
| Dark appearance | `background: '#07050d'` unless the partner supplied a background. |
| Light appearance | `background: '#f6f7f9'` unless the partner supplied a background. |
| No appearance preference | Dark for a new brand; preserve the current mode for an accent-only update. |
| Trading/status colors | Omit `long`, `short`, `warning` to retain green `#22c978`, red `#f05c55`, amber `#f4b94a`. |

`background` lightness selects light or dark inside the generator; there is no
separate mode argument. Keep explicitly supplied brand colors exact as seeds.
If a supplied background conflicts with the requested mode, explain the conflict
and resolve that choice before finalizing. Missing or uncertain colors should not
block a first preview: state the defaults or approximation, then let the partner
correct them in context.

`createTheme(seeds, overrides?)` derives the complete `ThemeColors` object in
OKLCH: page/panel/dialog layers, borders, text, primary/secondary button states,
side-toggle states, links, focus, overlays, shadows and chart colors. It adjusts
semantic lightness for readable labels on neutral/tinted surfaces and derives
matching foregrounds for normal and hover fills. It preserves trading semantics
independently of the primary accent. Do not copy the brand
color into every token, invent a second palette per component, or ask the partner
to resolve individual token values. Green/red accents still keep Long/Short labels
and semantic colors distinct; do not rely on color alone to identify a side.

## Generate and validate

Print a candidate with its contrast report using the existing helper:

```sh
npx vite-node scripts/theme-from-seeds.ts -- --background '#07050d' --accent '#6675f7'
npx vite-node scripts/theme-from-seeds.ts -- --background '#f6f7f9' --accent '#6675f7'
```

Use the chosen mode; generate a second option only when it will help the partner
make an unresolved choice. Optional CLI seeds are `--long`, `--short` and
`--warning`; leave them out unless semantic-color changes were requested.

Every checked pair is required: `LOW` is a failure and the CLI exits with status
1. There is no advisory waiver for text on semantic fills. Prefer adjustments to
generated foreground lightness and coordinated states over changing the partner's
primary hue. Keep green/red meanings. Resolve the problem in the shared generator for a
general defect or through a small `createTheme` override for a brand-specific
exception. Do not ask the partner to tune tokens. If exact brand constraints
prevent readable controls, explain the visible tradeoff and offer a readable
variant before finalizing.

The report checks selected pairs, not the entire rendered interface. Validate
text against its actual background in normal, hover and selected states,
including secondary labels on elevated panels, dialogs, filled actions, side
toggles, chart axes/legends and order-book depth fills. Keep each foreground tied
to its actual fill:

- `content-inverse` is for primary/accent actions; `trade-long-text` and
  `trade-short-text` cover their trade-action variants.
- `content-on-up`, `content-on-down`, `content-on-warning` cover positive,
  destructive and yellow filled buttons, including their alpha hover states.
  The checked Radix switch thumb also uses `content-on-up`.
- `content-on-long` covers the explorer switch thumb on its exact `long` fill.
- `trade-side-long-text` and `trade-side-short-text` cover side toggles, not filled
  action buttons. Ordinary semantic labels use readable `up`/`down` variants.

Do not substitute a passing toggle ratio for an action-button check.

Use at least 4.5:1 for ordinary text; 3:1 is for large text and meaningful
non-text graphics, not the app's small action labels. See W3C's
[text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
and [non-text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
Check focus visibility and controls at their real sizes. The report composites
raw `rgba(...)` fills over known app surfaces. Ordinary `rgba(...)` token alpha
is ignored when checking CSS-variable consumers because the app's RGB conversion
drops that alpha; utility alpha such as `bg-up/80` is composited separately.
Custom surfaces, overrides or component opacity still need checks against the
actual rendered background. The subtle-edge heuristic is not an accessibility
threshold. Disabled states need to be recognizable but do not use their muted
colors for enabled labels.

The checked-in literal default keeps its existing appearance, including white
semantic-fill foregrounds; do not treat it as proof of sufficient contrast.
Passing generated-theme checks covers only the reported pairs and known
surfaces, not every library dialog, chart overlay, export or custom style.

## Preview the application and invite adjustments

For a launch, copy the supplied logo into `public/` and apply the actual app name
and asset paths in the existing configuration before showing the preview. For a
restyle, keep existing branding unless requested. Use the
[asset guidance](branding-assets.md); URL parameters preview colors only, not a
new name, logo or static social metadata.

Start the existing dev server with the intended partner environment and use the
port it actually reports (currently the repository config uses 5174):

```sh
npm run dev
```

Give the partner a clickable link for each candidate to the **real application**:

```text
http://localhost:5174/?themeBg=07050d&themeAccent=6675f7
http://localhost:5174/?themeBg=f6f7f9&themeAccent=6675f7
```

Optional parameters are `themeLong`, `themeShort`, `themeWarning`; omit `#` or URL
encode it as `%23`. Seeds persist in that browser tab's `sessionStorage` across
navigation/reload. `?themePreview=reset` clears them. The same tab shows whichever
candidate was most recently selected. Invalid colors are ignored with a console
warning. These parameters work only under `import.meta.env.DEV`; a built or
hosted production site ignores them.

Inspect and show the branded desktop and mobile layout, chart and a reachable
dialog. Give screenshots if local links cannot be opened, clearly identifying
the candidate and viewport. Use the real requested identity and preserve any
unavailable-discovery screen. Do not switch to `global`, mock data or imply that
an unavailable trading view has been previewed. The current `PartnerBootstrap` unavailable
screen has no app header/name/logo: its theme and document metadata can be
checked, but header/drawer logo sizing and trading consumers remain blocked.
Show the supplied asset separately if helpful, clearly distinguishing that from
an in-app preview. Explain the blocked review and record it in the handoff; do
not claim the full branded application has been visually verified.

Invite feedback on the result in ordinary language: “Keep this version, or change
the color, page brightness or logo size?” Keep the review question concise. Apply
feedback, regenerate and rerun affected contrast/visual checks, then show the
revised application. Do not repeat the intake or request every token. Wait for
acceptance before calling it final, unless the user already delegated choosing
and finishing. While waiting, finish independent checks and keep the draft local.
An unanswered review is not acceptance, and acceptance of appearance does not
itself authorize publication.

## Persist the selected version

Replace the existing theme object in `src/config/partners/default.ts` with the
chosen seed expression and add its import, preserving all other configuration:

```ts
import { createTheme } from './themeFromSeeds';

// Inside the existing defaultPartner object:
theme: createTheme({ background: '#07050d', accent: '#6675f7' }),
```

Use `createTheme(seeds, overrides)` for a necessary exception; record why it is
needed. Preview URLs cannot carry overrides. Apply those candidates temporarily
to config and show the app with `?themePreview=reset` so saved seeds cannot mask
them. Recheck the persisted result with preview state cleared, then build and
inspect `dist/index.html`. PNG position/points exports use the configured palette,
so URL-only preview colors do not verify exports; check them after persistence
when accessible. RainbowKit and WalletConnect limits are in the appearance map.

Record chosen mode, exact seeds, any overrides, supplied versus inferred/default
colors, asset paths and review status in the partner's ignored `DEPLOYMENT.md`.
For other appearance changes use the repository changelog without creating launch
notes unnecessarily. Follow the main skill's verification and handoff steps.
