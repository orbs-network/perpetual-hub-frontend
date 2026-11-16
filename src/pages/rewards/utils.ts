import { normalizeReferralCode } from "@/api/referrals";
import { appRoutes } from "@/routes";
import {
  REFERRAL_CODE_RE,
  TRADING_NOT_ENABLED_MESSAGE,
} from "./constants";

export function isValidReferralCode(code: string) {
  return REFERRAL_CODE_RE.test(normalizeReferralCode(code));
}

export function isTradingNotEnabledError(message: string) {
  return (
    message.trim().toLowerCase() ===
    TRADING_NOT_ENABLED_MESSAGE.toLowerCase()
  );
}

export function formatReferralDateTime(timestamp?: number) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildReferralShareUrl(code: string) {
  if (typeof window === "undefined") return code;
  const url = new URL(appRoutes.trade(), window.location.origin);
  url.searchParams.set("ref", code);
  return url.toString();
}

export async function copyText(value: string) {
  if (!navigator.clipboard) throw new Error("Clipboard unavailable");
  await navigator.clipboard.writeText(value);
}
