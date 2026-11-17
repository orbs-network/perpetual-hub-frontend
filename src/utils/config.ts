import { partner } from "@/config/partners";
import type { PartnerChainConfig, PartnerConfig } from "@/config/partners";
import { safeUpperCase } from "@/lib/string";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const APP_CHAIN_QUERY_KEY = "chain";
const STALE_CHAIN_ID_QUERY_KEYS = ["chainId", "chainid"] as const;

export type AppPartnerChainConfig = PartnerChainConfig & {
  partnerId: string;
  partnerChainKey: string;
};

export function getPartnerChainIds(
  chains: readonly Pick<PartnerChainConfig, "chainId">[] = partner.chains,
) {
  return chains.map((entry) => entry.chainId);
}

function getBrowserSearch() {
  return typeof window === "undefined" ? "" : window.location.search;
}

function parseChainId(rawValue: number | string | null | undefined) {
  if (rawValue == null || rawValue === "") return undefined;
  const chainId = Number(rawValue);
  return Number.isInteger(chainId) && chainId > 0 ? chainId : undefined;
}

export function getQueryAppTargetChainId(search = getBrowserSearch()) {
  try {
    return parseChainId(new URLSearchParams(search).get(APP_CHAIN_QUERY_KEY));
  } catch {
    return undefined;
  }
}

export function getPrimaryPartnerChainId(
  chainIds: readonly number[] = getPartnerChainIds(),
) {
  const [chainId] = chainIds;
  if (!chainId) {
    throw new Error("Partner config must define at least one supported chain");
  }
  return chainId;
}

function withPartnerChainKey(
  entry: PartnerChainConfig,
  partnerConfig: PartnerConfig,
): AppPartnerChainConfig {
  const partnerId = partnerConfig.id;

  return {
    ...entry,
    partnerId,
    partnerChainKey: `${partnerId}:${entry.chainId}`,
  };
}

export function getPrimaryPartnerChain(
  chains: readonly PartnerChainConfig[] = partner.chains,
  partnerConfig: PartnerConfig = partner,
) {
  const [entry] = chains;
  if (!entry) {
    throw new Error("Partner config must define at least one partner-chain entry");
  }
  return withPartnerChainKey(entry, partnerConfig);
}

export function getAppPartnerChain({
  partnerConfig = partner,
  selectedChainId = getQueryAppTargetChainId(),
}: {
  partnerConfig?: PartnerConfig;
  selectedChainId?: number;
} = {}) {
  const targetChainId = getAppTargetChainId({
    chainIds: getPartnerChainIds(partnerConfig.chains),
    selectedChainId,
  });
  const directEntry = partnerConfig.chains.find(
    (entry) => entry.chainId === targetChainId,
  );
  if (directEntry) {
    return withPartnerChainKey(directEntry, partnerConfig);
  }

  return getPrimaryPartnerChain(
    partnerConfig.chains,
    partnerConfig,
  );
}

export function getAppTargetChainId({
  chainIds = getPartnerChainIds(),
  selectedChainId = getQueryAppTargetChainId(),
}: {
  chainIds?: readonly number[];
  selectedChainId?: number;
} = {}) {
  const baseChainIds = [...chainIds];
  return selectedChainId && baseChainIds.includes(selectedChainId)
    ? selectedChainId
    : getPrimaryPartnerChainId(baseChainIds);
}

export function stripAppChainQueryParams(search = getBrowserSearch()) {
  const params = new URLSearchParams(search);
  params.delete(APP_CHAIN_QUERY_KEY);
  for (const key of STALE_CHAIN_ID_QUERY_KEYS) {
    params.delete(key);
  }
  params.delete("debug");
  const nextSearch = params.toString();
  return nextSearch ? `?${nextSearch}` : "";
}

export function setAppChainQueryParam(
  chainId: number,
  search = getBrowserSearch(),
) {
  const params = new URLSearchParams(stripAppChainQueryParams(search));
  const parsedChainId = parseChainId(chainId);
  if (parsedChainId) {
    params.set(APP_CHAIN_QUERY_KEY, String(parsedChainId));
  }
  const nextSearch = params.toString();
  return nextSearch ? `?${nextSearch}` : "";
}

export function getCanonicalAppChainSearch({
  chainIds = getPartnerChainIds(),
  search = getBrowserSearch(),
}: {
  chainIds?: readonly number[];
  search?: string;
} = {}) {
  const selectedChainId = getQueryAppTargetChainId(search);
  const targetChainId = getAppTargetChainId({
    chainIds,
    selectedChainId,
  });

  return {
    isCanonical:
      selectedChainId !== undefined && [...chainIds].includes(selectedChainId),
    search: setAppChainQueryParam(targetChainId, search),
    targetChainId,
  };
}

const TOKEN_LOGO_URL_OVERRIDES: Record<string, readonly string[]> = {
  THE: ["/the-token.svg"],
  TON: ["https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png"],
};

const TOKEN_LOGO_SYMBOL_ALIASES: Record<string, string> = {
  BEAMX: "BEAM",
  BTCDOM: "BTC",
  DODOX: "DODO",
  LUNA2: "LUNA",
};

function normalizeCryptoLogoSymbol(baseAsset: string): string {
  return safeUpperCase(baseAsset).replace(/[^A-Z0-9]/g, "");
}

function normalizeCryptoLogoPlaceholderSymbol(baseAsset: string): string {
  const rawSymbol = safeUpperCase(baseAsset?.trim().replace(/['"]/g, ""));
  const normalizedSymbol = normalizeCryptoLogoSymbol(rawSymbol);
  if (!normalizedSymbol) return rawSymbol;

  return getCryptoLogoAlias(normalizedSymbol) ?? normalizedSymbol;
}

function getCryptoLogoAlias(symbol: string) {
  const explicitAlias = TOKEN_LOGO_SYMBOL_ALIASES[symbol];
  if (explicitAlias) return explicitAlias;

  const multiplierMatch = symbol.match(/^(?:1000000|1000|1M)([A-Z0-9]+)$/);
  return multiplierMatch?.[1];
}

function uniqueLogoUrls(urls: string[]) {
  return [...new Set(urls.filter(Boolean))];
}

function escapeSvgText(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function getGeneratedCryptoLogoUrl(symbol: string): string {
  const symbolCharacters = Array.from(symbol).filter((character) =>
    /\S/.test(character),
  );
  const label = symbolCharacters
    .slice(0, symbolCharacters.length === 1 ? 1 : 2)
    .join("");
  const escapedLabel = escapeSvgText(label);
  const background = escapeSvgText(partner.theme["accent-primary"]);
  const foreground = escapeSvgText(partner.theme["content-inverse"]);
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">',
    `<circle cx="32" cy="32" r="32" fill="${background}"/>`,
    `<text x="32" y="39" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${symbolCharacters.length === 1 ? 30 : 24}" font-weight="700" fill="${foreground}">${escapedLabel}</text>`,
    "</svg>",
  ].join("");

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function getCryptoLogoPlaceholderUrl(baseAsset: string): string {
  const symbol = normalizeCryptoLogoPlaceholderSymbol(baseAsset);
  return symbol ? getGeneratedCryptoLogoUrl(symbol) : "";
}

export function getCryptoLogoUrls(baseAsset: string): string[] {
  const symbol = normalizeCryptoLogoSymbol(baseAsset);
  if (!symbol) {
    return uniqueLogoUrls([getCryptoLogoPlaceholderUrl(baseAsset)]);
  }

  const alias = getCryptoLogoAlias(symbol);
  const lookupSymbols = alias ? [alias, symbol] : [symbol];
  const overrideUrls = TOKEN_LOGO_URL_OVERRIDES[symbol] ?? [];

  return uniqueLogoUrls([
    ...overrideUrls,
    ...lookupSymbols.flatMap((lookupSymbol) => [
      `https://intentx-cdn.fra1.cdn.digitaloceanspaces.com/coins/${lookupSymbol.toLowerCase()}.png`,
      `https://assets.coincap.io/assets/icons/${lookupSymbol.toLowerCase()}@2x.png`,
      `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/${lookupSymbol.toLowerCase()}.svg`,
    ]),
    getCryptoLogoPlaceholderUrl(symbol),
  ]);
}

/** Contract destinations come from the selected partner-chain configuration. */
export function getContractAddress({
  partnerContractAddress = getAppPartnerChain().contractAddress,
}: {
  partnerContractAddress?: string;
} = {}) {
  return partnerContractAddress;
}

export function getCollateralAddress({
  partnerCollateralAddress = getAppPartnerChain().collateralAddress,
}: {
  partnerCollateralAddress?: string;
} = {}) {
  return partnerCollateralAddress;
}
