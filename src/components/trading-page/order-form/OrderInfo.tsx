import BN from "bignumber.js";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { DataRow, DataRowContainer } from "../../DataRow";
import { useFormMarginInfo } from "@/hooks/order-form/useFormMarginInfo";
import { useAccountSymbolLeverage } from "@/hooks/useUserAccount";
import { useLiveAccountRisk } from "@/hooks/useLiveAccountRisk";
import { formatNumber, formatUSD } from "@/utils/formatting";
import { LiquidationPriceRow } from "@/components/LiquidationPriceRow";
import { useTradeSymbol } from "@/hooks/useSelectTradeSymbol";

function NotAvailable() {
  const { t } = useTranslation();
  return <>{t("N/A")}</>;
}

function OrderValue() {
  const { marginInfo } = useFormMarginInfo();
  return (
    <DataRow label="Order Value">
      {BN(marginInfo.notionalValue).gt(0) ? (
        <>${formatUSD(Number(marginInfo.notionalValue))}</>
      ) : (
        <NotAvailable />
      )}
    </DataRow>
  );
}

function MarginRequired() {
  const { marginInfo } = useFormMarginInfo();
  return (
    <DataRow label="Margin Required">
      {BN(marginInfo.notionalValue).gt(0) ? (
        <>${formatUSD(Number(marginInfo.required))}</>
      ) : (
        <NotAvailable />
      )}
    </DataRow>
  );
}


function Fee() {
  const { t } = useTranslation();
  const {feeRateBps, isLoading} = useLiveAccountRisk();
  const feePercent = feeRateBps ? feeRateBps / 100 : 0;
  const feePercentF = formatNumber(feePercent, {
    decimalScale: 2,
    suffix: "%",
  });
  return (
    <DataRow
      label="Fee"
      tooltip={`${t("Trading fee:")} ${feePercentF} ${t("of order value")}`}
      isLoading={isLoading}
    >
      {feePercentF}
    </DataRow>
  );
}


function BuyingPower() {
  const { availableBalance, isLoading } = useFormMarginInfo();
  const {symbol} = useTradeSymbol();
  const { leverage } = useAccountSymbolLeverage(symbol);
  return (
    <DataRow label="Buying Power" isLoading={isLoading}>
      ${formatUSD(BN(availableBalance).multipliedBy(leverage).toNumber())}
    </DataRow>
  );
}

const LiquidationPrice = () => {
  const { liquidationEstimate } = useFormMarginInfo();

  return (
    <LiquidationPriceRow
      liquidationPrice={liquidationEstimate?.liquidationPrice}
      valueClassName="text-content text-[12px]"
      labelClassName="text-content text-[12px]"
    />
  );
};

export function OrderInfo() {
  return (
    <DataRowContainer className="mt-0 pt-0">
      <LiquidationPrice />
      <OrderValue />
      <MarginRequired />
      <Fee />
      <BuyingPower />
    </DataRowContainer>
  );
}
