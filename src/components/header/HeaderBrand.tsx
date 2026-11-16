import { Link } from "react-router-dom";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { partner } from "@/config/partners";
import { useAppQueryParams } from "@/hooks/useAppQueryParams";
import { useIsMobile } from "@/hooks/useIsMobile";
import { withRouteSearch } from "@/routes";

type HeaderBrandProps = {
  tradePath: string;
};

export function HeaderBrand({
  tradePath,
}: HeaderBrandProps) {
  const { t } = useTranslation();
  const { queryString } = useAppQueryParams();
  const isMobile = useIsMobile();
  return (
    <Link
      to={withRouteSearch(tradePath, queryString)}
      aria-label={t("header.goToTradingPage")}
      className={`header-brand flex min-w-0 items-center gap-2 ${isMobile ? "mr-2" : "mr-4"}`}
    >
      {partner.logoUrl && (
        <img
          src={partner.wordmarkUrl ?? partner.logoUrl}
          alt={partner.name}
          className={partner.wordmarkUrl ? "h-6 w-auto max-w-[112px] object-contain" : "h-6 w-6 rounded-[4px]"}
        />
      )}
      {!isMobile && !partner.wordmarkUrl && (
        <span className="truncate text-sm font-bold text-logo-color">
          {partner.name}
        </span>
      )}
    </Link>
  );
}
