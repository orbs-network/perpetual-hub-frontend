import { useState } from "react";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
} from "@/components/ui/responsive-modal";
import { AuthGuardButton } from "@/components/AuthGuardButton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/hooks/useSafeTranslation";
import {
  useCloseAllPositions,
  type CloseAllMethod,
} from "@/hooks/mutations/useClosePosition";

export function CloseAllPositionsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [method, setMethod] = useState<CloseAllMethod>("limit-mid");
  const { mutate: closeAll, isPending } = useCloseAllPositions();

  const confirmLabel =
    method === "market" ? "Confirm Market Close" : "Confirm Limit Close at Mid";

  return (
    <ResponsiveModal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ResponsiveModalContent onOpenAutoFocus={(e) => e.preventDefault()} className="max-w-lg">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle className="text-center">
            {t("Confirm Close All")}</ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-center text-content-muted text-[13px]">
            {t("This will close all your positions and cancel their associated TP/SL orders.")}</ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="space-y-3 p-5 pb-0">
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              checked={method === "market"}
              onCheckedChange={() => setMethod("market")}
              className="h-4 w-4"
            />
            <span className="text-sm text-content">{t("Market Close")}</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              checked={method === "limit-mid"}
              onCheckedChange={() => setMethod("limit-mid")}
              className="h-4 w-4"
            />
            <span className="text-sm text-content">
              {t("Limit Close at Mid Price")}</span>
          </label>

          <div className="pt-4">
            <AuthGuardButton className="w-full">
              <Button
                type="button"
                onClick={() => closeAll({ method, onSuccess: onClose })}
                disabled={isPending}
                loading={isPending}
                className="w-full py-2.5 font-bold"
              >
                {t(isPending ? "Closing..." : confirmLabel)}
              </Button>
            </AuthGuardButton>
          </div>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
