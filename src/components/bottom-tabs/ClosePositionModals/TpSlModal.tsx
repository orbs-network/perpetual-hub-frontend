import { useEffect, useMemo, useRef, useState } from "react";
import BN from "bignumber.js";
import { toast } from "sonner";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
} from "@/components/ui/responsive-modal";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthGuardButton } from "@/components/AuthGuardButton";
import { Button } from "@/components/ui/button";
import { useUpdateTpSlOrders } from "@/hooks/mutations/useUpdateTpSlOrders";
import { usePrice } from "@/hooks/useBinancePrices";
import {
  ExitLimitPriceRows,
  ExitPriceRows,
} from "@/components/trading-page/ExitPriceRows";
import {
  formatDisplayPrice,
  fromScaledQuantity,
  getTickSizeStep,
  domainPriceToDisplayNumber,
} from "@/utils/formatting";
import { useFormatSymbolAmount } from "@/hooks/useFormatting";
import { useMarket } from "@/hooks/useMarkets";
import type { Position, Order } from "@/types";
import { getBaseAsset } from "./utils";
import { getInvalidTpSlTriggerPriceMessage } from "@/lib/tpSlValidation";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { resolveTpSlLeverage } from "@/utils/tpsl";

function InfoRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-between items-center">
      <span className="text-content-muted text-[13px]">{t(label)}</span>
      <span
        className={` text-[13px] font-medium ${valueClass ?? "text-content"}`}
      >
        {value}
      </span>
    </div>
  );
}

function orderTriggerPrice(
  order: Order | undefined,
  precision: number,
): string {
  if (!order) return "";
  const price = order.stopPrice > 0n ? order.stopPrice : order.price;
  if (price <= 0n) return "";
  return domainPriceToDisplayNumber(price).toFixed(precision);
}

function hasPositivePrice(price: string) {
  const parsed = parseDisplayPrice(price);
  return Number.isFinite(parsed) && parsed > 0;
}

function parseDisplayPrice(price: string) {
  return Number(price.replace(/,/g, ""));
}

function isLimitTpSlOrder(order: Order | undefined): order is Order {
  if (!order || order.price <= 0n) return false;
  return (
    order.orderType === "TAKE_PROFIT" ||
    order.orderType === "TAKE_PROFIT_LIMIT" ||
    order.orderType === "STOP" ||
    order.orderType === "STOP_LOSS_LIMIT"
  );
}

function orderLimitPrice(
  order: Order | undefined,
  precision: number,
): string {
  if (!isLimitTpSlOrder(order)) return "";
  return domainPriceToDisplayNumber(order.price).toFixed(precision);
}

function ExistingExitLegRow({
  label,
  triggerPrice,
  limitPrice,
  checked,
  onCheckedChange,
}: {
  label: string;
  triggerPrice: string;
  limitPrice: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <label className="flex items-center justify-between gap-3 rounded border border-edge/70 bg-surface/50 px-3 py-2 text-[13px] text-content-secondary">
      <span className="flex items-center gap-2">
        <Checkbox
          aria-label={t(label)}
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
        />
        <span className="font-semibold text-content">{t(label)}</span>
      </span>
      <span className="text-right text-content">
        {triggerPrice}
        {limitPrice && (
          <span className="ml-2 text-content-muted">
            {t("Limit")} {limitPrice}
          </span>
        )}
      </span>
    </label>
  );
}

export function TpSlModal({
  position,
  leverage,
  isOpen,
  onClose,
  existingTpOrder,
  existingSlOrder,
}: {
  position: Position;
  leverage?: number;
  isOpen: boolean;
  onClose: () => void;
  existingTpOrder?: Order;
  existingSlOrder?: Order;
}) {
  const { t } = useTranslation();
  const { mutate: updateTpSlOrders, isPending } = useUpdateTpSlOrders();
  const priceData = usePrice(position.symbol);
  const market = useMarket(position.symbol);
  const formatAmount = useFormatSymbolAmount();

  const isLong = BN(position.quantity.toString()).gt(0);
  const absQuantity = useMemo(
    () => BN(position.quantity.toString()).abs(),
    [position.quantity],
  );
  const baseAsset = getBaseAsset(position.symbol);
  const entryPrice = domainPriceToDisplayNumber(position.entryPrice);
  const markPrice = priceData?.markPrice ?? priceData?.price ?? 0;
  const pricePrecision = market?.pricePrecision ?? 2;
  const priceStep = getTickSizeStep(pricePrecision);
  const qtyNum = parseFloat(fromScaledQuantity(BigInt(absQuantity.toFixed(0))));
  const effectiveLeverage = resolveTpSlLeverage({
    entryPrice: BN(entryPrice),
    quantity: BN(qtyNum),
    initialMargin: position.initialMargin,
    allocatedMargin: position.allocatedMargin,
    positionLeverage: position.leverage,
    resolvedLeverage: leverage,
  });

  const initialTp = orderTriggerPrice(existingTpOrder, pricePrecision);
  const initialSl = orderTriggerPrice(existingSlOrder, pricePrecision);
  const initialTpLimit = orderLimitPrice(existingTpOrder, pricePrecision);
  const initialSlLimit = orderLimitPrice(existingSlOrder, pricePrecision);
  const initialLimitPrice = !!initialTpLimit || !!initialSlLimit;

  const [tpPrice, setTpPrice] = useState(initialTp);
  const [slPrice, setSlPrice] = useState(initialSl);
  const [hasTp, setHasTp] = useState(!!initialTp);
  const [hasSl, setHasSl] = useState(!!initialSl);

  const [limitPrice, setLimitPrice] = useState(initialLimitPrice);
  const [tpLimitPrice, setTpLimitPrice] = useState(initialTpLimit);
  const [slLimitPrice, setSlLimitPrice] = useState(initialSlLimit);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!isOpen || wasOpen) return;

    setTpPrice(initialTp);
    setSlPrice(initialSl);
    setHasTp(!!initialTp);
    setHasSl(!!initialSl);
    setLimitPrice(initialLimitPrice);
    setTpLimitPrice(initialTpLimit);
    setSlLimitPrice(initialSlLimit);
  }, [
    initialLimitPrice,
    initialSl,
    initialSlLimit,
    initialTp,
    initialTpLimit,
    isOpen,
  ]);

  const closeQuantity = useMemo(
    () => BigInt(absQuantity.toFixed(0)),
    [absQuantity],
  );

  const handleConfirm = () => {
    const tpValidationMessage = hasTpValue
      ? getInvalidTpSlTriggerPriceMessage({
          kind: "TP",
          positionQuantity: position.quantity,
          triggerPrice: parseDisplayPrice(tpPrice),
          currentPrice: markPrice,
          t,
        })
      : null;
    const slValidationMessage = hasSlValue
      ? getInvalidTpSlTriggerPriceMessage({
          kind: "SL",
          positionQuantity: position.quantity,
          triggerPrice: parseDisplayPrice(slPrice),
          currentPrice: markPrice,
          t,
        })
      : null;
    const validationMessage = tpValidationMessage ?? slValidationMessage;
    if (validationMessage) {
      toast.error(validationMessage, { duration: 5000 });
      return;
    }

    updateTpSlOrders({
      position,
      configureAmount: false,
      sizePercent: 100,
      closeQuantity,
      hasTp,
      tpPrice,
      hasSl,
      slPrice,
      limitPrice,
      tpLimitPrice,
      slLimitPrice,
      existingTpOrder,
      existingSlOrder,
      lockExistingFullPosition: true,
      pricePrecision,
      onSuccess: onClose,
    });
  };

  const hasTpValue = hasTp && hasPositivePrice(tpPrice);
  const hasSlValue = hasSl && hasPositivePrice(slPrice);
  const hasInitialTp = !!initialTp;
  const hasInitialSl = !!initialSl;
  const canAddTp = !hasInitialTp;
  const canAddSl = !hasInitialSl;
  const hasAddableLeg = canAddTp || canAddSl;
  const missingLimitPrice =
    limitPrice &&
    ((canAddTp && hasTpValue && !hasPositivePrice(tpLimitPrice)) ||
      (canAddSl && hasSlValue && !hasPositivePrice(slLimitPrice)));
  const hasAddableSubmit =
    (canAddTp && hasTpValue) || (canAddSl && hasSlValue);
  const hasCancellation =
    (hasInitialTp && !hasTp) || (hasInitialSl && !hasSl);
  const canSubmit = hasAddableSubmit || hasCancellation;

  return (
    <ResponsiveModal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ResponsiveModalContent
        className="max-w-xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ResponsiveModalHeader>
          <ResponsiveModalTitle className="text-center text-base">
            {t("TP/SL for Position")}</ResponsiveModalTitle>
          <ResponsiveModalDescription className="sr-only">
            {t("Set take profit and stop loss")}</ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="px-5 pt-3 space-y-4">
          {/* Position info */}
          <div className="space-y-2">
            <InfoRow
              label="Position"
              value={`${formatAmount(BigInt(absQuantity.toFixed(0)), position.symbol, "quantity")} ${baseAsset}`}
              valueClass={isLong ? "text-up" : "text-down"}
            />
            <InfoRow
              label="Entry Price"
              value={formatDisplayPrice(entryPrice)}
            />
            <InfoRow
              label="Mark Price"
              value={markPrice > 0 ? formatDisplayPrice(markPrice) : "-"}
            />
          </div>

          {(hasInitialTp || hasInitialSl) && (
            <div className="space-y-2">
              {hasInitialTp && (
                <ExistingExitLegRow
                  label="TP"
                  triggerPrice={initialTp}
                  limitPrice={initialTpLimit}
                  checked={hasTp}
                  onCheckedChange={setHasTp}
                />
              )}
              {hasInitialSl && (
                <ExistingExitLegRow
                  label="SL"
                  triggerPrice={initialSl}
                  limitPrice={initialSlLimit}
                  checked={hasSl}
                  onCheckedChange={setHasSl}
                />
              )}
            </div>
          )}

          {hasAddableLeg && (
            <ExitPriceRows
              key={`${isOpen ? "open" : "closed"}-${initialTp}-${initialSl}`}
              showTakeProfit={canAddTp}
              showStopLoss={canAddSl}
              pricePrecision={pricePrecision}
              priceStep={priceStep}
              entryPrice={BN(entryPrice)}
              quantity={BN(qtyNum)}
              isLong={isLong}
              leverage={effectiveLeverage}
              initialTpPrice=""
              initialSlPrice=""
              showExpectedValues
              onTpChange={(price, enabled) => {
                if (!canAddTp) return;
                setTpPrice(price);
                setHasTp(enabled);
              }}
              onSlChange={(price, enabled) => {
                if (!canAddSl) return;
                setSlPrice(price);
                setHasSl(enabled);
              }}
            />
          )}

          {/* Options */}
          {hasAddableLeg && (
            <div className="flex items-start gap-2 flex-col w-full">
              <label className="flex items-center gap-1.5 text-[13px] text-content-secondary cursor-pointer">
                <Checkbox
                  checked={limitPrice}
                  onCheckedChange={(v) => setLimitPrice(v === true)}
                />
                {t("Limit Price")}</label>
              {limitPrice && (
                <ExitLimitPriceRows
                  showTakeProfit={canAddTp}
                  showStopLoss={canAddSl}
                  pricePrecision={pricePrecision}
                  priceStep={priceStep}
                  takeProfitLimitPrice={tpLimitPrice}
                  stopLossLimitPrice={slLimitPrice}
                  onTakeProfitLimitPriceChange={setTpLimitPrice}
                  onStopLossLimitPriceChange={setSlLimitPrice}
                />
              )}
            </div>
          )}

          {/* Submit */}
          <AuthGuardButton className="w-full">
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isPending || !canSubmit || missingLimitPrice}
              loading={isPending}
              className="w-full py-2.5 font-bold"
            >
              {t("Confirm")}
            </Button>
          </AuthGuardButton>

          {/* Disclaimer */}
          <ResponsiveModalFooter>
            <div className="text-[12px] text-content-secondary text-center leading-relaxed flex flex-col gap-2">
              <p>
                {" "}
                {t("By default take-profit and stop-loss orders apply to the entire position. Take-profit and stop-loss automatically cancel after closing the position. A market order is triggered when the stop loss or take profit price is reached.")}</p>
            </div>
          </ResponsiveModalFooter>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
