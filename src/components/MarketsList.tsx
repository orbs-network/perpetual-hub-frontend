import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Search, Star, X } from "lucide-react";
import {
  TableVirtuoso,
  type ItemProps,
  type TableComponents,
} from "react-virtuoso";
import { TradingServiceError } from "./TradingServiceError";
import { useMarkets } from "../hooks/useMarkets";
import type { MarketInfo } from "../api/markets";
import { useAllPrices } from "../hooks/useBinancePrices";
import { useFavoritesStore } from "../stores/favoritesStore";
import { PopoverClose } from "@radix-ui/react-popover";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "./ui/drawer";
import { Input } from "./ui/input";
import { TokenLogo } from "./ui/token-logo";
import { useIsMobile } from "../hooks/useIsMobile";
import {
  formatDisplayPrice,
  formatVolume,
  formatNumber,
} from "../utils/formatting";
import { useSymbolConfig } from "@/hooks/useSymbolConfig";
import { usePrice } from "@/hooks/useBinancePrices";
import { Skeleton, SkeletonContainer } from "./ui/skeleton";
import {
  cn,
  compareSymbols,
  getDisplaySymbol,
  getSymbolWithoutQuoteAsset,
} from "@/lib/utils";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { SortableColumnHead } from "./bottom-tabs/SortableColumnHead";
import {
  DEFAULT_ASSET_SORT_DIRECTIONS,
  getDefaultAssetSort,
  sortAssetSymbols,
  type AssetSortKey,
  type AssetSortState,
  type SortDirection,
} from "./marketsListSort";
import {
  useSelectTradeSymbol,
  useTradeSymbol,
} from "@/hooks/useSelectTradeSymbol";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { partner } from "@/config/partners";

const MARKET_SORT_LABELS: Record<AssetSortKey, string> = {
  preferred: "preferred assets",
  asset: "asset",
  price: "price",
  change: "24h change",
  volume: "24h volume",
};

const MARKET_HEADER_ROW_CLASS =
  "sticky top-0 z-10 h-[30px] border-b border-edge/60 bg-base hover:!bg-base [&_th]:text-[12px] [&_th]:text-content-secondary";

const DESKTOP_MARKET_COLUMN_WIDTHS = [
  "36px",
  "220px",
  "112px",
  "170px",
  "182px",
];
const MOBILE_MARKET_COLUMN_WIDTHS = ["32px", "128px", "78px", "70px", "76px"];
const EMPTY_MARKET_PRIORITY_SYMBOLS: readonly string[] = [];

type MarketTableSortState = {
  column: AssetSortKey;
  direction: SortDirection;
};

type MarketListVariant = "mobile" | "desktop";

type MarketHeaderColumn = {
  column: AssetSortKey;
  label: string;
  className: string;
};

const MOBILE_MARKET_HEADER_COLUMNS: MarketHeaderColumn[] = [
  {
    column: "asset",
    label: "Symbol",
    className: "w-[128px] px-2",
  },
  {
    column: "volume",
    label: "Volume",
    className: "w-[78px] px-2",
  },
  {
    column: "price",
    label: "Last Price",
    className: "w-[70px] px-2",
  },
  {
    column: "change",
    label: "24h",
    className: "w-[76px] px-2",
  },
];

const DESKTOP_MARKET_HEADER_COLUMNS: MarketHeaderColumn[] = [
  {
    column: "asset",
    label: "Asset",
    className: "w-[220px] px-2",
  },
  {
    column: "price",
    label: "Last Price",
    className: "w-[112px] px-2",
  },
  {
    column: "change",
    label: "24h Change",
    className: "w-[170px] px-2",
  },
  {
    column: "volume",
    label: "24h Volume",
    className: "w-[182px] px-2",
  },
];

function MarketSortableHead({
  column,
  label,
  className,
  sort,
  onSort,
  getNextDirection,
}: MarketHeaderColumn & {
  sort: MarketTableSortState;
  onSort: (key: AssetSortKey) => void;
  getNextDirection: (key: AssetSortKey) => SortDirection;
}) {
  const { t } = useTranslation();
  return (
    <SortableColumnHead
      column={column}
      label={t(label)}
      sort={sort}
      sortLabel={t(MARKET_SORT_LABELS[column])}
      onSort={onSort}
      defaultDirection={DEFAULT_ASSET_SORT_DIRECTIONS[column]}
      nextDirection={getNextDirection(column)}
      iconSize={12}
      className={className}
    />
  );
}

function normalizeLeverageBadgeValue(maxLeverage: unknown) {
  const leverage =
    typeof maxLeverage === "number"
      ? maxLeverage
      : typeof maxLeverage === "string"
        ? Number(maxLeverage)
        : undefined;

  return leverage !== undefined && Number.isFinite(leverage)
    ? leverage
    : undefined;
}

function MarketLeverageBadge({
  maxLeverage,
  isLoading,
}: {
  maxLeverage?: number;
  isLoading: boolean;
}) {
  const leverage = normalizeLeverageBadgeValue(maxLeverage);

  return (
    <SkeletonContainer
      isLoading={isLoading && leverage === undefined}
      className="h-[18px] w-9 shrink-0"
      loaderClassName="h-[18px] w-9 rounded"
    >
      <span className="inline-flex h-[18px] w-9 shrink-0 items-center justify-center rounded bg-up/10 px-1 py-0 text-[10px] font-bold leading-none text-up">
        {leverage !== undefined ? `${leverage}x` : "--"}
      </span>
    </SkeletonContainer>
  );
}

type MarketTableRowProps = ItemProps<MarketInfo> & {
  className?: string;
};

function MarketRowCells({
  market,
  isMobile,
}: {
  market: MarketInfo;
  isMobile: boolean;
}) {
  const symbol = market.symbol;
  const baseAsset = market.baseAsset ?? "";
  const quoteAsset = market.quoteAsset ?? "";
  const pricePrecision = market.pricePrecision ?? 2;
  const { maxLeverage, isLoading: isLeverageLoading } =
    useSymbolConfig(symbol);
  const priceData = usePrice(symbol);
  const { priceChangePercent, volume24h, price } = priceData ?? {};
  const isPositive =
    priceChangePercent !== undefined && priceChangePercent >= 0;
  const changeColorClass =
    priceChangePercent === undefined
      ? "text-content-muted"
      : isPositive
        ? "text-up"
        : "text-down";
  const { toggleFavorite, isFavorite } = useFavoritesStore();
  const fav = isFavorite(symbol);
  const hasPrice = !!price && price > 0;
  const hasVolume = volume24h !== undefined && Number.isFinite(volume24h);

  const priceChangePercentF = formatNumber(priceChangePercent, {
    decimalScale: 2,
    suffix: "%",
  });
  const priceF = formatNumber(price ?? 0, {
    decimalScale: pricePrecision ?? 2,
  });
  const fullVolumeF = hasVolume
    ? `$${formatNumber(Math.round(volume24h), { decimalScale: 0 })}`
    : "--";
  const changeValueF = useMemo(() => {
    if (
      !price ||
      priceChangePercent === undefined ||
      !Number.isFinite(priceChangePercent)
    ) {
      return "-- / --";
    }
    const denominator = 100 + priceChangePercent;
    const change =
      denominator === 0 ? 0 : (price * priceChangePercent) / denominator;
    const sign = priceChangePercent >= 0 ? "+" : "-";
    const absChange = Math.abs(change);
    const decimalScale = absChange >= 10 ? 0 : absChange >= 1 ? 2 : 4;
    return `${sign}${formatNumber(absChange, { decimalScale })} / ${sign}${Math.abs(priceChangePercent).toFixed(2)}%`;
  }, [price, priceChangePercent]);

  if (isMobile) {
    return (
      <>
        <TableCell className="w-8 px-0 py-0 text-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(symbol);
            }}
            className="inline-flex h-9 w-8 items-center justify-center"
          >
            <Star
              size={16}
              className={
                fav ? "text-warning fill-warning" : "text-content-muted"
              }
            />
          </button>
        </TableCell>

        <TableCell className="w-[128px] px-2 py-0">
          <div className="flex h-9 min-w-0 items-center gap-1.5 whitespace-nowrap">
            <span className="min-w-0 truncate text-[14px] font-semibold text-content">
              {symbol}
            </span>
            <MarketLeverageBadge
              maxLeverage={maxLeverage}
              isLoading={isLeverageLoading}
            />
          </div>
        </TableCell>

        <TableCell className="w-[78px] px-2 py-0">
          <SkeletonContainer
            isLoading={!hasVolume}
            className="flex h-9 items-center"
            loaderClassName="h-3 w-14"
          >
            <div className="text-[12px] font-normal leading-none text-content">
              ${formatVolume(volume24h ?? 0)}
            </div>
          </SkeletonContainer>
        </TableCell>

        <TableCell className="w-[70px] px-2 py-0">
          <SkeletonContainer
            isLoading={!hasPrice}
            className="flex h-9 items-center"
            loaderClassName="h-4 w-16"
          >
            <div className="text-[12px] font-normal leading-none text-content">
              {formatDisplayPrice(price ?? 0)}
            </div>
          </SkeletonContainer>
        </TableCell>

        <TableCell className="w-[76px] px-2 py-0">
          <SkeletonContainer
            isLoading={!hasPrice}
            className="flex h-9 items-center"
            loaderClassName="h-3 w-14"
          >
            <div className={`text-[12px] leading-none ${changeColorClass}`}>
              {isPositive ? "+" : ""}
              {priceChangePercentF}
            </div>
          </SkeletonContainer>
        </TableCell>
      </>
    );
  }

  return (
    <>
      <TableCell className="w-9 px-0 py-0 text-center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(symbol);
          }}
          className="inline-flex h-[40px] w-8 items-center justify-center transition-transform hover:scale-110"
        >
          <Star
            size={14}
            className={
              fav
                ? "text-warning fill-warning"
                : "text-content-muted hover:text-warning"
            }
          />
        </button>
      </TableCell>

      <TableCell className="w-[220px] px-2 py-0">
        <div className="flex h-[40px] min-w-0 items-center whitespace-nowrap">
          <div className="flex min-w-0 items-center gap-1.5 leading-none">
            <span className="min-w-0 truncate text-[13px] font-semibold leading-none text-content">
              {baseAsset}-{quoteAsset}
            </span>
            <MarketLeverageBadge
              maxLeverage={maxLeverage}
              isLoading={isLeverageLoading}
            />
          </div>
        </div>
      </TableCell>

      <TableCell className="w-[112px] px-2 py-0">
        <SkeletonContainer
          isLoading={!hasPrice}
          className="flex h-[40px] items-center"
          loaderClassName="h-3 w-20"
        >
          <span className="text-[12px] font-normal leading-none text-content tabular-nums">
            {priceF}
          </span>
        </SkeletonContainer>
      </TableCell>

      <TableCell className="w-[170px] px-2 py-0">
        <SkeletonContainer
          isLoading={!hasPrice}
          className="flex h-[40px] items-center"
          loaderClassName="h-3 w-24"
        >
          <span
            className={`text-[12px] font-normal leading-none tabular-nums whitespace-nowrap ${changeColorClass}`}
          >
            {changeValueF}
          </span>
        </SkeletonContainer>
      </TableCell>

      <TableCell className="w-[182px] px-2 py-0">
        <SkeletonContainer
          isLoading={!hasVolume}
          className="flex h-[40px] items-center"
          loaderClassName="h-3 w-32"
        >
          <span className="whitespace-nowrap text-[12px] font-normal leading-none text-content tabular-nums">
            {fullVolumeF}
          </span>
        </SkeletonContainer>
      </TableCell>
    </>
  );
}

function SkeletonRow({ isMobile }: { isMobile: boolean }) {
  if (isMobile) {
    return (
      <TableRow className="h-[48px] border-b border-edge/40">
        <TableCell className="w-8 px-0 py-0" />
        <TableCell className="w-[128px] px-2 py-0">
          <Skeleton className="h-4 w-16" />
        </TableCell>
        <TableCell className="w-[78px] px-2 py-0">
          <Skeleton className="h-3 w-14" />
        </TableCell>
        <TableCell className="w-[70px] px-2 py-0">
          <Skeleton className="h-3 w-12" />
        </TableCell>
        <TableCell className="w-[76px] px-2 py-0">
          <Skeleton className="h-3 w-10" />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className="h-[30px] border-b border-edge/40">
      <TableCell className="w-9 px-0 py-0" />
      <TableCell className="w-[220px] px-2 py-0">
        <div className="flex items-center">
          <Skeleton className="h-4 w-24" />
        </div>
      </TableCell>
      <TableCell className="w-[112px] px-2 py-0">
        <Skeleton className="h-3 w-20" />
      </TableCell>
      <TableCell className="w-[170px] px-2 py-0">
        <Skeleton className="h-3 w-24" />
      </TableCell>
      <TableCell className="w-[182px] px-2 py-0">
        <Skeleton className="h-3 w-20" />
      </TableCell>
    </TableRow>
  );
}

function MarketsListContent({
  variant,
  selectedSymbol,
  onSelectSymbol,
}: {
  variant: MarketListVariant;
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
}) {
  const { t } = useTranslation();
  const isMobile = variant === "mobile";

  const { data: markets, isLoading, isUnavailable } = useMarkets();
  const { data: prices = {} } = useAllPrices();
  const prioritySymbols =
    partner.marketPreferences?.prioritySymbols ?? EMPTY_MARKET_PRIORITY_SYMBOLS;
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<AssetSortState>(() =>
    getDefaultAssetSort(prioritySymbols),
  );

  const handleSort = (key: AssetSortKey) => {
    setSort((prev) => {
      const direction =
        prev.key === key
          ? prev.direction === "desc"
            ? "asc"
            : "desc"
          : DEFAULT_ASSET_SORT_DIRECTIONS[key];

      return { key, direction };
    });
  };
  const getNextDirection = (key: AssetSortKey) => {
    if (sort.key !== key) return DEFAULT_ASSET_SORT_DIRECTIONS[key];
    return sort.direction === "desc" ? "asc" : "desc";
  };
  const tableSort = useMemo(
    () => ({ column: sort.key, direction: sort.direction }),
    [sort],
  );

  const marketsBySymbol = useMemo(() => {
    const map = new Map<string, MarketInfo>();
    for (const m of markets ?? []) map.set(m.symbol, m);
    return map;
  }, [markets]);

  const filtered = useMemo(() => {
    let symbols = markets?.map((m) => m.symbol) ?? [];
    if (search) {
      const q = search.toUpperCase();
      symbols = symbols.filter((s) => s.includes(q));
    }
    const sorted = sortAssetSymbols(
      symbols,
      prices,
      sort,
      prioritySymbols,
    );
    return sorted.map((s) => marketsBySymbol.get(s)!);
  }, [markets, marketsBySymbol, search, prices, prioritySymbols, sort]);

  const tableComponents = useMemo<TableComponents<MarketInfo>>(() => {
    const columnWidths = isMobile
      ? MOBILE_MARKET_COLUMN_WIDTHS
      : DESKTOP_MARKET_COLUMN_WIDTHS;
    const MarketTableRow = React.forwardRef<
      HTMLTableRowElement,
      MarketTableRowProps
    >(({ item, className, ...props }, ref) => {
      const row = (
        <TableRow
          ref={ref}
          className={cn(
            isMobile ? "h-[48px]" : "h-[30px]",
            "cursor-pointer border-b border-edge/40 bg-base hover:bg-hover/80",
            item.symbol === selectedSymbol && "bg-hover/80",
            className,
          )}
          onClick={() => onSelectSymbol(item.symbol)}
          {...props}
        />
      );

      if (isMobile) return <DrawerClose asChild>{row}</DrawerClose>;
      return <PopoverClose asChild>{row}</PopoverClose>;
    });

    return {
      Table: ({ style, children }) => (
        <table
          style={style}
          className={cn(
            "w-full max-w-full table-fixed border-separate border-spacing-0 text-[11px] tabular-nums",
            "[&_thead_th]:m-0 [&_thead_th]:py-0 [&_thead_tr]:h-[30px]",
            isMobile
              ? "[&_tbody_td]:h-[48px] [&_tbody_td]:py-0 [&_tbody_tr]:h-[48px]"
              : "[&_tbody_td]:h-[30px] [&_tbody_td]:py-0 [&_tbody_tr]:h-[30px]",
          )}
        >
          <colgroup>
            {columnWidths.map((width, index) => (
              <col key={index} style={{ width }} />
            ))}
          </colgroup>
          {children}
        </table>
      ),
      TableHead: React.forwardRef<
        HTMLTableSectionElement,
        React.HTMLAttributes<HTMLTableSectionElement>
      >(({ className, ...props }, ref) => (
        <TableHeader ref={ref} className={className} {...props} />
      )),
      TableBody: React.forwardRef<
        HTMLTableSectionElement,
        React.HTMLAttributes<HTMLTableSectionElement>
      >(({ className, ...props }, ref) => (
        <TableBody ref={ref} className={className} {...props} />
      )),
      TableRow: MarketTableRow,
    };
  }, [isMobile, onSelectSymbol, selectedSymbol]);

  const fixedHeaderContent = () => {
    if (isMobile) {
      return (
        <TableRow className={MARKET_HEADER_ROW_CLASS}>
          <TableHead className="w-8 px-0" />
          {MOBILE_MARKET_HEADER_COLUMNS.map((column) => (
            <MarketSortableHead
              key={column.column}
              {...column}
              sort={tableSort}
              onSort={handleSort}
              getNextDirection={getNextDirection}
            />
          ))}
        </TableRow>
      );
    }

    return (
      <TableRow className={MARKET_HEADER_ROW_CLASS}>
        <TableHead className="w-9 px-0" />
        {DESKTOP_MARKET_HEADER_COLUMNS.map((column) => (
          <MarketSortableHead
            key={column.column}
            {...column}
            sort={tableSort}
            onSort={handleSort}
            getNextDirection={getNextDirection}
          />
        ))}
      </TableRow>
    );
  };

  return (
    <div className="h-full flex flex-col bg-base">
      {/* Search */}
      <div className="px-3 py-2 border-b border-edge">
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-content-muted"
          />
          <Input
            type="text"
            inputSize="sm"
            placeholder={t("Search...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Markets list */}
      <div className="min-h-0 flex-1 overflow-x-hidden">
        {isUnavailable ? <TradingServiceError /> : isLoading ? (
          <table
            className={cn(
              "w-full max-w-full table-fixed border-separate border-spacing-0 text-[11px] tabular-nums",
              "[&_thead_th]:m-0 [&_thead_th]:py-0 [&_thead_tr]:h-[30px]",
            )}
          >
            <colgroup>
              {(isMobile
                ? MOBILE_MARKET_COLUMN_WIDTHS
                : DESKTOP_MARKET_COLUMN_WIDTHS
              ).map((width, i) => (
                <col key={i} style={{ width }} />
              ))}
            </colgroup>
            <TableBody>
              {Array.from({ length: 12 }, (_, i) => (
                <SkeletonRow key={i} isMobile={isMobile} />
              ))}
            </TableBody>
          </table>
        ) : (
          <TableVirtuoso
            className="page-scrollbar h-full w-full overflow-x-hidden overflow-y-auto"
            data={filtered}
            minOverscanItemCount={50}
            components={tableComponents}
            fixedHeaderContent={fixedHeaderContent}
            itemContent={(_, market) => (
              <MarketRowCells market={market} isMobile={isMobile} />
            )}
            computeItemKey={(_, market) => market.symbol}
            increaseViewportBy={160}
            style={{ height: "100%" }}
          />
        )}
      </div>
    </div>
  );
}

function AssetTickerContent({
  isMobile,
  symbol,
}: {
  isMobile: boolean;
  symbol: string;
}) {
  const displaySymbol = getDisplaySymbol(symbol);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <TokenLogo
        symbol={displaySymbol}
        className={cn("shrink-0", isMobile ? "h-5 w-5" : "h-5 w-5")}
        fallbackClassName="text-[10px]"
      />
      <div className="flex flex-col items-start">
        <span
          className={cn(
            "min-w-0 truncate font-medium leading-none text-content",
            "text-[20px] font-semibold",
          )}
        >
          {getSymbolWithoutQuoteAsset(symbol)}
        </span>
        {isMobile && <MaxLeverageBadge symbol={symbol} />}
      </div>
      <ChevronDown
        size={22}
        className="shrink-0 text-content-muted transition-[color,transform] duration-200 ease-in-out group-hover:text-content-secondary"
      />
      {!isMobile && <MaxLeverageBadge symbol={symbol} />}
    </div>
  );
}

function AssetTicker({ symbol }: { symbol: string }) {
  const isMobile = useIsMobile();

  return (
    <div
      className={cn(
        "group flex min-w-0 items-center rounded px-0 transition-colors cursor-pointer",
        !isMobile ? "py-2.5" : "py-0",
      )}
    >
      <AssetTickerContent
        isMobile={isMobile}
        symbol={symbol}
      />
    </div>
  );
}

function useImmediateMarketSelection() {
  const { symbol: routeSymbol } = useTradeSymbol();
  const selectTradeSymbol = useSelectTradeSymbol();
  const [pendingSelection, setPendingSelection] = useState<{
    source: string;
    target: string;
  } | null>(null);

  const selectedSymbol =
    pendingSelection && compareSymbols(routeSymbol, pendingSelection.source)
      ? pendingSelection.target
      : routeSymbol;

  useEffect(() => {
    if (
      !pendingSelection ||
      compareSymbols(routeSymbol, pendingSelection.source)
    ) {
      return;
    }

    const animationFrame = requestAnimationFrame(() => {
      setPendingSelection(null);
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [pendingSelection, routeSymbol]);

  const onSelectSymbol = useCallback(
    (symbol: string) => {
      if (!compareSymbols(symbol, routeSymbol)) {
        setPendingSelection({ source: routeSymbol, target: symbol });
      }
      selectTradeSymbol(symbol);
    },
    [routeSymbol, selectTradeSymbol],
  );

  return { onSelectSymbol, selectedSymbol };
}

export function MobileMarketsList() {
  const { onSelectSymbol, selectedSymbol } = useImmediateMarketSelection();

  return (
    <Drawer>
      <DrawerTrigger>
        <AssetTicker symbol={selectedSymbol} />
      </DrawerTrigger>
      <DrawerContent
        showHandle={false}
        aria-describedby={undefined}
        className="h-[100dvh] rounded-none pt-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DrawerTitle className="sr-only">Markets</DrawerTitle>
        <div className="flex h-10 shrink-0 items-center justify-end bg-base px-3 pt-2">
          <DrawerClose asChild>
            <button
              type="button"
              aria-label="Close markets"
              className="p-1.5 text-content-muted transition-colors hover:text-content"
            >
              <X size={20} />
            </button>
          </DrawerClose>
        </div>
        <div className="min-h-0 flex-1">
          <MarketsListContent
            variant="mobile"
            selectedSymbol={selectedSymbol}
            onSelectSymbol={onSelectSymbol}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function DesktopMarketsList() {
  const { onSelectSymbol, selectedSymbol } = useImmediateMarketSelection();

  return (
    <Popover>
      <PopoverTrigger>
        <AssetTicker symbol={selectedSymbol} />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-[720px] overflow-hidden p-0 duration-200 data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 data-[state=open]:slide-in-from-top-1"
        style={{
          height: "calc(var(--radix-popover-content-available-height) - 20px)",
        }}
      >
        <MarketsListContent
          variant="desktop"
          selectedSymbol={selectedSymbol}
          onSelectSymbol={onSelectSymbol}
        />
      </PopoverContent>
    </Popover>
  );
}

function MaxLeverageBadge({ symbol }: { symbol: string }) {
  const { maxLeverage, isLoading } = useSymbolConfig(symbol);
  const isMobile = useIsMobile();
  const leverage = normalizeLeverageBadgeValue(maxLeverage);

  return (
    <SkeletonContainer
      isLoading={isLoading && leverage === undefined}
      className={cn("h-[18px] shrink-0", isMobile ? "w-8" : "w-10")}
      loaderClassName="h-[18px] w-full rounded"
    >
      <span
        className={cn(
          "inline-flex h-[18px] w-full shrink-0 items-center justify-center text-[11px] font-semibold text-content-secondary",
          isMobile ? "" : "bg-up/10 px-1.5 py-0.5 rounded",
        )}
      >
        {leverage !== undefined ? `${leverage}x` : "--"}
      </span>
    </SkeletonContainer>
  );
}

export function MarketsList() {
  const isMobile = useIsMobile();

  return (
    <div className="flex min-w-0 items-center gap-2 group">
      {isMobile ? <MobileMarketsList /> : <DesktopMarketsList />}
    </div>
  );
}
