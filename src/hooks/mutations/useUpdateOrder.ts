import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { OrderResponse } from "@/types";
import { useCancelOrder } from "./useCancelOrder";
import {
  type CreateOrderInput,
  useSubmitOrder,
} from "./useSubmitOrder";
import { useOnOrdersChangeCallback } from "./useOnOrdersChangeCallback";
import { useOrderOperationsStore } from "@/stores/orderOperationsStore";
import { useTranslation } from "@/hooks/useSafeTranslation";

interface UpdateOrderInput {
  orderId: string;
  input: CreateOrderInput;
  onSuccess?: (response: OrderResponse) => void;
}

export function useUpdateOrder() {
  const { t } = useTranslation();
  const { mutateAsync: cancelOrder } = useCancelOrder();
  const { mutateAsync: submitOrder } = useSubmitOrder();
  const { mutateAsync: refetchOrders } = useOnOrdersChangeCallback();
  const beginOrderReplacement = useOrderOperationsStore(
    (state) => state.beginOrderReplacement,
  );
  const endOrderReplacement = useOrderOperationsStore(
    (state) => state.endOrderReplacement,
  );

  return useMutation({
    mutationFn: async ({ orderId, input, onSuccess }: UpdateOrderInput) => {
      const toastId = toast.loading(t("Modify request submitted"));
      beginOrderReplacement();

      try {
        if (!input.replacement) {
          await cancelOrder({
            orderId,
            silent: true,
            refetchOnSuccess: false,
          });
        }
        const response = await submitOrder({
          input,
        });
        await refetchOrders();
        toast.success(t("Modified order"), { id: toastId, duration: 4000 });
        onSuccess?.(response);
        return response;
      } catch (error) {
        try {
          await refetchOrders();
        } catch (refetchError) {
          console.error(refetchError);
        }
        toast.error(t("Modify failed"), {
          id: toastId,
          duration: 6000,
        });
        throw error;
      } finally {
        endOrderReplacement();
      }
    },
  });
}
