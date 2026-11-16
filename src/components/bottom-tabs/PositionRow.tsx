import { getCollateralSymbol } from "@/utils/collateralDisplay";
import { useState } from "react";
import { ExternalLink, Pencil } from "lucide-react";
import { TableCell } from "@/components/ui/table";
import { ClosePositionModals, TpSlModal } from "./ClosePositionModals";
import {
  domainPriceToBigInt,
  formatNumber,
  formatTimestamp,
} from "@/utils/formatting";
import type { Position } from "@/types";
import type { Order } from "@/types";
import { usePosition } from "@/hooks/usePosition";
import { cn } from "@/lib/utils";
import { SymbolSelectorButton } from "./SymbolSelectorButton";
import { MarketAmount } from "./MarketAmount";
import { HIDDEN_PNL_TEXT } from "@/lib/pnlPrivacy";
import { useUserPreferencesStore } from "@/stores/userPreferencesStore";
import { PositionShareModal } from "./PositionShareModal";
import { useTranslation } from "@/hooks/useSafeTranslation";
import {
  MobileCardShell,
  MobileCollapsedSummary,
  MobileExpandedFooter,
  MobileExpandedGrid,
  type MobileSummaryField,
} from "./MobileSummaryRow";

interface PositionRowProps {
  position: Position;
  readOnly?: boolean;
}

const DESKTOP_CELL_CLASS =
  "px-2 py-0 align-middle text-[12px] leading-none text-content";
const DESKTOP_MUTED_CELL_CLASS = cn(
  DESKTOP_CELL_CLASS,
  "text-content",
);

function formatExitOrderLabel(
  order: Order | undefined,
  symbol: string,
  t: (value: string) => string,
) {
  if (!order) return t("None");
  const rawPrice = order.stopPrice > 0n ? order.stopPrice : order.price;
  const price = domainPriceToBigInt(rawPrice);
  if (price <= 0n) return t("Active");
  return <MarketAmount amount={price} symbol={symbol} scaled="domainPrice" prefix="$" />;
}

function formatMarginLabel(marginDisplay: string) {
  return marginDisplay === "-" ? "-" : `$${marginDisplay}`;
}

export function MobilePositionCard({
  position,
  readOnly = false,
}: PositionRowProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [tpSlOpen, setTpSlOpen] = useState(false);
  const hidePnl = useUserPreferencesStore((state) => state.hidePnl);
  const {
    isLong,
    absQuantity,
    pnl,
    funding,
    symbolShort,
    leverage,
    positionValue,
    marginDisplay,
    markPrice,
    takeProfitOrder,
    stopLossOrder,
  } = usePosition(position);
  const takeProfitLabel = formatExitOrderLabel(
    takeProfitOrder,
    position.symbol,
    t,
  );
  const stopLossLabel = formatExitOrderLabel(
    stopLossOrder,
    position.symbol,
    t,
  );
  const pnlColorClass = hidePnl
    ? "text-content-muted"
    : pnl
    ? pnl.isPositive
      ? "text-up"
      : "text-down"
    : "text-content-muted";
  const pnlDisplayText = hidePnl
    ? HIDDEN_PNL_TEXT
    : `${pnl?.formatted || "-"}${pnl?.pctStr || ""}`;
  const sizeValue = (
    <MarketAmount
      amount={absQuantity}
      symbol={position.symbol}
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
          symbol={position.symbol}
          className={cn(
            "text-[12px] font-bold leading-[15px]",
            isLong ? "text-up" : "text-down",
          )}
          isClose={!isLong}
        >
          {symbolShort}
        </SymbolSelectorButton>
      ),
    },
    {
      label: t("Time"),
      value: formatTimestamp(position.openTimestamp),
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
      value: isLong ? "Long" : "Short",
      valueClassName: isLong ? "text-up" : "text-down",
    },
    {
      label: t("PNL (ROE %)"),
      value: (
        <span className="inline-flex min-w-0 items-center gap-1">
          <span className="whitespace-nowrap">{pnlDisplayText}</span>
          <PositionShareModal
            trigger={
              <button
                type="button"
                aria-label={t("Share position PNL")}
                className="shrink-0 rounded p-0.5 text-accent-primary"
              >
                <ExternalLink
                  data-testid="position-share-trigger-icon"
                  size={14}
                  strokeWidth={2}
                />
              </button>
            }
            position={position}
            isLong={isLong}
            leverage={leverage}
            symbolShort={symbolShort}
            markPrice={markPrice}
            pnl={pnl}
            hidePnl={hidePnl}
          />
        </span>
      ),
      valueClassName: pnlColorClass,
    },
    {
      label: t("Entry Price"),
      value: (
        <MarketAmount
          amount={position.entryPrice}
          symbol={position.symbol}
          scaled="domainPrice"
          prefix="$"
        />
      ),
    },
    {
      label: t("Mark Price"),
      value: markPrice ? (
        <MarketAmount amount={markPrice} symbol={position.symbol} />
      ) : (
        "-"
      ),
      valueClassName: "text-accent-primary",
    },
    {
      label: t("Liq. Price"),
      value: position.liquidationPrice ? (
        <MarketAmount
          amount={position.liquidationPrice}
          symbol={position.symbol}
          scaled="domainPrice"
          prefix="$"
        />
      ) : (
        t("N/A")
      ),
      valueClassName: "text-accent-tertiary",
    },
    {
      label: t("Position Value"),
      value: `${formatNumber(positionValue, { decimalScale: 2 })} ${getCollateralSymbol()}`,
    },
    {
      label: t("Margin"),
      value: formatMarginLabel(marginDisplay),
    },
    {
      label: t("TP/SL"),
      value: (
        <>
          <span>{takeProfitOrder ? takeProfitLabel : "--"}</span>
          <span className="px-1 text-content-muted">/</span>
          <span>{stopLossOrder ? stopLossLabel : "--"}</span>
          {!readOnly ? (
            <button
              type="button"
              aria-label={t("Edit TP/SL")}
              onClick={() => setTpSlOpen(true)}
              className="ml-1 inline-flex shrink-0 align-middle text-accent-primary"
            >
              <Pencil size={13} strokeWidth={1.8} />
            </button>
          ) : null}
        </>
      ),
    },
    {
      label: t("Funding"),
      value: funding.formatted,
      valueClassName: funding.colorClass,
    },
  ];

  return (
    <MobileCardShell>
      {!expanded ? (
        <MobileCollapsedSummary
          fields={summaryFields}
          onExpand={() => setExpanded(true)}
          expandLabel={t("Expand Position Details")}
        />
      ) : (
        <>
          <MobileExpandedGrid fields={detailFields} />
          {!readOnly ? (
            <TpSlModal
              position={position}
              leverage={leverage}
              isOpen={tpSlOpen}
              onClose={() => setTpSlOpen(false)}
              existingTpOrder={takeProfitOrder}
              existingSlOrder={stopLossOrder}
            />
          ) : null}
          <MobileExpandedFooter
            onCollapse={() => setExpanded(false)}
            collapseLabel={t("Collapse Position Details")}
          >
            {!readOnly ? (
              <ClosePositionModals
                position={position}
                variant="link"
                labels="close"
              />
            ) : null}
          </MobileExpandedFooter>
        </>
      )}
    </MobileCardShell>
  );
}

export function PositionCells({
  position,
  readOnly = false,
}: PositionRowProps) {
  const { t } = useTranslation();
  const [tpSlOpen, setTpSlOpen] = useState(false);
  const hidePnl = useUserPreferencesStore((state) => state.hidePnl);
  const {
    isLong,
    absQuantity,
    pnl,
    funding,
    symbolShort,
    leverage,
    positionValue,
    marginDisplay,
    markPrice,
    takeProfitOrder,
    stopLossOrder,
  } = usePosition(position);
  const takeProfitLabel = formatExitOrderLabel(
    takeProfitOrder,
    position.symbol,
    t,
  );
  const stopLossLabel = formatExitOrderLabel(
    stopLossOrder,
    position.symbol,
    t,
  );
  const pnlColorClass = hidePnl
    ? "text-content-muted"
    : pnl
    ? pnl.isPositive
      ? "text-up"
      : "text-down"
    : "text-content-muted";
  const pnlDisplayText = hidePnl
    ? HIDDEN_PNL_TEXT
    : `${pnl?.formatted || "-"}${pnl?.pctStr || ""}`;
  const marginLabel = formatMarginLabel(marginDisplay);

  return (
    <>
      <TableCell
        className={cn(
          "relative overflow-hidden py-0 pl-3 pr-2 align-middle before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:content-['']",
          isLong
            ? "bg-gradient-to-r from-up/15 via-up/5 to-transparent before:bg-up"
            : "bg-gradient-to-r from-down/15 via-down/5 to-transparent before:bg-down",
        )}
      >
        <div className="relative flex min-w-0 items-center gap-1.5">
          <SymbolSelectorButton
            symbol={position.symbol}
            className="text-[12px] font-semibold"
            isClose={!isLong}
          >
            {symbolShort}
          </SymbolSelectorButton>
          <span className="text-[11px] font-semibold text-content-secondary">
            {leverage}x
          </span>
        </div>
      </TableCell>

      <TableCell
        className={cn(
          DESKTOP_CELL_CLASS,
          isLong ? "text-up" : "text-down",
        )}
      >
        <MarketAmount amount={absQuantity} symbol={position.symbol} scaled="quantity" /> {symbolShort}
      </TableCell>

      <TableCell className={cn(DESKTOP_CELL_CLASS)}>
        {formatNumber(positionValue, { decimalScale: 2 })} {getCollateralSymbol()}
      </TableCell>

      <TableCell className={DESKTOP_CELL_CLASS}>
        <MarketAmount amount={position.entryPrice} symbol={position.symbol} scaled="domainPrice" />
      </TableCell>

      <TableCell className={DESKTOP_MUTED_CELL_CLASS}>
        {markPrice ? <MarketAmount amount={markPrice} symbol={position.symbol} /> : "-"}
      </TableCell>

      <TableCell className={cn(DESKTOP_CELL_CLASS)}>
        <div className={cn("inline-flex items-center gap-1", pnlColorClass)}>
          <span>{pnlDisplayText}</span>
          <PositionShareModal
            trigger={
              <button
                type="button"
                aria-label={t("Share position PNL")}
                className="rounded p-0.5 text-accent-primary"
              >
                <ExternalLink
                  data-testid="position-share-trigger-icon"
                  size={14}
                  strokeWidth={2}
                />
              </button>
            }
            position={position}
            isLong={isLong}
            leverage={leverage}
            symbolShort={symbolShort}
            markPrice={markPrice}
            pnl={pnl}
            hidePnl={hidePnl}
          />
        </div>
      </TableCell>

      <TableCell className={DESKTOP_MUTED_CELL_CLASS}>
        {position.liquidationPrice
          ? <MarketAmount amount={position.liquidationPrice} symbol={position.symbol} scaled="domainPrice" />
          : "-"}
      </TableCell>

      <TableCell className={cn(DESKTOP_CELL_CLASS)}>
        {marginLabel}
      </TableCell>

      <TableCell
        className={cn(DESKTOP_CELL_CLASS, funding.colorClass)}
      >
        {funding.formatted}
      </TableCell>

      {!readOnly ? (
        <TableCell className="px-2 py-0 align-middle whitespace-nowrap">
          <ClosePositionModals position={position} variant="link" />
        </TableCell>
      ) : null}

      <TableCell className="px-2 py-0 text-left align-middle whitespace-nowrap">
        <div className="flex min-w-[116px] items-center justify-start gap-2">
          <span className="whitespace-nowrap text-[12px] font-semibold">
            <span
              className='text-content'
            >
              {takeProfitOrder ? takeProfitLabel : "--"}
            </span>
            <span className="px-1 text-content-muted">/</span>
            <span
              className='text-content'
            >
              {stopLossOrder ? stopLossLabel : "--"}
            </span>
          </span>
          {!readOnly ? (
            <button
              aria-label={t("Edit TP/SL")}
              onClick={() => setTpSlOpen(true)}
              className="p-0.5 text-content-secondary transition-colors hover:text-content"
            >
              <Pencil size={13} strokeWidth={1.8} />
            </button>
          ) : null}
        </div>
        {!readOnly ? (
          <TpSlModal
            position={position}
            leverage={leverage}
            isOpen={tpSlOpen}
            onClose={() => setTpSlOpen(false)}
            existingTpOrder={takeProfitOrder}
            existingSlOrder={stopLossOrder}
          />
        ) : null}
      </TableCell>

    </>
  );
}
