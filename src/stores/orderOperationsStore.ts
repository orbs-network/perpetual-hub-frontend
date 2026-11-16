import { create } from "zustand";

const SUPPRESSED_FILL_TOAST_TTL_MS = 60_000;

interface SuppressedFillToastOrder {
  orderId: string;
  expiresAt: number;
}

interface ToastedFillOrder {
  orderId: string;
  expiresAt: number;
}

interface ToastedFillId {
  fillId: string;
  expiresAt: number;
}

interface OrderOperationsState {
  pendingOrderReplacementCount: number;
  suppressedFillToastOrders: SuppressedFillToastOrder[];
  toastedFillOrders: ToastedFillOrder[];
  toastedFillIds: ToastedFillId[];
  beginOrderReplacement: () => void;
  endOrderReplacement: () => void;
  suppressFillToastForOrder: (orderId: string | undefined) => void;
  consumeSuppressedFillToastOrder: (orderId: string | undefined) => boolean;
  markFillToastShown: (fillId: string | undefined, orderId: string | undefined) => boolean;
  claimOrderSubmitToast: (orderId: string | undefined, restToastIsFill?: boolean) => boolean;
  resetOrderOperations: () => void;
}

function pruneSuppressedFillToastOrders(
  orders: SuppressedFillToastOrder[],
  now = Date.now(),
) {
  return orders.filter((order) => order.expiresAt > now);
}

export const useOrderOperationsStore = create<OrderOperationsState>(
  (set, get) => ({
    pendingOrderReplacementCount: 0,
    suppressedFillToastOrders: [],
    toastedFillOrders: [],
    toastedFillIds: [],
    beginOrderReplacement: () =>
      set((state) => ({
        pendingOrderReplacementCount: state.pendingOrderReplacementCount + 1,
      })),
    endOrderReplacement: () =>
      set((state) => ({
        pendingOrderReplacementCount: Math.max(
          0,
          state.pendingOrderReplacementCount - 1,
        ),
      })),
    suppressFillToastForOrder: (orderId) => {
      if (!orderId) return;
      const now = Date.now();
      set((state) => {
        const activeOrders = pruneSuppressedFillToastOrders(
          state.suppressedFillToastOrders,
          now,
        ).filter((order) => order.orderId !== orderId);
        return {
          suppressedFillToastOrders: [
            ...activeOrders,
            {
              orderId,
              expiresAt: now + SUPPRESSED_FILL_TOAST_TTL_MS,
            },
          ],
        };
      });
    },
    consumeSuppressedFillToastOrder: (orderId) => {
      if (!orderId) return false;
      const activeOrders = pruneSuppressedFillToastOrders(
        get().suppressedFillToastOrders,
      );
      const shouldSuppress = activeOrders.some(
        (order) => order.orderId === orderId,
      );

      set({
        suppressedFillToastOrders: activeOrders.filter(
          (order) => order.orderId !== orderId,
        ),
      });
      return shouldSuppress;
    },
    markFillToastShown: (fillId, orderId) => {
      const now = Date.now();
      let firstToast = false;
      set((state) => {
        const activeOrders = state.toastedFillOrders.filter(
          (order) => order.expiresAt > now,
        );
        const activeFillIds = state.toastedFillIds.filter(
          (fill) => fill.expiresAt > now,
        );
        firstToast = !fillId || !activeFillIds.some((fill) => fill.fillId === fillId);
        return {
          toastedFillOrders: orderId && !activeOrders.some((order) => order.orderId === orderId)
            ? [...activeOrders, { orderId, expiresAt: now + SUPPRESSED_FILL_TOAST_TTL_MS }]
            : activeOrders,
          toastedFillIds: fillId && firstToast
            ? [...activeFillIds, { fillId, expiresAt: now + SUPPRESSED_FILL_TOAST_TTL_MS }]
            : activeFillIds,
        };
      });
      return firstToast;
    },
    claimOrderSubmitToast: (orderId, restToastIsFill = true) => {
      if (!restToastIsFill) return true;
      if (!orderId) return true;
      const now = Date.now();
      let shouldShow = true;
      set((state) => {
        const activeOrders = state.toastedFillOrders.filter(
          (order) => order.expiresAt > now,
        );
        const wsAlreadyToasted = activeOrders.some(
          (order) => order.orderId === orderId,
        );
        shouldShow = !wsAlreadyToasted;
        return {
          toastedFillOrders: wsAlreadyToasted
            ? activeOrders
            : [...activeOrders, { orderId, expiresAt: now + SUPPRESSED_FILL_TOAST_TTL_MS }],
        };
      });
      if (shouldShow) get().suppressFillToastForOrder(orderId);
      return shouldShow;
    },
    resetOrderOperations: () =>
      set({
        pendingOrderReplacementCount: 0,
        suppressedFillToastOrders: [],
        toastedFillOrders: [],
        toastedFillIds: [],
      }),
  }),
);

export function isOrderReplacementPending() {
  return (
    useOrderOperationsStore.getState().pendingOrderReplacementCount > 0
  );
}

export function consumeSuppressedFillToastOrder(orderId: string | undefined) {
  return useOrderOperationsStore
    .getState()
    .consumeSuppressedFillToastOrder(orderId);
}

export function resetOrderOperations() {
  useOrderOperationsStore.getState().resetOrderOperations();
}
