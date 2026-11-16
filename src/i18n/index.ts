import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import ja from "./locales/ja.json";
import zh from "./locales/zh.json";

export const LANGUAGE_STORAGE_KEY = "perpetual-hub-language";
export const DEFAULT_LANGUAGE = "en";

export const SUPPORTED_LANGUAGES = [
  { code: "en", nativeName: "English", shortName: "EN" },
  { code: "fr", nativeName: "Français", shortName: "FR" },
  { code: "zh", nativeName: "简体中文", shortName: "中文" },
  { code: "ja", nativeName: "日本語", shortName: "日本" },
  { code: "es", nativeName: "Español", shortName: "ES" },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]["code"];

const supportedLanguageCodes = SUPPORTED_LANGUAGES.map(({ code }) => code);

const resources: Record<SupportedLanguage, { translation: typeof en }> = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  ja: { translation: ja },
  zh: { translation: zh },
};

export function normalizeLanguage(value?: string | null): SupportedLanguage {
  const normalized = value?.toLowerCase().replace("_", "-");
  const baseLanguage = normalized?.split("-")[0];
  return supportedLanguageCodes.includes(baseLanguage as SupportedLanguage)
    ? (baseLanguage as SupportedLanguage)
    : DEFAULT_LANGUAGE;
}

function detectInitialLanguage(): SupportedLanguage {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;

  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (storedLanguage) return normalizeLanguage(storedLanguage);

  const browserLanguages =
    window.navigator.languages.length > 0
      ? window.navigator.languages
      : [window.navigator.language];
  for (const language of browserLanguages) {
    const normalizedLanguage = language.toLowerCase().replace("_", "-").split("-")[0];
    if (supportedLanguageCodes.includes(normalizedLanguage as SupportedLanguage)) {
      return normalizedLanguage as SupportedLanguage;
    }
  }

  return DEFAULT_LANGUAGE;
}

function persistLanguage(language: string) {
  const normalizedLanguage = normalizeLanguage(language);
  if (typeof document !== "undefined") {
    document.documentElement.lang = normalizedLanguage;
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizedLanguage);
  }
}

i18n.use(initReactI18next).init({
  resources,
  lng: detectInitialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: supportedLanguageCodes,
  interpolation: {
    escapeValue: false,
  },
  ignoreJSONStructure: true,
  returnNull: false,
});

persistLanguage(i18n.language);
i18n.on("languageChanged", persistLanguage);

export default i18n;
