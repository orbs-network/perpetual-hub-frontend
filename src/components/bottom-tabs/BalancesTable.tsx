import { getCollateralSymbol } from "@/utils/collateralDisplay";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/useIsMobile";
import { usePortfolioAddress } from "@/hooks/usePortfolioAddress";
import { useUserPortfolio } from "@/hooks/useUserPortfolio";
import { buildBalanceRows, type BalanceRow } from "@/lib/portfolio";
import { formatNumber, formatPnL } from "@/utils/formatting";
import { ConnectWalletState, EmptyState, ErrorMessage, LoadingSpinner } from "./shared";
import { TABLE_HEADER_ROW_CLASS } from "./utils";
import { BottomTabsTable } from "./BottomTabsTable";
import { BottomTabsPagination } from "./BottomTabsPagination";
import { HIDDEN_PNL_TEXT } from "@/lib/pnlPrivacy";
import { useUserPreferencesStore } from "@/stores/userPreferencesStore";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { buildTimestampedCsvFilename } from "./csvExport";

const BALANCE_CELL_CLASS =
  "px-2 py-0 text-[12px] font-semibold text-content whitespace-nowrap";

const BALANCE_COLUMNS = [
  "Coin",
  "Total Balance",
  "Available Balance",
  "{{collateralSymbol}} Value",
  "PNL",
  "Contract",
];

function formatUsdc(value: bigint) {
  return `${formatNumber(value, { decimalScale: 2, scaled: "price" })} ${getCollateralSymbol()}`;
}

function BalanceCells({ row }: { row: BalanceRow }) {
  const pnl = formatPnL(row.totalPnl);
  const hidePnl = useUserPreferencesStore((state) => state.hidePnl);
  return (
    <>
      <TableCell className={BALANCE_CELL_CLASS}>{row.coin}</TableCell>
      <TableCell className={BALANCE_CELL_CLASS}>
        {formatUsdc(row.totalBalance)}
      </TableCell>
      <TableCell className={BALANCE_CELL_CLASS}>
        {formatUsdc(row.availableBalance)}
      </TableCell>
      <TableCell className={BALANCE_CELL_CLASS}>
        ${formatNumber(row.usdcValue, { decimalScale: 2, scaled: "price" })}
      </TableCell>
      <TableCell className={BALANCE_CELL_CLASS}>
        <span
          className={
            hidePnl ? "text-content-muted" : pnl.isPositive ? "text-up" : "text-down"
          }
        >
          {hidePnl ? HIDDEN_PNL_TEXT : pnl.value}
        </span>
      </TableCell>
      <TableCell className={BALANCE_CELL_CLASS}>{row.contract}</TableCell>
    </>
  );
}

function MobileBalanceCard({ row }: { row: BalanceRow }) {
  const { t } = useTranslation();
  const pnl = formatPnL(row.totalPnl);
  const hidePnl = useUserPreferencesStore((state) => state.hidePnl);

  return (
    <div className="rounded-lg border border-edge bg-base">
      <div className="flex items-center justify-between gap-3 border-b border-edge/60 p-3">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-content">{row.coin}</div>
          <div className="mt-0.5 text-[11px] font-medium text-content-muted">
            {row.contract}
          </div>
        </div>
        <div className="text-right text-[13px] font-semibold text-content">
          ${formatNumber(row.usdcValue, { decimalScale: 2, scaled: "price" })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-3 text-[11px]">
        <div>
          <div className="text-content-muted">{t("Total Balance")}</div>
          <div className="mt-0.5 font-semibold text-content-secondary">
            {formatUsdc(row.totalBalance)}
          </div>
        </div>
        <div>
          <div className="text-content-muted">{t("Available Balance")}</div>
          <div className="mt-0.5 font-semibold text-content-secondary">
            {formatUsdc(row.availableBalance)}
          </div>
        </div>
        <div>
          <div className="text-content-muted">PNL</div>
          <div
            className={`mt-0.5 font-semibold ${
              hidePnl ? "text-content-muted" : pnl.isPositive ? "text-up" : "text-down"
            }`}
          >
            {hidePnl ? HIDDEN_PNL_TEXT : pnl.value}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BalancesTable() {
  const { t } = useTranslation();
  const { isConnected } = useAuth();
  const isMobile = useIsMobile();
  const address = usePortfolioAddress();
  const { data: portfolio, isLoading, error } = useUserPortfolio();
  const hidePnl = useUserPreferencesStore((state) => state.hidePnl);
  const rows = buildBalanceRows(portfolio);

  if (!isConnected && !address) return <ConnectWalletState label="Balances" />;
  if (isLoading && rows.length === 0) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={(error as Error).message} />;
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No Balances"
        subtitle="Your Perps Account Balances Will Appear Here"
      />
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-2 border-t border-edge/60 bg-surface px-3 py-3">
        {rows.map((row) => (
          <MobileBalanceCard key={row.coin} row={row} />
        ))}
      </div>
    );
  }

  return (
    <BottomTabsTable
      data={rows}
      computeItemKey={(_, row) => row.coin}
      footerContent={
        <BottomTabsPagination
          csvExport={{
            filename: () =>
              buildTimestampedCsvFilename(["balances", address]),
            rows,
            columns: [
              { header: t("Coin"), value: (row) => row.coin },
              {
                header: t("Total Balance"),
                value: (row) => formatUsdc(row.totalBalance),
              },
              {
                header: t("Available Balance"),
                value: (row) => formatUsdc(row.availableBalance),
              },
              {
                header: t("{{collateralSymbol}} Value", { collateralSymbol: getCollateralSymbol() }),
                value: (row) =>
                  `$${formatNumber(row.usdcValue, {
                    decimalScale: 2,
                    scaled: "price",
                  })}`,
              },
              {
                header: t("PNL"),
                value: (row) =>
                  hidePnl ? HIDDEN_PNL_TEXT : formatPnL(row.totalPnl).value,
              },
              { header: t("Contract"), value: (row) => row.contract },
            ],
          }}
          pagination={{
            page: 0,
            pageSize: rows.length,
            total: rows.length,
            canPreviousPage: false,
            canNextPage: false,
            onPreviousPage: () => undefined,
            onNextPage: () => undefined,
          }}
        />
      }
      fixedHeaderContent={() => (
        <TableRow className={TABLE_HEADER_ROW_CLASS}>
          {BALANCE_COLUMNS.map((column) => (
            <TableHead
              key={column}
              className="px-2 py-0 text-left text-[12px] font-semibold text-content-secondary"
            >
              {t(column, { collateralSymbol: getCollateralSymbol() })}
            </TableHead>
          ))}
        </TableRow>
      )}
      itemContent={(_, row) => <BalanceCells row={row} />}
    />
  );
}
