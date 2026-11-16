import { getCollateralSymbol, getCollateralLogoUrl } from "@/utils/collateralDisplay";
import { CollateralTokenDetails } from "./CollateralTokenDetails";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { Clock3, Minus } from "lucide-react";
import { useAccount } from "wagmi";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { AuthGuardButton } from "./AuthGuardButton";
import { AmountInput } from "./ui/amount-input";
import {
  toScaledPrice,
  fromScaledPrice,
  formatNumber,
} from "../utils/formatting";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalTrigger,
  ResponsiveModalFooter,
} from "./ui/responsive-modal";
import { useLiveAccountRisk } from "@/hooks/useLiveAccountRisk";
import { useWithdraw } from "@/hooks/mutations/useWithdraw";
import { useTargetChain } from "@/hooks/useTargetChain";
import { useUserAccount } from "@/hooks/useUserAccount";
import { useAppQueryParams } from "@/hooks/useAppQueryParams";
import {
  getWithdrawalFee,
  getWithdrawalMaxPayout,
  getWithdrawalTotalDebit,
  hasEnoughForWithdrawal,
  isAboveWithdrawalMaximum,
  isBelowWithdrawalMinimum,
} from "@/utils/withdrawalAmounts";
import {
  useHedgerAccounting,
  useIsHedgerAddress,
} from "@/hooks/useHedgerAccounting";
import { useLegacyHedgerAccount } from "@/hooks/useLegacyHedgerAccount";
import { MIN_WITHDRAWAL_AMOUNT } from "@/config/constants";

interface WithdrawModalProps {
  trigger?: ReactNode;
}

function parseRawAmount(value?: string | null) {
  if (!value) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function InlineValueSkeleton({
  testId,
  className = "h-3 w-20",
}: {
  testId: string;
  className?: string;
}) {
  return <Skeleton data-testid={testId} className={className} />;
}

export function WithdrawModal({ trigger }: WithdrawModalProps) {
  const { t } = useTranslation();
  const collateralSymbol = getCollateralSymbol();
  const logoUrl = getCollateralLogoUrl(collateralSymbol);
  const { address: walletAddress } = useAccount();
  const { sharedSession, viewerAddress } = useAppQueryParams();
  const liveRisk = useLiveAccountRisk();
  const { data: userAccount, isLoading: isUserAccountLoading } =
    useUserAccount();
  const { isHedger, isResolved: isHedgerRoleResolved } =
    useIsHedgerAddress(walletAddress);
  const {
    data: hedgerAccounting,
    isError: isHedgerAccountingError,
    isLoading: isHedgerAccountingLoading,
  } = useHedgerAccounting(isHedger);
  const [open, setOpen] = useState(false);
  const [legacyUserSelected, setLegacyUserSelected] = useState(false);
  const isLegacyUser = isHedger && legacyUserSelected;
  const isTreasury = isHedger && !isLegacyUser;
  const legacyAccount = useLegacyHedgerAccount(walletAddress, open && isLegacyUser);
  const [amount, setAmount] = useState<string>("");
  const [isMax, setIsMax] = useState(false);
  const targetChain = useTargetChain();
  const targetChainName = targetChain?.name ?? "";
  const scaledAmount = useMemo(() => {
    return amount ? toScaledPrice(amount) : 0n;
  }, [amount]);

  const {
    mutate: handleSubmit,
    isPending: isSubmitting,
    reset: resetMutation,
  } = useWithdraw();

  const accountError = isLegacyUser ? legacyAccount.isError : isTreasury && isHedgerAccountingError;
  const accountReady = isLegacyUser
    ? !!legacyAccount.data && !legacyAccount.isError
    : !isTreasury || (!!hedgerAccounting && !isHedgerAccountingError);
  const isWithdrawAmountLoading =
    !isHedgerRoleResolved ||
    (isLegacyUser && !legacyAccount.isError && !legacyAccount.data) ||
    (!isHedger && (liveRisk.isLoading || (isUserAccountLoading && !userAccount))) ||
    (isTreasury && !isHedgerAccountingError && (isHedgerAccountingLoading || !hedgerAccounting));
  const hedgerBalance = parseRawAmount(hedgerAccounting?.balanceRaw);
  // Legacy user funds retain user margin/fee rules and are never added to treasury.
  const userAvailableBalance = isLegacyUser
    ? (legacyAccount.data?.availableBalance ?? 0n)
    : liveRisk.availableBalance;
  const maxWithdrawable = isTreasury ? hedgerBalance : userAvailableBalance;
  const maxPayout = isTreasury
    ? (maxWithdrawable > 0n ? maxWithdrawable : 0n)
    : getWithdrawalMaxPayout(maxWithdrawable);
  const totalDebit = isTreasury
    ? scaledAmount
    : getWithdrawalTotalDebit(scaledAmount, maxWithdrawable, isMax);
  const withdrawalFee = isTreasury
    ? 0n
    : getWithdrawalFee(scaledAmount, maxWithdrawable, isMax);

  const handleMaxClick = useCallback(() => {
    if (maxWithdrawable > 0n) {
      const maxAmount = fromScaledPrice(maxPayout);
      setAmount(maxAmount);
      setIsMax(true);
    }
  }, [maxPayout, maxWithdrawable]);

  const hasEnoughBalance = isTreasury
    ? scaledAmount > 0n && scaledAmount <= maxWithdrawable
    : hasEnoughForWithdrawal(scaledAmount, maxWithdrawable, isMax);
  const hasWithdrawIntent =
    scaledAmount > 0n || (!isTreasury && isMax && maxWithdrawable > 0n);
  const belowMinimum =
    hasWithdrawIntent &&
    (isTreasury
      ? scaledAmount < MIN_WITHDRAWAL_AMOUNT && !(isMax && scaledAmount === maxWithdrawable)
      : isBelowWithdrawalMinimum(scaledAmount, maxWithdrawable, isMax));
  const aboveMaximum =
    hasWithdrawIntent && !isTreasury && isAboveWithdrawalMaximum(scaledAmount);
  const balanceLabel =
    accountError
      ? t("Unavailable")
      : !accountReady
        ? t("Loading...")
        : formatNumber(maxPayout, { scaled: "price" });

  useEffect(() => {
    resetMutation();
  }, [resetMutation, amount]);

  useEffect(() => {
    setLegacyUserSelected(false);
    setAmount("");
    setIsMax(false);
  }, [walletAddress, isHedger]);

  // Withdrawals require an on-chain wallet — not available in shared session mode.
  if (sharedSession || (!walletAddress && viewerAddress)) return null;

  return (
    <ResponsiveModal open={open} onOpenChange={setOpen}>
      <ResponsiveModalTrigger asChild>
        {trigger ?? (
          <button className="flex items-center h-full gap-1 border border-button-secondary-border bg-button-secondary hover:bg-button-secondary-hover text-content px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all">
            <Minus size={12} />
            {t("Withdraw")}
          </button>
        )}
      </ResponsiveModalTrigger>
      <ResponsiveModalContent className="max-w-[560px]">
        <ResponsiveModalHeader className="items-center px-6 pb-5 pt-4 text-center">
          {logoUrl && <img
            src={logoUrl}
            width={48}
            height={48}
            alt=""
            aria-hidden="true"
            className="mb-4 h-[48px] w-[48px] shrink-0 rounded-full"
          />}
          <ResponsiveModalTitle className="text-center text-[18px] font-medium leading-tight md:text-[18px]">
            {t("Withdraw {{collateralSymbol}} to", { collateralSymbol })} {targetChainName}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="mx-auto text-center text-[13px] font-medium leading-snug text-content">
            {t("{{collateralSymbol}} will be sent over the {{chainName}} network to your address.", {
              collateralSymbol,
              chainName: targetChainName,
            })}
            {!isTreasury && (
              <>
                <br />
                {t("A 1 {{collateralSymbol}} fee will be deducted from the {{collateralSymbol}} withdrawn.", { collateralSymbol })}
              </>
            )}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="p-5 space-y-4 pb-0">
          {!isWithdrawAmountLoading && !isSubmitting && <CollateralTokenDetails />}
          {isHedger && (
            <fieldset className="space-y-2" disabled={isSubmitting}>
              <legend className="text-xs text-content-muted">{t("Withdraw from")}</legend>
              <div className="flex gap-2">
                {[
                  { legacy: false, label: "Hedger funds" },
                  { legacy: true, label: "Previous user funds" },
                ].map(({ legacy, label }) => (
                  <Button
                    key={label}
                    type="button"
                    variant={isLegacyUser === legacy ? "default" : "secondary"}
                    aria-pressed={isLegacyUser === legacy}
                    disabled={isSubmitting}
                    onClick={() => {
                      setLegacyUserSelected(legacy);
                      setAmount("");
                      setIsMax(false);
                    }}
                  >{t(label)}</Button>
                ))}
              </div>
              {isLegacyUser && (
                <p className="text-xs text-content-muted">
                  {t("Funds deposited before this wallet became the hedger. Normal withdrawal fees and security delay apply.")}
                </p>
              )}
            </fieldset>
          )}

          <AmountInput
            value={amount}
            onValueChange={(v, source) => {
              setAmount(v);
              if (source === "event") setIsMax(false);
            }}
            maxLabel={
              isWithdrawAmountLoading ? (
                <InlineValueSkeleton
                  testId="withdraw-max-skeleton"
                  className="h-3 w-20"
                />
              ) : (
                `${t("MAX")}: ${balanceLabel}`
              )
            }
            onMaxClick={handleMaxClick}
            disabled={
              isSubmitting ||
              isWithdrawAmountLoading ||
              (isHedger && !accountReady)
            }
            placeholder="Amount"
          />
          <div className="flex items-center justify-between text-xs text-content-muted">
            <span>{t("Available to withdraw")}</span>
            <span>
              {isWithdrawAmountLoading ? (
                <InlineValueSkeleton testId="withdraw-balance-skeleton" />
              ) : (
                <>
                  {balanceLabel}
                  {accountReady && ` ${collateralSymbol}`}
                </>
              )}
            </span>
          </div>
          {!isTreasury && (
            <div className="flex items-center justify-between text-xs text-content-muted">
              <span>{t("Withdrawal fee")}</span>
              <span>
                {isWithdrawAmountLoading ? (
                  <InlineValueSkeleton
                    testId="withdraw-fee-skeleton"
                    className="h-3 w-16"
                  />
                ) : (
                  `${formatNumber(withdrawalFee, { scaled: "price" })} ${collateralSymbol}`
                )}
              </span>
            </div>
          )}
          {scaledAmount > 0n && (
            <div className="flex items-center justify-between text-xs text-content-muted">
              <span>{isTreasury ? t("Amount") : t("Total debit")}</span>
              <span>
                {isWithdrawAmountLoading ? (
                  <InlineValueSkeleton
                    testId="withdraw-total-debit-skeleton"
                    className="h-3 w-16"
                  />
                ) : (
                  `${formatNumber(totalDebit, { scaled: "price" })} ${collateralSymbol}`
                )}
              </span>
            </div>
          )}

          {/* Action Button */}
          <AuthGuardButton>
            <Button
              type="button"
              variant="default"
              className="w-full"
              disabled={
                !isHedgerRoleResolved ||
                isWithdrawAmountLoading ||
                !accountReady ||
                !hasWithdrawIntent ||
                belowMinimum ||
                aboveMaximum ||
                !hasEnoughBalance
              }
              loading={isSubmitting}
              onClick={() =>
                handleSubmit({
                  amount: scaledAmount,
                  isMax,
                  isHedger,
                  ...(isLegacyUser ? { isLegacyUser: true } : {}),
                  onSuccess: () => {
                    setOpen(false);
                    setAmount("");
                    setIsMax(false);
                  },
                })
              }
            >
              {isSubmitting
                ? t("Processing...")
                : !isHedgerRoleResolved || isWithdrawAmountLoading
                  ? t("Loading...")
                : accountError
                  ? (isLegacyUser ? t("Previous user funds unavailable") : t("Hedger balance unavailable"))
                : isHedger && !accountReady
                  ? t("Loading...")
                : belowMinimum
                  ? t("Minimum withdrawal is 2 {{collateralSymbol}}", { collateralSymbol })
                : aboveMaximum
                  ? t("Maximum withdrawal is 10000 {{collateralSymbol}}", { collateralSymbol })
                : !hasEnoughBalance && Number(amount) > 0
                  ? t("Insufficient Funds")
                  : `${t("Withdraw to")} ${targetChainName}`}
            </Button>
          </AuthGuardButton>
          <ResponsiveModalFooter>
            <div className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-edge bg-raised p-3 text-center text-sm leading-5 text-content">
              <Clock3 aria-hidden="true" className="h-4 w-4 shrink-0 text-accent-primary" />
              <p>{t("Withdrawals are released after a 24-hour security delay.")}</p>
            </div>
          </ResponsiveModalFooter>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
