import { DEFAULT_TRADE_SYMBOL } from "@/config/constants";
import { safeUpperCase } from "@/lib/string";
import { getDisplaySymbol, routeSlugToSymbol } from "@/lib/utils";

export const ROUTE_PATHS = {
  catchAll: "*",
  explorer: "/explorer",
  explorerRollup: "/explorer/:rollupId",
  home: "/",
  points: "/points",
  portfolio: "/portfolio",
  rewards: "/rewards",
  trade: "/trade",
  tradeSymbol: "/trade/:symbolSlug",
} as const;

export function withRouteSearch(path: string, search = "") {
  if (!search) return path;
  return `${path}${search.startsWith("?") ? search : `?${search}`}`;
}

function routeSegment(value: string | number) {
  return encodeURIComponent(String(value));
}

export function tradePathForSymbol(symbol?: string) {
  const displaySymbol = getDisplaySymbol(symbol || DEFAULT_TRADE_SYMBOL);
  return `${ROUTE_PATHS.trade}/${safeUpperCase(displaySymbol)}`;
}

export function tradeSymbolForPath(pathname: string) {
  if (pathname === ROUTE_PATHS.trade) {
    return routeSlugToSymbol(undefined);
  }
  const tradePrefix = `${ROUTE_PATHS.trade}/`;
  if (!pathname.startsWith(tradePrefix)) return undefined;
  return routeSlugToSymbol(pathname.slice(tradePrefix.length).split("/")[0]);
}

export const appRoutes = {
  explorer: (search = "") => withRouteSearch(ROUTE_PATHS.explorer, search),
  explorerRollup: (rollupId: string | number, search = "") =>
    withRouteSearch(
      `${ROUTE_PATHS.explorer}/${routeSegment(rollupId)}`,
      search,
    ),
  home: (search = "") => withRouteSearch(ROUTE_PATHS.home, search),
  points: (search = "") => withRouteSearch(ROUTE_PATHS.points, search),
  portfolio: (search = "") => withRouteSearch(ROUTE_PATHS.portfolio, search),
  rewards: (search = "") => withRouteSearch(ROUTE_PATHS.rewards, search),
  trade: (symbol?: string, search = "") =>
    withRouteSearch(tradePathForSymbol(symbol), search),
} as const;
