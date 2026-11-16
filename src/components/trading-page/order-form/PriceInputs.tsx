import { getCollateralSymbol } from "@/utils/collateralDisplay";
import { getTickSizeStep, snapPriceToTickSize } from "@/utils/formatting";
import { NumericInput } from "../../ui/numeric-input";
import { useOrderFormStore } from "@/stores/orderFormStore";
import { useTradeSymbol } from "@/hooks/useSelectTradeSymbol";
import { useSelectedOrderBook } from "@/hooks/useOrderBook";
import type { NumberFormatValues } from "react-number-format";
import { useTranslation } from "@/hooks/useSafeTranslation";

function PriceField({
  ariaLabel,
  label,
  price,
  pricePrecision,
  priceStep,
  midPrice,
  setPrice,
  fillMidOnEmptyBlur = true,
}: {
  ariaLabel: string;
  label: string;
  price: string;
  pricePrecision: number;
  priceStep: string;
  midPrice: number;
  setPrice: (price: string) => void;
  fillMidOnEmptyBlur?: boolean;
}) {
  const { t } = useTranslation();
  const setMidPrice = () => {
    if (midPrice > 0) {
      setPrice(snapPriceToTickSize(midPrice, pricePrecision));
    }
  };

  return (
    <NumericInput
      aria-label={t(ariaLabel)}
      decimalScale={pricePrecision}
      size="sm"
      step={priceStep}
      value={price}
      onValueChange={(values: NumberFormatValues) => setPrice(values.value)}
      onBlur={() => {
        if (fillMidOnEmptyBlur && price === "" && midPrice > 0) {
          setMidPrice();
        }
      }}
      className="text-right pl-2 !text-[13px]"
      startContent={`${t(label)} (${getCollateralSymbol()})`}
      endContent={
        <button
          type="button"
          onClick={setMidPrice}
          disabled={midPrice <= 0}
          className="text-[10px] text-content-muted hover:text-content transition-colors px-1"
        >
          {t("Mid")}
        </button>
      }
    />
  );
}

export function PriceInputs() {
  const { uiOrderType, price, setPrice } = useOrderFormStore();
  const {market} = useTradeSymbol();
  const { data: orderBook } = useSelectedOrderBook();

  const pricePrecision = market?.pricePrecision ?? 2;
  const priceStep = getTickSizeStep(pricePrecision);
  const midPrice = orderBook?.midPrice ?? 0;

  if (uiOrderType !== "LIMIT") return null;

  return (
    <div className="mb-2">
      <PriceField
        ariaLabel="Price"
        label="Price"
        price={price}
        pricePrecision={pricePrecision}
        priceStep={priceStep}
        midPrice={midPrice}
        setPrice={setPrice}
      />
    </div>
  );
}
