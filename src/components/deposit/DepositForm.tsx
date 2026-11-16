import { CollateralTokenDetails } from "@/components/CollateralTokenDetails";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { Button } from "@/components/ui/button";
import { AmountInput } from "@/components/ui/amount-input";
import { Skeleton } from "@/components/ui/skeleton";
import { SignTransactionOverlay } from "@/components/ui/sign-transaction-overlay";
import {
  useDepositFlow,
  useUSDCBalance,
} from "@/hooks/mutations/useDeposit";
import { cn } from "@/lib/utils";
import { formatNumber, toScaledPrice } from "@/utils/formatting";

interface DepositFormProps {
  className?: string;
  onDepositSuccess?: () => void;
  renderSubmit?: (button: ReactNode) => ReactNode;
}

export function DepositForm({
  className,
  onDepositSuccess,
  renderSubmit,
}: DepositFormProps) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState("");

  const {
    balance: usdcBalance,
    isLoading: isUSDCBalanceLoading,
    refetch,
    balanceFormatted: usdcBalanceFormatted,
  } = useUSDCBalance();
  const parsedAmount = amount ? toScaledPrice(amount) : 0n;

  useEffect(() => {
    refetch();
  }, [refetch]);

  const { mutate: depositFlow, isPending, steps: signSteps } = useDepositFlow();

  const hasEnoughBalance = parsedAmount > 0n && usdcBalance >= parsedAmount;
  const showInsufficientBalance = !hasEnoughBalance && parsedAmount > 0n;
  const buttonText = t(
    showInsufficientBalance ? "Insufficient Funds" : "Deposit",
  );
  const buttonDisabled =
    isUSDCBalanceLoading || showInsufficientBalance || parsedAmount <= 0n;

  const handleDeposit = () => {
    depositFlow({
      amount: parsedAmount,
      onSuccess: () => {
        setAmount("");
        onDepositSuccess?.();
      },
    });
  };

  const submitButton = (
    <Button
      variant="default"
      className="w-full"
      onClick={handleDeposit}
      disabled={buttonDisabled}
    >
      {buttonText}
    </Button>
  );

  return (
    <div className={cn("p-5 space-y-4 pb-0", className)}>
      {!isUSDCBalanceLoading && !isPending && <CollateralTokenDetails />}
      {isPending ? (
        <SignTransactionOverlay steps={signSteps} />
      ) : (
        <>
          <AmountInput
            value={amount}
            onValueChange={setAmount}
            maxLabel={
              isUSDCBalanceLoading
                ? (
                    <Skeleton
                      data-testid="deposit-balance-skeleton"
                      className="h-3 w-20"
                    />
                  )
                : `${t("MAX")}: ${formatNumber(usdcBalance, { scaled: "price" })}`
            }
            onMaxClick={() => setAmount(usdcBalanceFormatted)}
            disabled={isUSDCBalanceLoading || usdcBalance <= 0n}
            focusColor="buy"
          />
          <div className="mt-2">
            {renderSubmit ? renderSubmit(submitButton) : submitButton}
          </div>
        </>
      )}
    </div>
  );
}
