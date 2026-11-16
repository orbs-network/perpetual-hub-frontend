import { useLocation } from "react-router-dom";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { ROUTE_PATHS } from "@/routes";
import { HeaderNavLink } from "./HeaderNavLink";

type HeaderDesktopNavigationProps = {
  tradePath: string;
};

export function HeaderDesktopNavigation({
  tradePath,
}: HeaderDesktopNavigationProps) {
  const { t } = useTranslation();
  const pathname = useLocation().pathname;
  return (
    <>
      <HeaderNavLink
        to={tradePath}
        active={pathname.startsWith(ROUTE_PATHS.trade)}
      >
        {t("header.trade")}
      </HeaderNavLink>
      <HeaderNavLink
        to={ROUTE_PATHS.portfolio}
        active={pathname === ROUTE_PATHS.portfolio}
      >
        {t("header.portfolio")}
      </HeaderNavLink>
      <HeaderNavLink
        to={ROUTE_PATHS.rewards}
        active={pathname === ROUTE_PATHS.rewards}
      >
        {t("header.rewards")}
      </HeaderNavLink>
      <HeaderNavLink
        to={ROUTE_PATHS.points}
        active={pathname === ROUTE_PATHS.points}
      >
        {t("header.points")}
      </HeaderNavLink>
    </>
  );
}
