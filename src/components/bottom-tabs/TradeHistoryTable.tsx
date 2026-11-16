import { useCallback, useMemo } from "react";
import { ArrowUpDown } from "lucide-react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { useTradeHistory } from "@/hooks/useTradeHistory";
import { usePortfolioAddress } from "@/hooks/usePortfolioAddress";
import { getRecentUserTrades } from "@/api/history";
import type { TradeItem } from "@/types";
import { getDisplaySymbol } from "@/lib/utils";
import { domainPriceToBigInt } from "@/utils/formatting";
import { HIDDEN_PNL_TEXT } from "@/lib/pnlPrivacy";
import { useUserPreferencesStore } from "@/stores/userPreferencesStore";
import { TradeHistoryCells, MobileTradeCard } from "./TradeHistoryRow";
import {
  ActivityState,
  type AddressScopedHistoryTableProps,
} from "./shared";
import { SortableHeaderRow } from "./SortableHeaderRow";
import {
  formatScaledUsdc,
  formatTradeClosedPnl,
  formatTradePrice,
  formatTradeQuantity,
  formatTradeTime,
  formatTradeValue,
  getTradeClosedPnl,
  getTradeDirection,
  getTradeValue,
  parseTradeScaled,
} from "./tradeHistoryFormatters";
import {
  compareBigInt,
  compareText,
  sortRows,
  useSortedRows,
  useTableSort,
  type SortDirection,
} from "./useSortableRows";
import { buildTimestampedCsvFilename } from "./csvExport";

type SortColumn =
  | "time"
  | "coin"
  | "direction"
  | "price"
  | "size"
  | "tradeValue"
  | "fee"
  | "closedPnl";

const DEFAULT_SORT_DIRECTIONS: Record<SortColumn, SortDirection> = {
  time: "desc",
  coin: "asc",
  direction: "asc",
  price: "desc",
  size: "desc",
  tradeValue: "desc",
  fee: "desc",
  closedPnl: "desc",
};

const TRADE_SORT_LABELS: Record<SortColumn, string> = {
  time: "Time",
  coin: "Coin",
  direction: "Direction",
  price: "Price",
  size: "Size",
  tradeValue: "Trade Value",
  fee: "Fee",
  closedPnl: "Closed PNL",
};

interface TradeColumn {
  column: SortColumn;
  label: string;
  tooltip?: string;
}

const TRADE_COLUMNS: TradeColumn[] = [
  { column: "time", label: "Time" },
  { column: "coin", label: "Coin" },
  { column: "direction", label: "Direction" },
  { column: "price", label: "Price" },
  { column: "size", label: "Size" },
  { column: "tradeValue", label: "Trade Value" },
  { column: "fee", label: "Fee" },
  {
    column: "closedPnl",
    label: "Closed PNL",
    tooltip: "Closed PNL includes fees and rebates",
  },
];

function getTradeDirectionLabel(trade: TradeItem) {
  return getTradeDirection(trade).label;
}

function compareTradesByColumn(
  column: SortColumn,
  left: TradeItem,
  right: TradeItem,
) {
  switch (column) {
    case "time":
      return left.timestamp - right.timestamp;
    case "coin":
      return (
        compareText(
          getDisplaySymbol(left.symbol),
          getDisplaySymbol(right.symbol),
        ) || compareText(left.symbol, right.symbol)
      );
    case "direction":
      return compareText(
        getTradeDirectionLabel(left),
        getTradeDirectionLabel(right),
      );
    case "price":
      return compareBigInt(
        domainPriceToBigInt(left.price),
        domainPriceToBigInt(right.price),
      );
    case "size":
      return compareBigInt(
        parseTradeScaled(left.quantity) ?? 0n,
        parseTradeScaled(right.quantity) ?? 0n,
      );
    case "tradeValue":
      return compareBigInt(getTradeValue(left) ?? 0n, getTradeValue(right) ?? 0n);
    case "fee":
      return compareBigInt(
        parseTradeScaled(left.fee) ?? 0n,
        parseTradeScaled(right.fee) ?? 0n,
      );
    case "closedPnl":
      return compareBigInt(
        getTradeClosedPnl(left) ?? 0n,
        getTradeClosedPnl(right) ?? 0n,
      );
    default:
      return 0;
  }
}

export function TradeHistoryTable({
  address: addressOverride,
  fillAvailableSpace,
  queryKeyScope,
}: AddressScopedHistoryTableProps = {}) {
  const { t } = useTranslation();
  const portfolioAddress = usePortfolioAddress();
  const address = addressOverride === undefined
    ? portfolioAddress
    : addressOverride;
  const hidePnl = useUserPreferencesStore((state) => state.hidePnl);
  const {
    data: trades,
    isInitialLoading,
    error,
    total,
    pageSize,
    fetchNextPage,
    hasNextPage,
    historyRowLimit,
    isFetchingNextPage,
  } = useTradeHistory(address, queryKeyScope);

  const { sort, setSortColumn, getNextDirection } = useTableSort<SortColumn>({
    initialSort: {
      column: "time",
      direction: "desc",
    },
    defaultDirections: DEFAULT_SORT_DIRECTIONS,
  });
  const sortedTrades = useSortedRows({
    rows: trades,
    sort,
    compareRows: compareTradesByColumn,
  });
  const fetchCsvRows = useCallback(async (signal?: AbortSignal) => {
    if (!address) return [];
    const rows = await getRecentUserTrades(address, signal);
    return sortRows({
      rows,
      sort: {
        column: sort.column,
        direction: sort.direction,
      },
      compareRows: compareTradesByColumn,
    });
  }, [address, sort.column, sort.direction]);
  const csvExport = useMemo(
    () => ({
      filename: () =>
        buildTimestampedCsvFilename(["trade-history", address]),
      fetchRows: fetchCsvRows,
      columns: [
        { header: t("Time"), value: (trade: TradeItem) => formatTradeTime(trade.timestamp) },
        { header: t("Coin"), value: (trade: TradeItem) => getDisplaySymbol(trade.symbol) },
        { header: t("Direction"), value: (trade: TradeItem) => t(getTradeDirectionLabel(trade)) },
        { header: t("Price"), value: formatTradePrice },
        {
          header: t("Size"),
          value: (trade: TradeItem) => {
            const quantity = formatTradeQuantity(trade);
            return quantity === "-" ? "-" : `${quantity} ${getDisplaySymbol(trade.symbol)}`;
          },
        },
        { header: t("Trade Value"), value: formatTradeValue },
        {
          header: t("Fee"),
          value: (trade: TradeItem) => formatScaledUsdc(parseTradeScaled(trade.fee)),
        },
        {
          header: t("Closed PNL"),
          value: (trade: TradeItem) =>
            hidePnl
              ? HIDDEN_PNL_TEXT
              : formatTradeClosedPnl(trade),
        },
      ],
    }),
    [address, fetchCsvRows, hidePnl, t],
  );

  return (
    <ActivityState
      address={address}
      icon={ArrowUpDown}
      emptyTitle="No Trade History"
      emptySubtitle="Your Executed Trades Will Appear Here"
      isLoading={isInitialLoading}
      isEmpty={total === 0}
      error={error}
      fillAvailableSpace={fillAvailableSpace}
      label="Trade History"
      data={sortedTrades}
      csvExport={csvExport}
      computeItemKey={(_, trade) => `${trade.id}-${trade.timestamp}`}
      pageSize={pageSize}
      total={total}
      fetchNextPage={fetchNextPage}
      hasNextPage={hasNextPage}
      historyRowLimit={historyRowLimit}
      isFetchingNextPage={isFetchingNextPage}
      fixedHeaderContent={() => (
        <SortableHeaderRow
          columns={TRADE_COLUMNS}
          sort={sort}
          sortLabels={TRADE_SORT_LABELS}
          defaultDirections={DEFAULT_SORT_DIRECTIONS}
          onSort={setSortColumn}
          getNextDirection={getNextDirection}
          iconSize={14}
        />
      )}
      itemContent={(_, trade) => <TradeHistoryCells trade={trade} />}
      mobileExpansionLabels={{
        expand: "Expand All Trades",
        collapse: "Collapse All Trades",
      }}
      mobileItemContent={(_, trade, expansion) => (
        <MobileTradeCard
          trade={trade}
          expanded={expansion?.expanded}
          onExpandedChange={expansion?.setExpanded}
        />
      )}
    />
  );
}
