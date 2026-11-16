import { useCallback, useRef, useState } from "react";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { useAccount, useConfig, useConnect } from "wagmi";
import { useAuthStore } from "../stores/authStore";
import { useAuthSession } from "./useAuthSession";
import { signLogin } from "../utils/signing";
import { login as apiLogin } from "../api/auth";
import { useMutation } from "@tanstack/react-query";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { toast } from "sonner";
import { isMobile } from "@/config/wagmi";
import { useAppQueryParams } from "./useAppQueryParams";
import { useTranslation } from "@/hooks/useSafeTranslation";
import {
  DEFAULT_STAY_CONNECTED,
  getSessionExpiresAt,
  getSessionPersistence,
} from "@/lib/authSession";
import { useSupportedChainId } from "./useSupportedChainId";
import { useShouldSwitchToSupportedChain } from "./useSwitchToSupportedChain";
import { useCurrentPartnerChainIdentity } from "./useCurrentPartnerChain";
import {
  disconnectAllWallets,
  getWalletConnectionVersion,
  isWalletDisconnectPending,
  reloadWithoutWalletSession,
} from "@/lib/walletDisconnect";

export function useAuth() {
  const { t } = useTranslation();
  const config = useConfig();
  const {
    address,
    isConnected,
    isConnecting,
  } = useAccount();
  const chainId = useSupportedChainId();
  const partnerChain = useCurrentPartnerChainIdentity();
  const shouldSwitchChain = useShouldSwitchToSupportedChain();
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const disconnectingRef = useRef(false);
  const { openConnectModal } = useConnectModal();
  const { connectors, connect: wagmiConnect } = useConnect();

  const { setAuth, clearAuth } = useAuthStore();
  const { sessionKey, sessionPublicKey, sessionExpiresAt, isAuthenticated } =
    useAuthSession();
  const { sharedSession, viewerAddress, setQuery } = useAppQueryParams();
  const hasSharedSession =
    !!sharedSession || (!address && !!viewerAddress && !!sessionKey);

  const connect = useCallback(() => {
    if (disconnectingRef.current || isWalletDisconnectPending(config)) return;
    if (isMobile) {
      const wcConnector = connectors.find((c) => c.id === "walletConnect");
      if (wcConnector) {
        wagmiConnect({ connector: wcConnector });
        return;
      }
    }
    openConnectModal?.();
  }, [config, connectors, wagmiConnect, openConnectModal]);

  const { mutateAsync: loginMutation, isPending: isLoggingIn } = useMutation({
    mutationFn: async ({
      stayConnected = DEFAULT_STAY_CONNECTED,
      onSuccess,
    }: { stayConnected?: boolean, onSuccess?: () => void } = {}) => {
      if (disconnectingRef.current || isWalletDisconnectPending(config)) return;
      const connectionVersion = getWalletConnectionVersion();
      if (!address || !isConnected) {
        connect();
        return;
      }
      if (shouldSwitchChain) {
        throw new Error(t("Switch to supported chain first"));
      }
      if (!chainId) {
        throw new Error(t("Wallet chain is still loading"));
      }

      const nextSessionKey = generatePrivateKey();
      const sessionAccount = privateKeyToAccount(nextSessionKey);
      const timestamp = BigInt(Date.now());
      const sessionExpiresAtForMode = getSessionExpiresAt(
        Number(timestamp),
        stayConnected,
      );
      const sessionExpiresAt = BigInt(sessionExpiresAtForMode);
      const sessionPersistence = getSessionPersistence(stayConnected);


      const signature = await signLogin({
        config,
        chainId,
        user: address,
        sessionPublicKey: sessionAccount.publicKey,
        sessionExpiresAt,
        timestamp,
      });
      if (connectionVersion !== getWalletConnectionVersion()) return;

      // Register session key with backend/TEE so it can verify future signatures
      await apiLogin({
        address,
        partnerId: partnerChain.partnerId,
        chainId: String(partnerChain.chainId),
        partnerChainKey: partnerChain.partnerChainKey,
        sessionPublicKey: sessionAccount.publicKey,
        sessionExpiresAt: sessionExpiresAtForMode,
        timestamp: Number(timestamp),
        signature,
      });
      if (connectionVersion !== getWalletConnectionVersion()) return;

      // stayConnected persists in localStorage for 7 days. Otherwise, use sessionStorage for 24 hours.
      setAuth({
        address,
        partnerChainKey: partnerChain.partnerChainKey,
        sessionKey: nextSessionKey,
        sessionPublicKey: sessionAccount.publicKey,
        sessionExpiresAt: sessionExpiresAtForMode,
        loginSignature: signature,
        loginTimestamp: Number(timestamp),
        persistence: sessionPersistence,
      });
      setQuery({ walletReset: undefined }, "replaceIn");

      toast.success(t("Established connection"));
      onSuccess?.();
    },
    onError: (error) => {
      const sessionCooldown = error.message.match(
        /RATE_LIMITED: session registration is limited to one successful update per wallet every 1m0s; retry after (\d+)ms/,
      );
      if (sessionCooldown) {
        const retryAfterMs = Number(sessionCooldown[1]);
        if (Number.isSafeInteger(retryAfterMs)) {
          toast.error(t("Please wait before enabling trading again"), {
            closeButton: true,
            description: t(
              "This wallet can only update trading access once per minute. Please wait {{count}} seconds, then try again.",
              { count: Math.max(1, Math.ceil(retryAfterMs / 1000)) },
            ),
            duration: 10000,
          });
          return;
        }
      }
      toast.error(t("Login failed"));
    },
  });

  const logout = useCallback(async () => {
    if (disconnectingRef.current) return;
    disconnectingRef.current = true;
    setIsDisconnecting(true);
    try {
      // Invalidate pending login completions before clearing trading access.
      const completion = disconnectAllWallets(config);
      let cleanupFailed = false;
      try {
        clearAuth(undefined, partnerChain.partnerChainKey);
      } catch {
        // Zustand updates memory before persistence; a storage exception must
        // not interrupt the wallet disconnect or its reload recovery.
        cleanupFailed = true;
      }
      setQuery({ s: undefined, v: undefined }, "replaceIn");
      if (!(await completion) || cleanupFailed) {
        reloadWithoutWalletSession();
        return;
      }
      disconnectingRef.current = false;
      setIsDisconnecting(false);
    } catch {
      disconnectingRef.current = false;
      setIsDisconnecting(false);
      toast.error(t("Unable to disconnect wallet. Please try again."));
    }
  }, [clearAuth, config, partnerChain.partnerChainKey, setQuery, t]);

  return {
    isConnected: isConnected || hasSharedSession,
    isConnecting,
    isDisconnecting,
    isAuthenticated: isAuthenticated || hasSharedSession,
    sessionKey,
    sessionPublicKey,
    sessionExpiresAt,
    login: loginMutation,
    logout,
    isLoggingIn,
    connect,
    hasSharedSession,
  };
}
