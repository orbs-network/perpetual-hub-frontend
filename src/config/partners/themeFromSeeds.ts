import type { ThemeColors } from './types';

/**
 * A few brand colors from which the whole palette is derived. Only `background`
 * and `accent` are required; the trading colors default to the app's green/red
 * so buy/sell and profit/loss keep their usual meaning.
 */
export interface ThemeSeeds {
  /** Page background. Its lightness decides between a dark and a light palette. */
  background: string;
  /** Brand color for primary buttons, links, focus, sliders and highlights. */
  accent: string;
  /** Buy/long and profit color. */
  long?: string;
  /** Sell/short and loss color. */
  short?: string;
  /** Warning color. */
  warning?: string;
}

export const DEFAULT_THEME_SEEDS = {
  long: '#22c978',
  short: '#f05c55',
  warning: '#f4b94a',
} as const;

type Oklch = { l: number; c: number; h: number };

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

function parseHex(hex: string, field: string): [number, number, number] {
  if (!HEX_PATTERN.test(hex)) {
    throw new Error(`Theme seed "${field}" must be a six-digit hex color like #6675f7, got "${hex}"`);
  }
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

const toLinear = (channel: number) => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

const fromLinear = (value: number) =>
  value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;

function rgbToOklch([r, g, b]: [number, number, number]): Oklch {
  const [lr, lg, lb] = [r, g, b].map(toLinear);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(a, bb), h: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360 };
}

function oklchToLinearRgb({ l, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const inGamut = (rgb: number[]) => rgb.every((value) => value >= -1e-6 && value <= 1 + 1e-6);

/** Convert to sRGB, lowering chroma (not lightness or hue) until the color fits. */
function oklchToRgb(color: Oklch): [number, number, number] {
  const target = { ...color, l: Math.min(1, Math.max(0, color.l)), c: Math.max(0, color.c) };
  let rgb = oklchToLinearRgb(target);
  if (!inGamut(rgb)) {
    let low = 0;
    let high = target.c;
    for (let i = 0; i < 24; i += 1) {
      const mid = (low + high) / 2;
      if (inGamut(oklchToLinearRgb({ ...target, c: mid }))) low = mid;
      else high = mid;
    }
    rgb = oklchToLinearRgb({ ...target, c: low });
  }
  return rgb.map((value) =>
    Math.round(Math.min(1, Math.max(0, fromLinear(Math.min(1, Math.max(0, value))))) * 255),
  ) as [number, number, number];
}

const toHex = (rgb: [number, number, number]) =>
  `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;

const hex = (color: Oklch) => toHex(oklchToRgb(color));

const rgba = (rgb: [number, number, number], alpha: number) =>
  `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;

function relativeLuminance(rgb: [number, number, number]) {
  const [r, g, b] = rgb.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio between two colors. */
function contrast(a: [number, number, number], b: [number, number, number]) {
  const [high, low] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** Move a color's lightness away from the background until it reaches `ratio`. */
function withContrast(color: Oklch, background: Oklch, ratio: number): Oklch {
  const backgroundRgb = oklchToRgb(background);
  const step = background.l > 0.6 ? -0.01 : 0.01;
  let candidate = color;
  for (let i = 0; i < 100; i += 1) {
    if (contrast(oklchToRgb(candidate), backgroundRgb) >= ratio) return candidate;
    const next = candidate.l + step;
    if (next < 0 || next > 1) return candidate;
    candidate = { ...candidate, l: next };
  }
  return candidate;
}

/** Interpolate in OKLab, so mixes keep a natural hue. */
function mix(from: Oklch, to: Oklch, amount: number): Oklch {
  const toLab = ({ l, c, h }: Oklch) => [
    l,
    c * Math.cos((h * Math.PI) / 180),
    c * Math.sin((h * Math.PI) / 180),
  ];
  const [l1, a1, b1] = toLab(from);
  const [l2, a2, b2] = toLab(to);
  const l = l1 + (l2 - l1) * amount;
  const a = a1 + (a2 - a1) * amount;
  const b = b1 + (b2 - b1) * amount;
  return { l, c: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
}

const shift = (color: Oklch, l: number, chroma = 1, hue = 0): Oklch => ({
  l: color.l + l,
  c: color.c * chroma,
  h: (color.h + hue + 360) % 360,
});

/**
 * Elevation steps measured from the default dark palette, as OKLCH lightness
 * above the background. Light palettes step down with smaller increments.
 */
const ELEVATION = {
  inputBg: 0.014,
  surface: 0.029,
  modalBg: 0.041,
  edgeSubtle: 0.062,
  raised: 0.071,
  tabActive: 0.08,
  hover: 0.096,
  edge: 0.11,
  active: 0.124,
  secondaryBorder: 0.145,
  scrollbar: 0.148,
  scrollbarHover: 0.207,
} as const;

/** Derive every theme token from a few seed colors. */
export function createTheme(seeds: ThemeSeeds, overrides: Partial<ThemeColors> = {}): ThemeColors {
  const background = rgbToOklch(parseHex(seeds.background, 'background'));
  const accent = rgbToOklch(parseHex(seeds.accent, 'accent'));
  const long = rgbToOklch(parseHex(seeds.long ?? DEFAULT_THEME_SEEDS.long, 'long'));
  const short = rgbToOklch(parseHex(seeds.short ?? DEFAULT_THEME_SEEDS.short, 'short'));
  const warning = rgbToOklch(parseHex(seeds.warning ?? DEFAULT_THEME_SEEDS.warning, 'warning'));

  const isLight = background.l > 0.6;
  const direction = isLight ? -1 : 1;
  const scale = isLight ? 0.55 : 1;

  // Chroma grows a little with elevation, proportionally, so grey stays grey.
  const elevate = (step: number): Oklch => {
    const delta = step * scale;
    return { l: background.l + direction * delta, c: background.c * (1 + delta * 6), h: background.h };
  };
  const layer = (step: number) => hex(elevate(step));

  const content: Oklch = isLight
    ? { l: 0.21, c: Math.min(background.c * 1.5, 0.02), h: background.h }
    : { l: 0.967, c: Math.min(background.c * 0.35, 0.01), h: background.h };
  const contentSecondary = withContrast(
    isLight
      ? { l: 0.5, c: Math.min(background.c * 2, 0.03), h: background.h }
      : { l: 0.648, c: Math.min(background.c * 1.35, 0.03), h: background.h },
    background,
    4.5,
  );

  const white: [number, number, number] = [255, 255, 255];
  const accentRgb = oklchToRgb(accent);
  // Text on accent fills: white unless it falls below the large-text threshold.
  const onAccent = contrast(white, accentRgb) >= 3 ? '#ffffff' : hex({ l: 0.18, c: 0.01, h: accent.h });

  const accentHover = isLight ? shift(accent, -0.05, 0.98) : shift(accent, 0.041, 0.95, 1);
  const link = withContrast(isLight ? shift(accent, -0.04) : shift(accent, 0.055, 0.9, 2), background, 4.5);
  const focus = withContrast(link, background, 3);

  // Calibrated on the default green/red: red reads stronger, so it gets
  // a lighter text step and a weaker tint in the side toggle. The text must
  // stay readable on that toggle's active background.
  const sideText = (color: Oklch, side: 'long' | 'short') => {
    const darkStep = side === 'long' ? shift(color, 0.045, 1.03, 1) : shift(color, 0.06, 0.92);
    const text = withContrast(isLight ? shift(color, -0.06, 1.02) : darkStep, background, 3);
    return hex(withContrast(text, activeTint(color, side), 3));
  };
  const lighter = (color: Oklch) =>
    hex(withContrast(isLight ? shift(color, -0.08) : shift(color, 0.067, 0.98, 1), background, 3));
  const activeTint = (color: Oklch, side: 'long' | 'short') =>
    mix(background, color, isLight ? 0.16 : side === 'long' ? 0.39 : 0.27);
  const sideHover = (color: Oklch) => hex(isLight ? shift(color, -0.045, 1.02) : shift(color, 0.045, 1.03, 1));

  const activeBg = (color: Oklch, side: 'long' | 'short') => hex(activeTint(color, side));
  const activeBorder = (color: Oklch, side: 'long' | 'short') =>
    hex(mix(background, color, isLight ? 0.4 : side === 'long' ? 0.52 : 0.45));

  // Profit, loss and warning are also read as text, so keep them legible.
  const up = withContrast(long, background, 3);
  const down = withContrast(short, background, 3);
  const warningText = withContrast(warning, background, 3);

  const overlayRgb = isLight
    ? oklchToRgb({ l: 0.15, c: background.c, h: background.h })
    : oklchToRgb({ l: background.l * 0.85, c: background.c, h: background.h });
  const contentRgb = oklchToRgb(content);

  const theme: ThemeColors = {
    base: hex(background),
    surface: layer(ELEVATION.surface),
    raised: layer(ELEVATION.raised),
    hover: layer(ELEVATION.hover),
    active: layer(ELEVATION.active),

    'input-bg': layer(ELEVATION.inputBg),
    'tooltip-bg': layer(ELEVATION.raised),
    'modal-bg': layer(ELEVATION.modalBg),
    'badge-bg': layer(ELEVATION.raised),
    'tab-active': layer(ELEVATION.tabActive),
    'tab-inactive': layer(ELEVATION.surface),
    scrollbar: layer(ELEVATION.scrollbar),
    'scrollbar-hover': layer(ELEVATION.scrollbarHover),

    edge: layer(ELEVATION.edge),
    'edge-subtle': layer(ELEVATION.edgeSubtle),

    long: hex(long),
    'long-hover': sideHover(long),
    short: hex(short),
    'short-hover': sideHover(short),
    'order-book-bid-depth': hex(long),
    'order-book-ask-depth': hex(short),

    up: hex(up),
    'up-light': lighter(up),
    down: hex(down),
    'down-light': lighter(down),

    warning: hex(warningText),

    'accent-primary': hex(accent),
    'accent-secondary': hex(shift(accent, 0, 1.04, 8.7)),
    'accent-tertiary': hex(
      withContrast(isLight ? shift(accent, -0.08, 0.85, 14) : shift(accent, 0.125, 0.73, 14), background, 3),
    ),

    'button-primary': hex(accent),
    'button-primary-hover': hex(accentHover),
    'button-primary-bg': hex(accent),
    'button-primary-bg-hover': hex(accentHover),
    'button-primary-border': hex(accent),
    'button-primary-disabled-bg': rgba(accentRgb, 0.3),
    'button-primary-disabled-border': rgba(accentRgb, 0.38),
    'button-secondary': layer(ELEVATION.raised),
    'button-secondary-hover': layer(ELEVATION.edge),
    'button-secondary-border': layer(ELEVATION.secondaryBorder),
    'trade-long-active-bg': activeBg(long, 'long'),
    'trade-long-active-border': activeBorder(long, 'long'),
    'trade-long-text': sideText(long, 'long'),
    'trade-short-active-bg': activeBg(short, 'short'),
    'trade-short-active-border': activeBorder(short, 'short'),
    'trade-short-text': sideText(short, 'short'),
    'trade-side-inactive-bg': layer(ELEVATION.raised),
    'trade-side-inactive-border': layer(ELEVATION.edge),
    'trade-side-long-text': sideText(long, 'long'),
    'trade-side-short-text': sideText(short, 'short'),
    'slider-active': hex(accent),
    link: hex(link),
    focus: hex(focus),
    overlay: rgba(overlayRgb, isLight ? 0.45 : 0.78),
    spinner: hex(accent),
    selection: rgba(accentRgb, isLight ? 0.3 : 0.55),

    'logo-color': isLight ? hex(content) : '#ffffff',

    content: hex(content),
    'content-secondary': hex(contentSecondary),
    'content-muted': rgba(contentRgb, isLight ? 0.45 : 0.38),
    'content-inverse': onAccent,

    'shadow-card': isLight
      ? '0 1px 0 rgba(0, 0, 0, 0.03), 0 10px 28px rgba(0, 0, 0, 0.08)'
      : '0 1px 0 rgba(255, 255, 255, 0.015), 0 10px 28px rgba(0, 0, 0, 0.24)',
    'shadow-modal': isLight ? '0 24px 80px rgba(0, 0, 0, 0.18)' : '0 24px 80px rgba(0, 0, 0, 0.62)',
    'shadow-glow': `0 0 18px ${rgba(accentRgb, 0.18)}`,
  };

  return { ...theme, ...overrides };
}

export interface ThemeContrastCheck {
  pair: string;
  ratio: number;
  minimum: number;
  passes: boolean;
  /**
   * Advisory pairs report white/dark text on the buy/sell/warning fills. The
   * default palette already falls short there, so they inform, not block.
   */
  advisory: boolean;
}

/** Contrast of the main text and action pairs, for reviewing a generated theme. */
export function checkThemeContrast(theme: ThemeColors): ThemeContrastCheck[] {
  const rgbOf = (value: string, field: string) => {
    if (HEX_PATTERN.test(value)) return parseHex(value, field);
    const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    if (!channels || channels.length < 3) throw new Error(`Cannot read color "${field}": ${value}`);
    return channels as [number, number, number];
  };
  const pairs: Array<[keyof ThemeColors, keyof ThemeColors, number, boolean?]> = [
    ['content', 'base', 7],
    ['content', 'raised', 4.5],
    ['content-secondary', 'base', 4.5],
    ['content-secondary', 'raised', 3],
    ['link', 'base', 4.5],
    ['focus', 'base', 3],
    ['content-inverse', 'button-primary', 3],
    ['trade-side-long-text', 'trade-long-active-bg', 3],
    ['trade-side-short-text', 'trade-short-active-bg', 3],
    ['up', 'base', 3],
    ['down', 'base', 3],
    ['warning', 'base', 3],
    ['edge', 'base', 1.15],
    ['content-inverse', 'up', 3, true],
    ['content-inverse', 'down', 3, true],
    ['content-inverse', 'warning', 3, true],
  ];
  return pairs.map(([foreground, background, minimum, advisory = false]) => {
    const ratio = contrast(rgbOf(theme[foreground], foreground), rgbOf(theme[background], background));
    return {
      pair: `${foreground} on ${background}`,
      ratio: Math.round(ratio * 100) / 100,
      minimum,
      passes: ratio >= minimum,
      advisory,
    };
  });
}
