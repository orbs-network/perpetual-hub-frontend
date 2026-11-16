import { getCollateralSymbol } from "@/utils/collateralDisplay";
import { useCallback, useMemo, useState } from "react";
import BN from "bignumber.js";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
} from "@/components/ui/responsive-modal";
import { NumericInput } from "@/components/ui/numeric-input";
import { AuthGuardButton } from "@/components/AuthGuardButton";
import { Button } from "@/components/ui/button";
import { useCancelOrder } from "@/hooks/mutations/useCancelOrder";
import {
  getSubmitOrderErrorTitle,
  useSubmitOrder,
} from "@/hooks/mutations/useSubmitOrder";
import { useSubmitOrderSuccessTitle } from "@/hooks/useFormatFillMessage";
import { usePrice } from "@/hooks/useBinancePrices";
import { useSymbolOrderBook } from "@/hooks/useOrderBook";
import {
  domainPriceNotional,
  formatNumber,
  toDomainPrice,
} from "@/utils/formatting";
import { buildLimitCloseOrderInput } from "./limitCloseOrder";
import { useMarket } from "@/hooks/useMarkets";
import type { Position } from "@/types";
import { CloseSizeInput } from "./CloseSizeInput";
import {
  getBaseAsset,
  getFullCloseLimitOrdersToReplace,
  resolveCloseParams,
} from "./utils";
import { useUserAccount } from "@/hooks/useUserAccount";
import { toast } from "sonner";
import { useOnOrdersChangeCallback } from "@/hooks/mutations/useOnOrdersChangeCallback";
import { useMutation } from "@tanstack/react-query";
import { useOrderOperationsStore } from "@/stores/orderOperationsStore";
import { HIDDEN_PNL_TEXT } from "@/lib/pnlPrivacy";
import { useUserPreferencesStore } from "@/stores/userPreferencesStore";
import { useTranslation } from "@/hooks/useSafeTranslation";

export function LimitCloseModal({
  position,
  isLong,
  absQuantity,
  onClose,
  isOpen,
}: {
  position: Position;
  isLong: boolean;
  absQuantity: BN;
  onClose: () => void;
  isOpen: boolean;
}) {
  const { t } = useTranslation();
  const orders = useUserAccount().data?.orders;
  const { mutateAsync: submitOrder } = useSubmitOrder();
  const getSubmitOrderSuccessTitle = useSubmitOrderSuccessTitle(
    position.symbol,
  );
  const { mutateAsync: refetchOrders } = useOnOrdersChangeCallback();
  const { mutateAsync: cancelOrder, isPending: isCancelling } =
    useCancelOrder();
  const beginOrderReplacement = useOrderOperationsStore(
    (state) => state.beginOrderReplacement,
  );
  const endOrderReplacement = useOrderOperationsStore(
    (state) => state.endOrderReplacement,
  );
  const hidePnl = useUserPreferencesStore((state) => state.hidePnl);
  const { data: orderBook } = useSymbolOrderBook(position.symbol);
  const priceData = usePrice(position.symbol);
  const market = useMarket(position.symbol);
  const [price, setPrice] = useState("");
  const [sizePercent, setSizePercent] = useState(100);

  const markPrice = priceData?.price ?? 0;
  const baseAsset = useMemo(() => getBaseAsset(position.symbol), [position.symbol]);
  const qtyPrecision = market?.quantityPrecision ?? 8;
  const pricePrecision = market?.pricePrecision ?? 2;

  const closeParams = useMemo(
    () => resolveCloseParams(absQuantity, sizePercent, qtyPrecision),
    [absQuantity, sizePercent, qtyPrecision],
  );

  const hasValidPrice = useMemo(() => {
    const parsedPrice = parseFloat(price);
    return price !== "" && Number.isFinite(parsedPrice) && parsedPrice > 0;
  }, [price]);
  const replacementOrders = useMemo(
    () =>
      closeParams.isFullClose
        ? getFullCloseLimitOrdersToReplace(
            orders ?? [],
            position.symbol,
            isLong ? "SELL" : "BUY",
          )
        : [],
    [closeParams.isFullClose, orders, position.symbol, isLong],
  );

  const estimatedPnl = useMemo(() => {
    if (!hasValidPrice || !closeParams.isValid) return null;
    // Exact 1e18 prices; the PnL is a 1e6 USDC amount.
    const closePrice = toDomainPrice(price);
    const priceDiff = isLong
      ? closePrice - position.entryPrice
      : position.entryPrice - closePrice;
    return domainPriceNotional(closeParams.quantity, priceDiff);
  }, [
    hasValidPrice,
    price,
    closeParams.isValid,
    closeParams.quantity,
    isLong,
    position.entryPrice,
  ]);

  const handleMid = useCallback(() => {
    if (orderBook?.midPrice) {
      setPrice(orderBook.midPrice.toFixed(pricePrecision));
    }
  }, [orderBook?.midPrice, pricePrecision]);

  const { mutateAsync: handleConfirm, isPending: isSubmitting } = useMutation({
    mutationFn: async () => {
      if (!hasValidPrice || !closeParams.isValid) return;
      const input = buildLimitCloseOrderInput({
        position,
        isLong,
        quantity: closeParams.quantity,
        price,
        pricePrecision,
        isFullClose: closeParams.isFullClose,
      });
      const toastId = toast.loading(t("Order submitted"));
      const hasReplacements = replacementOrders.length > 0;
      if (hasReplacements) {
        beginOrderReplacement();
      }

      try {
        for (const order of replacementOrders) {
          await cancelOrder({
            orderId: order.orderId,
            silent: true,
            refetchOnSuccess: false,
          });
        }
        const response = await submitOrder({ input });
        await refetchOrders();
        toast.success(getSubmitOrderSuccessTitle(response, input), {
          id: toastId,
          duration: 4000,
        });
        onClose();
      } catch {
        if (hasReplacements) {
          try {
            await refetchOrders();
          } catch (refetchError) {
            console.error(refetchError);
          }
        }
        toast.error(getSubmitOrderErrorTitle(input, t), {
          id: toastId,
          duration: 6000,
        });
      } finally {
        if (hasReplacements) {
          endOrderReplacement();
        }
      }
    },
  });

  const isPending = isSubmitting || isCancelling;

  return (
    <ResponsiveModal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ResponsiveModalContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle className="text-center">
            {t("Limit Close")}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-center text-content-muted text-sm">
            {t(
              "This will send an order to close your position at the limit price.",
            )}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="space-y-3 p-5 pb-0">
          <NumericInput
            value={price}
            onValueChange={(v) => setPrice(v.value)}
            decimalScale={pricePrecision}
            className="text-right pl-2 flex-1"
            placeholder=""
            startContent={t("Price ({{collateralSymbol}})", { collateralSymbol: getCollateralSymbol() })}
            endContent={
              <button
                onClick={handleMid}
                className="text-[12px] font-medium text-accent-primary hover:text-accent-primary/80 transition-colors"
              >
                {t("Mid")}
              </button>
            }
          />

          <CloseSizeInput
            absQuantity={absQuantity}
            markPrice={markPrice}
            baseAsset={baseAsset}
            onValueChange={(_v, pct) => setSizePercent(pct)}
          />

          {estimatedPnl !== null && (
            <div className="text-[13px] text-content text-center py-1">
              {t("Estimated closed PnL (without fees):")}{" "}
              <span className={hidePnl ? "text-content-muted" : estimatedPnl >= 0n ? "text-up" : "text-down"}>
                {hidePnl
                  ? HIDDEN_PNL_TEXT
                  : formatNumber(estimatedPnl, {
                      scaled: "price",
                      decimalScale: 2,
                      prefix: "$",
                    })}
              </span>
            </div>
          )}

          <div className="pt-4">
            <AuthGuardButton className="w-full">
              <Button
                type="button"
                onClick={() => handleConfirm()}
                disabled={isPending || !hasValidPrice || !closeParams.isValid}
                loading={isPending}
                className="w-full py-2.5 font-bold"
              >
                {t(
                  closeParams.exceedsPosition
                    ? "Amount exceeds position size"
                    : "Limit Close",
                )}
              </Button>
            </AuthGuardButton>
          </div>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
