import { getCollateralSymbol } from "@/utils/collateralDisplay";
import { useCallback, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { TableHead, TableRow } from "@/components/ui/table";
import { useUserAccount } from "@/hooks/useUserAccount";
import { usePortfolioAddress } from "@/hooks/usePortfolioAddress";
import { useAllPrices } from "@/hooks/useBinancePrices";
import { useTeeConfig } from "@/hooks/useTeeConfig";
import { calculatePositionPnL, getDisplaySymbol } from "@/lib/utils";
import type { Order, Position, PriceData } from "@/types";
import {
  calculatePositionInitialMargin,
  calculatePositionNotional,
  DEFAULT_TRADING_FEE_RATE_BPS,
  resolveFeeRateBps,
  resolvePositionLeverage,
  resolvePositionPrice,
} from "@/lib/margin";
import { PositionCells, MobilePositionCard } from "./PositionRow";
import { ActivityState } from "./shared";
import { getFundingDisplayAmount, TABLE_HEADER_ROW_CLASS } from "./utils";
import { SortableColumnHead } from "./SortableColumnHead";
import {
  compareBigInt,
  compareText,
  useSortedRows,
  useTableSort,
  type SortDirection,
} from "./useSortableRows";
import { CloseAllPositionsModal } from "./ClosePositionModals/CloseAllPositionsModal";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { isLiveFullPositionExitOrder } from "@/lib/positionExitOrders";
import { selectPositionExitOrders } from "@/lib/positionExitOrders";
import { HIDDEN_PNL_TEXT } from "@/lib/pnlPrivacy";
import { useUserPreferencesStore } from "@/stores/userPreferencesStore";
import {
  domainPriceToBigInt,
  formatNumber,
  formatPnL,
  toDomainPrice,
} from "@/utils/formatting";
import { formatFunding } from "./utils";
import { buildTimestampedCsvFilename } from "./csvExport";

type PositionSortColumn =
  | "time"
  | "coin"
  | "size"
  | "positionValue"
  | "entryPrice"
  | "markPrice"
  | "pnl"
  | "liquidationPrice"
  | "margin"
  | "funding"
  | "tpSl";

const EMPTY_POSITIONS: Position[] = [];
const DEFAULT_POSITION_SORT_DIRECTIONS: Record<
  PositionSortColumn,
  SortDirection
> = {
  time: "desc",
  coin: "asc",
  size: "desc",
  positionValue: "desc",
  entryPrice: "desc",
  markPrice: "desc",
  pnl: "desc",
  liquidationPrice: "desc",
  margin: "desc",
  funding: "desc",
  tpSl: "desc",
};

const POSITION_SORT_LABELS: Record<PositionSortColumn, string> = {
  time: "Time",
  coin: "Coin",
  size: "Size",
  positionValue: "Position Value",
  entryPrice: "Entry Price",
  markPrice: "Mark Price",
  pnl: "PNL",
  liquidationPrice: "Liquidation Price",
  margin: "Margin",
  funding: "Funding",
  tpSl: "TP/SL",
};

interface SortablePositionColumn {
  column: PositionSortColumn;
  label: string;
  tooltip?: string;
}

interface ActionPositionColumn {
  action: "closeAll";
  label: string;
}

type PositionColumn = SortablePositionColumn | ActionPositionColumn;

const POSITION_COLUMNS: PositionColumn[] = [
  { column: "coin", label: "Coin" },
  { column: "size", label: "Size" },
  { column: "positionValue", label: "Position Value" },
  { column: "entryPrice", label: "Entry Price" },
  { column: "markPrice", label: "Mark Price" },
  {
    column: "pnl",
    label: "PNL (ROE %)",
    tooltip: "Net profit & loss based on mark price minus the opening fee",
  },
  {
    column: "liquidationPrice",
    label: "Liq. Price",
    tooltip: "Estimated liquidation price",
  },
  {
    column: "margin",
    label: "Margin",
    tooltip: "Current initial margin for this position",
  },
  {
    column: "funding",
    label: "Funding",
    tooltip: "Accumulated funding payments",
  },
  { action: "closeAll", label: "Close All" },
  { column: "tpSl", label: "TP/SL" },
];

function absBigInt(value: bigint) {
  return value >= 0n ? value : -value;
}

function getPositionValue(
  position: Position,
  prices: Record<string, PriceData>,
) {
  return calculatePositionNotional(
    position,
    resolvePositionPrice(prices, position.symbol),
  );
}

function getScaledMarkPrice(
  position: Position,
  prices: Record<string, PriceData>,
) {
  const markPrice = resolvePositionPrice(prices, position.symbol);
  if (markPrice && markPrice > 0) {
    return toDomainPrice(markPrice);
  }
  return position.currentPrice ?? 0n;
}

function getPositionPnlValue(
  position: Position,
  prices: Record<string, PriceData>,
  leverage: number,
  feeRateBps: number,
) {
  const markPrice = resolvePositionPrice(prices, position.symbol);
  if (!markPrice) return position.unrealizedPnL ?? 0n;
  return calculatePositionPnL(position, markPrice, feeRateBps, leverage).value;
}

function getActiveExitOrderCount(position: Position, orders: Order[]) {
  return orders.filter((order) =>
    isLiveFullPositionExitOrder(order, position.symbol),
  ).length;
}

function formatPositionPrice(value?: bigint) {
  if (!value || value <= 0n) return "-";
  return formatNumber(value, { decimalScale: 8, scaled: "domainPrice" });
}

function formatPositionExitOrder(order?: Order) {
  if (!order) return "--";
  const rawPrice = order.stopPrice > 0n ? order.stopPrice : order.price;
  const price = domainPriceToBigInt(rawPrice);
  return price > 0n ? formatPositionPrice(price) : "Active";
}

function CloseAllHeader({
  hasOpenPositions,
}: {
  hasOpenPositions: boolean;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <TableHead className="text-content-secondary">
      <button
        type="button"
        disabled={!hasOpenPositions}
        onClick={() => setIsOpen(true)}
        className="text-[12px] font-semibold hover:text-content transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-content-secondary"
      >
        {t("Close All")}</button>
      <CloseAllPositionsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </TableHead>
  );
}

export function PositionsTable({ readOnly = false }: { readOnly?: boolean }) {
  const { t } = useTranslation();
  const address = usePortfolioAddress();
  const { data: userAccount, isLoading: isUserAccountLoading } = useUserAccount();
  const { data: prices = {} } = useAllPrices();
  const { data: teeConfig } = useTeeConfig();
  const hidePnl = useUserPreferencesStore((state) => state.hidePnl);
  const positions = userAccount?.positions ?? EMPTY_POSITIONS;
  const hasOpenPositions = positions.length > 0;
  const {
    sort,
    setSortColumn,
    getNextDirection,
  } = useTableSort<PositionSortColumn>({
    initialSort: {
      column: "time",
      direction: "desc",
    },
    defaultDirections: DEFAULT_POSITION_SORT_DIRECTIONS,
  });
  const comparePositions = useCallback(
    (column: PositionSortColumn, left: Position, right: Position) => {
      const feeRateBps =
        resolveFeeRateBps(teeConfig, userAccount?.feeTier ?? 0) ??
        DEFAULT_TRADING_FEE_RATE_BPS;
      const leftLeverage = resolvePositionLeverage(
        left.symbol,
        userAccount?.leveragePreferences,
        undefined,
        teeConfig,
      );
      const rightLeverage = resolvePositionLeverage(
        right.symbol,
        userAccount?.leveragePreferences,
        undefined,
        teeConfig,
      );

      switch (column) {
        case "time":
          return left.openTimestamp - right.openTimestamp;
        case "coin":
          return (
            compareText(getDisplaySymbol(left.symbol), getDisplaySymbol(right.symbol)) ||
            compareText(left.symbol, right.symbol)
          );
        case "size":
          return compareBigInt(
            absBigInt(left.quantity),
            absBigInt(right.quantity),
          );
        case "positionValue":
          return compareBigInt(
            getPositionValue(left, prices),
            getPositionValue(right, prices),
          );
        case "entryPrice":
          return compareBigInt(left.entryPrice, right.entryPrice);
        case "markPrice":
          return compareBigInt(
            getScaledMarkPrice(left, prices),
            getScaledMarkPrice(right, prices),
          );
        case "pnl":
          return compareBigInt(
            getPositionPnlValue(left, prices, leftLeverage, feeRateBps),
            getPositionPnlValue(right, prices, rightLeverage, feeRateBps),
          );
        case "liquidationPrice":
          return compareBigInt(
            left.liquidationPrice ?? 0n,
            right.liquidationPrice ?? 0n,
          );
        case "margin":
          return compareBigInt(
            calculatePositionInitialMargin(
              left,
              leftLeverage,
              resolvePositionPrice(prices, left.symbol),
            ),
            calculatePositionInitialMargin(
              right,
              rightLeverage,
              resolvePositionPrice(prices, right.symbol),
            ),
          );
        case "funding":
          return compareBigInt(
            getFundingDisplayAmount(left.accumulatedFunding),
            getFundingDisplayAmount(right.accumulatedFunding),
          );
        case "tpSl":
          return getActiveExitOrderCount(left, userAccount?.orders ?? []) -
            getActiveExitOrderCount(right, userAccount?.orders ?? []);
        default:
          return 0;
      }
    },
    [
      prices,
      teeConfig,
      userAccount?.feeTier,
      userAccount?.leveragePreferences,
      userAccount?.orders,
    ],
  );
  const sortedPositions = useSortedRows({
    rows: positions,
    sort,
    compareRows: comparePositions,
  });
  const csvExport = useMemo(
    () => ({
      filename: () =>
        buildTimestampedCsvFilename(["positions", address]),
      columns: [
        {
          header: t("Time"),
          value: (position: Position) =>
            new Date(position.openTimestamp).toISOString(),
        },
        {
          header: t("Coin"),
          value: (position: Position) => getDisplaySymbol(position.symbol),
        },
        {
          header: t("Direction"),
          value: (position: Position) => t(position.quantity >= 0n ? "Long" : "Short"),
        },
        {
          header: t("Leverage"),
          value: (position: Position) =>
            `${resolvePositionLeverage(
              position.symbol,
              userAccount?.leveragePreferences,
              undefined,
              teeConfig,
            )}x`,
        },
        {
          header: t("Size"),
          value: (position: Position) =>
            `${formatNumber(absBigInt(position.quantity), {
              decimalScale: 8,
              scaled: "quantity",
            })} ${getDisplaySymbol(position.symbol)}`,
        },
        {
          header: t("Position Value"),
          value: (position: Position) =>
            `${formatNumber(getPositionValue(position, prices), {
              decimalScale: 2,
              scaled: "price",
            })} ${getCollateralSymbol()}`,
        },
        {
          header: t("Entry Price"),
          value: (position: Position) => formatPositionPrice(position.entryPrice),
        },
        {
          header: t("Mark Price"),
          value: (position: Position) =>
            formatPositionPrice(getScaledMarkPrice(position, prices)),
        },
        {
          header: t("PNL (ROE %)"),
          value: (position: Position) => {
            if (hidePnl) return HIDDEN_PNL_TEXT;
            const leverage = resolvePositionLeverage(
              position.symbol,
              userAccount?.leveragePreferences,
              undefined,
              teeConfig,
            );
            const feeRateBps =
              resolveFeeRateBps(teeConfig, userAccount?.feeTier ?? 0) ??
              DEFAULT_TRADING_FEE_RATE_BPS;
            const markPrice = resolvePositionPrice(prices, position.symbol);
            if (!markPrice) return formatPnL(position.unrealizedPnL ?? 0n).value;
            const pnl = calculatePositionPnL(
              position,
              markPrice,
              feeRateBps,
              leverage,
            );
            return `${pnl.formatted}${pnl.pctStr}`;
          },
        },
        {
          header: t("Liq. Price"),
          value: (position: Position) =>
            formatPositionPrice(position.liquidationPrice),
        },
        {
          header: t("Margin"),
          value: (position: Position) => {
            const leverage = resolvePositionLeverage(
              position.symbol,
              userAccount?.leveragePreferences,
              undefined,
              teeConfig,
            );
            return `$${formatNumber(
              calculatePositionInitialMargin(
                position,
                leverage,
                resolvePositionPrice(prices, position.symbol),
              ),
              { decimalScale: 2, scaled: "price" },
            )}`;
          },
        },
        {
          header: t("Funding"),
          value: (position: Position) =>
            formatFunding(position.accumulatedFunding).formatted,
        },
        {
          header: t("TP/SL"),
          value: (position: Position) => {
            const { takeProfitOrder, stopLossOrder } = selectPositionExitOrders(
              userAccount?.orders,
              position.symbol,
            );
            return `${formatPositionExitOrder(takeProfitOrder)} / ${formatPositionExitOrder(stopLossOrder)}`;
          },
        },
      ],
    }),
    [
      address,
      hidePnl,
      prices,
      t,
      teeConfig,
      userAccount?.feeTier,
      userAccount?.leveragePreferences,
      userAccount?.orders,
    ],
  );
  return (
    <ActivityState
      icon={BarChart3}
      emptyTitle="No Open Positions Yet"
      emptySubtitle="Open A Trade To See Your Positions Here"
      isLoading={isUserAccountLoading}
      isEmpty={userAccount?.positions.length === 0}
      error={null}
      label="Positions"
      data={sortedPositions}
      csvExport={csvExport}
      computeItemKey={(_, position) =>
        `${position.symbol}-${position.quantity >= 0n ? "LONG" : "SHORT"}-${position.openTimestamp}`
      }
      estimatedRowHeight={30}
      rowClassName="border-y border-edge/60 bg-surface/50 hover:bg-hover/30"
      showTableHeaderWhenEmpty
      fixedHeaderContent={() => (
        <TableRow className={TABLE_HEADER_ROW_CLASS}>
          {POSITION_COLUMNS.filter(
            (column) => !(readOnly && "action" in column),
          ).map((column) => (
            "action" in column ? (
              <CloseAllHeader
                key={column.action}
                hasOpenPositions={hasOpenPositions}
              />
            ) : (
              <SortableColumnHead
                key={column.column}
                column={column.column}
                label={column.label}
                sort={sort}
                sortLabel={POSITION_SORT_LABELS[column.column]}
                onSort={setSortColumn}
                defaultDirection={
                  DEFAULT_POSITION_SORT_DIRECTIONS[column.column]
                }
                nextDirection={getNextDirection(column.column)}
                tooltip={column.tooltip}
                iconSize={12}
              />
            )
          ))}
        </TableRow>
      )}
      itemContent={(_, position) => (
        <PositionCells position={position} readOnly={readOnly} />
      )}
      mobileItemContent={(_, position) => (
        <MobilePositionCard position={position} readOnly={readOnly} />
      )}
    />
  );
}
