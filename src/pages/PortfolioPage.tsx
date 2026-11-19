import { useCallback, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { BottomTabs, type BottomTabConfig } from "@/components/bottom-tabs";
import { BalancesTable } from "@/components/bottom-tabs/BalancesTable";
import { FundingHistoryTable } from "@/components/bottom-tabs/FundingHistoryTable";
import { OrderHistoryTable } from "@/components/bottom-tabs/OrderHistoryTable";
import { OrdersTable } from "@/components/bottom-tabs/OrdersTable";
import { PositionsTable } from "@/components/bottom-tabs/PositionsTable";
import { TradeHistoryTable } from "@/components/bottom-tabs/TradeHistoryTable";
import { TransactionsTable } from "@/components/bottom-tabs/TransactionsTable";
import { DepositModal } from "@/components/DepositModal";
import { PageHeader } from "@/components/PageHeader";
import {
  ACCOUNT_VALUE_DATE_RANGE_OPTIONS,
  PERPS_DATE_RANGE_OPTIONS,
  PortfolioDateRangeSelect,
} from "@/components/portfolio/PortfolioDateRangeSelect";
import { WithdrawModal } from "@/components/WithdrawModal";
import Surface from "@/components/ui/surface";
import SurfaceSeparator from "@/components/ui/surface-separator";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipLabel } from "@/components/ui/tooltip-label";
import { useBinanceSocket } from "@/hooks/useBinancePrices";
import {
  useIsPortfolioReadOnly,
  usePortfolioAddress,
} from "@/hooks/usePortfolioAddress";
import { usePortfolioHistory } from "@/hooks/usePortfolioHistory";
import { useUserAccount } from "@/hooks/useUserAccount";
import { useUserPortfolio } from "@/hooks/useUserPortfolio";
import { useWebSocket } from "@/hooks/useWebSocket";
import { downsampleChartData } from "@/lib/chartDownsampling";
import {
  buildBalanceRows,
  buildPortfolioHistory,
  parsePortfolioAmount,
  type PortfolioHistoryPoint,
} from "@/lib/portfolio";
import { HIDDEN_PNL_TEXT } from "@/lib/pnlPrivacy";
import {
  filterPortfolioHistoryPointsByRange,
  getPortfolioRangeStart,
  getPortfolioRangePnl,
  getPortfolioRangeVolume,
  type PortfolioDateRange,
} from "@/lib/portfolioDateRanges";
import {
  PORTFOLIO_TAB_VALUES,
} from "@/lib/portfolioTabs";
import { useUserPreferencesStore } from "@/stores/userPreferencesStore";
import { cn } from "@/lib/utils";
import {
  formatFeeRate,
  formatNumber,
  formatPnL,
} from "@/utils/formatting";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { isPartnerApprovalPending } from "@/config/partners/availability";
import type { UserPortfolioResponse } from "@/types";

type PortfolioChartMetric = "accountValue" | "pnl" | "volume";

const CHART_METRICS: Array<{
  value: PortfolioChartMetric;
  label: string;
}> = [
  { value: "accountValue", label: "Account Value" },
  { value: "pnl", label: "PNL" },
  { value: "volume", label: "Volume" },
];

function PortfolioListeners() {
  useWebSocket();
  useBinanceSocket();
  return null;
}

function formatUsd(value?: string | bigint) {
  return `$${formatNumber(value ?? 0n, { decimalScale: 2, scaled: "price" })}`;
}

function formatChartMetricValue(
  metric: PortfolioChartMetric,
  value: bigint,
  hidePnl = false,
) {
  if (metric === "pnl" && hidePnl) return HIDDEN_PNL_TEXT;
  if (metric === "pnl") return formatPnL(value).value;
  return formatUsd(value);
}

function getChartMetricValue(point: PortfolioHistoryPoint, metric: PortfolioChartMetric) {
  if (metric === "pnl") return point.pnl;
  if (metric === "volume") return point.volume;
  return point.accountValue;
}

const SCALE = 1_000_000n;

function bigintToChartNumber(value: bigint): number {
  return Number(value) / Number(SCALE);
}

function formatAxisTick(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatDateTick(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface ChartDataPoint {
  timestamp: number;
  value: number;
  raw: bigint;
}

function getChartDomain(
  points: ChartDataPoint[],
  metric: PortfolioChartMetric,
): [number, number] | ["auto", "auto"] {
  if (points.length === 0) return ["auto", "auto"];
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    min = Math.min(min, point.value);
    max = Math.max(max, point.value);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return ["auto", "auto"];

  const range = max - min;
  const padding = Math.max(range === 0 ? Math.abs(max) * 0.05 : range * 0.12, 1);
  const lower = metric === "pnl" ? min - padding : Math.max(0, min - padding);
  return [lower, max + padding];
}

function StatRow({
  isLoading = false,
  label,
  tooltip,
  value,
  tone,
}: {
  isLoading?: boolean;
  label: string;
  tooltip: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  const { t } = useTranslation();
  const toneClass =
    tone === "positive" ? "text-up" : tone === "negative" ? "text-down" : "text-content";
  return (
    <div className="flex min-h-8 items-center justify-between gap-6">
      <TooltipLabel
        ariaLabel={t(label)}
        className="text-[13px] font-medium text-content-muted"
        tooltip={tooltip}
      >
        {t(label)}
      </TooltipLabel>
      <div className={`text-right text-[13px] font-semibold tabular-nums ${toneClass}`}>
        {isLoading ? (
          <Skeleton
            aria-hidden="true"
            className="h-3 w-20 bg-content-muted/15"
            data-testid="portfolio-stat-skeleton"
          />
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function PortfolioActions() {
  const { t } = useTranslation();

  return (
    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
      <WithdrawModal
        trigger={
          <Button size="sm" variant="outline" className="w-full sm:w-auto">
            <ArrowUpFromLine size={14} />
            {t("Withdraw")}</Button>
        }
      />
      <DepositModal
        trigger={
          <Button size="sm" className="w-full sm:w-auto">
            <ArrowDownToLine size={14} />
            {t("Deposit")}</Button>
        }
      />
    </div>
  );
}

function ChartTooltipContent({
  active,
  payload,
  metric,
  hidePnl,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDataPoint }>;
  metric: PortfolioChartMetric;
  hidePnl: boolean;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-edge bg-surface px-3 py-2 shadow-card">
      <div className="text-[11px] text-content-muted">
        {new Date(point.timestamp).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
      <div className="mt-1 text-[13px] font-semibold text-content">
        {formatChartMetricValue(metric, point.raw, hidePnl)}
      </div>
    </div>
  );
}

function AccountValuePanel() {
  const { t } = useTranslation();
  const { data: portfolio, isLoading } = useUserPortfolio();
  const [range, setRange] = useState<PortfolioDateRange>("30D");
  const [fallbackEnd] = useState(() => Date.now());
  const {
    data: history,
    accountingIncomplete: unavailableAccounting,
    completeHistory,
    isError: isHistoryError,
    isLoading: isHistoryLoading,
  } = usePortfolioHistory(range, portfolio?.timestamp ?? fallbackEnd);
  const [metric, setMetric] = useState<PortfolioChartMetric>("accountValue");
  const hidePnl = useUserPreferencesStore((state) => state.hidePnl);
  const isPnlHidden = hidePnl && metric === "pnl";
  const isInitialLoading = isLoading || isHistoryLoading;

  const reconstruction = useMemo(() => {
    return buildPortfolioHistory({
      completeHistory,
      portfolio,
      startTime: getPortfolioRangeStart(range, portfolio?.timestamp ?? fallbackEnd),
      transactions: history?.transactions,
      orders: history?.orders,
      funding: history?.funding,
    });
  }, [completeHistory, fallbackEnd, history, portfolio, range]);
  const chartPoints = reconstruction.points;
  const accountingIncomplete = unavailableAccounting || reconstruction.accountingIncomplete || reconstruction.snapshotStale;

  const chartData: ChartDataPoint[] = useMemo(
    () => {
      const firstPoint = chartPoints[0];
      const volumeBaseline =
        metric === "volume" && range !== "All" && firstPoint
          ? firstPoint.volume - firstPoint.volumeDelta
          : 0n;
      return chartPoints.map((point) => {
        const raw = getChartMetricValue(point, metric);
        const rangedRaw = metric === "volume" ? raw - volumeBaseline : raw;
        return {
          timestamp: point.timestamp,
          value: isPnlHidden ? 0 : bigintToChartNumber(rangedRaw),
          raw: rangedRaw,
        };
      });
    },
    [chartPoints, isPnlHidden, metric, range],
  );
  const renderedChartData = useMemo(
    () => downsampleChartData(chartData),
    [chartData],
  );
  const chartDomain = useMemo(
    () => getChartDomain(renderedChartData, metric),
    [metric, renderedChartData],
  );

  const latest = chartData[chartData.length - 1];
  const latestValue = latest?.raw ?? 0n;
  const first = chartData[0];
  const firstValue = metric === "volume" ? 0n : first?.raw ?? 0n;
  const change = latestValue - firstValue;
  const isPositive = change >= 0n;

  const strokeColor = isPnlHidden
    ? "rgb(var(--color-content-muted))"
    : metric === "pnl"
    ? (isPositive ? "rgb(var(--color-up))" : "rgb(var(--color-down))")
    : "rgb(var(--color-accent-secondary))";

  const tooltipContent = useCallback(
    (props: { active?: boolean; payload?: Array<{ payload: ChartDataPoint }> }) => (
      <ChartTooltipContent {...props} metric={metric} hidePnl={isPnlHidden} />
    ),
    [isPnlHidden, metric],
  );

  return (
    <Surface className="flex h-full min-h-0 flex-col overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge px-4">
        <div className="flex min-w-0 overflow-x-auto scrollbar-none">
          {CHART_METRICS.map((item) => (
            <button
              key={item.value}
              className={`relative h-12 shrink-0 px-4 text-[13px] font-semibold transition-colors focus-visible:outline-none ${
                metric === item.value ? "text-content" : "text-content-muted hover:text-content"
              }`}
              onClick={() => setMetric(item.value)}
              type="button"
            >
              {t(item.label)}
              {metric === item.value ? (
                <span className="absolute inset-x-3 bottom-0 h-[2px] bg-accent-primary" />
              ) : null}
            </button>
          ))}
        </div>
        <PortfolioDateRangeSelect
          ariaLabel={t("Account history date range")}
          onValueChange={setRange}
          options={ACCOUNT_VALUE_DATE_RANGE_OPTIONS}
          value={range}
        />
      </div>

      <div
        className={cn(
          "flex min-h-14 flex-wrap gap-3 px-5 pb-1 pt-5",
          isInitialLoading ? "items-center" : "items-baseline",
        )}
        data-testid={
          isInitialLoading
            ? "portfolio-chart-value-skeleton"
            : "portfolio-chart-value-row"
        }
      >
        {isInitialLoading ? (
          <>
            <Skeleton className="h-6 w-40 bg-content-muted/15" />
            <Skeleton className="h-5 w-16 bg-content-muted/15" />
          </>
        ) : latest ? (
          <>
            <span
              className="text-[22px] font-semibold leading-7 tracking-tight text-content"
              data-testid="chart-latest-value"
            >
              {formatChartMetricValue(metric, latestValue, isPnlHidden)}
            </span>
            {!accountingIncomplete && chartPoints.length > 1 && metric !== "volume" && (
              <span
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${isPnlHidden ? "bg-hover text-content-muted" : isPositive ? "bg-up/10 text-up" : "bg-down/10 text-down"}`}
              >
                {!isPnlHidden && isPositive ? "+" : ""}
                {formatChartMetricValue(metric, change, isPnlHidden)}
              </span>
            )}
          </>
        ) : null}
      </div>

      <div className="portfolio-chart relative flex-1 px-3 pb-3 pt-1 outline-none [&_.recharts-surface:focus]:outline-none [&_.recharts-surface]:outline-none [&_.recharts-wrapper:focus]:outline-none [&_.recharts-wrapper]:outline-none">
        {isInitialLoading ? (
          <div
            className="flex h-full min-h-[180px] flex-col px-2 pb-2 pt-5"
            data-testid="portfolio-chart-skeleton"
          >
            <Skeleton className="min-h-[180px] flex-1 bg-content-muted/10" />
          </div>
        ) : isHistoryError ? (
          <div className="flex h-full min-h-[180px] items-center justify-center px-6 text-center text-[12px] text-content-muted">
            {t("Unable to load account history")}
          </div>
        ) : chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%" minHeight={180}>
            <AreaChart
              data={renderedChartData}
              margin={{ top: 12, right: 18, left: 0, bottom: 6 }}
              className="outline-none focus:outline-none"
              accessibilityLayer={false}
              tabIndex={-1}
            >
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity={0.24} />
                  <stop offset="70%" stopColor={strokeColor} stopOpacity={0.07} />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="2 6"
                stroke="rgb(var(--color-edge-subtle))"
                vertical={false}
              />
              {metric === "pnl" ? (
                <ReferenceLine y={0} stroke="rgb(var(--color-edge))" strokeDasharray="4 4" />
              ) : null}
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatDateTick}
                tick={{ fontSize: 11, fill: "rgb(var(--color-content-muted))" }}
                axisLine={false}
                tickLine={false}
                tickMargin={10}
                minTickGap={60}
              />
              <YAxis
                tickFormatter={isPnlHidden ? () => HIDDEN_PNL_TEXT : formatAxisTick}
                tick={{ fontSize: 11, fill: "rgb(var(--color-content-muted))" }}
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                width={65}
                domain={chartDomain}
              />
              <Tooltip
                content={({ active, payload }) =>
                  tooltipContent({
                    active: active ?? false,
                    payload: payload as unknown as Array<{ payload: ChartDataPoint }> | undefined,
                  })
                }
                cursor={{ stroke: "rgb(var(--color-edge))", strokeWidth: 1 }}
                wrapperStyle={{ outline: "none" }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={strokeColor}
                strokeWidth={2.5}
                fill="url(#chartGradient)"
                dot={false}
                activeDot={{
                  r: 4.5,
                  stroke: strokeColor,
                  strokeWidth: 2,
                  fill: "rgb(var(--color-surface))",
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full min-h-[180px] items-center justify-center text-[12px] text-content-muted">
            {t("No Account History")}
          </div>
        )}
      </div>
      {reconstruction.snapshotStale ? (
        <p className="px-4 pb-3 text-xs text-content-muted">{t("New activity is waiting for the next account update")}</p>
      ) : accountingIncomplete && <p className="px-4 pb-3 text-xs text-content-muted">{t("Showing available history; older accounting is incomplete")}</p>}
    </Surface>
  );
}

function PerpsPanel({
  isLoading,
  portfolio,
}: {
  isLoading: boolean;
  portfolio?: UserPortfolioResponse;
}) {
  const { t } = useTranslation();
  const [range, setRange] = useState<PortfolioDateRange>("30D");
  const [fallbackEnd] = useState(() => Date.now());
  const historyEnabled = range !== "All";
  const {
    data: history,
    accountingIncomplete: unavailableAccounting,
    completeHistory,
    isError: isHistoryError,
    isLoading: isHistoryLoading,
  } = usePortfolioHistory(
    range,
    portfolio?.timestamp ?? fallbackEnd,
    historyEnabled,
  );
  const hidePnl = useUserPreferencesStore((state) => state.hidePnl);
  const totalPnl = parsePortfolioAmount(portfolio?.totalPnl);
  const reconstruction = useMemo(
    () =>
      buildPortfolioHistory({
        completeHistory,
        portfolio,
        startTime: getPortfolioRangeStart(range, portfolio?.timestamp ?? fallbackEnd),
        transactions: history?.transactions,
        orders: history?.orders,
        funding: history?.funding,
      }),
    [completeHistory, history, portfolio, range, fallbackEnd],
  );
  const historyPoints = reconstruction.points;
  const accountingIncomplete = unavailableAccounting || reconstruction.accountingIncomplete || reconstruction.snapshotStale;
  const rangePoints = useMemo(
    () =>
      filterPortfolioHistoryPointsByRange(
        historyPoints,
        range,
        portfolio?.timestamp ?? fallbackEnd,
      ),
    [fallbackEnd, historyPoints, portfolio?.timestamp, range],
  );
  const pnl = formatPnL(getPortfolioRangePnl(rangePoints, range, totalPnl));
  const volume = getPortfolioRangeVolume(portfolio, range);

  return (
    <Surface className="h-full p-0">
      <div className="flex h-12 items-center justify-between border-b border-edge px-4">
        <div className="text-[13px] font-semibold uppercase tracking-wider text-content">
          {t("Perps")}
        </div>
        <PortfolioDateRangeSelect
          ariaLabel={t("Perps date range")}
          onValueChange={setRange}
          options={PERPS_DATE_RANGE_OPTIONS}
          value={range}
        />
      </div>
      <div className="space-y-0.5 p-4">
        {accountingIncomplete && historyEnabled && <p className="text-xs text-content-muted">{t("Some historical accounting is unavailable")}</p>}
        <StatRow
          isLoading={isLoading || (historyEnabled && isHistoryLoading)}
          label="PNL"
          tooltip="Profit and loss over the selected period, including realized and unrealized PNL."
          value={
            (isHistoryError || accountingIncomplete) && historyEnabled
              ? "-"
              : hidePnl
                ? HIDDEN_PNL_TEXT
                : pnl.value
          }
          tone={
            (isHistoryError || accountingIncomplete) && historyEnabled
              ? undefined
              : hidePnl
                ? undefined
                : pnl.isPositive
                  ? "positive"
                  : "negative"
          }
        />
        <StatRow
          isLoading={isLoading}
          label="Volume"
          tooltip="Total executed trading volume over the selected period."
          value={volume ? formatUsd(volume) : "$0.00"}
        />
        <SurfaceSeparator
          className="portfolio-perps-separator h-px bg-edge"
          direction="horizontal"
        />
        <StatRow
          isLoading={isLoading}
          label="Total Equity"
          tooltip="Wallet Balance plus unrealized PNL at current mark prices."
          value={portfolio ? formatUsd(portfolio.totalEquity) : "$0.00"}
        />
        <StatRow
          isLoading={isLoading}
          label="Wallet Balance"
          tooltip="Deposits minus withdrawals, adjusted for realized PNL, funding, and trading fees."
          value={portfolio ? formatUsd(portfolio.walletBalance) : "$0.00"}
        />
        <StatRow
          isLoading={isLoading}
          label="Available Balance"
          tooltip="Funds available after unrealized losses and initial margin reserved for positions and open orders."
          value={portfolio ? formatUsd(portfolio.availableBalance) : "$0.00"}
        />
        <SurfaceSeparator
          className="portfolio-perps-separator h-px bg-edge"
          direction="horizontal"
        />
        <StatRow
          isLoading={isLoading}
          label="Margin Used"
          tooltip="Initial margin currently reserved for open positions."
          value={portfolio ? formatUsd(portfolio.marginUsed) : "$0.00"}
        />
        <StatRow
          isLoading={isLoading}
          label="Maintenance Margin"
          tooltip="The minimum account equity required to keep open positions."
          value={portfolio ? formatUsd(portfolio.maintenanceMargin) : "$0.00"}
        />
      </div>
    </Surface>
  );
}

function PortfolioSummary({ readOnly }: { readOnly: boolean }) {
  const { t } = useTranslation();
  const { data: portfolio, isLoading } = useUserPortfolio();

  return (
    <section className="border-b border-edge bg-base pb-2 pt-4 sm:pt-5 lg:pt-7">
      <PageHeader
        action={readOnly ? undefined : <PortfolioActions />}
        className="mb-5 sm:mb-6"
        title={t("Portfolio")}
      />

      <div
        className="grid items-stretch gap-3 xl:grid-cols-[minmax(220px,0.85fr)_minmax(300px,0.95fr)_minmax(420px,1.7fr)]"
        data-testid="portfolio-summary-panels"
      >
        <div
          className="flex flex-col items-stretch gap-3 sm:flex-row xl:flex-col"
          data-testid="portfolio-left-summary"
        >
          <Surface className="flex flex-1 flex-col justify-between p-4">
            <div className="text-[13px] font-semibold uppercase tracking-wider text-content-muted">
              {t("14 Day Volume")}
            </div>
            <div>
              <div
                className="flex h-8 items-center text-[24px] font-semibold leading-7 tracking-tight text-content"
                data-testid="portfolio-volume-value-slot"
              >
                {isLoading ? (
                  <Skeleton
                    aria-hidden="true"
                    className="h-6 w-32 bg-content-muted/15"
                    data-testid="portfolio-volume-skeleton"
                  />
                ) : portfolio ? (
                  formatUsd(portfolio.volume14d)
                ) : (
                  "$0.00"
                )}
              </div>
            </div>
          </Surface>

          <Surface className="flex flex-1 flex-col justify-between p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[13px] font-semibold uppercase tracking-wider text-content-muted">
                {t("Fees")}
              </div>
              {isLoading ? (
                <Skeleton
                  aria-hidden="true"
                  className="h-5 w-14 bg-content-muted/15"
                  data-testid="portfolio-fee-tier-skeleton"
                />
              ) : (
                <div className="rounded bg-badge-bg px-2 py-0.5 text-[11px] font-semibold text-content-muted">
                  {t("Tier")} {portfolio?.feeTier ?? 0}
                </div>
              )}
            </div>
            <div>
              <div
                className="flex h-8 items-center text-[24px] font-semibold leading-7 tracking-tight text-content"
                data-testid="portfolio-fee-value-slot"
              >
                {isLoading ? (
                  <Skeleton
                    aria-hidden="true"
                    className="h-6 w-24 bg-content-muted/15"
                    data-testid="portfolio-fee-rate-skeleton"
                  />
                ) : (
                  formatFeeRate(portfolio?.totalFeeRateBps)
                )}
              </div>
              <div className="mt-3 text-[12px] font-medium text-content-muted">
                {t("Total perps fee rate")}
              </div>
            </div>
          </Surface>
        </div>

        <PerpsPanel isLoading={isLoading} portfolio={portfolio} />

        <AccountValuePanel />
      </div>
    </section>
  );
}

function PortfolioTabs({
  bottomOffset,
  value,
  readOnly,
}: {
  bottomOffset: number;
  value: string;
  readOnly: boolean;
}) {
  const { data: userAccount } = useUserAccount();
  const { data: portfolio } = useUserPortfolio();
  const balanceCount = buildBalanceRows(portfolio).length;
  const tabs: BottomTabConfig[] = useMemo(
    () => [
      {
        value: PORTFOLIO_TAB_VALUES[0],
        label: "Balances",
        mobileLabel: "Balances",
        count: balanceCount,
        content: <BalancesTable />,
      },
      {
        value: PORTFOLIO_TAB_VALUES[1],
        label: "Positions",
        mobileLabel: "Positions",
        count: userAccount?.positions.length ?? 0,
        content: <PositionsTable readOnly={readOnly} />,
      },
      {
        value: PORTFOLIO_TAB_VALUES[2],
        label: "Open Orders",
        mobileLabel: "Orders",
        count: userAccount?.orders.length ?? 0,
        content: <OrdersTable readOnly={readOnly} />,
      },
      {
        value: PORTFOLIO_TAB_VALUES[3],
        label: "Trade History",
        mobileLabel: "Trades",
        content: <TradeHistoryTable />,
      },
      {
        value: PORTFOLIO_TAB_VALUES[4],
        label: "Funding History",
        mobileLabel: "Funding",
        content: <FundingHistoryTable />,
      },
      {
        value: PORTFOLIO_TAB_VALUES[5],
        label: "Order History",
        mobileLabel: "History",
        content: <OrderHistoryTable />,
      },
      {
        value: PORTFOLIO_TAB_VALUES[6],
        label: "Deposits and Withdrawals",
        mobileLabel: "Transfers",
        content: <TransactionsTable />,
      },
    ],
    [
      balanceCount,
      readOnly,
      userAccount?.orders.length,
      userAccount?.positions.length,
    ],
  );

  return (
    <section className="bg-base pb-4 pt-2 sm:pb-5 lg:pb-7">
      <Surface className="p-0">
        <BottomTabs
          tabs={tabs}
          value={value}
          persistenceKey="portfolio"
          fillAvailableSpace
          fillBottomOffset={bottomOffset}
          fillMinHeight={100}
        />
      </Surface>
    </section>
  );
}

export function PortfolioView({
  readOnly,
}: {
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const portfolioAddress = usePortfolioAddress();
  const portfolioQuery = useUserPortfolio();
  const persistedPortfolioTab = useUserPreferencesStore(
    (state) => state.selectedBottomTabs.portfolio,
  );
  const availableTabValues: readonly string[] = PORTFOLIO_TAB_VALUES;
  const activeTab = persistedPortfolioTab && availableTabValues.includes(
    persistedPortfolioTab,
  )
    ? persistedPortfolioTab
    : PORTFOLIO_TAB_VALUES[0];
  if (!portfolioAddress || portfolioQuery.isError) {
    const unavailableMessage = !portfolioAddress
      ? t(isPartnerApprovalPending() ? "Trading is not available yet." : "Connect your wallet to view your portfolio")
      : t("Unable to load portfolio");

    return (
      <div
        className={cn(
          "mx-auto flex w-full max-w-[1580px] flex-col",
          "px-3 pt-4 md:px-6 sm:pt-5 lg:pt-7",
        )}
        data-testid="portfolio-page-content"
      >
        <PageHeader className="mb-5 sm:mb-6" title={t("Portfolio")} />
        <Surface className="flex min-h-48 items-center justify-center px-6 py-10 text-center text-[13px] text-content-muted">
          {unavailableMessage}
        </Surface>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[1580px] flex-col",
        "px-3 md:px-6",
      )}
      data-testid="portfolio-page-content"
    >
      <PortfolioSummary
        readOnly={readOnly}
      />
      <PortfolioTabs
        bottomOffset={28}
        value={activeTab}
        readOnly={readOnly}
      />
      <PortfolioListeners />
    </div>
  );
}

export function PortfolioPage() {
  const readOnly = useIsPortfolioReadOnly();

  return <PortfolioView readOnly={readOnly} />;
}
