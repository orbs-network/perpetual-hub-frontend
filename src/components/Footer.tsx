import { useTranslation } from "@/hooks/useSafeTranslation";
import { getThemeColorScheme, partner } from "@/config/partners";
import { useAppliedThemeColors } from "@/hooks/useAppliedThemeColors";

function Footer() {
  const { t } = useTranslation();
  const theme = useAppliedThemeColors();
  return (
    <footer className="hidden md:flex items-center justify-between bg-base text-[12px] text-content flex-shrink-0 mt-auto pt-8 w-full">
      <div className="flex items-center justify-between w-full border-t border-edge px-4 py-1.5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-up" />
            <span className="text-content">{t("Online")}</span>
          </div>
          <a
            href="https://www.orbs.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-content transition-colors"
          >
            <span>{t("Powered by")}</span>
            <img
              src="/orbs-white-logo.svg"
              alt="Orbs"
              className={getThemeColorScheme(theme) === "light" ? "h-4 w-auto brightness-0" : "h-4 w-auto"}
            />
          </a>
        </div>
        <nav className="flex items-center gap-4">
          <a
            href={partner.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-content transition-colors"
          >
            {t("Docs")}
          </a>
          <a
            href={partner.supportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-content transition-colors"
          >
            {t("Support")}
          </a>
          <a
            href={partner.policyUrls.termsOfUse}
            className="hover:text-content transition-colors"
          >
            {t("Terms")}
          </a>
          <a
            href={partner.policyUrls.privacyPolicy}
            className="hover:text-content transition-colors"
          >
            {t("Privacy Policy")}
          </a>
        </nav>
      </div>
    </footer>
  );
}

export default Footer;
