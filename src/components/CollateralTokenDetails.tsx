import { getCollateralSymbol } from "@/utils/collateralDisplay";
import { ExternalLink } from "lucide-react";
import { useCollateralAddress } from "@/hooks/useCurrentPartnerChain";
import { useTargetChain } from "@/hooks/useTargetChain";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { shortenAddress } from "@/utils/formatting";

export function CollateralTokenDetails() {
  const { t } = useTranslation();
  const collateralSymbol = getCollateralSymbol();
  const address = useCollateralAddress();
  const chain = useTargetChain();
  const explorer = chain?.blockExplorers?.default;

  if (!address || /^0x0{40}$/i.test(address)) return null;

  const addressText = (
    <>
      <span aria-hidden="true">{shortenAddress(address)}</span>
      <span className="sr-only">{address}</span>
    </>
  );

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-edge bg-input-bg/40 px-3 py-2.5">
      <div className="shrink-0 whitespace-nowrap text-[11px] leading-4 text-content-muted">
        {t("{{collateralSymbol}} Address", { collateralSymbol })}
      </div>
      {explorer ? (
        <a
          href={`${explorer.url.replace(/\/$/, "")}/token/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          title={address}
          className="group inline-flex min-w-0 items-center gap-2 rounded-sm text-content-secondary transition-colors hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <span className="truncate font-mono text-xs leading-5" translate="no">{addressText}</span>
          <ExternalLink size={14} className="shrink-0 text-content-muted group-hover:text-content" aria-hidden="true" />
          <span className="sr-only">{explorer.name}</span>
        </a>
      ) : (
        <span className="min-w-0 truncate font-mono text-xs leading-5 text-content-secondary" title={address} translate="no">{addressText}</span>
      )}
    </div>
  );
}
