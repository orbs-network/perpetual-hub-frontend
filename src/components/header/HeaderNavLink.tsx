import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAppQueryParams } from "@/hooks/useAppQueryParams";

type HeaderNavLinkProps = {
  active?: boolean;
  children: ReactNode;
  to: string;
};

export function HeaderNavLink({ active, children, to }: HeaderNavLinkProps) {
  const { queryString } = useAppQueryParams();

  return (
    <Link
      to={to + queryString}
      aria-current={active ? "page" : undefined}
      className={`header-nav-link px-3 py-1 text-[12px] font-medium transition-colors ${
        active ? "text-content" : "text-content-muted hover:text-content"
      }`}
    >
      {children}
    </Link>
  );
}
