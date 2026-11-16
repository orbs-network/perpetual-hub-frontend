import { useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import {
  TableRow,
  TableHead,
} from "@/components/ui/table";
import { CancelAllOrdersModal } from "./CancelAllOrdersModal";
import { useUserAccount } from "@/hooks/useUserAccount";
import { usePortfolioAddress } from "@/hooks/usePortfolioAddress";
import { getDisplaySymbol } from "@/lib/utils";
import type { Order } from "@/types";
import { OrderCells, MobileOrderCard } from "./OrderRow";
import { ActivityState } from "./shared";
import { SortableColumnHead } from "./SortableColumnHead";
import {
  compareBigInt,
  compareText,
  useSortedRows,
  useTableSort,
  type SortDirection,
} from "./useSortableRows";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { isFullPositionTpSlOrder } from "@/lib/orderEditPermissions";
import {
  domainPriceToBigInt,
  formatNumber,
} from "@/utils/formatting";
import {
  formatOrderTypeLabel,
  formatUsdcAmount,
  getOrderValue,
  getTriggerConditionDirection,
  TABLE_HEADER_ROW_CLASS,
} from "./utils";
import { buildTimestampedCsvFilename } from "./csvExport";

type OrderSortColumn =
  | "time"
  | "type"
  | "coin"
  | "direction"
  | "size"
  | "originalSize"
  | "orderValue"
  | "price"
  | "reduceOnly"
  | "triggerConditions"
  | "tpSl"
  | "cancel";

const EMPTY_ORDERS: Order[] = [];
const DEFAULT_ORDER_SORT_DIRECTIONS: Record<OrderSortColumn, SortDirection> = {
  time: "desc",
  type: "asc",
  coin: "asc",
  direction: "asc",
  size: "desc",
  originalSize: "desc",
  orderValue: "desc",
  price: "desc",
  reduceOnly: "desc",
  triggerConditions: "asc",
  tpSl: "asc",
  cancel: "asc",
};

const ORDER_SORT_LABELS: Record<OrderSortColumn, string> = {
  time: "Time",
  type: "Type",
  coin: "Coin",
  direction: "Direction",
  size: "Size",
  originalSize: "Original Size",
  orderValue: "Order Value",
  price: "Price",
  reduceOnly: "Reduce Only",
  triggerConditions: "Trigger Conditions",
  tpSl: "TP/SL",
  cancel: "Cancel Action",
};

interface OrderColumn {
  column: OrderSortColumn;
  label: string;
}

const ORDER_COLUMNS: OrderColumn[] = [
  { column: "time", label: "Time" },
  { column: "type", label: "Type" },
  { column: "coin", label: "Coin" },
  { column: "direction", label: "Direction" },
  { column: "size", label: "Size" },
  { column: "originalSize", label: "Original Size" },
  { column: "orderValue", label: "Order Value" },
  { column: "price", label: "Price" },
  { column: "reduceOnly", label: "Reduce Only" },
  {
    column: "triggerConditions",
    label: "Trigger Conditions",
  },
  { column: "tpSl", label: "TP/SL" },
  { column: "cancel", label: "Cancel All" },
];

function getOrderDirectionLabel(order: Order) {
  const isBuy = order.side === "BUY";
  if (order.closePosition || order.reduceOnly) {
    return isBuy ? "Close Short" : "Close Long";
  }
  return isBuy ? "Buy Long" : "Short";
}

function getOrderTpSlLabel(order: Order) {
  if (!order.reduceOnly && !order.closePosition) return "--";
  if (order.orderType.startsWith("TAKE_PROFIT")) return "TP";
  if (order.orderType.startsWith("STOP")) return "SL";
  return "--";
}

function getOrderTriggerSortLabel(order: Order) {
  if (order.stopPrice <= 0n) return "N/A";
  return `${getTriggerConditionDirection(order)} ${order.stopPrice}`;
}

function compareOrdersByColumn(
  column: OrderSortColumn,
  left: Order,
  right: Order,
) {
  switch (column) {
    case "time":
      return left.timestamp - right.timestamp;
    case "type":
      return compareText(
        formatOrderTypeLabel(left.orderType),
        formatOrderTypeLabel(right.orderType),
      );
    case "coin":
      return (
        compareText(getDisplaySymbol(left.symbol), getDisplaySymbol(right.symbol)) ||
        compareText(left.symbol, right.symbol)
      );
    case "direction":
      return compareText(
        getOrderDirectionLabel(left),
        getOrderDirectionLabel(right),
      );
    case "size":
    case "originalSize":
      return compareBigInt(left.quantity, right.quantity);
    case "orderValue":
      return compareBigInt(getOrderValue(left), getOrderValue(right));
    case "price":
      return compareBigInt(left.price, right.price);
    case "reduceOnly":
      return Number(left.reduceOnly || left.closePosition) -
        Number(right.reduceOnly || right.closePosition);
    case "triggerConditions":
      return compareText(
        getOrderTriggerSortLabel(left),
        getOrderTriggerSortLabel(right),
      );
    case "tpSl":
      return compareText(getOrderTpSlLabel(left), getOrderTpSlLabel(right));
    case "cancel":
      return compareText(left.status, right.status) ||
        compareText(left.orderId, right.orderId);
    default:
      return 0;
  }
}

function CancelAllHeader({ hasOpenOrders }: { hasOpenOrders: boolean }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  return (
    <TableHead className="text-content-secondary">
      <button
        type="button"
        disabled={!hasOpenOrders}
        onClick={() => setIsOpen(true)}
        className="text-[12px] font-semibold hover:text-content transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-content-secondary"
      >
        {t("Cancel All")}</button>
      <CancelAllOrdersModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </TableHead>
  );
}

export function OrdersTable({ readOnly = false }: { readOnly?: boolean }) {
  const { t } = useTranslation();
  const address = usePortfolioAddress();
  const { data: userAccount, isLoading: isUserAccountLoading } = useUserAccount();
  const orders = userAccount?.orders ?? EMPTY_ORDERS;
  const hasOpenOrders = orders.length > 0;
  const {
    sort,
    setSortColumn,
    getNextDirection,
  } = useTableSort<OrderSortColumn>({
    initialSort: {
      column: "time",
      direction: "desc",
    },
    defaultDirections: DEFAULT_ORDER_SORT_DIRECTIONS,
  });
  const sortedOrders = useSortedRows({
    rows: orders,
    sort,
    compareRows: compareOrdersByColumn,
  });
  const csvExport = useMemo(
    () => ({
      filename: () =>
        buildTimestampedCsvFilename(["open-orders", address]),
      columns: [
        {
          header: t("Time"),
          value: (order: Order) => new Date(order.timestamp).toISOString(),
        },
        {
          header: t("Type"),
          value: (order: Order) => t(formatOrderTypeLabel(order.orderType)),
        },
        {
          header: t("Coin"),
          value: (order: Order) => getDisplaySymbol(order.symbol),
        },
        {
          header: t("Direction"),
          value: (order: Order) => t(getOrderDirectionLabel(order)),
        },
        {
          header: t("Size"),
          value: (order: Order) =>
            isFullPositionTpSlOrder(order)
              ? t("Close Position")
              : `${formatNumber(order.quantity, {
                  decimalScale: 8,
                  scaled: "quantity",
                })} ${getDisplaySymbol(order.symbol)}`,
        },
        {
          header: t("Original Size"),
          value: (order: Order) =>
            isFullPositionTpSlOrder(order)
              ? "--"
              : `${formatNumber(order.quantity, {
                  decimalScale: 8,
                  scaled: "quantity",
                })} ${getDisplaySymbol(order.symbol)}`,
        },
        {
          header: t("Order Value"),
          value: (order: Order) =>
            formatUsdcAmount(order.price > 0n ? getOrderValue(order) : undefined),
        },
        {
          header: t("Price"),
          value: (order: Order) =>
            order.price > 0n
              ? formatNumber(domainPriceToBigInt(order.price), {
                  decimalScale: 8,
                  scaled: "domainPrice",
                })
              : t("Market"),
        },
        {
          header: t("Reduce Only"),
          value: (order: Order) =>
            t(order.reduceOnly || order.closePosition ? "Yes" : "No"),
        },
        {
          header: t("Trigger Conditions"),
          value: (order: Order) =>
            order.stopPrice > 0n
              ? `${t("Price")} ${getTriggerConditionDirection(order)} ${formatNumber(
                  domainPriceToBigInt(order.stopPrice),
                  { decimalScale: 8, scaled: "domainPrice" },
                )}`
              : t("N/A"),
        },
        {
          header: t("TP/SL"),
          value: (order: Order) => t(getOrderTpSlLabel(order)),
        },
        { header: t("Status"), value: (order: Order) => order.status },
      ],
    }),
    [address, t],
  );

  return (
    <div className="pb-4 md:h-full md:min-h-0 md:pb-0">
      <ActivityState
        icon={ClipboardList}
        emptyTitle="No Open Orders"
        emptySubtitle="Place A Limit Order To See It Here"
        isLoading={isUserAccountLoading}
        isEmpty={orders.length === 0}
        error={null}
        label="Orders"
        data={sortedOrders}
        csvExport={csvExport}
        computeItemKey={(_, order) => `${order.orderId}-${order.timestamp}`}
        estimatedRowHeight={30}
        showTableHeaderWhenEmpty
        fixedHeaderContent={() => (
          <TableRow className={TABLE_HEADER_ROW_CLASS}>
            {ORDER_COLUMNS.filter(
              (column) => !(readOnly && column.column === "cancel"),
            ).map((col) =>
              col.column === "cancel" ? (
                <CancelAllHeader
                  key={col.column}
                  hasOpenOrders={hasOpenOrders}
                />
              ) : (
                <SortableColumnHead
                  key={col.column}
                  column={col.column}
                  label={col.label}
                  sort={sort}
                  sortLabel={ORDER_SORT_LABELS[col.column]}
                  onSort={setSortColumn}
                  defaultDirection={
                    DEFAULT_ORDER_SORT_DIRECTIONS[col.column]
                  }
                  nextDirection={getNextDirection(col.column)}
                  iconSize={12}
                />
              ),
            )}
          </TableRow>
        )}
        itemContent={(_, order) => (
          <OrderCells order={order} readOnly={readOnly} />
        )}
        mobileExpansionLabels={{
          expand: "Expand All Orders",
          collapse: "Collapse All Orders",
        }}
        mobileItemContent={(_, order, expansion) => (
          <MobileOrderCard
            order={order}
            readOnly={readOnly}
            expanded={expansion?.expanded}
            onExpandedChange={expansion?.setExpanded}
          />
        )}
      />
    </div>
  );
}
