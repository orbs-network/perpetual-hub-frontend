import { useEffect, useRef } from "react";
import { useAuthSession } from "../hooks/useAuthSession";
import { useShouldLogin } from "@/hooks/useIsSessionExpired";
import { useAppQueryParams } from "@/hooks/useAppQueryParams";
import { useAuthStore } from "@/stores/authStore";
import type { Hex } from "viem";
import { useCurrentPartnerChainKey } from "@/hooks/useCurrentPartnerChain";

export function AuthGuard() {
  const { clearAuth } = useAuthSession();
  const { sharedSession, setQuery } = useAppQueryParams();
  const partnerChainKey = useCurrentPartnerChainKey();
  const setAuth = useAuthStore((s) => s.setAuth);
  const injectedRef = useRef(false);

  const shouldLogin = useShouldLogin();

  // Inject shared session from URL params (once)
  useEffect(() => {
    if (!sharedSession || injectedRef.current) return;
    injectedRef.current = true;
    setAuth({
      address: sharedSession.address,
      partnerChainKey,
      sessionKey: sharedSession.sessionKey as Hex,
      sessionPublicKey: sharedSession.sessionPublicKey as Hex,
      sessionExpiresAt: sharedSession.sessionExpiresAt,
      loginSignature: sharedSession.loginSignature,
      loginTimestamp: sharedSession.loginTimestamp,
      persistence: "session",
    });
    setQuery({ s: undefined, v: sharedSession.address }, "replaceIn");
  }, [partnerChainKey, sharedSession, setAuth, setQuery]);

  useEffect(() => {
    if (shouldLogin && !sharedSession) {
      clearAuth();
    }
  }, [shouldLogin, clearAuth, sharedSession]);

  return null;
}
