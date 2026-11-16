import type { Position } from "../../types";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSubmitOrder } from "./useSubmitOrder";
import { useCancelOrder } from "./useCancelOrder";
import { useUserAccount } from "../useUserAccount";
import { useMarkets } from "../useMarkets";
import {
  BINANCE_CONFIG,
  DEFAULT_PRICE_SOURCE,
} from "@/config/constants";
import { toDomainTickPrice } from "@/utils/formatting";
import { fetchOrderBookSnapshot } from "@/api/book";
import {
  type CloseAllMethod,
  countRejectedSettledResults,
  getCloseAllOrdersToCancel,
} from "./closeAllOrders";
import { useOnOrdersChangeCallback } from "./useOnOrdersChangeCallback";
import { useAllPrices } from "../useBinancePrices";
import { useTeeConfig } from "../useTeeConfig";
import {
  DEFAULT_TRADING_FEE_RATE_BPS,
  resolveFeeRateBps,
} from "@/lib/margin";
import {
  buildReversePositionOrders,
  evaluateReversePositionPreflight,
} from "./reversePosition";
import { useOrderOperationsStore } from "@/stores/orderOperationsStore";
import { useTranslation } from "@/hooks/useSafeTranslation";

export type { CloseAllMethod } from "./closeAllOrders";

export const useReversePosition = () => {
  const { t } = useTranslation();
  const { mutateAsync: submitOrder } = useSubmitOrder();
  const { mutateAsync: refetchOrders } = useOnOrdersChangeCallback();
  const { data: userAccount } = useUserAccount();
  const { data: prices = {} } = useAllPrices();
  const { data: teeConfig } = useTeeConfig();
  const beginOrderReplacement = useOrderOperationsStore(
    (state) => state.beginOrderReplacement,
  );
  const endOrderReplacement = useOrderOperationsStore(
    (state) => state.endOrderReplacement,
  );

  return useMutation({
    mutationFn: async (position: Position) => {
      const orders = buildReversePositionOrders(position);
      if (!orders) {
        throw new Error(t("Position size is unavailable"));
      }

      const toastId = toast.loading(t("Reverse order submitted"));
      let closeFilled = false;
      let refreshPaused = false;
      const feeRateBps =
        resolveFeeRateBps(teeConfig, userAccount?.feeTier ?? 0) ??
        DEFAULT_TRADING_FEE_RATE_BPS;

      try {
        const preflight = evaluateReversePositionPreflight({
          position,
          positions: userAccount?.positions ?? [],
          pendingOrders: userAccount?.orders ?? [],
          prices,
          balance: userAccount?.accountSummary.balance ?? 0n,
          leveragePreferences: userAccount?.leveragePreferences ?? {},
          teeConfig,
          feeRateBps,
        });
        if (!preflight.canReverse) {
          throw new Error(
            t(preflight.reason ?? "Cannot reverse position"),
          );
        }

        refreshPaused = true;
        beginOrderReplacement();
        await submitOrder({ input: orders.closeInput });
        closeFilled = true;
        const response = await submitOrder({ input: orders.openInput });
        await refetchOrders();
        toast.success(t("Position reversed"), {
          id: toastId,
          duration: 4000,
        });
        return response;
      } catch (error) {
        if (refreshPaused) {
          try {
            await refetchOrders();
          } catch (refetchError) {
            console.error(refetchError);
          }
        }
        toast.error(
          t(closeFilled ? "Reverse open failed" : "Reverse failed"),
          {
            id: toastId,
            duration: 6000,
          },
        );
        throw error;
      } finally {
        if (refreshPaused) {
          endOrderReplacement();
        }
      }
    },
    onError: (error) => {
      console.error("Failed to reverse position:", error);
    },
  });
};

export const useCloseAllPositions = () => {
  const { t } = useTranslation();
  const { mutateAsync: submitOrder } = useSubmitOrder();
  const { mutateAsync: cancelOrder } = useCancelOrder();
  const { mutateAsync: refetchOrders } = useOnOrdersChangeCallback();
  const { data: userAccount } = useUserAccount();
  const { data: markets } = useMarkets();
  const priceSource = DEFAULT_PRICE_SOURCE;
  const beginOrderReplacement = useOrderOperationsStore(
    (state) => state.beginOrderReplacement,
  );
  const endOrderReplacement = useOrderOperationsStore(
    (state) => state.endOrderReplacement,
  );

  return useMutation({
    mutationFn: async ({
      onSuccess,
      method,
    }: {
      method: CloseAllMethod;
      onSuccess: () => void;
    }) => {
      const positions = userAccount?.positions ?? [];
      const orders = userAccount?.orders ?? [];
      if (positions.length === 0) return;
      beginOrderReplacement();

      const toastId = toast.loading(
        method === "market"
          ? t("Closing all positions at market price...")
          : t("Closing all positions at mid price..."),
      );

      try {
        const ordersToCancel = getCloseAllOrdersToCancel(
          positions,
          orders,
          method,
        );
        const cancelResults = await Promise.allSettled(
          ordersToCancel.map((order) =>
            cancelOrder({
              orderId: order.orderId,
              silent: true,
              refetchOnSuccess: false,
            }),
          ),
        );
        const failedCancels = countRejectedSettledResults(cancelResults);
        if (failedCancels > 0) {
          await refetchOrders();
          const message = `${failedCancels} ${t("existing close order(s) failed to cancel")}`;
          toast.error(message, { id: toastId, duration: 4000 });
          throw new Error(message);
        }

        let results: PromiseSettledResult<unknown>[];

        if (method === "market") {
          results = await Promise.allSettled(
            positions.map((position) => {
              const side = position.quantity > 0n ? "SELL" : "BUY";
              const absQuantity =
                position.quantity > 0n ? position.quantity : -position.quantity;
              return submitOrder({
                input: {
                  symbol: position.symbol,
                  orderType: "MARKET",
                  side,
                  quantity: absQuantity,
                  closePosition: true,
                },
              });
            }),
          );
        } else {
          const restUrl = BINANCE_CONFIG[priceSource].futuresRestUrl;
          results = await Promise.allSettled(
            positions.map(async (position) => {
              const side = position.quantity > 0n ? "SELL" : "BUY";
              const absQuantity =
                position.quantity > 0n ? position.quantity : -position.quantity;
              const market = markets?.find((m) => m.symbol === position.symbol);
              const pricePrecision = market?.pricePrecision ?? 2;
              const orderBook = await fetchOrderBookSnapshot(
                restUrl,
                position.symbol,
              );
              if (orderBook.midPrice <= 0) {
                throw new Error(`No mid price for ${position.symbol}`);
              }
              const price = toDomainTickPrice(
                orderBook.midPrice.toFixed(pricePrecision),
                pricePrecision,
              );
              return submitOrder({
                input: {
                  symbol: position.symbol,
                  orderType: "LIMIT",
                  side,
                  quantity: absQuantity,
                  price,
                  closePosition: true,
                },
              });
            }),
          );
        }

        const failed = results.filter((r) => r.status === "rejected").length;
        await refetchOrders();
        if (failed > 0) {
          toast.error(
            `${failed} ${t("position(s) failed to close")}`,
            { id: toastId, duration: 4000 },
          );
        } else {
          toast.success(
            method === "market"
              ? t("Close all positions at market price")
              : t("Placed orders to close all positions at mid price"),
            { id: toastId, duration: 4000 },
          );
        }
        onSuccess();
      } finally {
        endOrderReplacement();
      }
    },
  });
};
