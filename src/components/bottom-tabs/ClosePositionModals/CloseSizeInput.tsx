import { useState } from "react";
import BN from "bignumber.js";
import { SizeInput, type SizeUnit } from "@/components/ui/size-input";
import { fromScaledQuantity } from "@/utils/formatting";
import { deriveCloseSizeValue } from "./utils";
import { useMarket } from "@/hooks/useMarkets";

export function CloseSizeInput({
  absQuantity,
  markPrice,
  baseAsset,
  onValueChange,
  hideInput
}: {
  absQuantity: BN;
  markPrice: number;
  baseAsset: string;
  onValueChange: (rawValue: string, percent: number) => void;
  hideInput?: boolean;
}) {
  const precision = useMarket(baseAsset)?.quantityPrecision;
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>("asset");
  const [percent, setPercent] = useState(100);
  const [sizeValue, setSizeValue] = useState(() =>
    deriveCloseSizeValue(100, absQuantity, markPrice, "asset", precision)
  );


  const maxQtyNum = BN(fromScaledQuantity(BigInt(absQuantity.toFixed(0))));

  const handleInputChange = (rawValue: string) => {
    setSizeValue(rawValue);
    const inputValue = parseFloat(rawValue) || 0;
    if (maxQtyNum.lte(0) || inputValue <= 0) {
      setPercent(0);
      onValueChange(rawValue, 0);
      return;
    }
    const inputQty = sizeUnit === "usd" && markPrice > 0
      ? BN(inputValue).div(markPrice)
      : BN(inputValue);
    const pct = inputQty.div(maxQtyNum).multipliedBy(100).toNumber();
    setPercent(pct);
    onValueChange(rawValue, pct);
  };

  const handlePercentChange = (pct: number) => {
    setPercent(pct);
    const value = deriveCloseSizeValue(pct, absQuantity, markPrice, sizeUnit, precision);
    setSizeValue(value);
    onValueChange(value, pct);
  };

  const handleUnitChange = (unit: SizeUnit) => {
    setSizeUnit(unit);
    const value = deriveCloseSizeValue(percent, absQuantity, markPrice, unit, precision);
    setSizeValue(value);
    onValueChange(value, percent);
  };

  return (
    <SizeInput
      value={sizeValue}
      percent={percent}
      onPercentChange={handlePercentChange}
      onInputChange={handleInputChange}
      baseAsset={baseAsset}
      sizeUnit={sizeUnit}
      onSizeUnitChange={handleUnitChange}
      decimalScale={precision}
      hideInput={hideInput}
      counterpartPrice={markPrice}
    />
  );
}
