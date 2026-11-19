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

/** CSS alpha compositing happens in encoded sRGB before contrast is measured. */
function composite(
  foreground: [number, number, number],
  alpha: number,
  background: [number, number, number],
): [number, number, number] {
  return foreground.map((channel, index) => channel * alpha + background[index] * (1 - alpha)) as [number, number, number];
}

/** Balance a semantic label/fill and its own foreground across tinted states. */
function semanticColors(color: Oklch, backgrounds: Oklch[], tintAlpha: number, hoverAlpha: number) {
  const backdropRgbs = backgrounds.map(oklchToRgb);
  const foregrounds: Array<[number, number, number]> = [[0, 0, 0], [255, 255, 255]];
  let best = { color, foreground: '#000000' };
  let bestRatio = 0;
  for (let distance = 0; distance <= 200; distance += 1) {
    for (const direction of [-1, 1]) {
      const candidate = { ...color, l: Math.min(1, Math.max(0, color.l + direction * distance / 200)) };
      const rgb = oklchToRgb(candidate);
      const labelRatio = Math.min(...backdropRgbs.flatMap((background) => [
        contrast(rgb, background), contrast(rgb, composite(rgb, tintAlpha, background)),
      ]));
      const fillBackgrounds = [rgb, ...backdropRgbs.map((background) => composite(rgb, hoverAlpha, background))];
      const fillRatios = foregrounds.map((foreground) =>
        Math.min(...fillBackgrounds.map((background) => contrast(foreground, background))));
      const foregroundIndex = fillRatios[0] >= fillRatios[1] ? 0 : 1;
      const minimum = Math.min(labelRatio, fillRatios[foregroundIndex]);
      const result = { color: candidate, foreground: toHex(foregrounds[foregroundIndex]) };
      if (minimum >= 4.5) return result;
      if (minimum > bestRatio) {
        best = result;
        bestRatio = minimum;
      }
    }
  }
  return best;
}

/** Keep hue, finding nearby lightness readable on every supplied background. */
function withContrastOn(color: Oklch, backgrounds: Oklch[], ratio: number): Oklch {
  const backgroundRgbs = backgrounds.map(oklchToRgb);
  let best = color;
  let bestRatio = 0;
  for (let distance = 0; distance <= 100; distance += 1) {
    for (const direction of [-1, 1]) {
      const candidate = { ...color, l: Math.min(1, Math.max(0, color.l + direction * distance / 100)) };
      const candidateRgb = oklchToRgb(candidate);
      const minimum = Math.min(...backgroundRgbs.map((background) => contrast(candidateRgb, background)));
      if (minimum >= ratio) return candidate;
      if (minimum > bestRatio) {
        best = candidate;
        bestRatio = minimum;
      }
    }
  }
  // An unusual seed/override can make a shared foreground impossible. Keep the
  // best candidate and let checkThemeContrast report the unresolved pairs.
  return best;
}

const withContrast = (color: Oklch, background: Oklch, ratio: number) =>
  withContrastOn(color, [background], ratio);

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

  const textBackgrounds = [background, ...[
    ELEVATION.inputBg, ELEVATION.surface, ELEVATION.modalBg, ELEVATION.raised,
    ELEVATION.tabActive, ELEVATION.hover, ELEVATION.edge, ELEVATION.active,
  ].map(elevate)];
  const readableText = (color: Oklch) => withContrastOn(color, textBackgrounds, 4.5);

  const content: Oklch = readableText(isLight
    ? { l: 0.21, c: Math.min(background.c * 1.5, 0.02), h: background.h }
    : { l: 0.967, c: Math.min(background.c * 0.35, 0.01), h: background.h });
  const contentSecondary = readableText(
    isLight
      ? { l: 0.5, c: Math.min(background.c * 2, 0.03), h: background.h }
      : { l: 0.648, c: Math.min(background.c * 1.35, 0.03), h: background.h },
  );

  const white: [number, number, number] = [255, 255, 255];
  const black: [number, number, number] = [0, 0, 0];
  const accentRgb = oklchToRgb(accent);
  const fillForeground = (fill: Oklch): Oklch => ({
    l: contrast(white, oklchToRgb(fill)) >= contrast(black, oklchToRgb(fill)) ? 1 : 0,
    c: 0,
    h: fill.h,
  });
  // Ordinary action labels need 4.5:1. Adjust the hover fill if necessary,
  // keeping the exact brand accent and a common foreground for both states.
  const onAccent = fillForeground(accent);
  const accentHover = withContrast(
    isLight ? shift(accent, -0.05, 0.98) : shift(accent, 0.041, 0.95, 1), onAccent, 4.5,
  );
  const link = readableText(isLight ? shift(accent, -0.04) : shift(accent, 0.055, 0.9, 2));
  const focus = withContrastOn(link, textBackgrounds, 3);

  // Calibrated on the default green/red: red reads stronger, so it gets
  // a lighter text step and a weaker tint in the side toggle. The text must
  // stay readable on that toggle's active background.
  const sideText = (color: Oklch, side: 'long' | 'short') => {
    const darkStep = side === 'long' ? shift(color, 0.045, 1.03, 1) : shift(color, 0.06, 0.92);
    return hex(withContrastOn(isLight ? shift(color, -0.06, 1.02) : darkStep,
      [elevate(ELEVATION.raised), activeTint(color, side)], 4.5));
  };
  const lighter = (color: Oklch) =>
    hex(readableText(isLight ? shift(color, -0.08) : shift(color, 0.067, 0.98, 1)));
  const activeTint = (color: Oklch, side: 'long' | 'short') =>
    mix(background, color, isLight ? 0.16 : side === 'long' ? 0.39 : 0.27);
  const sideHover = (color: Oklch) => withContrast(
    isLight ? shift(color, -0.045, 1.02) : shift(color, 0.045, 1.03, 1), fillForeground(color), 4.5,
  );
  const shortHover = sideHover(short);

  const activeBg = (color: Oklch, side: 'long' | 'short') => hex(activeTint(color, side));
  const activeBorder = (color: Oklch, side: 'long' | 'short') =>
    hex(mix(background, color, isLight ? 0.4 : side === 'long' ? 0.52 : 0.45));

  // Semantic colors are text on neutral/tinted surfaces and action fills with
  // independent text. Account for their existing 80/90% hover backgrounds too.
  const upColors = semanticColors(long, textBackgrounds, 0.2, 0.8);
  const downColors = semanticColors(short, textBackgrounds, 0.2, 0.9);
  const warningColors = semanticColors(warning, textBackgrounds, 0.3, 0.8);
  const up = upColors.color;
  const down = downColors.color;
  const warningText = warningColors.color;

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

    edge: hex(withContrast(elevate(ELEVATION.edge), background, 1.15)),
    'edge-subtle': layer(ELEVATION.edgeSubtle),

    long: hex(long),
    'long-hover': hex(sideHover(long)),
    short: hex(short),
    'short-hover': hex(shortHover),
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
    'trade-long-text': hex(withContrastOn(long, [accent, accentHover], 4.5)),
    'trade-short-active-bg': activeBg(short, 'short'),
    'trade-short-active-border': activeBorder(short, 'short'),
    'trade-short-text': hex(withContrastOn(short, [short, shortHover], 4.5)),
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
    'content-inverse': hex(onAccent),
    'content-on-up': upColors.foreground,
    'content-on-down': downColors.foreground,
    'content-on-warning': warningColors.foreground,
    'content-on-long': hex(fillForeground(long)),

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
}

/** Contrast of the main text and action pairs, for reviewing a generated theme. */
export function checkThemeContrast(theme: ThemeColors): ThemeContrastCheck[] {
  const colorOf = (value: string, field: string, raw: boolean) => {
    if (HEX_PATTERN.test(value)) return { rgb: parseHex(value, field), alpha: 1 };
    const css = value.trim().match(/^rgba?\(([^()]*)\)$/i);
    const channels = css?.[1].trim().split(/[\s,/]+/);
    if (!channels || (channels.length !== 3 && channels.length !== 4)
      || channels.some((channel) => !/^[+-]?(?:\d+\.?\d*|\.\d+)%?$/.test(channel))) {
      throw new Error(`Cannot read color "${field}": ${value}. Use six-digit hex or rgb()/rgba().`);
    }
    const renderedChannels = raw ? channels.slice(0, 3) : value.match(/[\d.]+/g)!.slice(0, 3);
    const rgb = renderedChannels.map((channel) => {
      // Ordinary variables use index.ts's RGB conversion, which drops alpha
      // and reads percent numerals as channel values. RAW fills retain CSS alpha.
      const scale = raw && channel.endsWith('%') ? 2.55 : 1;
      return Math.min(255, Math.max(0, parseFloat(channel) * scale));
    }) as [number, number, number];
    const alpha = raw && channels[3] !== undefined
      ? Math.min(1, Math.max(0, parseFloat(channels[3]) / (channels[3].endsWith('%') ? 100 : 1)))
      : 1;
    return { rgb, alpha };
  };
  const backgrounds: Array<keyof ThemeColors> = [
    'base', 'surface', 'raised', 'hover', 'active', 'input-bg', 'tooltip-bg',
    'modal-bg', 'badge-bg', 'tab-active', 'tab-inactive', 'button-secondary', 'button-secondary-hover',
  ];
  const textTokens: Array<keyof ThemeColors> = [
    'content', 'content-secondary', 'link', 'up', 'up-light', 'down', 'down-light', 'warning',
  ];
  const pairs: Array<[keyof ThemeColors, keyof ThemeColors, number]> = [
    ...textTokens.flatMap((foreground) => backgrounds.map((background):
      [keyof ThemeColors, keyof ThemeColors, number] => [foreground, background, 4.5])),
    ...backgrounds.map((background): [keyof ThemeColors, keyof ThemeColors, number] => ['focus', background, 3]),
    ['content-inverse', 'button-primary', 4.5],
    ['content-inverse', 'button-primary-hover', 4.5],
    ['content-inverse', 'button-primary-bg', 4.5],
    ['content-inverse', 'button-primary-bg-hover', 4.5],
    ['trade-long-text', 'button-primary', 4.5],
    ['trade-long-text', 'button-primary-hover', 4.5],
    ['trade-long-text', 'button-primary-bg', 4.5],
    ['trade-long-text', 'button-primary-bg-hover', 4.5],
    ['trade-short-text', 'short', 4.5],
    ['trade-short-text', 'short-hover', 4.5],
    ['trade-side-long-text', 'trade-long-active-bg', 4.5],
    ['trade-side-long-text', 'trade-side-inactive-bg', 4.5],
    ['trade-side-short-text', 'trade-short-active-bg', 4.5],
    ['trade-side-short-text', 'trade-side-inactive-bg', 4.5],
    ['content-on-up', 'up', 4.5],
    ['content-on-down', 'down', 4.5],
    ['content-on-warning', 'warning', 4.5],
    ['content-on-long', 'long', 4.5],
    ['content-on-long', 'long-hover', 4.5],
    // Decorative panel separation; this is not a WCAG control-boundary check.
    ['edge', 'base', 1.15],
  ];
  const rawFills = new Set<keyof ThemeColors>([
    'button-primary-bg', 'button-primary-bg-hover', 'trade-long-active-bg',
    'trade-short-active-bg', 'trade-side-inactive-bg',
  ]);
  const backdropColors = backgrounds.map((key) => ({ key, rgb: colorOf(theme[key], key, false).rgb }));
  const measure = (foreground: keyof ThemeColors, background: keyof ThemeColors, minimum: number, opacity = 1): ThemeContrastCheck => {
    const text = colorOf(theme[foreground], foreground, false).rgb;
    const fill = colorOf(theme[background], background, rawFills.has(background));
    const alpha = fill.alpha * opacity;
    const candidates = alpha === 1 ? [{ key: background, rgb: fill.rgb }]
      : backdropColors.map(({ key, rgb }) => ({ key, rgb: composite(fill.rgb, alpha, rgb) }));
    const worst = candidates.reduce((lowest, candidate) =>
      contrast(text, candidate.rgb) < contrast(text, lowest.rgb) ? candidate : lowest);
    const ratio = contrast(text, worst.rgb);
    return {
      pair: `${foreground} on ${background}${opacity === 1 ? '' : `/${opacity * 100}`}${alpha === 1 ? '' : ` over ${worst.key}`}`,
      ratio: Math.round(ratio * 100) / 100,
      minimum,
      passes: ratio >= minimum,
    };
  };
  const checks = pairs.map(([foreground, background, minimum]) => measure(foreground, background, minimum));
  for (const [foreground, background, opacity] of [
    ['content-on-up', 'up', 0.8], ['content-on-down', 'down', 0.9], ['content-on-warning', 'warning', 0.8],
  ] as const) checks.push(measure(foreground, background, 4.5, opacity));
  for (const semantic of ['up', 'down', 'warning'] as const) {
    const opacities = semantic === 'warning' ? [0.1, 0.15, 0.2, 0.3] : [0.05, 0.1, 0.15, 0.2];
    for (const opacity of opacities) checks.push(measure(semantic, semantic, 4.5, opacity));
  }
  return checks;
}
