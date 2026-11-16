import { useMemo, useState } from "react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { Pencil } from "lucide-react";
import { TableCell } from "@/components/ui/table";
import { getDisplaySymbol } from "@/lib/utils";
import type { Order } from "@/types";
import {
  computeOrderDistance,
  formatOrderTypeLabel,
  getTriggerConditionDirection,
} from "./utils";
import { useCancelOrder } from "@/hooks/mutations/useCancelOrder";
import { usePrice } from "@/hooks/useBinancePrices";
import {
  domainPriceToBigInt,
  domainPriceToDisplayNumber,
  formatTimestamp,
} from "@/utils/formatting";
import { EditOrderModal } from "./EditOrderModal";
import type { EditOrderMode } from "./editOrderUtils";
import { AuthGuardButton } from "@/components/AuthGuardButton";
import { SymbolSelectorButton } from "./SymbolSelectorButton";
import { formatUsdcAmount, getOrderValue } from "./utils";
import { MarketAmount } from "./MarketAmount";
import {
  canEditOrderPrice,
  canEditOrderSize,
  isFullPositionTpSlOrder,
} from "@/lib/orderEditPermissions";
import {
  MobileCardShell,
  MobileCollapsedSummary,
  MobileExpandedFooter,
  MobileExpandedGrid,
  type MobileSummaryField,
} from "./MobileSummaryRow";

interface OrderRowProps {
  order: Order;
  readOnly?: boolean;
}

interface MobileOrderCardProps extends OrderRowProps {
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

function formatDirection(order: Order): { label: string; className: string } {
  const isLong = order.side === "BUY";
  if (order.closePosition) {
    return {
      label: isLong ? "Close Short" : "Close Long",
      className: isLong ? "text-up" : "text-down",
    };
  }
  if (order.reduceOnly) {
    return {
      label: isLong ? "Reduce Short" : "Reduce Long",
      className: isLong ? "text-up" : "text-down",
    };
  }
  return {
    label: isLong ? "Open Long" : "Open Short",
    className: isLong ? "text-up" : "text-down",
  };
}

function formatDesktopDirection(order: Order): {
  label: string;
  className: string;
} {
  const isBuy = order.side === "BUY";

  if (order.closePosition || order.reduceOnly) {
    return {
      label: isBuy ? "Close Short" : "Close Long",
      className: isBuy ? "text-up" : "text-down",
    };
  }

  return {
    label: isBuy ? "Buy Long" : "Short",
    className: isBuy ? "text-up" : "text-down",
  };
}

function OrderPriceValue({ order }: { order: Order }) {
  const { t } = useTranslation();
  if (order.price <= 0n) return t("Market");
  return (
    <MarketAmount
      amount={domainPriceToBigInt(order.price)}
      symbol={order.symbol}
      scaled="domainPrice"
    />
  );
}

function ExecutionNotice({ order }: { order: Order }) {
  const { t } = useTranslation();
  const messages = {
    EXECUTING: "Execution in progress",
    ATTEMPT_FAILED: "Execution attempt failed. Cancel and place a new order to try again.",
    OUTCOME_UNKNOWN: "Execution outcome unresolved. Contact support before placing another order.",
    NO_MORE_ATTEMPTS: "Execution attempt completed. Cancel the remaining order to place a new one.",
    NO_FILL_RETRY_PENDING: "Not enough liquidity at your price. The order stays open and will be tried again automatically.",
    NO_FILL_ATTEMPTS_EXHAUSTED: "Liquidity at your price stayed too thin. Cancel and place a new order to try again.",
  };
  if (!order.executionStatus) return null;
  return <div className="mt-1 max-w-64 whitespace-normal text-[11px] font-normal text-content-secondary" role="status">{t(messages[order.executionStatus])}</div>;
}

function getTpSlLabel(order: Order) {
  if (!order.reduceOnly && !order.closePosition) return "--";
  if (order.orderType.startsWith("TAKE_PROFIT")) return "TP";
  if (order.orderType.startsWith("STOP")) return "SL";
  return "--";
}

function TriggerCondition({ order }: { order: Order }) {
  const { t } = useTranslation();
  if (order.stopPrice <= 0n) return t("N/A");
  return (
    <>
      {t("Price")} {getTriggerConditionDirection(order)}{" "}
      <MarketAmount
        amount={domainPriceToBigInt(order.stopPrice)}
        symbol={order.symbol}
        scaled="domainPrice"
      />
    </>
  );
}

function useOrderData(order: Order) {
  const currentPrice = usePrice(order.symbol)?.price || 0;
  const { mutate: cancelOrder, isPending: isCancelling } = useCancelOrder();

  const derived = useMemo(() => {
    const symbolShort = getDisplaySymbol(order.symbol);
    const triggerPrice =
      order.stopPrice > 0n
        ? domainPriceToDisplayNumber(order.stopPrice)
        : order.price > 0n
          ? domainPriceToDisplayNumber(order.price)
          : 0;
    const distance = computeOrderDistance(currentPrice, triggerPrice);
    return { symbolShort, triggerPrice, distance };
  }, [order.symbol, order.stopPrice, order.price, currentPrice]);

  return useMemo(() => {
    return { ...derived, currentPrice, cancelOrder, isCancelling };
  }, [derived, currentPrice, cancelOrder, isCancelling]);
}

export function MobileOrderCard({
  order,
  readOnly = false,
  expanded,
  onExpandedChange,
}: MobileOrderCardProps) {
  const { t } = useTranslation();
  const [localExpanded, setLocalExpanded] = useState(false);
  const isExpanded = expanded ?? localExpanded;
  const setExpanded = onExpandedChange ?? setLocalExpanded;
  const { symbolShort, cancelOrder, isCancelling, distance } = useOrderData(order);
  const direction = formatDirection(order);
  const [editOpen, setEditOpen] = useState(false);
  const canEditSize = !readOnly && canEditOrderSize(order);
  const isFullPositionProtection = isFullPositionTpSlOrder(order);
  const sizeValue = isFullPositionProtection ? (
    t("Close Position")
  ) : (
    <MarketAmount
      amount={order.quantity}
      symbol={order.symbol}
      scaled="quantity"
      suffix={` ${symbolShort}`}
    />
  );
  const summaryFields: [
    MobileSummaryField,
    MobileSummaryField,
    MobileSummaryField,
  ] = [
    {
      label: t("Coin"),
      value: (
        <SymbolSelectorButton
          symbol={order.symbol}
          isClose={direction.label.startsWith("Close")}
          className="text-[12px] font-bold leading-[15px]"
        >
          {symbolShort}
        </SymbolSelectorButton>
      ),
    },
    {
      label: t("Time"),
      value: formatTimestamp(order.timestamp),
    },
    {
      label: t("Size"),
      value: sizeValue,
    },
  ];
  const detailFields: MobileSummaryField[] = [
    ...summaryFields,
    {
      label: t("Direction"),
      value: t(direction.label),
      valueClassName: direction.className,
    },
    {
      label: t("Price"),
      value: <OrderPriceValue order={order} />,
    },
    {
      label: t("Trigger Conditions"),
      value: <TriggerCondition order={order} />,
      valueClassName: order.stopPrice > 0n
        ? "text-accent-tertiary"
        : undefined,
    },
    {
      label: t("Type"),
      value: formatOrderTypeLabel(order.orderType),
    },
    {
      label: t("Order Value"),
      value: formatUsdcAmount(order.price > 0n ? getOrderValue(order) : undefined),
    },
    {
      label: t("Reduce Only"),
      value: t(order.reduceOnly || order.closePosition ? "Yes" : "No"),
    },
    {
      label: t("TP/SL"),
      value: t(getTpSlLabel(order)),
    },
    {
      label: t("Distance"),
      value: distance
        ? `${distance.distance >= 0 ? "+" : ""}${distance.distance.toFixed(2)}%`
        : "-",
      valueClassName: distance?.colorClass,
    },
  ];

  return (
    <MobileCardShell>
      <ExecutionNotice order={order} />
      {!isExpanded ? (
        <MobileCollapsedSummary
          fields={summaryFields}
          onExpand={() => setExpanded(true)}
          expandLabel={t("Expand Order Details")}
        />
      ) : (
        <>
          <MobileExpandedGrid fields={detailFields} />
          <MobileExpandedFooter
            onCollapse={() => setExpanded(false)}
            collapseLabel={t("Collapse Order Details")}
          >
            {!readOnly ? (
              <div className="flex items-center gap-2">
                <AuthGuardButton className="w-auto" passthrough>
                  <button
                    onClick={() => cancelOrder(order.orderId)}
                    disabled={isCancelling}
                    className="rounded bg-down/10 px-3 py-1 text-[11px] font-medium transition-colors hover:bg-down/20"
                  >
                    {t("Cancel")}
                  </button>
                </AuthGuardButton>
                {canEditSize && (
                  <button
                    type="button"
                    onClick={() => setEditOpen(true)}
                    className="rounded bg-content-muted/10 px-3 py-1 text-[11px] font-semibold text-content-secondary transition-colors hover:bg-content-muted/20"
                  >
                    {t("Edit")}
                  </button>
                )}
              </div>
            ) : null}
          </MobileExpandedFooter>
        </>
      )}

      {!readOnly && editOpen && (
        <EditOrderModal
          order={order}
          isOpen
          mode="size"
          onClose={() => setEditOpen(false)}
        />
      )}
    </MobileCardShell>
  );
}

export function OrderCells({ order, readOnly = false }: OrderRowProps) {
  const { t } = useTranslation();
  const { symbolShort, cancelOrder, isCancelling } = useOrderData(order);
  const direction = formatDesktopDirection(order);
  const symbolTone = direction.label === "Buy Long" ? "content" : undefined;
  const [editMode, setEditMode] = useState<EditOrderMode | null>(null);
  const orderValue = order.price > 0n ? getOrderValue(order) : undefined;
  const canEditSize = !readOnly && canEditOrderSize(order);
  const canEditPrice = !readOnly && canEditOrderPrice(order);
  const isFullPositionProtection = isFullPositionTpSlOrder(order);
  const numericSizeValue = (
    <MarketAmount amount={order.quantity} symbol={order.symbol} scaled="quantity" />
  );
  const sizeValue = isFullPositionProtection
    ? t("Close Position")
    : numericSizeValue;
  const originalSizeValue = isFullPositionProtection ? "--" : numericSizeValue;

  return (
    <>
      <TableCell className="px-2 py-0 text-[12px] font-semibold text-content whitespace-nowrap">
        {formatTimestamp(order.timestamp)}
      </TableCell>

      <TableCell className="px-2 py-0 text-[12px] font-semibold text-content whitespace-nowrap">
        {formatOrderTypeLabel(order.orderType)}
        <ExecutionNotice order={order} />
      </TableCell>

      <TableCell>
        <SymbolSelectorButton
          symbol={order.symbol}
          isClose={direction.label.startsWith("Close")}
          tone={symbolTone}
          className="text-[12px] font-semibold"
        >
          {symbolShort}
        </SymbolSelectorButton>
      </TableCell>

      <TableCell className="px-2 py-0">
        <span className={`text-[12px] font-semibold whitespace-nowrap ${direction.className}`}>
          {t(direction.label)}
        </span>
      </TableCell>

      <TableCell className="px-2 py-0 text-[12px] font-semibold text-content">
        <span className="inline-flex items-center gap-1">
          {sizeValue}
          {canEditSize && (
            <button
              type="button"
              onClick={() => setEditMode("size")}
              aria-label={`${t("Edit")} ${symbolShort} ${t("order size")}`}
              className="text-accent-primary hover:text-accent-primary/80 transition-colors"
            >
              <Pencil size={13} strokeWidth={1.8} />
            </button>
          )}
        </span>
      </TableCell>

      <TableCell className="px-2 py-0 text-[12px] font-semibold text-content">
        {originalSizeValue}
      </TableCell>

      <TableCell className="px-2 py-0 text-[12px] font-semibold text-content whitespace-nowrap">
        {formatUsdcAmount(orderValue)}
      </TableCell>

      <TableCell className="px-2 py-0 text-[12px] font-semibold text-content">
        <span className="inline-flex items-center gap-1">
          <OrderPriceValue order={order} />
          {canEditPrice && (
            <button
              type="button"
              onClick={() => setEditMode("price")}
              aria-label={`${t("Edit")} ${symbolShort} ${t("order price")}`}
              className="text-accent-primary hover:text-accent-primary/80 transition-colors"
            >
              <Pencil size={13} strokeWidth={1.8} />
            </button>
          )}
        </span>
      </TableCell>

      <TableCell className="px-2 py-0 text-[12px] font-semibold text-content">
        {t(order.reduceOnly || order.closePosition ? "Yes" : "No")}
      </TableCell>

      <TableCell className="px-2 py-0 text-[12px] font-semibold text-content whitespace-nowrap">
        <TriggerCondition order={order} />
      </TableCell>

      <TableCell className="px-2 py-0 text-[12px] font-semibold text-content">
        {t(getTpSlLabel(order))}
      </TableCell>

      {!readOnly ? (
        <TableCell className="px-2 py-0">
          <AuthGuardButton className="w-auto" passthrough>
            <button
              type="button"
              onClick={() => cancelOrder(order.orderId)}
              disabled={isCancelling}
              className="text-[12px] font-semibold text-content-secondary transition-colors hover:text-content disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("Cancel")}
            </button>
          </AuthGuardButton>
          {editMode && (
            <EditOrderModal
              order={order}
              isOpen
              mode={editMode}
              onClose={() => setEditMode(null)}
            />
          )}
        </TableCell>
      ) : null}
    </>
  );
}
