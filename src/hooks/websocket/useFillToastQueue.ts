import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { OrderSide, WSFillEvent } from "@/types";
import {
  consumeSuppressedFillToastOrder,
  useOrderOperationsStore,
} from "@/stores/orderOperationsStore";
import { useFormatFillMessage } from "../useFormatFillMessage";

type FillToast = WSFillEvent["data"];

interface QueuedFillToast {
  id: number;
  fill: FillToast;
}

export function useFillToastQueue({
  isReplacementPending,
}: {
  isReplacementPending: boolean;
}) {
  const nextQueueIdRef = useRef(0);
  const [fillToastQueue, setFillToastQueue] = useState<QueuedFillToast[]>([]);
  const nextFillToastItem = fillToastQueue[0] ?? null;
  const nextFillToast = nextFillToastItem?.fill ?? null;
  const formatFillMessage = useFormatFillMessage(nextFillToast?.symbol ?? "");

  const queueFillToast = useCallback((fill: FillToast) => {
    // System executions use orderId 0 and already have a specific notice.
    if (fill.orderId === "0") return;
    const id = nextQueueIdRef.current;
    nextQueueIdRef.current += 1;
    setFillToastQueue((queue) => [...queue, { id, fill }]);
  }, []);

  useEffect(() => {
    if (!nextFillToastItem || isReplacementPending) {
      return;
    }

    const nextFillToast = nextFillToastItem.fill;
    const nextFillToastId = nextFillToastItem.id;
    try {
      const firstFill = useOrderOperationsStore
        .getState()
        .markFillToastShown(nextFillToast.fillId, nextFillToast.orderId);
      if (
        firstFill &&
        !consumeSuppressedFillToastOrder(nextFillToast.orderId)
      ) {
        toast.success(
          formatFillMessage(
            { ...nextFillToast, entryPrice: nextFillToast.price },
            {
              side: nextFillToast.side as OrderSide,
              symbol: nextFillToast.symbol,
              quantity: BigInt(nextFillToast.quantity),
            },
          ),
          { duration: 4000 },
        );
      }
    } catch (error) {
      console.error("Error formatting WebSocket fill toast:", error);
    } finally {
      setFillToastQueue((queue) =>
        queue[0]?.id === nextFillToastId ? queue.slice(1) : queue,
      );
    }
  }, [formatFillMessage, isReplacementPending, nextFillToastItem]);

  return { queueFillToast };
}
