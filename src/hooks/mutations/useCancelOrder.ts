import { cancelOrder } from "../../api/orders";
import { generateRequestId } from "../../api/client";
import { useAuthSession } from "../useAuthSession";
import { toast } from "sonner";
import { signCancel } from "../../utils/signing";
import { useMutation } from "@tanstack/react-query";
import { useActiveAddress } from "@/hooks/useActiveAddress";
import { useOnOrdersChangeCallback } from "./useOnOrdersChangeCallback";
import { useUserAccount } from "../useUserAccount";
import { ACTIVE_ORDER_STATUSES } from "@/config/constants";
import { useOrderOperationsStore } from "@/stores/orderOperationsStore";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { useSupportedChainId } from "@/hooks/useSupportedChainId";

export function useCancelOrder() {
  const { t } = useTranslation();
  const address = useActiveAddress();
  const sessionKey = useAuthSession().sessionKey;
  const { mutateAsync: refetchOrders } = useOnOrdersChangeCallback();
  const chainId = useSupportedChainId();

  return useMutation({
    mutationFn: async (
      input:
        | string
        | { orderId: string; silent?: boolean; refetchOnSuccess?: boolean },
    ) => {
      const orderId = typeof input === "string" ? input : input.orderId;
      const silent = typeof input === "string" ? false : !!input.silent;
      const refetchOnSuccess =
        typeof input === "string" ? true : input.refetchOnSuccess ?? true;

      if (!address || !sessionKey) {
        throw new Error("Sign in required");
      }
      if (!chainId) {
        throw new Error(t("Wallet chain is still loading"));
      }

      const toastId = silent ? undefined : toast.loading(t("Cancel order"));
      const serverRequestId = generateRequestId();

      try {
        const timestamp = BigInt(Date.now());
        const signature = await signCancel({
          sessionKey,
          chainId,
          user: address,
          orderId: BigInt(orderId),
          timestamp,
        });
        const response = await cancelOrder({
          requestId: serverRequestId,
          orderId,
          timestamp: Number(timestamp),
          signature,
        });

        if (refetchOnSuccess) {
          await refetchOrders();
        }

        if (!silent) {
          toast.success(t("Order cancelled"), { id: toastId, duration: 3000 });
        }
        return response;
      } catch (err) {
        if (!silent) {
          toast.error(t("Cancel failed"), { id: toastId, duration: 6000 });
        }
        throw err;
      }
    },
  });
}

export function useCancelAllOrders() {
  const { t } = useTranslation();
  const { mutateAsync: cancel } = useCancelOrder();
  const { mutateAsync: refetchOrders } = useOnOrdersChangeCallback();
  const { data: userAccount } = useUserAccount();
  const beginOrderReplacement = useOrderOperationsStore(
    (state) => state.beginOrderReplacement,
  );
  const endOrderReplacement = useOrderOperationsStore(
    (state) => state.endOrderReplacement,
  );

  return useMutation({
    mutationFn: async ({ onSuccess }: { onSuccess: () => void }) => {
      const orders = userAccount?.orders ?? [];
      const activeOrders = orders.filter((order) =>
        ACTIVE_ORDER_STATUSES.has(order.status),
      );
      if (activeOrders.length === 0) return;

      const toastId = toast.loading(t("Cancel orders"));
      beginOrderReplacement();

      try {
        const results = await Promise.allSettled(
          activeOrders.map((order) =>
            cancel({
              orderId: order.orderId,
              silent: true,
              refetchOnSuccess: false,
            }),
          ),
        );
        const failed = results.filter((r) => r.status === "rejected").length;
        await refetchOrders();
        if (failed > 0) {
          toast.error(
            `${failed} ${t("order(s) failed to cancel")}`,
            {
              id: toastId,
              duration: 4000,
            },
          );
        } else {
          toast.success(t("All orders cancelled"), {
            id: toastId,
            duration: 3000,
          });
        }
        onSuccess();
      } finally {
        endOrderReplacement();
      }
    },
  });
}
