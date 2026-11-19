// Print a theme generated from seed colors, with its contrast checks.
// Usage: npx vite-node scripts/theme-from-seeds.ts -- --background '#07050d' --accent '#6675f7' [--long '#22c978'] [--short '#f05c55'] [--warning '#f4b94a']
import {
  checkThemeContrast,
  createTheme,
  type ThemeSeeds,
} from "../src/config/partners/themeFromSeeds";

const SEED_FIELDS = ["background", "accent", "long", "short", "warning"] as const;

function parseArgs(argv: string[]): ThemeSeeds {
  const values: Partial<Record<(typeof SEED_FIELDS)[number], string>> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const field = argv[i].replace(/^--/, "") as (typeof SEED_FIELDS)[number];
    if (!SEED_FIELDS.includes(field)) continue;
    values[field] = argv[i + 1];
    i += 1;
  }
  if (!values.background || !values.accent) {
    throw new Error("Pass at least --background '#rrggbb' and --accent '#rrggbb'.");
  }
  return { ...values, background: values.background, accent: values.accent };
}

const seeds = parseArgs(process.argv.slice(2));
const theme = createTheme(seeds);
const checks = checkThemeContrast(theme);

console.log(`createTheme(${JSON.stringify(seeds)})\n`);
console.log(JSON.stringify(theme, null, 2));
console.log("\nContrast checks:");
for (const check of checks) {
  const mark = check.passes ? "ok  " : "LOW ";
  console.log(`${mark} ${check.pair.padEnd(48)} ${check.ratio.toFixed(2)} (min ${check.minimum})`);
}
const failing = checks.filter((check) => !check.passes).length;
console.log(
  failing === 0
    ? "\nAll required contrast checks pass."
    : `\n${failing} required contrast check(s) below minimum.`,
);
process.exitCode = failing === 0 ? 0 : 1;
