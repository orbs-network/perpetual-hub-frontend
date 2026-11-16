import { getCollateralSymbol } from "@/utils/collateralDisplay";
import { hasUnavailableWithdrawalAccounting } from "./transactionAccounting";
import type { HedgerAccounting } from "@/api/hedger";
import type {
  OrderHistoryItem,
  TransactionItem,
  UserPortfolioResponse,
} from "@/types";
import { QUANTITY_SCALE } from "@/config/constants";
import { safeUpperCase } from "@/lib/utils";
import { domainPriceToBigInt } from "@/utils/formatting";

export interface BalanceRow {
  coin: string;
  totalBalance: bigint;
  availableBalance: bigint;
  usdcValue: bigint;
  totalPnl: bigint;
  contract: string;
}

export function parsePortfolioAmount(value?: string | number | bigint | null) {
  if (value === undefined || value === null || value === "") return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

export function parseDecimalAmountToRaw(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return "0";

  const sign = trimmed.startsWith("-") ? -1n : 1n;
  const unsigned = trimmed.replace(/^[+-]/, "");
  const [wholePart = "0", fractionPart = ""] = unsigned.split(".");
  if (!/^\d+$/.test(wholePart || "0") || !/^\d*$/.test(fractionPart)) {
    return "0";
  }

  const whole = BigInt(wholePart || "0") * 1_000_000n;
  const fractionText = fractionPart.slice(0, 6).padEnd(6, "0");
  const fraction = BigInt(fractionText || "0");
  return (sign * (whole + fraction)).toString();
}

export function buildHedgerPortfolio(
  accounting: HedgerAccounting,
): UserPortfolioResponse {
  const balanceRaw =
    accounting.balanceRaw || parseDecimalAmountToRaw(accounting.balance);
  const realizedPnlRaw = parseDecimalAmountToRaw(accounting.realizedPnl);
  const feesRaw = parseDecimalAmountToRaw(accounting.totalFeesCollected);
  const fundingRaw = parseDecimalAmountToRaw(accounting.totalFunding);

  return {
    userAddress: accounting.hedgerAddress,
    totalValue: balanceRaw,
    totalEquity: balanceRaw,
    perpsEquity: balanceRaw,
    walletBalance: balanceRaw,
    availableBalance: balanceRaw,
    marginUsed: "0",
    maintenanceMargin: "0",
    unrealizedPnl: "0",
    realizedPnl: realizedPnlRaw,
    totalPnl: (
      parsePortfolioAmount(realizedPnlRaw) +
      parsePortfolioAmount(feesRaw) -
      parsePortfolioAmount(fundingRaw)
    ).toString(),
    totalDeposits: parseDecimalAmountToRaw(accounting.totalDeposits),
    totalWithdrawals: parseDecimalAmountToRaw(accounting.totalWithdrawals),
    totalPositionUsdValue: "0",
    volume24h: "0",
    volume14d: "0",
    volume30d: "0",
    volumeAllTime: "0",
    feeTier: 0,
    totalFeeRateBps: 0,
    timestamp: accounting.updatedAt ?? Date.now(),
    source: "hedger_accounting",
  };
}

export function buildBalanceRows(portfolio?: UserPortfolioResponse | null): BalanceRow[] {
  if (!portfolio) return [];
  return [
    {
      coin: `${getCollateralSymbol()} (Perps)`,
      totalBalance: parsePortfolioAmount(portfolio.walletBalance),
      availableBalance: parsePortfolioAmount(portfolio.availableBalance),
      usdcValue: parsePortfolioAmount(portfolio.totalValue),
      totalPnl: parsePortfolioAmount(portfolio.totalPnl),
      contract: "Perps",
    },
  ];
}

export function getPortfolioAccountValue(portfolio?: UserPortfolioResponse | null) {
  if (!portfolio) return 0n;
  return parsePortfolioAmount(portfolio.totalEquity);
}

export interface PortfolioHistoryInput {
  portfolio?: UserPortfolioResponse | null;
  startTime?: number;
  completeHistory?: boolean;
  transactions?: TransactionItem[];
  orders?: OrderHistoryItem[];
  funding?: OrderHistoryItem[];
}

export interface PortfolioHistoryPoint {
  timestamp: number;
  accountValue: bigint;
  pnl: bigint;
  pnlDelta: bigint;
  volume: bigint;
  volumeDelta: bigint;
}

type LedgerEvent = {
  timestamp: number;
  sortOrder: number;
  accountDelta: bigint;
  cashFlowDelta: bigint;
  volumeDelta: bigint;
  accountValue?: bigint;
};

function successful(status?: string) {
  return safeUpperCase(status) === "SUCCESS";
}

function transactionDelta(transaction: TransactionItem) {
  const type = safeUpperCase(transaction.operationType);
  const amount = parsePortfolioAmount(transaction.amount);
  if (type === "DEPOSIT") return amount;
  if (type === "WITHDRAWAL") return -amount;
  return 0n;
}

function orderLedgerEvent(order: OrderHistoryItem): LedgerEvent | null {
  if (!successful(order.status)) return null;
  const type = safeUpperCase(order.operationType);
  if (
    !["OPEN_POSITION", "CLOSE_POSITION", "FILL_ORDER", "LIQUIDATION"].includes(
      type,
    )
  ) {
    return null;
  }

  const fee = parsePortfolioAmount(order.fee);
  const realizedPnl = parsePortfolioAmount(order.realizedPnl);
  const quantity = parsePortfolioAmount(order.quantity);
  const absoluteQuantity = quantity < 0n ? -quantity : quantity;
  const price = domainPriceToBigInt(order.price);
  const volumeDelta = price > 0n
    ? (absoluteQuantity * price) / (QUANTITY_SCALE * 1_000_000_000_000n)
    : 0n;
  if (type === "LIQUIDATION") {
    return {
      timestamp: order.timestamp,
      sortOrder: 1,
      accountDelta: 0n,
      cashFlowDelta: 0n,
      volumeDelta,
      accountValue: 0n,
    };
  }

  return {
    timestamp: order.timestamp,
    sortOrder: 1,
    accountDelta: realizedPnl - fee,
    cashFlowDelta: 0n,
    volumeDelta,
  };
}

function fundingLedgerEvent(row: OrderHistoryItem): LedgerEvent | null {
  if (!successful(row.status)) return null;
  const amount = parsePortfolioAmount(row.amount);
  return {
    timestamp: row.timestamp,
    sortOrder: 2,
    accountDelta: -amount,
    cashFlowDelta: 0n,
    volumeDelta: 0n,
  };
}

export interface PortfolioHistoryResult {
  points: PortfolioHistoryPoint[];
  accountingIncomplete: boolean;
  snapshotStale: boolean;
}

export function buildPortfolioHistory({
  portfolio,
  startTime,
  completeHistory = false,
  transactions = [],
  orders = [],
  funding = [],
}: PortfolioHistoryInput): PortfolioHistoryResult {
  const snapshotTime = portfolio?.timestamp;
  const snapshotStale = Boolean(snapshotTime && [...transactions, ...orders, ...funding]
    .some((row) => row.timestamp > snapshotTime));
  const unknown = transactions.filter((tx) => hasUnavailableWithdrawalAccounting(tx) &&
    (!snapshotTime || tx.timestamp <= snapshotTime));
  const requestedStart = startTime ?? -Infinity;
  let accountingIncomplete = unknown.some((tx) => tx.timestamp >= requestedStart);
  // A snapshot cannot be projected through an unknown debit. Keep later rows in
  // the cache; snapshotStale exposes why they are not yet charted.
  if (unknown.length && !snapshotTime) return { points: [], accountingIncomplete, snapshotStale };
  const lastUnknown = unknown.reduce((latest, tx) => Math.max(latest, tx.timestamp), -Infinity);
  // Complete history can be replayed from genesis, including pre-window losses
  // and fees. Otherwise an absolute liquidation reset cannot be reversed from
  // today's balance: begin at the first known reset, not invented principal.
  const hasResetInWindow = orders.some((row) => successful(row.status) &&
    safeUpperCase(row.operationType) === "LIQUIDATION" && row.timestamp >= requestedStart &&
    (!snapshotTime || row.timestamp <= snapshotTime));
  const replayFromGenesis = completeHistory && unknown.length === 0 && hasResetInWindow;
  let cutoff = replayFromGenesis ? -Infinity : Math.max(lastUnknown, requestedStart - 1);
  transactions = transactions.filter((tx) => tx.timestamp > cutoff && (!snapshotTime || tx.timestamp <= snapshotTime));
  orders = orders.filter((row) => row.timestamp > cutoff && (!snapshotTime || row.timestamp <= snapshotTime));
  funding = funding.filter((row) => row.timestamp > cutoff && (!snapshotTime || row.timestamp <= snapshotTime));

  const transactionEvents = transactions
    .filter((transaction) => successful(transaction.status))
    .map((transaction) => {
      const delta = transactionDelta(transaction);
      return {
        timestamp: transaction.timestamp,
        sortOrder: 0,
        accountDelta: delta - (safeUpperCase(transaction.operationType) === "WITHDRAWAL" ? parsePortfolioAmount(transaction.fee) : 0n),
        cashFlowDelta: delta,
        volumeDelta: 0n,
      };
    });
  let seenNetCashFlow = transactionEvents.reduce(
    (total, event) => total + event.cashFlowDelta,
    0n,
  );
  const totalDeposits = parsePortfolioAmount(portfolio?.totalDeposits);
  const totalWithdrawals = parsePortfolioAmount(portfolio?.totalWithdrawals);
  const hasAuthoritativeCashFlow = totalDeposits !== 0n || totalWithdrawals !== 0n;
  const missingNetCashFlow = hasAuthoritativeCashFlow
    ? totalDeposits - totalWithdrawals - seenNetCashFlow
    : 0n;
  let events: LedgerEvent[] = [
    ...transactionEvents,
    ...orders.map(orderLedgerEvent).filter((event): event is LedgerEvent => event !== null),
    ...funding.map(fundingLedgerEvent).filter((event): event is LedgerEvent => event !== null),
  ]
    .filter((event) => event.timestamp > 0)
    .sort((left, right) => left.timestamp - right.timestamp || left.sortOrder - right.sortOrder);

  const firstResetIndex = events.findIndex((event) => event.accountValue !== undefined);
  const beginsAtReset = firstResetIndex >= 0 && !replayFromGenesis;
  if (beginsAtReset) {
    events = events.slice(firstResetIndex);
    cutoff = events[0].timestamp;
    accountingIncomplete = true;
    seenNetCashFlow = events.reduce((sum, event) => sum + event.cashFlowDelta, 0n);
  }
  let accountValue = replayFromGenesis || beginsAtReset ? 0n : (missingNetCashFlow > 0n ? missingNetCashFlow : 0n);
  let netCashFlow = replayFromGenesis ? 0n : missingNetCashFlow;
  if (snapshotTime) {
    // Cash flow remains invertible across liquidation, even though equity does
    // not. Retain pre-window withdrawal fees in the current PnL anchor.
    netCashFlow = getPortfolioAccountValue(portfolio) - parsePortfolioAmount(portfolio?.totalPnl) - seenNetCashFlow;
    if (!replayFromGenesis && !beginsAtReset) {
      const realizedBalance = getPortfolioAccountValue(portfolio) - parsePortfolioAmount(portfolio?.unrealizedPnl);
      accountValue = realizedBalance - events.reduce((sum, event) => sum + event.accountDelta, 0n);
    }
  }
  const seenVolume = events.reduce(
    (total, event) => total + event.volumeDelta,
    0n,
  );
  const reportedVolume = parsePortfolioAmount(portfolio?.volumeAllTime);
  const authoritativeVolume = reportedVolume > seenVolume
    ? reportedVolume
    : seenVolume;
  let volume = authoritativeVolume - seenVolume;
  const points: PortfolioHistoryPoint[] = [];
  if (portfolio?.timestamp && Number.isFinite(cutoff) && cutoff < portfolio.timestamp &&
      !beginsAtReset && !replayFromGenesis) {
    points.push({ timestamp: cutoff + 1, accountValue, pnl: accountValue - netCashFlow,
      pnlDelta: 0n, volume, volumeDelta: 0n });
  }

  let needsOpeningPoint = replayFromGenesis && Number.isFinite(requestedStart);
  const addOpeningPoint = () => {
    points.push({ timestamp: requestedStart, accountValue, pnl: accountValue - netCashFlow,
      pnlDelta: 0n, volume, volumeDelta: 0n });
    needsOpeningPoint = false;
  };
  for (const [index, event] of events.entries()) {
    if (needsOpeningPoint && event.timestamp >= requestedStart) addOpeningPoint();
    const previousPnl = accountValue - netCashFlow;
    accountValue = event.accountValue ?? accountValue + event.accountDelta;
    if (accountValue < 0n) accountValue = 0n;
    netCashFlow += event.cashFlowDelta;
    volume += event.volumeDelta;
    const pnl = accountValue - netCashFlow;
    points.push({
      timestamp: event.timestamp,
      accountValue,
      pnl,
      pnlDelta: beginsAtReset && index === 0 ? 0n : pnl - previousPnl,
      volume,
      volumeDelta: event.volumeDelta,
    });
  }

  if (needsOpeningPoint && snapshotTime && requestedStart <= snapshotTime) addOpeningPoint();

  if (portfolio?.timestamp) {
    points.push({
      timestamp: portfolio.timestamp,
      accountValue: getPortfolioAccountValue(portfolio),
      pnl: parsePortfolioAmount(portfolio.totalPnl),
      pnlDelta: 0n,
      volume: authoritativeVolume,
      volumeDelta: 0n,
    });
  }

  const distinctPoints = points.filter(
    (point, index) =>
      index === 0 ||
      point.timestamp !== points[index - 1].timestamp ||
      point.accountValue !== points[index - 1].accountValue ||
      point.pnl !== points[index - 1].pnl ||
      point.volume !== points[index - 1].volume,
  );
  return {
    points: distinctPoints.filter((point) => point.timestamp >= requestedStart),
    accountingIncomplete,
    snapshotStale,
  };
}
