import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useIsMobile } from "../hooks/useIsMobile";
import { appRoutes, tradeSymbolForPath } from "@/routes";
import { HeaderActions } from "./header/HeaderActions";
import { HeaderBrand } from "./header/HeaderBrand";
import { HeaderDesktopNavigation } from "./header/HeaderDesktopNavigation";
import { HeaderMobileNavigationDrawer } from "./header/HeaderMobileNavigationDrawer";

export function Header() {
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  const symbol = useMemo(() => tradeSymbolForPath(pathname), [pathname]);
  const tradePath = appRoutes.trade(symbol);

  return (
    <header
      className={`flex items-center overflow-hidden bg-surface ${
        isMobile ? "h-[53px] px-3" : "h-12 px-4"
      }`}
    >
      <div className="flex min-w-0 shrink items-center gap-1">
        <HeaderBrand tradePath={tradePath} />
        {isMobile ? (
          <HeaderMobileNavigationDrawer tradePath={tradePath} />
        ) : (
          <HeaderDesktopNavigation tradePath={tradePath} />
        )}
      </div>
      <div className="min-w-0 flex-1" />
      <HeaderActions />
    </header>
  );
}
