import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "../../ui/responsive-modal";
import { Button } from "../../ui/button";
import { AuthGuardButton } from "../../AuthGuardButton";
import { SkipConfirmCheckbox } from "../../ui/skip-confirm-checkbox";
import { useOrderFormStore } from "@/stores/orderFormStore";
import { useFormMarginInfo } from "@/hooks/order-form/useFormMarginInfo";
import { useUserAccount } from "@/hooks/useUserAccount";
import { getDisplaySymbol } from "@/lib/utils";
import {
  formatNumber,
  toScaledQuantityWithStep,
} from "@/utils/formatting";
import { useUserPreferencesStore } from "@/stores/userPreferencesStore";
import { useSubmitFormOrder } from "@/hooks/mutations/useSubmitFormOrder";
import { LiquidationPriceRow } from "../../LiquidationPriceRow";
import { getReduceOnlyMaxQuantity } from "@/utils/orderSizing";
import { useTradeSymbol } from "@/hooks/useSelectTradeSymbol";
import { useSymbolConfig } from "@/hooks/useSymbolConfig";
import { partner } from "@/config/partners";

function ConfirmRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-content-muted">{t(label)}</span>
      <span className={valueClassName ?? "text-content font-semibold"}>
        {value}
      </span>
    </div>
  );
}

const NoGasMessage = () => {
  const { t } = useTranslation();
  return (
    <p className="text-[13px] text-content-muted">
      {t(
        "You pay no gas. The order will be confirmed within a few seconds.",
      )}
    </p>
  );
};

const DontShowAgainCheckbox = () => {
  const {
    skipOpenOrderConfirm: skipConfirm,
    setSkipOpenOrderConfirm: setSkipConfirm,
  } = useUserPreferencesStore();
  return (
    <SkipConfirmCheckbox
      checked={skipConfirm}
      onCheckedChange={setSkipConfirm}
    />
  );
};

function SubmitButton({ onOpenConfirm }: { onOpenConfirm: () => void }) {
  const { t } = useTranslation();
  const { skipOpenOrderConfirm: skipConfirm } = useUserPreferencesStore();
  const { data: userData } = useUserAccount();
  const {
    side,
    uiOrderType,
    price,
    closePosition,
    takeProfitEnabled,
    stopLossEnabled,
  } = useOrderFormStore();
  const { symbol, market } = useTradeSymbol();
  const symbolConfig = useSymbolConfig(symbol);
  const { mutate: submitOrder, isPending: isSubmitting } = useSubmitFormOrder();
  const hasNoBalance = userData?.hasNoBalance;
  const buyButtonVariant = partner.featureFlags?.themedOrderButtons
    ? "themedTradeLong"
    : "tradeLong";
  const { marginInfo, effectiveReduceOnly } = useFormMarginInfo();
  const { skipRiskEngine } = useOrderFormStore();
  const reduceOnlyMaxQuantity = useMemo(
    () => getReduceOnlyMaxQuantity(userData?.positions ?? [], symbol, side),
    [userData?.positions, symbol, side],
  );
  const requestedQuantity = useMemo(() => {
    try {
      return toScaledQuantityWithStep(
        marginInfo.derivedQuantity || "0",
        symbolConfig?.stepSize,
        market?.quantityPrecision ?? 3,
      );
    } catch {
      return 0n;
    }
  }, [
    marginInfo.derivedQuantity,
    market?.quantityPrecision,
    symbolConfig?.stepSize,
  ]);
  const {
    reduceOnlyUnavailable,
    isOppositeCloseOnly,
    isFlipOrder,
    bypassMarginChecks,
  } = useMemo(() => {
    const nextReduceOnlyUnavailable =
      effectiveReduceOnly && reduceOnlyMaxQuantity <= 0n;
    const shouldCloseOppositeImmediately = uiOrderType !== "LIMIT";
    const hasOppositeLivePosition =
      !effectiveReduceOnly && !closePosition && reduceOnlyMaxQuantity > 0n;
    const isOppositeLimitReduce =
      uiOrderType === "LIMIT" &&
      hasOppositeLivePosition &&
      requestedQuantity <= reduceOnlyMaxQuantity;
    const nextIsOppositeCloseOnly =
      shouldCloseOppositeImmediately &&
      hasOppositeLivePosition &&
      requestedQuantity <= reduceOnlyMaxQuantity;
    return {
      reduceOnlyUnavailable: nextReduceOnlyUnavailable,
      isOppositeCloseOnly: nextIsOppositeCloseOnly,
      isFlipOrder:
        shouldCloseOppositeImmediately &&
        hasOppositeLivePosition &&
        requestedQuantity > reduceOnlyMaxQuantity,
      bypassMarginChecks:
        effectiveReduceOnly ||
        skipRiskEngine ||
        nextIsOppositeCloseOnly ||
        isOppositeLimitReduce,
    };
  }, [
    closePosition,
    effectiveReduceOnly,
    reduceOnlyMaxQuantity,
    requestedQuantity,
    skipRiskEngine,
    uiOrderType,
  ]);

  const hasPositiveNotional = useMemo(
    () => parseFloat(marginInfo.notionalValue) > 0,
    [marginInfo.notionalValue],
  );

  const exceedsBuyingPower =
    !bypassMarginChecks && !marginInfo.hasEnough && hasPositiveNotional;
  const attachedTpSlUnavailable =
    (takeProfitEnabled || stopLossEnabled) &&
    (effectiveReduceOnly || closePosition);

  const missingLimitPrice = useMemo(() => {
    const parsedLimitPrice = parseFloat(price);
    return (
      !isOppositeCloseOnly &&
      uiOrderType === "LIMIT" &&
      (!Number.isFinite(parsedLimitPrice) || parsedLimitPrice <= 0)
    );
  }, [isOppositeCloseOnly, price, uiOrderType]);
  const { marginPercent, sizeValue } = useOrderFormStore();
  const amountTooSmall = useMemo(
    () =>
      !marginInfo.hasValidQuantity &&
      (marginPercent > 0 || !!sizeValue) &&
      !hasNoBalance,
    [hasNoBalance, marginInfo.hasValidQuantity, marginPercent, sizeValue],
  );

  const isDisabled = useMemo(
    () =>
      isSubmitting ||
      attachedTpSlUnavailable ||
      reduceOnlyUnavailable ||
      hasNoBalance ||
      missingLimitPrice ||
      !marginInfo.hasValidQuantity ||
      exceedsBuyingPower,
    [
      attachedTpSlUnavailable,
      exceedsBuyingPower,
      hasNoBalance,
      isSubmitting,
      marginInfo.hasValidQuantity,
      missingLimitPrice,
      reduceOnlyUnavailable,
    ],
  );
  const text = useMemo(() => {
    if (attachedTpSlUnavailable) return t("TP/SL unavailable");
    if (reduceOnlyUnavailable) return t("No Position To Reduce");
    if (hasNoBalance) return t("Not Enough Margin");
    if (amountTooSmall) return t("Amount Too Small");
    if (exceedsBuyingPower) return t("Exceeds Buying Power");
    return t("Place Order");
  }, [
    attachedTpSlUnavailable,
    reduceOnlyUnavailable,
    hasNoBalance,
    amountTooSmall,
    exceedsBuyingPower,
    t,
  ]);

  return (
    <AuthGuardButton
      className="w-full"
      connectOrEnableVariant="themed"
      variant={side === "BUY" ? buyButtonVariant : "tradeShort"}
    >
      <Button
        type="button"
        variant={side === "BUY" ? buyButtonVariant : "tradeShort"}
        disabled={isDisabled}
        loading={isSubmitting}
        className="order-submit-button w-full mt-5"
        onClick={() => {
          if (skipConfirm && !isFlipOrder) {
            submitOrder();
          } else {
            onOpenConfirm();
          }
        }}
      >
        {text}
      </Button>
    </AuthGuardButton>
  );
}

export function OrderConfirmModal() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { side, uiOrderType, price } = useOrderFormStore();
  const { symbol, market } = useTradeSymbol();
  const { mutate: submitOrder, isPending: isSubmitting } = useSubmitFormOrder();
  const precision = market?.quantityPrecision;
  const { marginInfo, liquidationEstimate } = useFormMarginInfo();
  const displaySymbol = useMemo(() => getDisplaySymbol(symbol), [symbol]);
  const sideLabel = useMemo(
    () => t(side === "BUY" ? "Long" : "Short"),
    [side, t],
  );
  const buttonLabel = useMemo(
    () => t(side === "BUY" ? "Buy / Long" : "Sell / Short"),
    [side, t],
  );

  const priceDisplay = useMemo(
    () =>
      uiOrderType === "LIMIT" && price ? `$${price}` : t("Market"),
    [price, t, uiOrderType],
  );
  const sizeDisplay = useMemo(
    () =>
      `${formatNumber(marginInfo.derivedQuantity || "0", {
        decimalScale: precision,
      })} ${displaySymbol}`,
    [displaySymbol, marginInfo.derivedQuantity, precision],
  );

  const handleConfirm = useCallback(() => {
    submitOrder();
    setOpen(false);
  }, [submitOrder, setOpen]);

  return (
    <>
      <SubmitButton onOpenConfirm={() => setOpen(true)} />
      <ResponsiveModal open={open} onOpenChange={setOpen}>
        <ResponsiveModalContent className="max-w-lg">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle className="text-xl">
              {t("Confirm Order")}
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div className="px-5 py-4 pb-0 space-y-5">
            <div className="space-y-2">
              <ConfirmRow
                label="Action"
                value={sideLabel}
                valueClassName={
                  side === "BUY"
                    ? "text-up font-semibold"
                    : "text-down font-semibold"
                }
              />
              <ConfirmRow
                label="Size"
                value={sizeDisplay}
              />
              <ConfirmRow label="Price" value={priceDisplay} />
              <LiquidationPriceRow
                liquidationPrice={liquidationEstimate?.liquidationPrice}
              />
            </div>
            <div className="flex flex-col gap-3">
              <NoGasMessage />

              <DontShowAgainCheckbox />
            </div>

            <Button
              variant={side === "BUY" ? "tradeLong" : "tradeShort"}
              loading={isSubmitting}
              disabled={isSubmitting}
              className="order-submit-button w-full py-3 font-bold text-[14px]"
              onClick={handleConfirm}
            >
              {buttonLabel}
            </Button>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}
