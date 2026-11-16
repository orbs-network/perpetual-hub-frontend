import { useState } from "react";
import { NumericInput } from "@/components/ui/numeric-input";
import { AuthGuardButton } from "@/components/AuthGuardButton";
import { Button } from "@/components/ui/button";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
} from "@/components/ui/responsive-modal";
import { useUpdateOrder } from "@/hooks/mutations/useUpdateOrder";
import { useMarket } from "@/hooks/useMarkets";
import { getDisplaySymbol } from "@/lib/utils";
import type { Order } from "@/types";
import { useTranslation } from "@/hooks/useSafeTranslation";
import {
  domainPriceToDecimal,
  fromScaledQuantity,
} from "@/utils/formatting";
import {
  buildEditOrderInput,
  type EditOrderMode,
} from "./editOrderUtils";

interface EditOrderModalProps {
  order: Order;
  isOpen: boolean;
  mode: EditOrderMode;
  onClose: () => void;
}

export function EditOrderModal({
  order,
  isOpen,
  mode,
  onClose,
}: EditOrderModalProps) {
  const { t } = useTranslation();
  const market = useMarket(order.symbol);
  const { mutateAsync: updateOrder, isPending: isProcessing } = useUpdateOrder();

  const qtyPrecision = market?.quantityPrecision ?? 8;
  const pricePrecision = market?.pricePrecision ?? 2;
  const symbolShort = getDisplaySymbol(order.symbol);
  const originalQty = fromScaledQuantity(order.quantity);
  const canEditPrice = order.price > 0n;
  const originalPrice = canEditPrice ? domainPriceToDecimal(order.price) : "";

  const [quantity, setQuantity] = useState(originalQty);
  const [price, setPrice] = useState(originalPrice);

  const isSizeMode = mode === "size";
  const isPriceMode = mode === "price";
  const hasChanges = isSizeMode
    ? quantity !== originalQty
    : canEditPrice && price !== originalPrice;
  const quantityValue = parseFloat(quantity);
  const priceValue = parseFloat(price);
  const isValid = isSizeMode
    ? Number.isFinite(quantityValue) && quantityValue > 0
    : canEditPrice && Number.isFinite(priceValue) && priceValue > 0;
  const title = isSizeMode ? "Edit Size" : "Edit Price";

  const handleConfirm = async () => {
    if (!hasChanges || !isValid) return;
    const input = buildEditOrderInput({
      order,
      mode,
      quantity,
      price,
      qtyPrecision,
      pricePrecision,
    });
    try {
      await updateOrder({
        orderId: order.orderId,
        input,
        onSuccess: onClose,
      });
    } catch {
      // useUpdateOrder owns the user-facing failure toast.
    }
  };

  return (
    <ResponsiveModal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ResponsiveModalContent
        className="max-w-md"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <ResponsiveModalHeader>
          <ResponsiveModalTitle className="text-center text-base">
            {t(title)} - {symbolShort}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="sr-only">
            {t("Modify order")}{" "}
            {t(isSizeMode ? "size" : "price")}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="px-5 pt-3 space-y-3">
          {isSizeMode && (
            <div>
              <label className="text-[12px] text-content-muted mb-1 block">
                {t("Size (")}{symbolShort})
              </label>
              <NumericInput
                value={quantity}
                onValueChange={(value) => setQuantity(value.value)}
                decimalScale={qtyPrecision}
                disabled={isProcessing}
                size="sm"
              />
            </div>
          )}
          {isPriceMode && canEditPrice && (
            <div>
              <label className="text-[12px] text-content-muted mb-1 block">
                {t("Price")}</label>
              <NumericInput
                value={price}
                onValueChange={(value) => setPrice(value.value)}
                decimalScale={pricePrecision}
                disabled={isProcessing}
                size="sm"
              />
            </div>
          )}

          <p className="text-[11px] text-content-muted text-center">
            {t("This will cancel the existing order and place a new one with the updated")}{" "}
            {t(isSizeMode ? "size" : "price")}.
          </p>

          <AuthGuardButton className="w-full">
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isProcessing || !hasChanges || !isValid}
              loading={isProcessing}
              className="w-full py-2.5 font-bold"
            >
              {t(isProcessing ? "Updating..." : "Confirm")}
            </Button>
          </AuthGuardButton>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
