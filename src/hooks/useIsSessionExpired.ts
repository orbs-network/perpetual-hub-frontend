import { useAuthStore } from "@/stores/authStore";
import type { Session } from "@/stores/authStore";
import { useQuery } from "@tanstack/react-query";
import { useActiveAddress } from "./useActiveAddress";
import { useCurrentPartnerChainKey } from "./useCurrentPartnerChain";

export function shouldLoginForSession(
  address?: string,
  session?: Pick<Session, "sessionPublicKey" | "sessionExpiresAt"> | null,
  now = Date.now(),
) {
  if (!address) return false;
  if (!session?.sessionPublicKey) return true;
  return session.sessionExpiresAt <= now;
}

export function useShouldLogin() {
  const activeAddress = useActiveAddress();
  const address = activeAddress ?? undefined;
  const partnerChainKey = useCurrentPartnerChainKey();
  const session = useAuthStore((s) => s.getSession(address, partnerChainKey));

  return useQuery({
    queryKey: [
      "session-validation",
      address,
      partnerChainKey,
      session?.sessionPublicKey,
      session?.sessionExpiresAt,
    ],
    queryFn: (): boolean => {
      return shouldLoginForSession(address, session);
    },
    initialData: () => shouldLoginForSession(address, session),
    refetchInterval: 1_000,
  }).data;
}
