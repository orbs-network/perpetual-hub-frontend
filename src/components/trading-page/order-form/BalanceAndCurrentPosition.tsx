import { getCollateralSymbol } from "@/utils/collateralDisplay";
import { useFormatSymbolAmount } from "@/hooks/useFormatting";
import { useMarket } from "@/hooks/useMarkets";
import { useUserAccount } from "@/hooks/useUserAccount";
import { compareSymbols, getDisplaySymbol } from "@/lib/utils";
import {
  formatNumber,
  zeroWithDecimals,
} from "@/utils/formatting";
import { useMemo } from "react";
import { DataRow } from "../../DataRow";
import { useTradeSymbol } from "@/hooks/useSelectTradeSymbol";
import { MOBILE_BREAKPOINT } from "@/hooks/useIsMobile";
import { useWindowWidth } from "@/hooks/useWindowWidth";
import { useFormMarginInfo } from "@/hooks/order-form/useFormMarginInfo";

const Balance = () => {
  const { availableBalance, isLoading } = useFormMarginInfo();

  return (
    <DataRow label="Available to Trade" isLoading={isLoading}>
      {formatNumber(availableBalance, { decimalScale: 2 })} {getCollateralSymbol()}
    </DataRow>
  );
};

const CurrentPosition = () => {
  const { symbol } = useTradeSymbol();
  const { data: userAccount, isLoading } = useUserAccount();
  const formatAmount = useFormatSymbolAmount();
  const precision = useMarket(symbol)?.quantityPrecision;
  const currentPosition = useMemo(
    () => userAccount?.positions.find((p) => compareSymbols(p.symbol, symbol)),
    [userAccount, symbol],
  );
  const currentQuantity = currentPosition?.quantity;
  const displayQuantity =
    currentQuantity && currentQuantity < 0n ? -currentQuantity : currentQuantity;
  const positionColor =
    currentQuantity === undefined || currentQuantity === 0n
      ? undefined
      : currentQuantity > 0n
        ? "text-up"
        : "text-down";

  return (
    <DataRow label="Current Position" valueClassName={positionColor} isLoading={isLoading}>
      {currentPosition
        ? formatAmount(displayQuantity, symbol, "quantity")
        : zeroWithDecimals(precision)}{" "}
      {getDisplaySymbol(symbol)}
    </DataRow>
  );
};

export const BalanceAndCurrentPosition = () => {
  const windowWidth = useWindowWidth();
  return (
    <div className={`flex flex-col gap-[5px] mb-4`}
    style={{ marginTop: windowWidth < MOBILE_BREAKPOINT ? "10px" : "0px" }}
      >
      <Balance />
      <CurrentPosition />
    </div>
  );
};
