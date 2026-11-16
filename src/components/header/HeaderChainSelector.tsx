import { useCallback, useMemo, useState, type MouseEvent } from "react";
import { Check, ChevronDown, Network } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAccount, useSwitchChain } from "wagmi";
import { getChainLogoUrl } from "@/config/chains";
import { partner } from "@/config/partners";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  getAppTargetChainId,
  getPartnerChainIds,
  getQueryAppTargetChainId,
} from "@/utils/config";
import { applyHeaderChainSelectorHref } from "./HeaderChainSelectorNavigation";
import { buildHeaderChainSelectorHref } from "./HeaderChainSelectorUtils";

type ChainSelectorOption = {
  chainId: number;
  href: string;
  isSelected: boolean;
  label: string;
  logoUrl?: string;
};

export type HeaderChainSelectorOption = ChainSelectorOption;

type HeaderChainSelectorControlProps = {
  options: ChainSelectorOption[];
  selectedOption?: ChainSelectorOption;
  showChainName?: boolean;
  singleAriaLabelPrefix?: string;
  triggerAriaLabelPrefix?: string;
  triggerClassName?: string;
  contentClassName?: string;
  describedBy?: string;
  invalid?: boolean;
  onSelectChain: (
    event: MouseEvent<HTMLAnchorElement>,
    option: ChainSelectorOption,
  ) => boolean | void | Promise<boolean | void>;
};

export function ChainLogo({
  className = "h-5 w-5",
  logoUrl,
}: {
  className?: string;
  logoUrl?: string;
}) {
  if (!logoUrl) {
    return <Network size={13} className="shrink-0 text-content-muted" />;
  }

  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white`}
    >
      <img src={logoUrl} alt="" aria-hidden="true" className="h-full w-full object-cover" />
    </span>
  );
}

export function HeaderChainSelectorControl({
  contentClassName,
  describedBy,
  invalid = false,
  onSelectChain,
  options,
  selectedOption = options.find((option) => option.isSelected) ?? options[0],
  showChainName = false,
  singleAriaLabelPrefix = "Partner chain",
  triggerAriaLabelPrefix = "Select partner chain",
  triggerClassName,
}: HeaderChainSelectorControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = selectedOption?.label;

  if (!selectedOption) {
    return null;
  }

  const selectedContent = (
    <>
      <ChainLogo logoUrl={selectedOption.logoUrl} />
      {showChainName ? (
        <span className="min-w-0 truncate">{selectedOption.label}</span>
      ) : null}
    </>
  );

  if (options.length <= 1) {
    return (
      <div
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        aria-label={`${singleAriaLabelPrefix}: ${selectedLabel}`}
        title={selectedLabel}
        className={cn(
          "inline-flex h-full min-w-9 items-center justify-center rounded border border-edge px-2 text-content-secondary",
          showChainName && "min-w-0 justify-start gap-2 px-2.5 text-[13px]",
          invalid && "border-short/70",
          triggerClassName,
        )}
      >
        {selectedContent}
      </div>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          aria-label={`${triggerAriaLabelPrefix}: ${selectedLabel}`}
          title={selectedLabel}
          className={cn(
            "flex h-full min-w-11 items-center justify-center gap-1 rounded border border-edge px-2 text-content-secondary transition-colors hover:bg-hover hover:text-content",
            showChainName && "min-w-0 justify-between gap-2 px-2.5 text-[13px]",
            invalid && "border-short/70",
            triggerClassName,
          )}
        >
          {selectedContent}
          <ChevronDown
            size={13}
            className={cn(
              "shrink-0 text-content-muted transition-transform",
              isOpen && "rotate-180 text-content-secondary",
            )}
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "w-[13rem] max-w-[calc(100vw-1rem)] border-edge bg-base p-1.5",
          contentClassName,
        )}
        align="end"
      >
        <div className="space-y-0.5">
          {options.map((option) => (
            <a
              key={option.chainId}
              href={option.href}
              aria-current={option.isSelected ? "true" : undefined}
              className={cn(
                "flex min-w-0 items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-hover hover:text-content",
                option.isSelected
                  ? "bg-hover text-content"
                  : "text-content-secondary",
              )}
              onClick={(event) => {
                event.preventDefault();
                void Promise.resolve(onSelectChain(event, option)).then(
                  (shouldClose) => {
                    if (shouldClose !== false) setIsOpen(false);
                  },
                );
              }}
            >
              <ChainLogo className="h-4 w-4" logoUrl={option.logoUrl} />
              <span className="min-w-0 flex-1 whitespace-normal break-words">
                {option.label}
              </span>
              {option.isSelected && (
                <Check size={13} className="shrink-0 text-content" />
              )}
            </a>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function HeaderChainSelector({
  showChainName = false,
  triggerClassName,
}: {
  showChainName?: boolean;
  triggerClassName?: string;
} = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { chainId: walletChainId, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const chainIds = getPartnerChainIds(partner.chains);
  const currentChainId = getAppTargetChainId({
    chainIds,
    selectedChainId: getQueryAppTargetChainId(location.search),
  });

  const options = useMemo<ChainSelectorOption[]>(
    () =>
      partner.chains.map((entry) => {
        return {
          chainId: entry.chainId,
          href: buildHeaderChainSelectorHref({
            chainId: entry.chainId,
            hash: location.hash,
            pathname: location.pathname,
            search: location.search,
          }),
          isSelected: entry.chainId === currentChainId,
          label: entry.chainName,
          logoUrl: getChainLogoUrl(entry.chainId),
        };
      }),
    [currentChainId, location.hash, location.pathname, location.search],
  );

  const selectedOption =
    options.find((option) => option.isSelected) ?? options[0];

  const selectChain = useCallback(
    async (event: MouseEvent<HTMLAnchorElement>, option: ChainSelectorOption) => {
      event.preventDefault();

      const shouldSwitchWallet =
        isConnected && walletChainId !== option.chainId;

      if (shouldSwitchWallet) {
        try {

          await switchChainAsync({ chainId: option.chainId });
        } catch {
          toast.error("Failed to switch network", {
            duration: 5000,
          });
          return false;
        }
      }

      applyHeaderChainSelectorHref(option.href, navigate);
      return true;
    },
    [isConnected, navigate, switchChainAsync, walletChainId],
  );

  return (
    <HeaderChainSelectorControl
      options={options}
      selectedOption={selectedOption}
      showChainName={showChainName}
      triggerClassName={triggerClassName}
      onSelectChain={selectChain}
    />
  );
}
