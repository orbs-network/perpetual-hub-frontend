import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal";
import { AuthGuardButton } from "@/components/AuthGuardButton";
import { Button } from "@/components/ui/button";
import { SkipConfirmCheckbox } from "@/components/ui/skip-confirm-checkbox";
import { useReversePosition } from "@/hooks/mutations/useClosePosition";
import { useUserPreferencesStore } from "@/stores/userPreferencesStore";
import type { Position } from "@/types";
import { fromScaledQuantity } from "@/utils/formatting";
import { getBaseAsset } from "./utils";
import { useTranslation } from "@/hooks/useSafeTranslation";

export function ReversePositionModal({
  position,
  isLong,
  onClose,
  isOpen,
}: {
  position: Position;
  isLong: boolean;
  onClose: () => void;
  isOpen: boolean;
}) {
  const { t } = useTranslation();
  const { mutateAsync: reversePosition, isPending } = useReversePosition();
  const skipClosePositionConfirm = useUserPreferencesStore(
    (state) => state.skipClosePositionConfirm,
  );
  const setSkipClosePositionConfirm = useUserPreferencesStore(
    (state) => state.setSkipClosePositionConfirm,
  );
  const absQuantity =
    position.quantity > 0n ? position.quantity : -position.quantity;
  const baseAsset = getBaseAsset(position.symbol);
  const nextDirection = isLong ? "Short" : "Long";

  async function handleConfirm() {
    try {
      await reversePosition(position);
      onClose();
    } catch {
      // Toast/error ownership lives in useReversePosition.
    }
  }

  return (
    <ResponsiveModal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ResponsiveModalContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle className="text-center">
            {t("Reverse Position")}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-center text-content-muted text-sm">
            {t(
              "This will close the current position and open the same size in the opposite direction.",
            )}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="p-5 space-y-4 pb-0">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-content-secondary">
                {t("Price")}
              </span>
              <span className="text-content text-[12px]">
                {t("Market")}
              </span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-content-secondary">
                {t("Size")}
              </span>
              <span className="text-content">
                {fromScaledQuantity(absQuantity)} {baseAsset}
              </span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-content-secondary">
                {t("New Direction")}
              </span>
              <span className="text-content">
                {t(nextDirection)}
              </span>
            </div>
          </div>

          <SkipConfirmCheckbox
            checked={skipClosePositionConfirm}
            onCheckedChange={setSkipClosePositionConfirm}
          />
          <AuthGuardButton className="w-full">
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              loading={isPending}
              className="w-full py-2.5 font-bold"
            >
              {t("Reverse")}
            </Button>
          </AuthGuardButton>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
