import { useCallback, useMemo } from "react";
import { getAuthSessionKey, useAuthStore } from "../stores/authStore";
import { useActiveAddress } from "./useActiveAddress";
import { useCurrentPartnerChainKey } from "./useCurrentPartnerChain";
import { useAppQueryParams } from "./useAppQueryParams";

export function useAuthSession() {
  const activeAddress = useActiveAddress();
  const partnerChainKey = useCurrentPartnerChainKey();
  const sessions = useAuthStore((s) => s.sessions);
  const _clearAuth = useAuthStore((s) => s.clearAuth);
  const { query } = useAppQueryParams();
  const needsFreshLogin = Boolean(query?.walletReset);

  const session = useMemo(() => {
    if (!activeAddress || needsFreshLogin) return null;
    return sessions[getAuthSessionKey(activeAddress, partnerChainKey)] ?? null;
  }, [activeAddress, partnerChainKey, sessions, needsFreshLogin]);

  const clearAuth = useCallback(() => {
    if (!activeAddress) return;
    _clearAuth(activeAddress, partnerChainKey);
  }, [activeAddress, _clearAuth, partnerChainKey]);

  return {
    sessionKey: session?.sessionKey ?? null,
    sessionPublicKey: session?.sessionPublicKey ?? null,
    sessionExpiresAt: session?.sessionExpiresAt ?? null,
    loginSignature: session?.loginSignature ?? null,
    loginTimestamp: session?.loginTimestamp ?? null,
    clearAuth,
    isAuthenticated: session !== null,
  };
}
