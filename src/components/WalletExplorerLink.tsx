import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { buildAddressExplorerUrl } from "@/lib/addressExplorer";
import { cn } from "@/lib/utils";

type WalletExplorerLinkProps = Omit<
  ComponentPropsWithoutRef<"a">,
  "children" | "href"
> & {
  address: string;
  chainId?: number | null;
  children?: ReactNode;
  fallbackClassName?: string;
  iconClassName?: string;
  showIcon?: boolean;
};

export function WalletExplorerLink({
  address,
  chainId,
  children,
  className,
  fallbackClassName,
  iconClassName,
  rel = "noreferrer",
  showIcon = true,
  target = "_blank",
  ...props
}: WalletExplorerLinkProps) {
  const explorerUrl = buildAddressExplorerUrl(chainId, address);
  const content = children ?? <span className="truncate">{address}</span>;

  if (!explorerUrl) {
    return (
      <span className={cn("min-w-0", fallbackClassName ?? className)}>
        {content}
      </span>
    );
  }

  return (
    <a
      className={cn("inline-flex min-w-0 items-center gap-1.5", className)}
      href={explorerUrl}
      rel={rel}
      target={target}
      {...props}
    >
      {content}
      {showIcon ? (
        <ExternalLink
          className={cn("h-3.5 w-3.5 shrink-0", iconClassName)}
        />
      ) : null}
    </a>
  );
}
