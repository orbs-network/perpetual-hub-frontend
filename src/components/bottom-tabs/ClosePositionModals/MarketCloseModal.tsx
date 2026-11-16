import { useMemo, useState } from "react";
import BN from "bignumber.js";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
} from "@/components/ui/responsive-modal";
import { AuthGuardButton } from "@/components/AuthGuardButton";
import { Button } from "@/components/ui/button";
import { SkipConfirmCheckbox } from "@/components/ui/skip-confirm-checkbox";
import {
  getSubmitOrderErrorTitle,
  useSubmitOrder,
} from "@/hooks/mutations/useSubmitOrder";
import { useSubmitOrderSuccessTitle } from "@/hooks/useFormatFillMessage";
import { useUserPreferencesStore } from "@/stores/userPreferencesStore";
import { usePrice } from "@/hooks/useBinancePrices";
import { useMarket } from "@/hooks/useMarkets";
import type { Position } from "@/types";
import { CloseSizeInput } from "./CloseSizeInput";
import { getBaseAsset, resolveCloseParams } from "./utils";
import { toast } from "sonner";
import { useOnOrdersChangeCallback } from "@/hooks/mutations/useOnOrdersChangeCallback";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "@/hooks/useSafeTranslation";

export function MarketCloseModal({
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
  const { mutateAsync: submitOrder } = useSubmitOrder();
  const getSubmitOrderSuccessTitle = useSubmitOrderSuccessTitle(
    position.symbol,
  );
  const { mutateAsync: refetchOrders } = useOnOrdersChangeCallback();
  const priceData = usePrice(position.symbol);
  const market = useMarket(position.symbol);
  const [sizePercent, setSizePercent] = useState(100);
  const skipClosePositionConfirm = useUserPreferencesStore(
    (state) => state.skipClosePositionConfirm,
  );
  const setSkipClosePositionConfirm = useUserPreferencesStore(
    (state) => state.setSkipClosePositionConfirm,
  );

  const markPrice = priceData?.price ?? 0;
  const baseAsset = useMemo(() => getBaseAsset(position.symbol), [position.symbol]);
  const qtyPrecision = market?.quantityPrecision ?? 8;

  const closeParams = useMemo(
    () => resolveCloseParams(absQuantity, sizePercent, qtyPrecision),
    [absQuantity, sizePercent, qtyPrecision],
  );

  const { mutateAsync: handleConfirm, isPending } = useMutation({
    mutationFn: async () => {
      if (!closeParams.isValid) return;
      const input = {
        symbol: position.symbol,
        orderType: "MARKET" as const,
        side: isLong ? ("SELL" as const) : ("BUY" as const),
        quantity: closeParams.quantity,
        closePosition: closeParams.isFullClose,
        reduceOnly: !closeParams.isFullClose,
      };
      const toastId = toast.loading(t("Submit market close order"));

      try {
        const response = await submitOrder({ input });
        await refetchOrders();
        toast.success(getSubmitOrderSuccessTitle(response, input), {
          id: toastId,
          duration: 4000,
        });
        onClose();
      } catch {
        toast.error(getSubmitOrderErrorTitle(input, t), {
          id: toastId,
          duration: 6000,
        });
      }
    },
  });
  return (
    <ResponsiveModal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ResponsiveModalContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle className="text-center">
            {t("Market Close")}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-center text-content-muted text-sm">
            {t("This will attempt to immediately close the position.")}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="p-5 space-y-4 pb-0">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-content-secondary">
                {t("Price")}
              </span>
              <span className=" text-content text-[12px]">
                {t("Market")}
              </span>
            </div>

            <div className="flex justify-between text-[12px]">
              <span className="text-content-secondary">
                {t("Close Size")}
              </span>
              <span className=" text-content text-[12px]">
                {closeParams.displayQuantity} {baseAsset}
              </span>
            </div>
          </div>

          <CloseSizeInput
            absQuantity={absQuantity}
            markPrice={markPrice}
            baseAsset={baseAsset}
            onValueChange={(_v, pct) => setSizePercent(pct)}
          />
          <SkipConfirmCheckbox
            checked={skipClosePositionConfirm}
            onCheckedChange={setSkipClosePositionConfirm}
          />
          <AuthGuardButton className="w-full">
            <Button
              type="button"
              onClick={() => handleConfirm()}
              disabled={isPending || !closeParams.isValid}
              loading={isPending}
              className="w-full py-2.5 font-bold"
            >
              {t(
                closeParams.exceedsPosition
                  ? "Amount exceeds position size"
                  : "Market Close",
              )}
            </Button>
          </AuthGuardButton>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
