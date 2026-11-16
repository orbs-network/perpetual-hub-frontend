import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
} from "@/components/ui/responsive-modal";
import { AuthGuardButton } from "@/components/AuthGuardButton";
import { Button } from "@/components/ui/button";
import { useCancelAllOrders } from "@/hooks/mutations/useCancelOrder";
import { useTranslation } from "@/hooks/useSafeTranslation";

export function CancelAllOrdersModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { mutate: cancelAll, isPending } = useCancelAllOrders();

  return (
    <ResponsiveModal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ResponsiveModalContent onOpenAutoFocus={(e) => e.preventDefault()} className="max-w-lg">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle className="text-center">
            {t("Cancel All Orders")}</ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-center text-content-muted text-[13px]">
            {t("This will cancel all your open orders.")}</ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="p-5 pb-0">
          <AuthGuardButton className="w-full">
            <Button
              type="button"
              onClick={() => cancelAll({ onSuccess: onClose })}
              disabled={isPending}
              loading={isPending}
              className="w-full py-2.5 font-bold"
            >
              {t(isPending ? "Cancelling..." : "Confirm Cancel All")}
            </Button>
          </AuthGuardButton>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
