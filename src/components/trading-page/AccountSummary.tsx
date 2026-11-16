import { formatPnL, formatNumber } from "../../utils/formatting";
import { FormatNumber } from "../ui/format-number";
import { DataRow, DataRowContainer } from "../DataRow";
import { useLiveAccountRisk } from "@/hooks/useLiveAccountRisk";
import {
  useHedgerAccounting,
  useIsHedgerAddress,
} from "@/hooks/useHedgerAccounting";
import { usePortfolioAddress } from "@/hooks/usePortfolioAddress";
import { parsePortfolioAmount } from "@/lib/portfolio";
import { HIDDEN_PNL_TEXT } from "@/lib/pnlPrivacy";
import { useUserPreferencesStore } from "@/stores/userPreferencesStore";
import { useTranslation } from "@/hooks/useSafeTranslation";

function WalletBalance({
  balance,
  isLoading = false,
  isUnavailable = false,
}: {
  balance: bigint;
  isLoading?: boolean;
  isUnavailable?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <DataRow
      label="Wallet Balance"
      tooltip="Wallet Balance = Total Net Transfer + Total Realized Profit + Total Net Funding Fee - Total Commission."
      isLoading={isLoading}
    >
      {isUnavailable
        ? t("Unavailable")
        : `$${formatNumber(balance, { decimalScale: 2, scaled: "price" })}`}
    </DataRow>
  );
}

function MarginBalanceRow({ marginBalance }: { marginBalance: bigint }) {
  return (
    <DataRow
      label="Margin Balance"
      tooltip="Margin Balance = Wallet Balance + gross mark-to-market PNL. Trading fees are already reflected in Wallet Balance."
    >
      ${formatNumber(marginBalance, { decimalScale: 2, scaled: "price" })}
    </DataRow>
  );
}

function MaintenanceMargin({ maintenanceMargin }: { maintenanceMargin: bigint }) {
  return (
    <DataRow
      label="Maintenance Margin"
      tooltip="The minimum amount of margin balance required to keep your open positions."
    >
      ${formatNumber(maintenanceMargin, { decimalScale: 2, scaled: "price" })}
    </DataRow>
  );
}

function UnrealizedPNL({ unrealizedPnL }: { unrealizedPnL: bigint }) {
  const pnl = formatPnL(unrealizedPnL);
  const hidePnl = useUserPreferencesStore((state) => state.hidePnl);
  return (
    <DataRow label="Unrealized PNL" tooltip="Net unrealized PNL based on Mark Price minus opening fees, matching the positions table.">
      {hidePnl ? HIDDEN_PNL_TEXT : pnl.value}
    </DataRow>
  );
}

function MarginRatioRow({ marginRatio }: { marginRatio: number }) {
  return (
    <DataRow
      label="Margin Ratio"
      tooltip="Account Margin Ratio = Account Maintenance Margin / Account Equity"
    >
      {Number.isFinite(marginRatio) ? (
        <FormatNumber value={marginRatio} decimalScale={2} suffix="%" />
      ) : (
        "∞%"
      )}
    </DataRow>
  );
}

export function AccountSummary() {
  const {
    balance,
    marginBalance,
    maintenanceMargin,
    netUnrealizedPnL,
    marginRatio,
  } = useLiveAccountRisk();
  const portfolioAddress = usePortfolioAddress();
  const { isHedger, isResolved: isHedgerRoleResolved } =
    useIsHedgerAddress(portfolioAddress);
  const {
    data: hedgerAccounting,
    isError: isHedgerAccountingError,
    isLoading: isHedgerAccountingLoading,
  } = useHedgerAccounting(isHedger);
  const hedgerWalletBalance = parsePortfolioAmount(hedgerAccounting?.balanceRaw);
  const walletBalance = isHedger ? hedgerWalletBalance : balance;
  const isHedgerWalletLoading =
    isHedger &&
    !isHedgerAccountingError &&
    (!isHedgerRoleResolved || isHedgerAccountingLoading || !hedgerAccounting);

  return (
    <div className="space-y-1">
      <DataRowContainer label="Account Equity">
        <WalletBalance
          balance={walletBalance}
          isLoading={isHedgerWalletLoading}
          isUnavailable={isHedger && isHedgerAccountingError}
        />
        <MarginBalanceRow marginBalance={marginBalance} />
        <MaintenanceMargin maintenanceMargin={maintenanceMargin} />
        <UnrealizedPNL unrealizedPnL={netUnrealizedPnL} />
        <MarginRatioRow marginRatio={marginRatio} />
      </DataRowContainer>
    </div>
  );
}
