import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { normalizeReferralCode } from "@/api/referrals";

export function useInitialReferralCode() {
  const location = useLocation();
  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    return normalizeReferralCode(params.get("ref") ?? "");
  }, [location.search]);
}
