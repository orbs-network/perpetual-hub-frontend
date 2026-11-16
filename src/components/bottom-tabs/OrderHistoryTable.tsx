import { useMemo } from "react";
import { Clock } from "lucide-react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { useOrderHistory } from "@/hooks/useOrderHistory";
import { usePortfolioAddress } from "@/hooks/usePortfolioAddress";
import { getRecentUserOrderHistory } from "@/api/history";
import { getDisplaySymbol } from "@/lib/utils";
import type { OrderHistoryItem } from "@/types";
import { MobileOrderHistoryCard, OrderHistoryCells } from "./OrderHistoryRow";
import {
  formatHistoryTime,
  getHistoryDirection,
  getHistoryStatus,
  getHistoryTpSlLabel,
  getHistoryTriggerCondition,
  getHistoryTriggerDirection,
  getHistoryType,
  getOrderHistoryValue,
  isFilledStatus,
  parseHistoryScaled,
} from "./orderHistoryFormatters";
import {
  ActivityState,
  type AddressScopedHistoryTableProps,
} from "./shared";
import { SortableHeaderRow } from "./SortableHeaderRow";
import {
  formatFundingPaymentAmount,
  formatUsdcAmount,
} from "./utils";
import {
  compareBigInt,
  compareText,
  sortRows,
  useSortedRows,
  useTableSort,
  type SortDirection,
} from "./useSortableRows";
import { domainPriceToBigInt, formatNumber } from "@/utils/formatting";
import { buildTimestampedCsvFilename } from "./csvExport";

type OrderHistorySortColumn =
  | "time"
  | "type"
  | "coin"
  | "direction"
  | "size"
  | "filledSize"
  | "orderValue"
  | "price"
  | "reduceOnly"
  | "triggerConditions"
  | "tpSl"
  | "status";

const DEFAULT_ORDER_HISTORY_SORT_DIRECTIONS: Record<
  OrderHistorySortColumn,
  SortDirection
> = {
  time: "desc",
  type: "asc",
  coin: "asc",
  direction: "asc",
  size: "desc",
  filledSize: "desc",
  orderValue: "desc",
  price: "desc",
  reduceOnly: "desc",
  triggerConditions: "asc",
  tpSl: "asc",
  status: "asc",
};

const ORDER_HISTORY_SORT_LABELS: Record<OrderHistorySortColumn, string> = {
  time: "Time",
  type: "Type",
  coin: "Coin",
  direction: "Direction",
  size: "Size",
  filledSize: "Filled Size",
  orderValue: "Order Value",
  price: "Price",
  reduceOnly: "Reduce Only",
  triggerConditions: "Trigger Conditions",
  tpSl: "TP/SL",
  status: "Status",
};

interface OrderHistoryColumn {
  column: OrderHistorySortColumn;
  label: string;
}

const ORDER_HISTORY_COLUMNS: OrderHistoryColumn[] = [
  { column: "time", label: "Time" },
  { column: "type", label: "Type" },
  { column: "coin", label: "Coin" },
  { column: "direction", label: "Direction" },
  { column: "size", label: "Size" },
  { column: "filledSize", label: "Filled Size" },
  { column: "orderValue", label: "Order Value" },
  { column: "price", label: "Price" },
  { column: "reduceOnly", label: "Reduce Only" },
  {
    column: "triggerConditions",
    label: "Trigger Conditions",
  },
  { column: "tpSl", label: "TP/SL" },
  { column: "status", label: "Status" },
];

function getHistoryReduceOnly(order: OrderHistoryItem) {
  const direction = getHistoryDirection(order).label;
  return direction.startsWith("Close") || order.operationType === "LIQUIDATION";
}

function getHistorySizeForColumn(
  order: OrderHistoryItem,
  column: "size" | "filledSize",
) {
  const filled = isFilledStatus(order.status);
  const quantity = parseHistoryScaled(order.quantity);
  if (column === "size") return quantity;
  return filled ? quantity : 0n;
}

function formatHistoryQuantity(order: OrderHistoryItem) {
  const quantity = parseHistoryScaled(order.quantity);
  if (quantity <= 0n) return "--";
  return formatNumber(quantity, { scaled: "quantity", decimalScale: 8 });
}

function formatOrderHistoryCsvValue(
  order: OrderHistoryItem,
  t: (value: string) => string,
) {
  const value = getOrderHistoryValue(order);
  const price = domainPriceToBigInt(order.price);
  const type = getHistoryType(order);

  if (type === "Funding") return formatFundingPaymentAmount(value);
  if (price <= 0n) return type === "Market" ? t("Market") : "--";
  return formatUsdcAmount(value);
}

function formatHistoryPriceText(
  order: OrderHistoryItem,
  t: (value: string) => string,
) {
  const price = domainPriceToBigInt(order.price);
  if (price <= 0n) return getHistoryType(order) === "Market" ? t("Market") : "--";
  return formatNumber(price, { scaled: "domainPrice", decimalScale: 8 });
}

function formatHistoryTriggerText(
  order: OrderHistoryItem,
  t: (value: string) => string,
) {
  const stopPrice = getHistoryTriggerCondition(order);
  const direction = getHistoryTriggerDirection(order);
  if (stopPrice === null || direction === null) return t("N/A");
  return `${t("Price")} ${direction} ${formatNumber(
    domainPriceToBigInt(stopPrice.toString()),
    { scaled: "domainPrice", decimalScale: 8 },
  )}`;
}

function compareOrderHistoryRows(
  column: OrderHistorySortColumn,
  left: OrderHistoryItem,
  right: OrderHistoryItem,
) {
  switch (column) {
    case "time":
      return left.timestamp - right.timestamp;
    case "type":
      return compareText(getHistoryType(left), getHistoryType(right));
    case "coin":
      return (
        compareText(getDisplaySymbol(left.symbol), getDisplaySymbol(right.symbol)) ||
        compareText(left.symbol, right.symbol)
      );
    case "direction":
      return compareText(
        getHistoryDirection(left).label,
        getHistoryDirection(right).label,
      );
    case "size":
    case "filledSize":
      return compareBigInt(
        getHistorySizeForColumn(left, column),
        getHistorySizeForColumn(right, column),
      );
    case "orderValue":
      return compareBigInt(
        getOrderHistoryValue(left) ?? 0n,
        getOrderHistoryValue(right) ?? 0n,
      );
    case "price":
      return compareBigInt(
        domainPriceToBigInt(left.price),
        domainPriceToBigInt(right.price),
      );
    case "reduceOnly":
      return Number(getHistoryReduceOnly(left)) -
        Number(getHistoryReduceOnly(right));
    case "triggerConditions":
      return compareText(
        `${getHistoryTriggerDirection(left) ?? ""} ${getHistoryTriggerCondition(left) ?? ""}`,
        `${getHistoryTriggerDirection(right) ?? ""} ${getHistoryTriggerCondition(right) ?? ""}`,
      );
    case "tpSl":
      return compareText(getHistoryTpSlLabel(left), getHistoryTpSlLabel(right));
    case "status":
      return compareText(getHistoryStatus(left), getHistoryStatus(right));
    default:
      return 0;
  }
}

export function OrderHistoryTable({
  address: addressOverride,
  fillAvailableSpace,
  queryKeyScope,
}: AddressScopedHistoryTableProps = {}) {
  const { t } = useTranslation();
  const portfolioAddress = usePortfolioAddress();
  const address = addressOverride === undefined
    ? portfolioAddress
    : addressOverride;
  const {
    data: orders,
    isInitialLoading,
    error,
    total,
    pageSize,
    fetchNextPage,
    hasNextPage,
    historyRowLimit,
    isFetchingNextPage,
  } = useOrderHistory(address, queryKeyScope);
  const {
    sort,
    setSortColumn,
    getNextDirection,
  } = useTableSort<OrderHistorySortColumn>({
    initialSort: {
      column: "time",
      direction: "desc",
    },
    defaultDirections: DEFAULT_ORDER_HISTORY_SORT_DIRECTIONS,
  });
  const sortedOrders = useSortedRows({
    rows: orders,
    sort,
    compareRows: compareOrderHistoryRows,
  });
  const csvExport = useMemo(
    () => ({
      filename: () =>
        buildTimestampedCsvFilename(["order-history", address]),
      fetchRows: async (signal?: AbortSignal) => {
        if (!address) return [];
        const rows = await getRecentUserOrderHistory(address, signal);
        return sortRows({
          rows,
          sort: {
            column: sort.column,
            direction: sort.direction,
          },
          compareRows: compareOrderHistoryRows,
        });
      },
      columns: [
        { header: t("Time"), value: (order: OrderHistoryItem) => formatHistoryTime(order.timestamp) },
        { header: t("Type"), value: (order: OrderHistoryItem) => t(getHistoryType(order)) },
        { header: t("Coin"), value: (order: OrderHistoryItem) => getDisplaySymbol(order.symbol) },
        { header: t("Direction"), value: (order: OrderHistoryItem) => t(getHistoryDirection(order).label) },
        { header: t("Size"), value: formatHistoryQuantity },
        {
          header: t("Filled Size"),
          value: (order: OrderHistoryItem) =>
            isFilledStatus(order.status) ? formatHistoryQuantity(order) : "--",
        },
        { header: t("Order Value"), value: (order: OrderHistoryItem) => formatOrderHistoryCsvValue(order, t) },
        { header: t("Price"), value: (order: OrderHistoryItem) => formatHistoryPriceText(order, t) },
        {
          header: t("Reduce Only"),
          value: (order: OrderHistoryItem) => t(getHistoryReduceOnly(order) ? "Yes" : "No"),
        },
        {
          header: t("Trigger Conditions"),
          value: (order: OrderHistoryItem) => formatHistoryTriggerText(order, t),
        },
        { header: t("TP/SL"), value: (order: OrderHistoryItem) => t(getHistoryTpSlLabel(order)) },
        { header: t("Status"), value: (order: OrderHistoryItem) => t(getHistoryStatus(order)) },
      ],
    }),
    [address, sort.column, sort.direction, t],
  );

  return (
    <ActivityState
      address={address}
      icon={Clock}
      emptyTitle="No Order History"
      emptySubtitle="Your Completed Orders Will Appear Here"
      isLoading={isInitialLoading}
      isEmpty={total === 0}
      error={error}
      fillAvailableSpace={fillAvailableSpace}
      label="Order History"
      data={sortedOrders}
      csvExport={csvExport}
      computeItemKey={(_, order) => `${order.id}-${order.timestamp}`}
      pageSize={pageSize}
      total={total}
      fetchNextPage={fetchNextPage}
      hasNextPage={hasNextPage}
      historyRowLimit={historyRowLimit}
      isFetchingNextPage={isFetchingNextPage}
      fixedHeaderContent={() => (
        <SortableHeaderRow
          columns={ORDER_HISTORY_COLUMNS}
          sort={sort}
          sortLabels={ORDER_HISTORY_SORT_LABELS}
          defaultDirections={DEFAULT_ORDER_HISTORY_SORT_DIRECTIONS}
          onSort={setSortColumn}
          getNextDirection={getNextDirection}
        />
      )}
      itemContent={(_, order) => <OrderHistoryCells order={order} />}
      mobileExpansionLabels={{
        expand: "Expand All Orders",
        collapse: "Collapse All Orders",
      }}
      mobileItemContent={(_, order, expansion) => (
        <MobileOrderHistoryCard
          order={order}
          expanded={expansion?.expanded}
          onExpandedChange={expansion?.setExpanded}
        />
      )}
    />
  );
}
