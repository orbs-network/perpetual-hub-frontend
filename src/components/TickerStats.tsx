import { useEffect, useRef, useState, type ReactNode } from "react";

import { TooltipLabel } from "@/components/ui/tooltip-label";
import { usePrice } from "@/hooks/useBinancePrices";
import {
  useSelectedSymbolLeverageInfo,
  useTradeSymbol,
} from "@/hooks/useSelectTradeSymbol";
import { cn } from "@/lib/utils";
import {
  amountScaleToDisplayNumber,
  formatNumber,
} from "@/utils/formatting";
import { useFormatSymbolAmount } from "@/hooks/useFormatting";
import { getChangeSummary } from "./TickerStats.helpers";
import { useTranslation } from "@/hooks/useSafeTranslation";

function TickerStat({
  label,
  value,
  valueClassName,
  tooltip,
  className,
  labelClassName,
}: {
  label: ReactNode;
  value: ReactNode;
  valueClassName?: string;
  tooltip?: string;
  className?: string;
  labelClassName?: string;
}) {
  const { t } = useTranslation();
  const hasLabel =
    label !== undefined && label !== null && label !== false && label !== "";
  const labelNode = typeof label === "string" ? t(label) : label;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {hasLabel && (
        tooltip ? (
          <TooltipLabel
            tooltip={tooltip}
            side="bottom"
            className={cn(
              "text-[12px] text-content-secondary leading-none",
              labelClassName,
            )}
          >
            <span className="w-fit">{labelNode}</span>
          </TooltipLabel>
        ) : (
          <span
            className={cn(
              "text-[12px] text-content-secondary leading-none font-medium",
              labelClassName,
            )}
          >
            {labelNode}
          </span>
        )
      )}
      <span
        className={cn("text-[12px] leading-none text-content font-semibold", valueClassName)}
      >
        {value}
      </span>
    </div>
  );
}

const FLASH_DURATION = 400;

export function MarkPriceStat({
  hideLabel = false,
  className,
}: {
  hideLabel?: boolean;
  className?: string;
}) {
  const { symbol, market } = useTradeSymbol();
  const priceData = usePrice(symbol);
  const price = priceData?.markPrice ?? priceData?.price ?? null;
  const pricePrecision = market?.pricePrecision ?? 2;
  const prevPriceRef = useRef<number | null>(null);
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (price === null) return;
    const prev = prevPriceRef.current;
    prevPriceRef.current = price;
    if (prev === null || prev === price) return;

    const el = spanRef.current;
    if (!el) return;

    const color =
      price > prev ? "rgb(var(--color-up))" : "rgb(var(--color-down))";

    el.style.transition = "none";
    el.style.color = color;
    void el.offsetHeight;
    el.style.transition = `color ${FLASH_DURATION}ms ease-out`;
    el.style.color = "";
  }, [price]);

  return (
    <TickerStat
      label={hideLabel ? undefined : "Mark"}
      tooltip={
        hideLabel
          ? undefined
          : "Used for margining, computing unrealized PNL, liquidations and triggering TP/SL orders."
      }
      value={
        <span
          ref={spanRef}
          className={cn(
            "text-[12px] font-medium leading-none text-content",
            className,
          )}
        >
          {price !== null
            ? formatNumber(price, { decimalScale: pricePrecision })
            : "--"}
        </span>
      }
    />
  );
}

const MarkOracleStat = () => {
  const { symbol, market } = useTradeSymbol();
  const priceData = usePrice(symbol);
  const pricePrecision = market?.pricePrecision ?? 2;
  const markPrice = priceData?.markPrice ?? priceData?.price;
  const oraclePrice = priceData?.price;
  const hasPrices = markPrice !== undefined && oraclePrice !== undefined;
  const markColorClass =
    hasPrices && markPrice < oraclePrice ? "text-down" : "text-content";

  return (
    <TickerStat
      label="Mark / Oracle"
      tooltip="Mark price is used for margining, unrealized PNL, liquidations and TP/SL triggers. Oracle price is the reference market price."
      value={
        hasPrices ? (
          <>
            <span className={markColorClass}>
              {formatNumber(markPrice, { decimalScale: pricePrecision })}
            </span>
            <span> / {formatNumber(oraclePrice, { decimalScale: pricePrecision })}</span>
          </>
        ) : (
          "-- / --"
        )
      }
    />
  );
};

export function FundingCountdown({
  nextFundingTime,
  className,
}: {
  nextFundingTime?: number;
  className?: string;
}) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!nextFundingTime) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [nextFundingTime]);

  if (!nextFundingTime) {
    return <span className={cn("text-content", className)}>--:--:--</span>;
  }

  const diff = Math.max(0, nextFundingTime - now);
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);

  return (
    <span className={cn("text-content", className)}>
      {`${String(hours).padStart(2, "0")}:${String(minutes).padStart(
        2,
        "0",
      )}:${String(seconds).padStart(2, "0")}`}
    </span>
  );
}

const VolumeStat = () => {
  const { symbol } = useTradeSymbol();
  const priceData = usePrice(symbol);
  const format = useFormatSymbolAmount();
  return (
    <TickerStat
      label="24h Volume"
      value={priceData ? `$${format(priceData.volume24h, symbol)}` : "--"}
    />
  );
};

const OpenInterestStat = () => {
  const { data: leverageInfo } = useSelectedSymbolLeverageInfo();
  const openInterest = leverageInfo?.aggregateNotional
    ? amountScaleToDisplayNumber(leverageInfo.aggregateNotional)
    : undefined;

  return (
    <TickerStat
      label="Open Interest"
      tooltip="The total notional size of open positions on this market."
      value={
        openInterest !== undefined
          ? `$${formatNumber(openInterest, { decimalScale: 2 })}`
          : "--"
      }
    />
  );
};

const FundingStat = () => {
  const { symbol } = useTradeSymbol();
  const priceData = usePrice(symbol);
  return (
    <TickerStat
      label="Funding / Countdown"
      value={
        priceData?.fundingRate != null ? (
          <>
            <span
              className={priceData.fundingRate >= 0 ? "text-up" : "text-down"}
            >
              {(priceData.fundingRate * 100).toFixed(4)}%
            </span>
            <span className="mx-1 text-content"></span>
            <FundingCountdown nextFundingTime={priceData.nextFundingTime} />
          </>
        ) : (
          "--%"
        )
      }
      tooltip="The funding rate for the current period at which longs pay shorts (if negative, shorts pay longs). There are no fees associated with funding, which is a peer-to-peer transfer between users to push prices towards the spot price."
    />
  );
};

const ChangeStat = ({ hideLabel = false }: { hideLabel?: boolean }) => {
  const { symbol } = useTradeSymbol();
  const priceData = usePrice(symbol);
  const summary = getChangeSummary({
    price: priceData?.price,
    priceChangePercent: priceData?.priceChangePercent,
  });

  return (
    <TickerStat
      label={hideLabel ? undefined : "24h Change"}
      value={
        <span className={cn(summary?.className ?? "text-content-muted")}>
          {summary?.label ?? "-- / --"}
        </span>
      }
    />
  );
};

const TickerStats = () => {
  return <></>;
};

TickerStats.MarkPriceStat = MarkPriceStat;
TickerStats.MarkOracleStat = MarkOracleStat;
TickerStats.FundingStat = FundingStat;
TickerStats.ChangeStat = ChangeStat;
TickerStats.VolumeStat = VolumeStat;
TickerStats.OpenInterestStat = OpenInterestStat;

export default TickerStats;
