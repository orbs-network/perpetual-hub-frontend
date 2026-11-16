import type { CreateOrderInput } from "@/hooks/mutations/useSubmitOrder";
import type { Position } from "@/types";
import { toDomainTickPrice } from "@/utils/formatting";

export function buildLimitCloseOrderInput({
  position,
  isLong,
  quantity,
  price,
  pricePrecision,
  isFullClose,
}: {
  position: Position;
  isLong: boolean;
  quantity: bigint;
  price: string;
  pricePrecision: number;
  isFullClose: boolean;
}): CreateOrderInput {
  return {
    symbol: position.symbol,
    orderType: "LIMIT",
    side: isLong ? "SELL" : "BUY",
    quantity,
    price: toDomainTickPrice(price, pricePrecision),
    closePosition: isFullClose,
    reduceOnly: !isFullClose,
  };
}
