import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { partner } from "@/config/partners";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useAppQueryParams } from "@/hooks/useAppQueryParams";
import { appRoutes, ROUTE_PATHS, withRouteSearch } from "@/routes";

type MobileDrawerLinkProps = {
  active?: boolean;
  children: ReactNode;
  to: string;
};

function MobileDrawerLink({ active, children, to }: MobileDrawerLinkProps) {
  return (
    <DrawerClose asChild>
      <Link
        to={to}
        aria-current={active ? "page" : undefined}
        className={`header-nav-link flex items-center rounded px-3 py-2 text-[17px] transition-colors hover:bg-hover ${
          active ? "text-content" : "text-content-secondary"
        }`}
      >
        {children}
      </Link>
    </DrawerClose>
  );
}

type HeaderMobileNavigationDrawerProps = {
  tradePath: string;
};

export function HeaderMobileNavigationDrawer({
  tradePath,
}: HeaderMobileNavigationDrawerProps) {
  const { t } = useTranslation();
  const { queryString } = useAppQueryParams();
  const pathname = useLocation().pathname;
  return (
    <Drawer direction="left" shouldScaleBackground={false}>
      <DrawerTrigger asChild>
        <button
          type="button"
          aria-label={t("header.navigationMenu")}
          className="flex h-8 w-8 items-center justify-center rounded border border-edge text-content-secondary transition-colors hover:bg-hover hover:text-content"
        >
          <Menu size={16} />
        </button>
      </DrawerTrigger>
      <DrawerContent
        direction="left"
        aria-describedby={undefined}
        className="w-64 max-w-[76vw] overflow-y-auto p-0"
      >
        <DrawerTitle className="sr-only">
          {t("header.navigationMenu")}
        </DrawerTitle>
        <div className="flex h-[53px] items-center justify-between px-4">
          {partner.logoUrl && (
            <img
              src={partner.wordmarkUrl ?? partner.logoUrl}
              alt={partner.name}
              className={partner.wordmarkUrl ? "h-7 w-auto max-w-[128px] object-contain" : "h-7 w-7"}
            />
          )}
          <DrawerClose asChild>
            <button
              type="button"
              aria-label={t("Close")}
              className="flex h-8 w-8 items-center justify-center rounded text-content-muted transition-colors hover:bg-hover hover:text-content"
            >
              <X size={18} />
            </button>
          </DrawerClose>
        </div>
        <nav
          aria-label={t("header.navigationMenu")}
          className="flex flex-col gap-1 p-2"
        >
          <MobileDrawerLink
            to={withRouteSearch(tradePath, queryString)}
            active={pathname.startsWith(ROUTE_PATHS.trade)}
          >
            {t("header.trade")}
          </MobileDrawerLink>
          <MobileDrawerLink
            to={appRoutes.portfolio(queryString)}
            active={pathname === ROUTE_PATHS.portfolio}
          >
            {t("header.portfolio")}
          </MobileDrawerLink>
          <MobileDrawerLink
            to={appRoutes.rewards(queryString)}
            active={pathname === ROUTE_PATHS.rewards}
          >
            {t("header.rewards")}
          </MobileDrawerLink>
          <MobileDrawerLink
            to={appRoutes.points(queryString)}
            active={pathname === ROUTE_PATHS.points}
          >
            {t("header.points")}
          </MobileDrawerLink>
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
