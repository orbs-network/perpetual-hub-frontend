import type { Order } from "@/types";

export type ChartDragPreview = {
  orderId: string;
  price: number;
} | null;

export type ChartDragState = {
  orderId: string;
  pointerId: number;
  ownerDocument: Document;
} | null;

export type OptimisticChartOrderReplacement = {
  oldOrderId: string;
  order: Order;
};

export type ChartOverlayLabel = {
  key: string;
  top: number;
  left: number;
  text: string;
  quantity?: string;
  color: string;
  quantityColor: string;
  cancelOrderId?: string;
  cancelBorderColor?: string;
  draggableOrderId?: string;
  isUpdating?: boolean;
  price: number;
  pricePrecision: number;
  right: number;
};
