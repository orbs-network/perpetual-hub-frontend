# Branding assets and metadata

Put supplied assets in `public/`, for example `public/brand/logo.svg`, and use
root paths such as `/brand/logo.svg` in `defaultPartner`. Keep actual partner
configuration in `src/config/partners`; the skill itself should not become a
second configuration source.

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

For text-only branding, set `logoUrl: ''`, remove `wordmarkUrl` and clear or
replace old favicon/social-image fields and their static HTML tags. Do not leave
the previous brand's icon in a partner preview. The current mobile header hides
fallback name text: inspect it and provide a small responsive name fallback if
needed for the requested text-only result. Check the drawer and share consumers
too; an empty image path must not become a broken image. This may require a
narrow component change rather than a new palette token.

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
