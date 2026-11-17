import type { ChartPeriod, TradingChartController } from "@/lib/chart/model";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type { TFunction } from "i18next";
import { toast } from "sonner";
import { ACTIVE_ORDER_STATUSES, type PriceSource } from "@/config/constants";
import { useCancelOrder } from "@/hooks/mutations/useCancelOrder";
import type { CreateOrderInput } from "@/hooks/mutations/useSubmitOrder";
import { useUpdateOrder } from "@/hooks/mutations/useUpdateOrder";
import { useUpdateTpSlOrders } from "@/hooks/mutations/useUpdateTpSlOrders";
import { classifyPendingOrder } from "@/lib/pendingOrderChart";
import { getInvalidTpSlTriggerPriceMessage } from "@/lib/tpSlValidation";
import { compareSymbols } from "@/lib/utils";
import type { Order, Position } from "@/types";
import {
  domainPriceToDecimal,
  domainPriceToDisplayNumber,
  toDomainTickPrice,
} from "@/utils/formatting";
import type {
  ChartDragPreview,
  ChartDragState,
  OptimisticChartOrderReplacement,
} from "../types";
import {
  createOptimisticReplacementOrder,
  getChartPriceFromClientY,
  isTpSlChartOrder,
} from "../utils";

interface UseChartOrderInteractionsOptions {
  enabled: boolean;
  period: ChartPeriod;
  symbol: string;
  priceSource: PriceSource;
  containerRef: RefObject<HTMLDivElement | null>;
  currentMarketPriceRef: MutableRefObject<number>;
  pendingOrders: Order[];
  position: Position | null | undefined;
  pricePrecision: number;
  t: TFunction;
  userOrders: Order[] | undefined;
  chartRef: MutableRefObject<TradingChartController | null>;
}

export function useChartOrderInteractions({
  enabled,
  period,
  symbol,
  priceSource,
  containerRef,
  currentMarketPriceRef,
  pendingOrders,
  position,
  pricePrecision,
  t,
  userOrders,
  chartRef,
}: UseChartOrderInteractionsOptions) {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;
  const tradingContext = `${priceSource}:${symbol}`;
  const tradingContextRef = useRef(tradingContext);
  const session = `${tradingContext}:${period.type}:${period.span}`;
  const sessionRef = useRef(session);
  const { mutate: cancelOrder } = useCancelOrder();
  const cancelOrderRef = useRef(cancelOrder);
  cancelOrderRef.current = cancelOrder;
  const { mutateAsync: updateOrder } = useUpdateOrder();
  const updateOrderRef = useRef(updateOrder);
  updateOrderRef.current = updateOrder;
  const { mutateAsync: updateTpSlOrders } = useUpdateTpSlOrders();
  const updateTpSlOrdersRef = useRef(updateTpSlOrders);
  updateTpSlOrdersRef.current = updateTpSlOrders;

  const [cancellingOrderIds, setCancellingOrderIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const cancellingOrderIdsRef = useRef(cancellingOrderIds);
  cancellingOrderIdsRef.current = cancellingOrderIds;
  const [cancelledOrderIds, setCancelledOrderIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const cancelledOrderIdsRef = useRef(cancelledOrderIds);
  cancelledOrderIdsRef.current = cancelledOrderIds;
  const [updatingOrderIds, setUpdatingOrderIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const updatingOrderIdsRef = useRef(updatingOrderIds);
  updatingOrderIdsRef.current = updatingOrderIds;
  const [dragPreview, setDragPreview] = useState<ChartDragPreview>(null);
  const dragPreviewRef = useRef<ChartDragPreview>(dragPreview);
  dragPreviewRef.current = dragPreview;
  const dragStateRef = useRef<ChartDragState>(null);
  const [optimisticOrderReplacements, setOptimisticOrderReplacements] =
    useState<OptimisticChartOrderReplacement[]>([]);
  const optimisticOrderReplacementsRef = useRef(optimisticOrderReplacements);
  optimisticOrderReplacementsRef.current = optimisticOrderReplacements;

  const pendingOrdersRef = useRef(pendingOrders);
  pendingOrdersRef.current = pendingOrders;
  const positionRef = useRef(position);
  positionRef.current = position;
  const pricePrecisionRef = useRef(pricePrecision);
  pricePrecisionRef.current = pricePrecision;

  const pointerMoveHandlerRef = useRef<(event: PointerEvent) => void>(
    () => undefined,
  );
  const pointerUpHandlerRef = useRef<(event: PointerEvent) => void>(
    () => undefined,
  );
  const pointerCancelHandlerRef = useRef<(event: PointerEvent) => void>(
    () => undefined,
  );
  const pointerMoveListener = useCallback((event: PointerEvent) => {
    pointerMoveHandlerRef.current(event);
  }, []);
  const pointerUpListener = useCallback((event: PointerEvent) => {
    pointerUpHandlerRef.current(event);
  }, []);
  const pointerCancelListener = useCallback((event: PointerEvent) => {
    pointerCancelHandlerRef.current(event);
  }, []);

  const cancelChartOrder = useCallback((orderId: string) => {
    if (
      cancellingOrderIdsRef.current.has(orderId) ||
      updatingOrderIdsRef.current.has(orderId)
    ) {
      return;
    }

    setCancellingOrderIds((currentIds) => {
      if (currentIds.has(orderId)) return currentIds;
      const nextIds = new Set(currentIds);
      nextIds.add(orderId);
      return nextIds;
    });

    cancelOrderRef.current(
      { orderId },
      {
        onSuccess: () => {
          setCancelledOrderIds((currentIds) => {
            if (currentIds.has(orderId)) return currentIds;
            const nextIds = new Set(currentIds);
            nextIds.add(orderId);
            return nextIds;
          });
          setOptimisticOrderReplacements((current) =>
            current.filter(
              (replacement) =>
                replacement.oldOrderId !== orderId &&
                replacement.order.orderId !== orderId,
            ),
          );
          setDragPreview((preview) =>
            preview?.orderId === orderId ? null : preview,
          );
        },
        onSettled: () => {
          setCancellingOrderIds((currentIds) => {
            if (!currentIds.has(orderId)) return currentIds;
            const nextIds = new Set(currentIds);
            nextIds.delete(orderId);
            return nextIds;
          });
        },
      },
    );
  }, []);

  useEffect(() => {
    setOptimisticOrderReplacements((current) =>
      current.filter((replacement) => {
        if (
          pendingOrders.some(
            (order) => order.orderId === replacement.order.orderId,
          )
        ) {
          return false;
        }
        if (
          isTpSlChartOrder(replacement.order) &&
          (!position ||
            !compareSymbols(position.symbol, replacement.order.symbol))
        ) {
          return false;
        }
        return true;
      }),
    );
  }, [pendingOrders, position]);

  useEffect(() => {
    setCancelledOrderIds((currentIds) => {
      if (currentIds.size === 0) return currentIds;

      const activeOrderIds = new Set(
        (userOrders ?? [])
          .filter((order) => ACTIVE_ORDER_STATUSES.has(order.status))
          .map((order) => order.orderId),
      );
      let changed = false;
      const nextIds = new Set<string>();
      for (const orderId of currentIds) {
        if (activeOrderIds.has(orderId)) {
          nextIds.add(orderId);
        } else {
          changed = true;
        }
      }
      return changed ? nextIds : currentIds;
    });
  }, [userOrders]);

  const resolvePriceFromClientY = useCallback(
    (clientY: number) =>
      getChartPriceFromClientY(chartRef.current, containerRef.current, clientY),
    [containerRef, chartRef],
  );

  const replaceChartOrderPrice = useCallback(
    async (orderId: string, nextDisplayPrice: number) => {
      if (
        !enabledRef.current ||
        updatingOrderIdsRef.current.has(orderId) ||
        cancellingOrderIdsRef.current.has(orderId)
      ) {
        return;
      }

      const order =
        pendingOrdersRef.current.find(
          (candidate) => candidate.orderId === orderId,
        ) ??
        optimisticOrderReplacementsRef.current.find(
          (replacement) => replacement.order.orderId === orderId,
        )?.order;
      if (
        !enabledRef.current ||
        !order ||
        !compareSymbols(order.symbol, symbolRef.current)
      ) {
        setDragPreview((preview) =>
          preview?.orderId === orderId ? null : preview,
        );
        return;
      }

      const kind = classifyPendingOrder(order);
      if (kind === "OTHER") {
        setDragPreview((preview) =>
          preview?.orderId === orderId ? null : preview,
        );
        return;
      }

      const nextPrice = toDomainTickPrice(
        nextDisplayPrice,
        pricePrecisionRef.current,
      );
      if (nextPrice <= 0n) {
        setDragPreview((preview) =>
          preview?.orderId === orderId ? null : preview,
        );
        return;
      }

      const originalPrice = kind === "LIMIT" ? order.price : order.stopPrice;
      if (nextPrice === originalPrice) {
        setDragPreview((preview) =>
          preview?.orderId === orderId ? null : preview,
        );
        return;
      }

      if (kind !== "LIMIT") {
        const validationMessage = getInvalidTpSlTriggerPriceMessage({
          kind,
          positionQuantity: positionRef.current?.quantity ?? 0n,
          triggerPrice: domainPriceToDisplayNumber(nextPrice),
          currentPrice: currentMarketPriceRef.current,
          t,
        });
        if (validationMessage) {
          toast.error(validationMessage, { duration: 5000 });
          setDragPreview((preview) =>
            preview?.orderId === orderId ? null : preview,
          );
          return;
        }
      }

      setOptimisticOrderReplacements((current) => {
        const next = current.filter(
          (replacement) =>
            replacement.oldOrderId !== orderId &&
            replacement.order.orderId !== orderId,
        );
        next.push({
          oldOrderId: orderId,
          order: createOptimisticReplacementOrder(
            order,
            orderId,
            kind,
            nextPrice,
          ),
        });
        return next;
      });

      if (kind !== "LIMIT") {
        const rawPosition = positionRef.current;
        if (!rawPosition) {
          setOptimisticOrderReplacements((current) =>
            current.filter(
              (replacement) =>
                replacement.oldOrderId !== orderId &&
                replacement.order.orderId !== orderId,
            ),
          );
          setDragPreview((preview) =>
            preview?.orderId === orderId ? null : preview,
          );
          return;
        }

        const absQuantity =
          rawPosition.quantity > 0n
            ? rawPosition.quantity
            : -rawPosition.quantity;
        const isFullClose = order.closePosition;
        const closeQuantity = isFullClose ? absQuantity : order.quantity;
        const existingLimitPrice =
          order.price > 0n ? domainPriceToDecimal(order.price) : "";
        const triggerPrice = domainPriceToDecimal(nextPrice);
        const limitPrice = existingLimitPrice;
        const role = kind === "TP" ? "take-profit" : "stop-loss";

        setUpdatingOrderIds((currentIds) => {
          if (currentIds.has(orderId)) return currentIds;
          const nextIds = new Set(currentIds);
          nextIds.add(orderId);
          return nextIds;
        });

        try {
          const result = await updateTpSlOrdersRef.current({
            position: rawPosition,
            configureAmount: !isFullClose,
            sizePercent: isFullClose ? 100 : 99,
            closeQuantity,
            hasTp: kind === "TP",
            tpPrice: kind === "TP" ? triggerPrice : "",
            hasSl: kind === "SL",
            slPrice: kind === "SL" ? triggerPrice : "",
            limitPrice: !!limitPrice,
            tpLimitPrice: kind === "TP" ? limitPrice : "",
            slLimitPrice: kind === "SL" ? limitPrice : "",
            existingTpOrder: kind === "TP" ? order : undefined,
            existingSlOrder: kind === "SL" ? order : undefined,
            pricePrecision: pricePrecisionRef.current,
            onSuccess: () => {},
          });
          const response = result?.submittedOrders.find(
            (submittedOrder) => submittedOrder.role === role,
          )?.response;
          setOptimisticOrderReplacements((current) =>
            current.map((replacement) =>
              replacement.oldOrderId === orderId
                ? {
                    oldOrderId: orderId,
                    order: createOptimisticReplacementOrder(
                      order,
                      response?.orderId ?? orderId,
                      kind,
                      nextPrice,
                    ),
                  }
                : replacement,
            ),
          );
        } catch {
          setOptimisticOrderReplacements((current) =>
            current.filter(
              (replacement) =>
                replacement.oldOrderId !== orderId &&
                replacement.order.orderId !== orderId,
            ),
          );
        } finally {
          setUpdatingOrderIds((currentIds) => {
            if (!currentIds.has(orderId)) return currentIds;
            const nextIds = new Set(currentIds);
            nextIds.delete(orderId);
            return nextIds;
          });
          setDragPreview((preview) =>
            preview?.orderId === orderId ? null : preview,
          );
        }
        return;
      }

      const input: CreateOrderInput = {
        symbol: order.symbol,
        orderType: order.orderType,
        side: order.side,
        quantity: order.quantity,
        price: nextPrice,
        stopPrice: order.stopPrice > 0n ? order.stopPrice : undefined,
        reduceOnly: order.reduceOnly,
        closePosition: order.closePosition,
        timeInForce: order.timeInForce,
        replacement: { orderId },
      };

      setUpdatingOrderIds((currentIds) => {
        if (currentIds.has(orderId)) return currentIds;
        const nextIds = new Set(currentIds);
        nextIds.add(orderId);
        return nextIds;
      });

      try {
        const response = await updateOrderRef.current({ orderId, input });
        setOptimisticOrderReplacements((current) =>
          current.map((replacement) =>
            replacement.oldOrderId === orderId
              ? {
                  oldOrderId: orderId,
                  order: createOptimisticReplacementOrder(
                    order,
                    response.orderId ?? orderId,
                    kind,
                    nextPrice,
                  ),
                }
              : replacement,
          ),
        );
      } catch {
        setOptimisticOrderReplacements((current) =>
          current.filter(
            (replacement) =>
              replacement.oldOrderId !== orderId &&
              replacement.order.orderId !== orderId,
          ),
        );
      } finally {
        setUpdatingOrderIds((currentIds) => {
          if (!currentIds.has(orderId)) return currentIds;
          const nextIds = new Set(currentIds);
          nextIds.delete(orderId);
          return nextIds;
        });
        setDragPreview((preview) =>
          preview?.orderId === orderId ? null : preview,
        );
      }
    },
    [currentMarketPriceRef, t],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      const price = resolvePriceFromClientY(event.clientY);
      if (price === null) return;
      event.preventDefault();
      setDragPreview({ orderId: dragState.orderId, price });
    },
    [resolvePriceFromClientY],
  );

  const stopDocumentOrderDrag = useCallback(
    (ownerDocument?: Document) => {
      const targetDocument =
        ownerDocument ?? dragStateRef.current?.ownerDocument ?? document;
      targetDocument.removeEventListener("pointermove", pointerMoveListener);
      targetDocument.removeEventListener("pointerup", pointerUpListener);
      targetDocument.removeEventListener(
        "pointercancel",
        pointerCancelListener,
      );
    },
    [pointerCancelListener, pointerMoveListener, pointerUpListener],
  );

  const handlePointerCancel = useCallback(
    (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      dragStateRef.current = null;
      stopDocumentOrderDrag(dragState.ownerDocument);
      setDragPreview((preview) =>
        preview?.orderId === dragState.orderId ? null : preview,
      );
    },
    [stopDocumentOrderDrag],
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      dragStateRef.current = null;
      stopDocumentOrderDrag(dragState.ownerDocument);

      const price =
        resolvePriceFromClientY(event.clientY) ?? dragPreviewRef.current?.price;
      if (typeof price === "number") {
        void replaceChartOrderPrice(dragState.orderId, price);
      } else {
        setDragPreview((preview) =>
          preview?.orderId === dragState.orderId ? null : preview,
        );
      }
    },
    [replaceChartOrderPrice, resolvePriceFromClientY, stopDocumentOrderDrag],
  );

  useEffect(() => {
    pointerMoveHandlerRef.current = handlePointerMove;
  }, [handlePointerMove]);
  useEffect(() => {
    pointerUpHandlerRef.current = handlePointerUp;
  }, [handlePointerUp]);
  useEffect(() => {
    pointerCancelHandlerRef.current = handlePointerCancel;
  }, [handlePointerCancel]);

  const beginChartOrderDrag = useCallback(
    (orderId: string, event: ReactPointerEvent<HTMLDivElement>) => {
      if (
        event.button !== 0 ||
        updatingOrderIdsRef.current.has(orderId) ||
        cancellingOrderIdsRef.current.has(orderId)
      ) {
        return;
      }

      if (!enabledRef.current) return;
      const ownerDocument = event.currentTarget.ownerDocument;
      const price = resolvePriceFromClientY(event.clientY);
      if (price === null) return;

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      dragStateRef.current = {
        orderId,
        pointerId: event.pointerId,
        ownerDocument,
      };
      setDragPreview({ orderId, price });
      ownerDocument.addEventListener("pointermove", pointerMoveListener);
      ownerDocument.addEventListener("pointerup", pointerUpListener);
      ownerDocument.addEventListener("pointercancel", pointerCancelListener);
    },
    [
      pointerCancelListener,
      pointerMoveListener,
      pointerUpListener,
      resolvePriceFromClientY,
    ],
  );

  useEffect(
    () => () => {
      const ownerDocument = dragStateRef.current?.ownerDocument;
      dragStateRef.current = null;
      stopDocumentOrderDrag(ownerDocument);
    },
    [stopDocumentOrderDrag],
  );

  useEffect(() => {
    if (sessionRef.current === session && enabled) return;
    const changed = tradingContextRef.current !== tradingContext;
    tradingContextRef.current = tradingContext;
    sessionRef.current = session;
    const ownerDocument = dragStateRef.current?.ownerDocument;
    dragStateRef.current = null;
    stopDocumentOrderDrag(ownerDocument);
    setDragPreview(null);
    if (changed) setOptimisticOrderReplacements([]);
  }, [enabled, session, tradingContext, stopDocumentOrderDrag]);

  return {
    beginChartOrderDrag,
    cancelChartOrder,
    cancelledOrderIds,
    cancelledOrderIdsRef,
    cancellingOrderIds,
    cancellingOrderIdsRef,
    dragPreview,
    dragPreviewRef,
    optimisticOrderReplacements,
    optimisticOrderReplacementsRef,
    replaceChartOrderPrice,
    updatingOrderIds,
    updatingOrderIdsRef,
  };
}
