import { useAppliedThemeColors } from "@/hooks/useAppliedThemeColors";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { TFunction } from "i18next";
import {
  CHART_DRAG_HANDLE_GLYPH,
  ORDER_LABEL_DRAG_HANDLE_FONT_SIZE,
  ORDER_LABEL_FONT_SIZE,
  ORDER_LABEL_HEIGHT,
} from "./constants";
import type { ChartOverlayLabel } from "./types";

export function ChartOverlayLayer({
  beginOrderDrag,
  cancellingOrderIds,
  cancelOrder,
  labels,
  changeOrderPrice,
  t,
  updatingOrderIds,
}: {
  beginOrderDrag: (
    orderId: string,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  cancellingOrderIds: ReadonlySet<string>;
  cancelOrder: (orderId: string) => void;
  labels: ChartOverlayLabel[];
  changeOrderPrice: (orderId: string, price: number) => Promise<void>;
  t: TFunction;
  updatingOrderIds: ReadonlySet<string>;
}) {
  const theme = useAppliedThemeColors();
  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 10,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {labels.map((label) => {
        const cancelDisabled = label.cancelOrderId
          ? cancellingOrderIds.has(label.cancelOrderId) ||
            updatingOrderIds.has(label.cancelOrderId)
          : false;
        const hasDragHandle = Boolean(label.draggableOrderId);
        const canDragNow = hasDragHandle && !label.isUpdating;

        return (
          <div key={label.key}>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute"
              data-chart-overlay-line={label.key}
              style={{
                position: "absolute",
                pointerEvents: "none",
                top: label.top,
                left: 0,
                right: label.right,
                height: 1,
                transform: "translateY(-50%)",
                backgroundImage: `repeating-linear-gradient(to right, ${label.color} 0 8px, transparent 8px 18px)`,
                opacity: 0.95,
                zIndex: 0,
              }}
            />
            <div
              className="pointer-events-auto absolute flex items-stretch whitespace-nowrap font-bold leading-none"
              data-chart-order={label.draggableOrderId}
              onPointerDown={
                canDragNow
                  ? (event) =>
                      beginOrderDrag(label.draggableOrderId as string, event)
                  : undefined
              }
              style={{
                position: "absolute",
                display: "flex",
                alignItems: "stretch",
                pointerEvents: "auto",
                whiteSpace: "nowrap",
                fontWeight: 700,
                lineHeight: 1,
                top: label.top,
                left: label.left,
                height: ORDER_LABEL_HEIGHT,
                transform: "translateY(-50%)",
                fontSize: ORDER_LABEL_FONT_SIZE,
                cursor: canDragNow ? "pointer" : "default",
                touchAction: canDragNow ? "none" : undefined,
                userSelect: canDragNow ? "none" : undefined,
                zIndex: 1,
              }}
            >
              <span
                className="flex items-center px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-primary"
                role={hasDragHandle ? "slider" : undefined}
                tabIndex={hasDragHandle ? 0 : undefined}
                aria-label={
                  hasDragHandle
                    ? `${t("Modify order")} ${label.draggableOrderId}`
                    : undefined
                }
                aria-valuenow={hasDragHandle ? label.price : undefined}
                aria-disabled={hasDragHandle ? !canDragNow : undefined}
                onKeyDown={
                  canDragNow
                    ? (event) => {
                        if (
                          event.key !== "ArrowUp" &&
                          event.key !== "ArrowDown"
                        )
                          return;
                        event.preventDefault();
                        void changeOrderPrice(
                          label.draggableOrderId as string,
                          label.price +
                            (event.key === "ArrowUp" ? 1 : -1) *
                              10 ** -label.pricePrecision,
                        );
                      }
                    : undefined
                }
                aria-valuemin={hasDragHandle ? 0 : undefined}
                aria-valuemax={
                  hasDragHandle ? Number.MAX_SAFE_INTEGER : undefined
                }
                aria-orientation={hasDragHandle ? "vertical" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  boxSizing: "border-box",
                  padding: hasDragHandle ? "0 8px 0 5px" : "0 8px",
                  background: theme.raised,
                  border: `1px solid ${label.color}`,
                  color: theme.content,
                  minWidth: 54,
                  justifyContent: "center",
                }}
              >
                {hasDragHandle ? (
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      marginRight: 4,
                      fontSize: ORDER_LABEL_DRAG_HANDLE_FONT_SIZE,
                      lineHeight: 1,
                      opacity: 0.85,
                    }}
                  >
                    {CHART_DRAG_HANDLE_GLYPH}
                  </span>
                ) : null}
                <span>{label.text}</span>
              </span>
              {label.quantity ? (
                <span
                  className="flex items-center px-1.5"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    boxSizing: "border-box",
                    padding: "0 6px",
                    marginLeft: -1,
                    background: theme.base,
                    border: `1px solid ${label.quantityColor}`,
                    color: theme.content,
                    minWidth: 38,
                    justifyContent: "center",
                  }}
                >
                  {label.quantity}
                </span>
              ) : null}
              {label.cancelOrderId ? (
                <button
                  aria-label={`${t("Cancel order")} ${label.cancelOrderId}`}
                  className="pointer-events-auto flex items-center justify-center font-bold disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={cancelDisabled}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    cancelOrder(label.cancelOrderId as string);
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  style={{
                    appearance: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "auto",
                    boxSizing: "border-box",
                    padding: 0,
                    marginLeft: -1,
                    width: ORDER_LABEL_HEIGHT,
                    minWidth: ORDER_LABEL_HEIGHT,
                    background: theme.raised,
                    border: `1px solid ${label.cancelBorderColor ?? label.color}`,
                    color: theme.content,
                    font: "inherit",
                    fontWeight: 700,
                    lineHeight: 1,
                    cursor: cancelDisabled ? "not-allowed" : "pointer",
                    opacity: cancelDisabled ? 0.6 : 1,
                  }}
                  title={t("Cancel order")}
                  type="button"
                >
                  X
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
