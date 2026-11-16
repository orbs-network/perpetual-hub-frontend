import { useState } from "react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { TableCell } from "@/components/ui/table";
import {
  domainPriceToBigInt,
} from "@/utils/formatting";
import type { TradeItem } from "@/types";
import { SymbolSelectorButton } from "./SymbolSelectorButton";
import { cn, getDisplaySymbol } from "@/lib/utils";
import { MarketAmount } from "./MarketAmount";
import { HIDDEN_PNL_TEXT } from "@/lib/pnlPrivacy";
import { useUserPreferencesStore } from "@/stores/userPreferencesStore";
import {
  MobileCardShell,
  MobileCollapsedSummary,
  MobileExpandedFooter,
  MobileExpandedGrid,
  type MobileSummaryField,
} from "./MobileSummaryRow";
import {
  formatScaledUsdc,
  formatTradeClosedPnl,
  formatTradeTime,
  formatTradeValue,
  getTradeDirection,
  parseTradeScaled,
} from "./tradeHistoryFormatters";

interface TradeHistoryRowProps {
  trade: TradeItem;
}

interface MobileTradeCardProps extends TradeHistoryRowProps {
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

const TRADE_CELL_CLASS =
  "px-2 py-0 align-middle text-[12px] font-semibold text-content";
const TRADE_MUTED_CELL_CLASS = cn(TRADE_CELL_CLASS, "text-content");

export function MobileTradeCard({
  trade,
  expanded,
  onExpandedChange,
}: MobileTradeCardProps) {
  const { t } = useTranslation();
  const [localExpanded, setLocalExpanded] = useState(false);
  const isExpanded = expanded ?? localExpanded;
  const setExpanded = onExpandedChange ?? setLocalExpanded;
  const hidePnl = useUserPreferencesStore((state) => state.hidePnl);
  const direction = getTradeDirection(trade);
  const price = domainPriceToBigInt(trade.price);
  const quantity = parseTradeScaled(trade.quantity);
  const fee = parseTradeScaled(trade.fee);
  const closedPnlValue = hidePnl ? HIDDEN_PNL_TEXT : formatTradeClosedPnl(trade);
  const sizeValue = quantity
    ? (
        <MarketAmount
          amount={quantity}
          symbol={trade.symbol}
          scaled="quantity"
          suffix={` ${getDisplaySymbol(trade.symbol)}`}
        />
      )
    : "-";
  const summaryFields: [
    MobileSummaryField,
    MobileSummaryField,
    MobileSummaryField,
  ] = [
    {
      label: t("Coin"),
      value: (
        <SymbolSelectorButton
          symbol={trade.symbol}
          isClose={direction.label.startsWith("Close")}
          className="text-[12px] font-bold leading-[15px]"
        />
      ),
    },
    {
      label: t("Time"),
      value: formatTradeTime(trade.timestamp),
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
      value: price > 0n
        ? <MarketAmount amount={price} symbol={trade.symbol} scaled="domainPrice" />
        : "-",
    },
    {
      label: t("Trade Value"),
      value: formatTradeValue(trade),
    },
    {
      label: t("Fee"),
      value: formatScaledUsdc(fee),
    },
    {
      label: t("Closed PNL"),
      value: closedPnlValue,
    },
  ];

  return (
    <MobileCardShell>
      {!isExpanded ? (
        <MobileCollapsedSummary
          fields={summaryFields}
          onExpand={() => setExpanded(true)}
          expandLabel={t("Expand Trade Details")}
        />
      ) : (
        <>
          <MobileExpandedGrid fields={detailFields} />
          <MobileExpandedFooter
            onCollapse={() => setExpanded(false)}
            collapseLabel={t("Collapse Trade Details")}
          />
        </>
      )}
    </MobileCardShell>
  );
}

export function TradeHistoryCells({ trade }: TradeHistoryRowProps) {
  const { t } = useTranslation();
  const hidePnl = useUserPreferencesStore((state) => state.hidePnl);
  const direction = getTradeDirection(trade);
  const price = domainPriceToBigInt(trade.price);
  const quantity = parseTradeScaled(trade.quantity);
  const fee = parseTradeScaled(trade.fee);
  const closedPnlValue = hidePnl ? HIDDEN_PNL_TEXT : formatTradeClosedPnl(trade);

  return (
    <>
      <TableCell className={TRADE_CELL_CLASS}>
        {formatTradeTime(trade.timestamp)}
      </TableCell>

      <TableCell>
        <SymbolSelectorButton
          symbol={trade.symbol}
          isClose={direction.label.startsWith("Close")}
          className="font-semibold text-[12px]"
        />
      </TableCell>

      <TableCell className={TRADE_CELL_CLASS}>
        <span className={direction.className}>{t(direction.label)}</span>
      </TableCell>

      <TableCell className={TRADE_MUTED_CELL_CLASS}>
        {price > 0n ? <MarketAmount amount={price} symbol={trade.symbol} scaled="domainPrice" /> : "-"}
      </TableCell>

      <TableCell className={TRADE_MUTED_CELL_CLASS}>
        {quantity
          ? (
              <>
                <MarketAmount amount={quantity} symbol={trade.symbol} scaled="quantity" /> {getDisplaySymbol(trade.symbol)}
              </>
            )
          : "-"}
      </TableCell>

      <TableCell className={TRADE_MUTED_CELL_CLASS}>
        {formatTradeValue(trade)}
      </TableCell>

      <TableCell className={TRADE_MUTED_CELL_CLASS}>
        {formatScaledUsdc(fee)}
      </TableCell>

      <TableCell className={TRADE_CELL_CLASS}>
        {closedPnlValue}
      </TableCell>

    </>
  );
}
