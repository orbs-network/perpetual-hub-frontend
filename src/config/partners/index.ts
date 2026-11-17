import type { PartnerConfig, ThemeColors } from './types';
import { createPartnerConfig } from './default';
import { resolvePublicEnvironment } from './environment';

export type {
  PartnerConfig,
  PartnerChainConfig,
  PartnerFeatureFlags,
  PartnerMarketPreferences,
  ThemeColors,
} from './types';

export const publicEnvironment = resolvePublicEnvironment(import.meta.env);

export const partner: PartnerConfig = createPartnerConfig(publicEnvironment.partnerId);

let appliedThemeColors: ThemeColors = partner.theme;
const appliedThemeColorListeners = new Set<() => void>();

/** Read the theme currently applied to the document, including explicit color updates. */
export function getAppliedThemeColors(): ThemeColors {
  return appliedThemeColors;
}

/** Subscribe to runtime theme changes without coupling consumers to a page. */
export function subscribeAppliedThemeColors(listener: () => void): () => void {
  appliedThemeColorListeners.add(listener);
  return () => appliedThemeColorListeners.delete(listener);
}

/** Convert a hex color like '#0e0e10' to '14 14 16' (space-separated RGB) */
function hexToRgb(hex: string): string {
  if (hex.startsWith('rgba(') || hex.startsWith('rgb(')) {
    const match = hex.match(/[\d.]+/g);
    if (match && match.length >= 3) return `${match[0]} ${match[1]} ${match[2]}`;
  }
  const h = hex.replace('#', '');
  const num = parseInt(h, 16);
  return `${(num >> 16) & 255} ${(num >> 8) & 255} ${num & 255}`;
}

/** Match native and embedded controls to the surface's relative luminance. */
export function getThemeColorScheme(theme: ThemeColors): 'light' | 'dark' {
  const [r, g, b] = hexToRgb(theme.surface).split(' ').map((channel) => {
    const value = Number(channel) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? 'light' : 'dark';
}

function getImageType(src: string) {
  if (src.endsWith('.svg')) return 'image/svg+xml';
  if (src.endsWith('.png')) return 'image/png';
  if (src.endsWith('.webp')) return 'image/webp';
  return undefined;
}

/** Keys that are raw CSS values (not RGB-converted) */
const RAW_KEYS = new Set([
  'button-primary-bg',
  'button-primary-bg-hover',
  'button-primary-border',
  'button-primary-disabled-bg',
  'button-primary-disabled-border',
  'trade-long-active-bg',
  'trade-long-active-border',
  'trade-short-active-bg',
  'trade-short-active-border',
  'trade-side-inactive-bg',
  'trade-side-inactive-border',
  'shadow-card',
  'shadow-modal',
  'shadow-glow',
  'overlay',
]);

function setMetaContent(
  selector: string,
  attributes: Record<string, string>,
  content: string,
) {
  let meta = document.querySelector<HTMLMetaElement>(selector);
  if (!meta) {
    meta = document.createElement('meta');
    for (const [name, value] of Object.entries(attributes)) {
      meta.setAttribute(name, value);
    }
    document.head.appendChild(meta);
  }

  meta.setAttribute('content', content);
}

/** Inject theme CSS variables onto :root */
export function getPartnerDocumentTitle(p: PartnerConfig = partner): string {
  return `${p.name} | Perpetual Trading`;
}

/** Build the CSS custom properties consumed by themed component scopes. */
export function getThemeColorVariables(theme: ThemeColors): Record<string, string> {
  return Object.fromEntries(
    Object.entries(theme).map(([key, value]) => [
      `--color-${key}`,
      RAW_KEYS.has(key) ? value : hexToRgb(value),
    ]),
  );
}

/** Inject theme CSS variables onto :root without changing partner metadata. */
export function applyThemeColors(theme: ThemeColors): void {
  appliedThemeColors = theme;
  document.documentElement.style.colorScheme = getThemeColorScheme(theme);
  const variables = getThemeColorVariables(theme);
  for (const [property, value] of Object.entries(variables)) {
    document.documentElement.style.setProperty(property, value);
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.base);

  for (const listener of appliedThemeColorListeners) listener();
}

export function applyTheme(p: PartnerConfig = partner): void {
  applyThemeColors(p.theme);

  if (p.favicon) {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (link) {
      link.href = p.favicon;
      const imageType = getImageType(p.favicon);
      if (imageType) link.type = imageType;
      else link.removeAttribute('type');
    }
  }

  document.title = getPartnerDocumentTitle(p);

  if (p.previewImageUrl) {
    setMetaContent('meta[property="og:image"]', { property: 'og:image' }, p.previewImageUrl);
    setMetaContent('meta[name="twitter:image"]', { name: 'twitter:image' }, p.previewImageUrl);
    setMetaContent('meta[name="twitter:card"]', { name: 'twitter:card' }, 'summary_large_image');
  }

  if (p.previewImageType) {
    setMetaContent(
      'meta[property="og:image:type"]',
      { property: 'og:image:type' },
      p.previewImageType,
    );
  }
}
