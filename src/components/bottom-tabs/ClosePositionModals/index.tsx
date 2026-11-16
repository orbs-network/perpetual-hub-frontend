import { useCallback, useMemo, useState } from "react";
import BN from "bignumber.js";
import type { Position } from "@/types";
import { LimitCloseModal } from "./LimitCloseModal";
import { MarketCloseModal } from "./MarketCloseModal";
import { ReversePositionModal } from "./ReversePositionModal";
import {
  getSubmitOrderErrorTitle,
  useSubmitOrder,
} from "@/hooks/mutations/useSubmitOrder";
import { useReversePosition } from "@/hooks/mutations/useClosePosition";
import { useUserPreferencesStore } from "@/stores/userPreferencesStore";
import { useMarket } from "@/hooks/useMarkets";
import { resolveCloseParams } from "./utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useOnOrdersChangeCallback } from "@/hooks/mutations/useOnOrdersChangeCallback";
import { useSubmitOrderSuccessTitle } from "@/hooks/useFormatFillMessage";
import { useTranslation } from "@/hooks/useSafeTranslation";

export { TpSlModal } from "./TpSlModal";

type CloseMode = "limit" | "market" | "reverse";
type CloseActionVariant = "button" | "link";
type CloseActionLabels = "short" | "close";

export function ClosePositionModals({
  position,
  variant = "button",
  labels = "short",
}: {
  position: Position;
  variant?: CloseActionVariant;
  labels?: CloseActionLabels;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<CloseMode | null>(null);
  const { isLong, absQuantity } = useMemo(() => {
    const quantity = BN(position.quantity.toString());
    return {
      isLong: quantity.gt(0),
      absQuantity: quantity.abs(),
    };
  }, [position.quantity]);
  const skipCloseConfirm = useUserPreferencesStore(
    (s) => s.skipClosePositionConfirm,
  );
  const { mutateAsync: submitOrder, isPending } = useSubmitOrder();
  const { mutateAsync: reversePosition, isPending: isReversing } =
    useReversePosition();
  const getSubmitOrderSuccessTitle = useSubmitOrderSuccessTitle(
    position.symbol,
  );
  const { mutateAsync: refetchOrders } = useOnOrdersChangeCallback();
  const market = useMarket(position.symbol);
  const qtyPrecision = market?.quantityPrecision ?? 8;

  const handleMarketClose = useCallback(async () => {
    if (skipCloseConfirm) {
      const { quantity } = resolveCloseParams(absQuantity, 100, qtyPrecision);
      const input = {
        symbol: position.symbol,
        orderType: "MARKET" as const,
        side: isLong ? ("SELL" as const) : ("BUY" as const),
        quantity,
        closePosition: true,
      };
      const toastId = toast.loading(t("Order submitted"));
      try {
        const response = await submitOrder({ input });
        await refetchOrders();
        toast.success(getSubmitOrderSuccessTitle(response, input), {
          id: toastId,
          duration: 4000,
        });
      } catch {
        toast.error(getSubmitOrderErrorTitle(input, t), {
          id: toastId,
          duration: 6000,
        });
      }
    } else {
      setMode("market");
    }
  }, [
    absQuantity,
    getSubmitOrderSuccessTitle,
    isLong,
    position.symbol,
    qtyPrecision,
    refetchOrders,
    skipCloseConfirm,
    submitOrder,
    t,
  ]);
  const handleReverse = useCallback(async () => {
    if (skipCloseConfirm) {
      try {
        await reversePosition(position);
      } catch {
        // Toast/error ownership lives in useReversePosition.
      }
    } else {
      setMode("reverse");
    }
  }, [position, reversePosition, skipCloseConfirm]);
  const actionClassName = useMemo(
    () =>
      cn(
        "transition-colors font-semibold disabled:cursor-not-allowed disabled:opacity-50",
        variant === "link"
          ? "px-0 py-0 text-[12px] text-content-secondary hover:text-content"
          : "px-3 py-1 text-[12px] md:px-2.5 md:py-1 md:text-[11px] rounded bg-content-muted/10 hover:bg-content-muted/20 text-content-secondary",
      ),
    [variant],
  );
  const limitLabel = labels === "close" ? "Limit Close" : "Limit";
  const marketLabel = labels === "close" ? "Market Close" : "Market";

  return (
    <>
      <div
        className={cn(
          "flex items-center",
          variant === "link" ? "gap-3" : "gap-1.5",
        )}
      >
        <button
          type="button"
          onClick={() => setMode("limit")}
          className={actionClassName}
        >
          {t(limitLabel)}</button>
        <button
          type="button"
          onClick={handleMarketClose}
          disabled={isPending || isReversing}
          className={actionClassName}
        >
          {t(isPending ? "Closing..." : marketLabel)}
        </button>
        <button
          type="button"
          onClick={handleReverse}
          disabled={isPending || isReversing}
          className={actionClassName}
        >
          {t(isReversing ? "Reversing..." : "Reverse")}
        </button>
      </div>

      <LimitCloseModal
        position={position}
        isLong={isLong}
        absQuantity={absQuantity}
        onClose={() => setMode(null)}
        isOpen={mode === "limit"}
      />
      <MarketCloseModal
        position={position}
        isLong={isLong}
        absQuantity={absQuantity}
        onClose={() => setMode(null)}
        isOpen={mode === "market"}
      />
      <ReversePositionModal
        position={position}
        isLong={isLong}
        onClose={() => setMode(null)}
        isOpen={mode === "reverse"}
      />
    </>
  );
}
