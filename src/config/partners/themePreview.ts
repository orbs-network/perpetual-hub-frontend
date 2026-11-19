import { createTheme, type ThemeSeeds } from './themeFromSeeds';
import type { ThemeColors } from './types';

/**
 * Local-development theme previews from the URL, so a partner can click through
 * the real app in each candidate palette before one is written to config:
 *
 *   http://localhost:5173/?themeBg=0b0f14&themeAccent=f0b90b
 *
 * Optional: themeLong, themeShort, themeWarning. Hex may omit the leading "#".
 * The choice is kept for this browser tab, because the app rewrites the URL on
 * navigation; `?themePreview=reset` returns to the configured theme.
 * Only `main.tsx` calls this, behind `import.meta.env.DEV`, so production
 * builds never read these parameters.
 */
const PARAMS = {
  background: 'themeBg',
  accent: 'themeAccent',
  long: 'themeLong',
  short: 'themeShort',
  warning: 'themeWarning',
} as const satisfies Record<keyof ThemeSeeds, string>;

const STORAGE_KEY = 'perpetual-hub:theme-preview-seeds';
const RESET_PARAM = 'themePreview';

type SeedStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function normalizeHex(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

function seedsFromSearch(search: string): ThemeSeeds | null {
  const params = new URLSearchParams(search);
  const background = normalizeHex(params.get(PARAMS.background));
  const accent = normalizeHex(params.get(PARAMS.accent));
  if (!background || !accent) return null;
  return {
    background,
    accent,
    long: normalizeHex(params.get(PARAMS.long)),
    short: normalizeHex(params.get(PARAMS.short)),
    warning: normalizeHex(params.get(PARAMS.warning)),
  };
}

function readStored(storage: SeedStorage | undefined): ThemeSeeds | null {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ThemeSeeds) : null;
  } catch {
    return null;
  }
}

function write(storage: SeedStorage | undefined, seeds: ThemeSeeds | null) {
  try {
    if (seeds) storage?.setItem(STORAGE_KEY, JSON.stringify(seeds));
    else storage?.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode); the URL preview still applies.
  }
}

/** Resolve a preview palette from the URL or this tab's earlier preview. */
export function resolveThemePreview(
  search: string,
  storage: SeedStorage | undefined,
): { seeds: ThemeSeeds; theme: ThemeColors } | null {
  if (new URLSearchParams(search).get(RESET_PARAM) === 'reset') {
    write(storage, null);
    return null;
  }

  const fromUrl = seedsFromSearch(search);
  const seeds = fromUrl ?? readStored(storage);
  if (!seeds) return null;

  try {
    const theme = createTheme(seeds);
    if (fromUrl) write(storage, fromUrl);
    return { seeds, theme };
  } catch (error) {
    write(storage, null);
    console.warn('[theme preview] Ignored invalid colors:', error);
    return null;
  }
}
