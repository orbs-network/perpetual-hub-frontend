import { useState } from "react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { ChevronDown, Copy, LogOut } from "lucide-react";
import { toast } from "sonner";
import { shortenAddress } from "@/utils/formatting";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type HeaderWalletPopoverProps = {
  logout: () => Promise<void>;
  walletAddress?: string;
  isDisconnecting?: boolean;
};

export function HeaderWalletPopover({
  logout,
  walletAddress,
  isDisconnecting = false,
}: HeaderWalletPopoverProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("Wallet menu")}
          className="flex h-full min-w-11 items-center justify-center gap-1 rounded border border-edge px-2.5 text-[12px] text-content-secondary transition-colors hover:bg-hover hover:text-content"
        >
          <span className="normal-case">
            {walletAddress ? shortenAddress(walletAddress) : ""}
          </span>
          <ChevronDown
            size={13}
            className={`shrink-0 text-content-muted transition-transform ${
              isOpen ? "rotate-180 text-content-secondary" : ""
            }`}
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 border-edge bg-base p-1.5" align="end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            if (walletAddress) {
              navigator.clipboard.writeText(walletAddress);
              toast.success(t("wallet.addressCopied"), { duration: 2000 });
            }
            setIsOpen(false);
          }}
          className="h-auto w-full justify-start rounded px-2 py-1.5 text-left text-[12px] font-normal text-content-secondary hover:text-content"
        >
          <Copy size={12} className="text-content-muted" />
          {t("wallet.copyAddress")}
        </Button>
        <div className="my-0.5 border-t border-edge" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isDisconnecting}
          onClick={() => {
            void logout();
          }}
          className="h-auto w-full justify-start rounded px-2 py-1.5 text-left text-[12px] font-normal text-short hover:text-short"
        >
          <LogOut size={12} />
          {isDisconnecting ? t("Disconnecting…") : t("wallet.disconnect")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
