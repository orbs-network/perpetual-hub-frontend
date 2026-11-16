import type { Chart } from "klinecharts";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type { TFunction } from "i18next";
import { getAppliedThemeColors } from "@/config/partners";
import { QUANTITY_SCALE } from "@/config/constants";
import { HIDDEN_PNL_TEXT } from "@/lib/pnlPrivacy";
import { classifyPendingOrder } from "@/lib/pendingOrderChart";
import { compareSymbols } from "@/lib/utils";
import type { Order, OrderSide, Position, UIOrderType } from "@/types";
import { formatNumber } from "@/utils/formatting";
import { DOMAIN_PRICE_SCALE, ORDER_LABEL_HEIGHT } from "../constants";
import type {
  ChartDragPreview,
  ChartOverlayLabel,
  OptimisticChartOrderReplacement,
} from "../types";
import { haveSameChartOverlayLabels } from "../utils";

interface UseChartOverlaysOptions {
  symbol: string;
  cancelledOrderIdsRef: MutableRefObject<ReadonlySet<string>>;
  currentMarketPriceRef: MutableRefObject<number>;
  dragPreviewRef: MutableRefObject<ChartDragPreview>;
  formPrice: string;
  formSide: OrderSide;
  formUiOrderType: UIOrderType;
  hidePnl: boolean;
  optimisticOrderReplacementsRef: MutableRefObject<
    OptimisticChartOrderReplacement[]
  >;
  pendingOrders: Order[];
  pnlDisplayText: string | undefined;
  pnlIsPositive: boolean | undefined;
  position: Position | null | undefined;
  pricePrecision: number;
  quantityPrecision: number;
  t: TFunction;
  updatingOrderIdsRef: MutableRefObject<ReadonlySet<string>>;
}

export function useChartOverlays({
  symbol,
  cancelledOrderIdsRef: chartCancelledOrderIdsRef,
  currentMarketPriceRef,
  dragPreviewRef: chartDragPreviewRef,
  formPrice,
  formSide,
  formUiOrderType,
  hidePnl,
  optimisticOrderReplacementsRef,
  pendingOrders,
  pnlDisplayText,
  pnlIsPositive,
  position,
  pricePrecision,
  quantityPrecision,
  t,
  updatingOrderIdsRef: chartUpdatingOrderIdsRef,
}: UseChartOverlaysOptions) {
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;
  const syncOverlaysRef = useRef<(() => Promise<void>) | null>(null);
  const [chartOverlayLabels, setChartOverlayLabels] = useState<
    ChartOverlayLabel[]
  >([]);

  const positionRawRef = useRef(position);
  positionRawRef.current = position;
  const pnlTextRef = useRef(pnlDisplayText);
  pnlTextRef.current = pnlDisplayText;
  const pnlPositiveRef = useRef(pnlIsPositive);
  pnlPositiveRef.current = pnlIsPositive;
  const hidePnlRef = useRef(hidePnl);
  hidePnlRef.current = hidePnl;
  const pendingOrdersRef = useRef(pendingOrders);
  pendingOrdersRef.current = pendingOrders;
  const quantityPrecRef = useRef(quantityPrecision);
  quantityPrecRef.current = quantityPrecision;
  const pricePrecRef = useRef(pricePrecision);
  pricePrecRef.current = pricePrecision;
  const formDataRef = useRef({
    side: formSide,
    uiOrderType: formUiOrderType,
    price: formPrice,
  });
  formDataRef.current = {
    side: formSide,
    uiOrderType: formUiOrderType,
    price: formPrice,
  };

  // ── Overlay sync: create once, update in place, reconcile by key ──
  const setupSyncOverlays = useCallback(
    (chart: Chart) => {
      const ensureLine = (
        key: string,
        props: {
          price: number;
          text?: string;
          quantity?: string;
          lineColor: string;
          lineLength?: number;
          quantityBorderColor?: string;
          cancelOrderId?: string;
          cancelBorderColor?: string;
          draggableOrderId?: string;
          isUpdating?: boolean;
        },
        active: { overlays: ChartOverlayLabel[] },
      ) => {
        const pane = chart.getSize("candle_pane", "main");
        if (!pane || pane.width <= 0 || pane.height <= 0) return;
        const coordinate = chart.convertToPixel(
          { value: props.price },
          { paneId: "candle_pane", absolute: true },
        );
        const y = Array.isArray(coordinate) ? coordinate[0]?.y : coordinate.y;
        if (
          typeof y !== "number" ||
          !Number.isFinite(y) ||
          y < pane.top - ORDER_LABEL_HEIGHT ||
          y > pane.top + pane.height + ORDER_LABEL_HEIGHT
        )
          return;
        const anchorFraction = Math.min(
          Math.max((100 - (props.lineLength ?? 50)) / 100, 0.16),
          0.64,
        );
        const left = Math.max(
          8,
          Math.min(pane.width * anchorFraction, pane.width - 420),
        );
        active.overlays.push({
          key,
          top: y,
          left,
          text: props.text ?? "",
          quantity: props.quantity,
          color: props.lineColor,
          quantityColor:
            props.quantityBorderColor ??
            getAppliedThemeColors()["accent-primary"],
          cancelOrderId: props.cancelOrderId,
          cancelBorderColor:
            props.cancelBorderColor ??
            getAppliedThemeColors()["accent-primary"],
          draggableOrderId: props.draggableOrderId,
          isUpdating: props.isUpdating,
          price: props.price,
          pricePrecision: pricePrecRef.current,
          right: Math.max(
            0,
            (chart.getSize()?.width ?? pane.width) - pane.width - pane.left,
          ),
        });
      };

      let running = false;
      let queued = false;

      const doSync = () => {
        const active = {
          overlays: [] as ChartOverlayLabel[],
        };
        const pos = positionRawRef.current;
        const c = getAppliedThemeColors();

        // Position PNL + liquidation order lines.
        if (pos && pos.entryPrice > 0n) {
          const ep = Number(pos.entryPrice) / Number(DOMAIN_PRICE_SCALE);
          const pnl = pnlTextRef.current;
          const isProfit = pnlPositiveRef.current;
          const isHiddenPnl = hidePnlRef.current && Boolean(pnl);
          const color = isHiddenPnl
            ? c["accent-primary"]
            : pnl
              ? isProfit
                ? c.up
                : c.down
              : c["accent-primary"];
          const qty = Number(pos.quantity) / Number(QUANTITY_SCALE);
          const qtyText = formatNumber(qty, {
            decimalScale: quantityPrecRef.current,
          });
          const pnlText = pnl
            ? `PNL ${isHiddenPnl ? HIDDEN_PNL_TEXT : pnl.replace(/^\+/, "")}`
            : "PNL --";

          ensureLine(
            "pos-pnl",
            {
              price: ep,
              text: pnlText,
              quantity: qtyText,
              lineColor: color,
              lineLength: 75,
            },
            active,
          );

          if (pos.liquidationPrice && pos.liquidationPrice > 0n) {
            const lp =
              Number(pos.liquidationPrice) / Number(DOMAIN_PRICE_SCALE);
            ensureLine(
              "pos-liq",
              {
                price: lp,
                text: "Liq. Price ",
                quantity: "",
                lineColor: c.down,
                lineLength: 75,
                quantityBorderColor: c["accent-primary"],
              },
              active,
            );
          }
        }

        // Pending orders.
        const optimisticReplacements = optimisticOrderReplacementsRef.current;
        const cancelledOrderIds = chartCancelledOrderIdsRef.current;
        const hiddenOrderIds = new Set([
          ...optimisticReplacements.map(
            (replacement) => replacement.oldOrderId,
          ),
          ...cancelledOrderIds,
        ]);
        const visiblePendingOrders = pendingOrdersRef.current.filter(
          (order) => !hiddenOrderIds.has(order.orderId),
        );
        const visiblePendingOrderIds = new Set(
          visiblePendingOrders.map((order) => order.orderId),
        );
        const orders = [
          ...visiblePendingOrders,
          ...optimisticReplacements
            .filter(
              (replacement) =>
                !visiblePendingOrderIds.has(replacement.order.orderId) &&
                !cancelledOrderIds.has(replacement.order.orderId),
            )
            .map((replacement) => replacement.order),
        ];

        for (const order of orders) {
          if (!compareSymbols(order.symbol, symbolRef.current)) continue;
          const kind = classifyPendingOrder(order);
          if (kind === "OTHER") continue;
          if (
            (kind === "TP" || kind === "SL") &&
            (!pos || !compareSymbols(pos.symbol, order.symbol))
          ) {
            continue;
          }
          const isBuy = order.side === "BUY";
          const lineColor = isBuy ? c.up : c.down;
          const rawOrderQty = Math.abs(
            Number(order.quantity) / Number(QUANTITY_SCALE),
          );
          const key = `order-${order.orderId}`;
          const previewPrice =
            chartDragPreviewRef.current?.orderId === order.orderId
              ? chartDragPreviewRef.current.price
              : undefined;
          const isUpdating = chartUpdatingOrderIdsRef.current.has(
            order.orderId,
          );

          if (kind === "LIMIT") {
            const price =
              previewPrice ?? Number(order.price) / Number(DOMAIN_PRICE_SCALE);
            const priceText = formatNumber(price, {
              decimalScale: pricePrecRef.current,
            });
            const bodyText = `Limit ${priceText}`;

            ensureLine(
              key,
              {
                price,
                text: bodyText,
                quantity: formatNumber(rawOrderQty, {
                  decimalScale: quantityPrecRef.current,
                }),
                lineColor,
                lineLength: 50,
                quantityBorderColor: c["accent-primary"],
                cancelBorderColor: c["accent-primary"],
                cancelOrderId: order.orderId,
                draggableOrderId: order.orderId,
                isUpdating,
              },
              active,
            );
            continue;
          }

          // TP / SL use the same trigger badge and mutation path as limit orders.
          const stopPx =
            previewPrice ??
            Number(order.stopPrice) / Number(DOMAIN_PRICE_SCALE);
          const isTp = kind === "TP";
          const cmp = (isTp && !isBuy) || (!isTp && isBuy) ? ">" : "<";
          const label = isTp ? "TP" : "SL";
          const priceText = formatNumber(stopPx, {
            decimalScale: pricePrecRef.current,
          });
          const limitPx =
            order.price > 0n
              ? Number(order.price) / Number(DOMAIN_PRICE_SCALE)
              : undefined;
          const limitPriceText =
            limitPx !== undefined
              ? formatNumber(limitPx, { decimalScale: pricePrecRef.current })
              : "";
          const positionQty = positionRawRef.current
            ? Number(positionRawRef.current.quantity) / Number(QUANTITY_SCALE)
            : undefined;
          const displayQty =
            order.closePosition && positionQty !== undefined
              ? positionQty
              : rawOrderQty;
          const qtyText = formatNumber(displayQty, {
            decimalScale: quantityPrecRef.current,
          });
          const bodyText =
            limitPx !== undefined
              ? `${t(isTp ? "TP Limit" : "Stop Limit")} ${limitPriceText} ${t("Price")} ${cmp} ${priceText}`
              : `${t(`${label} Price`)} ${cmp} ${priceText}`;

          ensureLine(
            key,
            {
              price: stopPx,
              text: bodyText,
              quantity: qtyText,
              lineColor,
              lineLength: 50,
              cancelOrderId: order.orderId,
              draggableOrderId: order.orderId,
              isUpdating,
            },
            active,
          );
        }

        // Form preview lines.
        const form = formDataRef.current;
        const mktPrice = currentMarketPriceRef.current;
        const ok = (p: number) =>
          p > 0 && (mktPrice <= 0 || (p < mktPrice * 5 && p > mktPrice * 0.01));

        const formPriceNum = parseFloat(form.price);
        if (form.uiOrderType === "LIMIT" && ok(formPriceNum)) {
          const formColor = (form.side === "BUY" ? c.up : c.down) + "99";
          ensureLine(
            "form-limit",
            {
              price: formPriceNum,
              text: `${t("Order")} (${form.side})`,
              lineColor: formColor,
            },
            active,
          );
        }

        setChartOverlayLabels((current) =>
          haveSameChartOverlayLabels(current, active.overlays)
            ? current
            : active.overlays,
        );
      };

      // Concurrency guard: if sync is already running, queue one re-run.
      // The wrapper calls itself (not doSync) so queued re-runs are also guarded.
      const syncFn: () => Promise<void> = async () => {
        if (running) {
          queued = true;
          return;
        }
        running = true;
        try {
          doSync();
        } catch {
          /* chart not ready */
        } finally {
          running = false;
          if (queued) {
            queued = false;
            void syncFn();
          }
        }
      };
      return syncFn;
    },
    [
      chartCancelledOrderIdsRef,
      chartDragPreviewRef,
      chartUpdatingOrderIdsRef,
      currentMarketPriceRef,
      optimisticOrderReplacementsRef,
      t,
    ],
  );

  return {
    chartOverlayLabels,
    setChartOverlayLabels,
    setupSyncOverlays,
    syncOverlaysRef,
  };
}

interface UseSyncChartOverlaysOptions {
  cancellingOrderIds: ReadonlySet<string>;
  cancelledOrderIds: ReadonlySet<string>;
  dragPreview: ChartDragPreview;
  formPrice: string;
  formSide: OrderSide;
  formUiOrderType: UIOrderType;
  hidePnl: boolean;
  optimisticOrderReplacements: OptimisticChartOrderReplacement[];
  overlayRenderNonce: number;
  pendingOrders: Order[];
  pnlDisplayText: string | undefined;
  pnlIsPositive: boolean | undefined;
  position: Position | null | undefined;
  pricePrecision: number;
  quantityPrecision: number;
  symbol: string;
  syncOverlaysRef: MutableRefObject<(() => Promise<void>) | null>;
  updatingOrderIds: ReadonlySet<string>;
}

export function useSyncChartOverlays({
  cancellingOrderIds,
  cancelledOrderIds,
  dragPreview,
  formPrice,
  formSide,
  formUiOrderType,
  hidePnl,
  optimisticOrderReplacements,
  overlayRenderNonce,
  pendingOrders,
  pnlDisplayText,
  pnlIsPositive,
  position,
  pricePrecision,
  quantityPrecision,
  symbol,
  syncOverlaysRef,
  updatingOrderIds,
}: UseSyncChartOverlaysOptions) {
  useEffect(() => {
    syncOverlaysRef.current?.();
  }, [hidePnl, pnlDisplayText, pnlIsPositive, syncOverlaysRef]);
  useEffect(() => {
    syncOverlaysRef.current?.();
  }, [
    overlayRenderNonce,
    pendingOrders,
    position,
    pricePrecision,
    quantityPrecision,
    symbol,
    syncOverlaysRef,
  ]);
  useEffect(() => {
    syncOverlaysRef.current?.();
  }, [cancellingOrderIds, syncOverlaysRef]);
  useEffect(() => {
    syncOverlaysRef.current?.();
  }, [cancelledOrderIds, syncOverlaysRef]);
  useEffect(() => {
    syncOverlaysRef.current?.();
  }, [
    dragPreview,
    optimisticOrderReplacements,
    syncOverlaysRef,
    updatingOrderIds,
  ]);
  useEffect(() => {
    syncOverlaysRef.current?.();
  }, [formPrice, formSide, formUiOrderType, syncOverlaysRef]);
}
