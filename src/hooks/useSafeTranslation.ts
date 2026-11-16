import { useMemo } from "react";
import {
  useTranslation as useReactTranslation,
} from "react-i18next";

type TranslationResult = ReturnType<typeof useReactTranslation>;
type TranslationFunction = TranslationResult["t"];
type UnsafeTranslate = (...args: unknown[]) => unknown;

function fallbackKeyFromArgs(key: unknown, args: unknown[]) {
  if (typeof key === "string") return key;
  if (typeof key === "number" || typeof key === "boolean") return String(key);
  if (Array.isArray(key)) {
    const fallbackKey = key.find((item) => typeof item === "string" && item);
    if (fallbackKey) return fallbackKey;
    const lastKey = key[key.length - 1];
    return lastKey === undefined || lastKey === null ? "" : String(lastKey);
  }

  const defaultValue = args.find((arg) => typeof arg === "string" && arg);
  return defaultValue ? String(defaultValue) : "";
}

export function safeTranslate(
  translate: unknown,
  fallbackTranslate?: unknown,
): TranslationFunction {
  return ((key: unknown, ...args: unknown[]) => {
    const fallbackKey = fallbackKeyFromArgs(key, args);
    const activeTranslate =
      typeof translate === "function" ? translate : fallbackTranslate;

    if (typeof activeTranslate !== "function") return fallbackKey;

    try {
      const translated = (activeTranslate as UnsafeTranslate)(key, ...args);
      if (translated === undefined || translated === null) return fallbackKey;
      return typeof translated === "string" ? translated : String(translated);
    } catch {
      return fallbackKey;
    }
  }) as unknown as TranslationFunction;
}

export function useTranslation(): TranslationResult {
  const translation = useReactTranslation();
  const safeT = useMemo(
    () => safeTranslate(translation.t),
    [translation.t],
  );

  return useMemo(() => {
    const safeTranslation = [
      safeT,
      translation.i18n,
      translation.ready,
    ] as TranslationResult;
    safeTranslation.t = safeT;
    safeTranslation.i18n = translation.i18n;
    safeTranslation.ready = translation.ready;
    return safeTranslation;
  }, [safeT, translation.i18n, translation.ready]);
}
