import { useState } from "react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { TableCell } from "@/components/ui/table";
import {
  domainPriceToBigInt,
} from "@/utils/formatting";
import type { OrderHistoryItem } from "@/types";
import {
  formatFundingPaymentAmount,
  formatUsdcAmount,
} from "./utils";
import { SymbolSelectorButton } from "./SymbolSelectorButton";
import { getDisplaySymbol } from "@/lib/utils";
import { MarketAmount } from "./MarketAmount";
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
  MobileCardShell,
  MobileCollapsedSummary,
  MobileExpandedFooter,
  MobileExpandedGrid,
  type MobileSummaryField,
} from "./MobileSummaryRow";

interface OrderHistoryRowProps {
  order: OrderHistoryItem;
}

interface MobileOrderHistoryCardProps extends OrderHistoryRowProps {
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

const HISTORY_CELL_CLASS =
  "px-2 py-0 text-[12px] font-semibold text-content whitespace-nowrap";

function formatOrderHistoryValue(order: OrderHistoryItem, t: (value: string) => string) {
  const value = getOrderHistoryValue(order);
  const price = domainPriceToBigInt(order.price);

  if (getHistoryType(order) === "Funding") return formatFundingPaymentAmount(value);
  if (price <= 0n) return getHistoryType(order) === "Market" ? t("Market") : "--";
  return formatUsdcAmount(value);
}

function formatHistoryPrice(
  order: OrderHistoryItem,
  t: (value: string) => string,
) {
  const price = domainPriceToBigInt(order.price);
  if (price <= 0n) return getHistoryType(order) === "Market" ? t("Market") : "--";
  return <MarketAmount amount={price} symbol={order.symbol} scaled="domainPrice" />;
}

function HistoryTriggerCondition({ order }: { order: OrderHistoryItem }) {
  const { t } = useTranslation();
  const stopPrice = getHistoryTriggerCondition(order);
  const direction = getHistoryTriggerDirection(order);
  if (stopPrice === null || direction === null) return t("N/A");
  return (
    <>
      {t("Price")} {direction}{" "}
      <MarketAmount amount={domainPriceToBigInt(stopPrice.toString())} symbol={order.symbol} scaled="domainPrice" />
    </>
  );
}

export function OrderHistoryCells({ order }: OrderHistoryRowProps) {
  const { t } = useTranslation();
  const direction = getHistoryDirection(order);
  const symbolTone = direction.label === "Buy Long" ? "content" : undefined;
  const filled = isFilledStatus(order.status);
  const quantity = parseHistoryScaled(order.quantity);
  const size = quantity > 0n
    ? <MarketAmount amount={quantity} symbol={order.symbol} scaled="quantity" />
    : "--";

  return (
    <>
      <TableCell className={HISTORY_CELL_CLASS}>
        {formatHistoryTime(order.timestamp)}
      </TableCell>

      <TableCell className={HISTORY_CELL_CLASS}>
        {t(getHistoryType(order))}
      </TableCell>

      <TableCell>
        {order.symbol ? (
          <SymbolSelectorButton
            symbol={order.symbol}
            isClose={direction.label.startsWith("Close")}
            tone={symbolTone}
            className="text-[12px] font-semibold"
          >
            {getDisplaySymbol(order.symbol)}
          </SymbolSelectorButton>
        ) : (
          <span className="text-[12px] font-semibold text-content">--</span>
        )}
      </TableCell>

      <TableCell className={HISTORY_CELL_CLASS}>
        <span className={direction.className}>{t(direction.label)}</span>
      </TableCell>

      <TableCell className={HISTORY_CELL_CLASS}>
        {size}
      </TableCell>

      <TableCell className={HISTORY_CELL_CLASS}>
        {filled ? size : "--"}
      </TableCell>

      <TableCell className={HISTORY_CELL_CLASS}>
        {formatOrderHistoryValue(order, t)}
      </TableCell>

      <TableCell className={HISTORY_CELL_CLASS}>
        {formatHistoryPrice(order, t)}
      </TableCell>

      <TableCell className={HISTORY_CELL_CLASS}>
        {t(direction.label.startsWith("Close") || order.operationType === "LIQUIDATION" ? "Yes" : "No")}
      </TableCell>

      <TableCell className={HISTORY_CELL_CLASS}>
        <HistoryTriggerCondition order={order} />
      </TableCell>

      <TableCell className={HISTORY_CELL_CLASS}>
        {t(getHistoryTpSlLabel(order))}
      </TableCell>

      <TableCell className={HISTORY_CELL_CLASS}>
        {getHistoryStatus(order)}
      </TableCell>
    </>
  );
}

export function MobileOrderHistoryCard({
  order,
  expanded,
  onExpandedChange,
}: MobileOrderHistoryCardProps) {
  const { t } = useTranslation();
  const [localExpanded, setLocalExpanded] = useState(false);
  const isExpanded = expanded ?? localExpanded;
  const setExpanded = onExpandedChange ?? setLocalExpanded;
  const direction = getHistoryDirection(order);
  const symbolTone = direction.label === "Buy Long" ? "content" : undefined;
  const quantity = parseHistoryScaled(order.quantity);
  const size =
    quantity > 0n
      ? (
          <MarketAmount
            amount={quantity}
            symbol={order.symbol}
            scaled="quantity"
            suffix={` ${getDisplaySymbol(order.symbol)}`}
          />
        )
      : "--";
  const filled = isFilledStatus(order.status);
  const coinValue = order.symbol ? (
    <SymbolSelectorButton
      symbol={order.symbol}
      isClose={direction.label.startsWith("Close")}
      tone={symbolTone}
      className="text-[12px] font-bold leading-[15px]"
    >
      {getDisplaySymbol(order.symbol)}
    </SymbolSelectorButton>
  ) : (
    "--"
  );
  const summaryFields: [
    MobileSummaryField,
    MobileSummaryField,
    MobileSummaryField,
  ] = [
    {
      label: t("Coin"),
      value: coinValue,
    },
    {
      label: t("Time"),
      value: formatHistoryTime(order.timestamp),
    },
    {
      label: t("Type"),
      value: t(getHistoryType(order)),
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
      value: formatHistoryPrice(order, t),
    },
    {
      label: t("Trigger Conditions"),
      value: <HistoryTriggerCondition order={order} />,
    },
    {
      label: t("Size"),
      value: size,
    },
    {
      label: t("Filled Size"),
      value: filled ? size : "--",
    },
    {
      label: t("TP/SL"),
      value: t(getHistoryTpSlLabel(order)),
    },
    {
      label: t("Status"),
      value: getHistoryStatus(order),
    },
  ];

  return (
    <MobileCardShell>
      {!isExpanded ? (
        <MobileCollapsedSummary
          fields={summaryFields}
          onExpand={() => setExpanded(true)}
          expandLabel={t("Expand History Details")}
        />
      ) : (
        <>
          <MobileExpandedGrid fields={detailFields} />
          <MobileExpandedFooter
            onCollapse={() => setExpanded(false)}
            collapseLabel={t("Collapse History Details")}
          />
        </>
      )}
    </MobileCardShell>
  );
}
