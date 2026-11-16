import { Check, Globe2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { normalizeLanguage, SUPPORTED_LANGUAGES } from "@/i18n";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";

export function LanguagePopover() {
  const [isOpen, setIsOpen] = useState(false);
  const { i18n, t } = useTranslation();
  const currentLanguage = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("language.selectorLabel")}
          className="h-full w-8 rounded border border-edge text-content-secondary hover:text-content"
        >
          <Globe2 size={14} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 bg-base p-1.5 border-edge" align="end">
        <div className="px-2 pb-1.5 pt-1 text-[11px] font-medium text-content-muted">
          {t("language.title")}
        </div>
        <div className="space-y-0.5">
          {SUPPORTED_LANGUAGES.map((language) => {
            const isSelected = currentLanguage === language.code;
            return (
              <button
                key={language.code}
                type="button"
                aria-current={isSelected ? "true" : undefined}
                onClick={() => {
                  void i18n.changeLanguage(language.code);
                  setIsOpen(false);
                }}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[12px] text-content-secondary transition-colors hover:bg-hover hover:text-content"
              >
                <span>{language.nativeName}</span>
                <span className="flex items-center gap-1 text-[10px] text-content-muted">
                  <span aria-hidden="true">{language.shortName}</span>
                  {isSelected && (
                    <Check
                      aria-label={t("language.current")}
                      size={12}
                      className="text-accent-primary"
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
