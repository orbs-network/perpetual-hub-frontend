import {
  DOMAIN_PRICE_SCALE,
  PRICE_SCALE,
  QUANTITY_SCALE,
} from "../config/constants";
import { numericFormatter } from "react-number-format";
import BN from "bignumber.js";

/**
 * Convert a display USDC amount (e.g., 50000.50) to a 1e6-scaled bigint.
 * Order and position prices use the exact 1e18 helpers below instead.
 */
export function toScaledPrice(price: string | number): bigint {
 try {
  return BigInt(
    BN(price)
      .multipliedBy(BN(PRICE_SCALE))
      .decimalPlaces(0)
      .integerValue()
      .toString(),
  );
 } catch (error) {
  console.error(error);
  return 0n;
 }
}

/**
 * Convert a 1e6-scaled USDC amount to a display string
 */
export function fromScaledPrice(scaled: bigint | string): string {
  return BN(scaled).div(BN(PRICE_SCALE)).toFixed();
}

const DOMAIN_PRICE_DECIMALS = 18;
// A 1e18 domain price is also a legacy 1e6 order-API price only when it is an
// exact multiple of this unit.
export const DOMAIN_PRICE_PER_LEGACY_UNIT = DOMAIN_PRICE_SCALE / PRICE_SCALE; // 1e12

function parseDomainPrice(value?: string | number | bigint | null): bigint {
  if (value === undefined || value === null || value === "") return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

/**
 * Convert an exact display price (decimal string, number or BN) into the
 * backend/TEE PriceScale (1e18). Numbers are read through their shortest
 * decimal form, never through float multiplication. Digits beyond 18
 * decimals are rounded down; anything unparseable is 0n.
 */
export function toDomainPrice(price: string | number | BN): bigint {
  const parsed = BN(price);
  if (!parsed.isFinite()) return 0n;
  return BigInt(
    parsed
      .multipliedBy(DOMAIN_PRICE_SCALE.toString())
      .integerValue(BN.ROUND_DOWN)
      .toFixed(0),
  );
}

/**
 * Exact plain decimal string of a 1e18 domain price, trailing zeros trimmed
 * (9500000000000n -> "0.0000095").
 */
export function domainPriceToDecimal(
  value?: string | number | bigint | null,
): string {
  const scaled = parseDomainPrice(value);
  const sign = scaled < 0n ? "-" : "";
  const abs = scaled < 0n ? -scaled : scaled;
  const whole = abs / DOMAIN_PRICE_SCALE;
  const fraction = (abs % DOMAIN_PRICE_SCALE)
    .toString()
    .padStart(DOMAIN_PRICE_DECIMALS, "0")
    .replace(/0+$/, "");
  return `${sign}${whole}${fraction ? `.${fraction}` : ""}`;
}

/**
 * Convert a backend domain/TEE price (1e18) into a JS number for display and
 * charting. No 1e6 truncation: 9500000000000n -> 0.0000095.
 */
export function domainPriceToDisplayNumber(
  value?: string | number | bigint | null,
): number {
  const scaled = parseDomainPrice(value);
  if (scaled <= 0n) return 0;
  return Number(domainPriceToDecimal(scaled));
}

// Kept as a source-compatible name for price call sites: this now returns
// the full domain-scale value, with no division or truncation.
export function domainPriceToBigInt(
  value?: string | number | bigint | null,
): bigint {
  return parseDomainPrice(value);
}

/**
 * The legacy 1e6 integer string of a 1e18 price, only when it is exactly
 * representable at 1e6. Sub-1e-6 prices have no legacy form.
 */
export function domainPriceToLegacyPrice(price: bigint): string | undefined {
  if (price <= 0n || price % DOMAIN_PRICE_PER_LEGACY_UNIT !== 0n) {
    return undefined;
  }
  return (price / DOMAIN_PRICE_PER_LEGACY_UNIT).toString();
}

/**
 * USDC notional (1e6) of a 1e8 quantity at an exact 1e18 price:
 * qty * price / 1e8 / 1e12, truncated once at the end.
 */
export function domainPriceNotional(quantity: bigint, price: bigint): bigint {
  return (quantity * price) / (QUANTITY_SCALE * DOMAIN_PRICE_PER_LEGACY_UNIT);
}

export function amountScaleToDisplayNumber(
  value?: string | number | bigint | null,
): number {
  if (value === undefined || value === null || value === "") return 0;
  try {
    const scaled = BigInt(value);
    return Number(scaled) / Number(PRICE_SCALE);
  } catch {
    return 0;
  }
}

/**
 * Snap a display price to the symbol's tick size.
 * E.g., snapPriceToTickSize(71700.97, 1) → 71700.9 (1 decimal place).
 */
export function snapPriceToTickSize(
  price: string | number,
  precision: number = 2,
): string {
  return BN(price).decimalPlaces(precision, BN.ROUND_DOWN).toFixed(precision);
}

/**
 * Snap a display price down to `precision` decimals and return it as an exact
 * 1e18 domain price.
 */
export function toDomainTickPrice(
  price: string | number,
  precision: number = 2,
): bigint {
  return toDomainPrice(snapPriceToTickSize(price, precision));
}

export function scaledIncrement(
  increment: string | number | undefined,
  scale: bigint,
): bigint | undefined {
  if (increment === undefined || increment === "") return undefined;
  const parsed = BN(increment);
  if (!parsed.isFinite() || parsed.lte(0)) return undefined;
  const scaled = BigInt(
    parsed
      .multipliedBy(scale.toString())
      .decimalPlaces(0, BN.ROUND_DOWN)
      .toFixed(0),
  );
  return scaled > 0n ? scaled : undefined;
}

function precisionUnit(precision: number): bigint {
  const decimals = Math.min(
    Math.max(Math.trunc(precision), 0),
    DOMAIN_PRICE_DECIMALS,
  );
  return 10n ** BigInt(DOMAIN_PRICE_DECIMALS - decimals);
}

/**
 * Snap a 1e18 domain price down onto the symbol's tick grid, exactly at 1e18.
 * Without a usable tick size it falls back to `precision` decimals.
 */
export function normalizeDomainPriceToTick(
  price: bigint,
  tickSize?: string | number,
  precision: number = 2,
): bigint {
  const tick =
    scaledIncrement(tickSize, DOMAIN_PRICE_SCALE) ?? precisionUnit(precision);
  return (price / tick) * tick;
}

export function toDomainTickPriceWithTick(
  price: string | number,
  tickSize?: string | number,
  precision: number = 2,
): bigint {
  return normalizeDomainPriceToTick(toDomainPrice(price), tickSize, precision);
}


/**
 * Get the tick size step for a price input precision.
 * E.g., getTickSizeStep(1) → "0.1"
 */
export function getTickSizeStep(precision: number = 2): string {
  return (1 / Math.pow(10, precision)).toFixed(precision);
}

/**
 * Convert a display quantity (e.g., 0.001) to scaled bigint,
 * truncated to the symbol's Binance step size so the signed
 * value matches what the backend sends to the TEE.
 */
export function toScaledQuantity(
  quantity: string | number,
  precision: number = 3,
): bigint {
  const raw = BigInt(
    BN(quantity)
      .multipliedBy(BN(QUANTITY_SCALE))
      .decimalPlaces(0, BN.ROUND_UP)
      .toFixed(),
  );

  return normalizeQuantity(raw, precision);
}

export function normalizeQuantityToStep(
  qty: bigint,
  stepSize?: string | number,
  precision: number = 3,
): bigint {
  const step = scaledIncrement(stepSize, QUANTITY_SCALE);
  if (!step) return normalizeQuantity(qty, precision);
  return (qty / step) * step;
}

export function toScaledQuantityWithStep(
  quantity: string | number,
  stepSize?: string | number,
  precision: number = 3,
): bigint {
  const raw = BigInt(
    BN(quantity)
      .multipliedBy(BN(QUANTITY_SCALE))
      .decimalPlaces(0, BN.ROUND_DOWN)
      .toFixed(),
  );

  return normalizeQuantityToStep(raw, stepSize, precision);
}

/**
 * Normalize a 1e8-scaled quantity to Binance step-size precision.
 * Mirrors backend NormalizeQuantityForSymbol.
 */
export function normalizeQuantity(qty: bigint, precision: number = 3): bigint {
  if (precision >= 8) return qty;
  const scale = BN(10).pow(8 - precision);
  return BigInt(BN(qty.toString()).dividedToIntegerBy(scale).multipliedBy(scale).toFixed(0));
}

/**
 * Convert a scaled bigint quantity to display number
 */
export function fromScaledQuantity(scaled: bigint): string {
  return BN(scaled).div(BN(QUANTITY_SCALE)).toFixed();
}

const MAX_FALLBACK_PRICE_SIGNIFICANT_DIGITS = 8;

function decimalPlacesOfNumber(value: number): number {
  if (!Number.isFinite(value) || value === 0) return 0;
  return BN(value).decimalPlaces() ?? 0;
}

/**
 * Decimal places for showing a display price: the magnitude default (2/4/6),
 * widened to the symbol's tick precision when it is known, otherwise to the
 * price's own digits (up to 8 significant digits) so a fine price such as
 * 0.0000095 is never cut at 6 decimals.
 */
export function getPriceDisplayDecimals(
  price: number,
  precision?: number,
): number {
  const magnitudeDecimals = price >= 100 ? 2 : price >= 1 ? 4 : 6;
  if (precision !== undefined && Number.isInteger(precision) && precision >= 0) {
    return Math.max(magnitudeDecimals, precision);
  }
  if (!Number.isFinite(price) || price <= 0) return magnitudeDecimals;
  const significant = Number(
    price.toPrecision(MAX_FALLBACK_PRICE_SIGNIFICANT_DIGITS),
  );
  return Math.max(magnitudeDecimals, decimalPlacesOfNumber(significant));
}

/** Format a display price with adaptive decimals (see getPriceDisplayDecimals) */
export function formatDisplayPrice(price: number, precision?: number): string {
  return formatNumber(price, {
    decimalScale: getPriceDisplayDecimals(price, precision),
  });
}

/** Format volume with compact suffix (K/M/B) */
export function formatVolume(vol: number): string {
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(2)}B`;
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toFixed(0);
}

export function zeroWithDecimals(decimals?: number): string {
  if (!decimals) return "0";
  return (0).toFixed(decimals);
}

export function formatUSD(value: number | string): string {
  return formatNumber(value, { decimalScale: 2 });
}



/**
 * Format PnL with color indicator
 */
export function formatPnL(scaled: bigint): {
  value: string;
  isPositive: boolean;
} {
  const num = parseFloat(fromScaledPrice(scaled));
  const isPositive = num >= 0;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "always",
  }).format(num);

  return { value: formatted, isPositive };
}

/**
 * Shorten an Ethereum address for display
 */
export function shortenAddress(address: string, chars: number = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Format timestamp to readable date/time
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Format a number with thousand separators and decimal scaling.
 * Pure function equivalent of useFormatNumber — safe to call outside React components.
 */
export function formatNumber(
  value?: string | number | bigint,
  {
    decimalScale,
    prefix = "",
    suffix = "",
    scaled,
  }: {
    decimalScale?: number;
    prefix?: string;
    suffix?: string;
    scaled?: "quantity" | "price" | "domainPrice";
  } = {},
): string {
  let _value = value;
  if (scaled === "quantity") {
    _value = fromScaledQuantity(value as bigint);
  } else if (scaled === "price") {
    _value = fromScaledPrice(value as bigint);
  } else if (scaled === "domainPrice") {
    _value = domainPriceToDecimal(value);
  } else if (typeof value === "number" && Number.isFinite(value)) {
    // Plain digits: String(0.00000095) would be "9.5e-7".
    _value = BN(value).toFixed();
  }

  // const trimmed = formatDecimals(_value?.toString() || "", decimalScale);
  // if (!trimmed) return "";

  return numericFormatter(_value?.toString() || "", {
    thousandSeparator: ",",
    // An exact domain price without a known tick keeps every digit.
    decimalScale:
      decimalScale ?? (scaled === "domainPrice" ? DOMAIN_PRICE_DECIMALS : 3),
    allowLeadingZeros: true,
    prefix,
    suffix,
  });
}

export function formatFeeRate(bps?: number): string {
  const value = Number.isFinite(bps) ? bps ?? 0 : 0;
  return `${BN(value).dividedBy(100).decimalPlaces(4).toFixed()}%`;
}
