import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WS_URL } from "../config/constants";
import { useAuthSession } from "./useAuthSession";
import { useWSStore } from "../stores/wsStore";
import { usePageVisible } from "./usePageVisible";
import type { WSFillEvent } from "../types";
import { useUserAccount } from "./useUserAccount";
import { useActiveAddress } from "./useActiveAddress";
import { signWebSocketAuth } from "@/utils/signing";
import { useOrderOperationsStore } from "@/stores/orderOperationsStore";
import { useLatestRef } from "./useLatestRef";
import { useDeferredAccountRefresh } from "./websocket/useDeferredAccountRefresh";
import { useFillToastQueue } from "./websocket/useFillToastQueue";
import { useSupportedChainId } from "./useSupportedChainId";
import { useCurrentPartnerChainIdentity } from "./useCurrentPartnerChain";

const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_DELAY = 30000;

export function useWebSocket() {
  const isVisible = usePageVisible();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isManualDisconnectRef = useRef(false);
  const connectionIdRef = useRef(0);
  const connectedKeyRef = useRef<string | null>(null);
  const connectRef = useRef<() => void>(() => {});
  const cleanupConnectionRef = useRef<() => void>(() => {});

  const address = useActiveAddress();
  const authSession = useAuthSession();
  const isAuthenticated = authSession.isAuthenticated;
  const sessionKey = authSession.sessionKey;
  const chainId = useSupportedChainId();
  const partnerChain = useCurrentPartnerChainIdentity();

  const queryClient = useQueryClient();
  const { refetch: refetchUserAccount } = useUserAccount();
  const isReplacementPending = useOrderOperationsStore(
    (state) => state.pendingOrderReplacementCount > 0,
  );
  const { setStatus, setError, setLastMessage } = useWSStore();
  const { queueFillToast } = useFillToastQueue({ isReplacementPending });
  const { requestAccountRefresh, refreshAccountAndHistory } =
    useDeferredAccountRefresh({
      hasAddress: !!address,
      queryClient,
      refetchUserAccount,
    });

  const addressRef = useLatestRef(address);
  const chainIdRef = useLatestRef(chainId);
  const isAuthenticatedRef = useLatestRef(isAuthenticated);
  const sessionKeyRef = useLatestRef(sessionKey);
  const setStatusRef = useLatestRef(setStatus);
  const setErrorRef = useLatestRef(setError);
  const setLastMessageRef = useLatestRef(setLastMessage);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const closeSocket = useCallback((socket: WebSocket | null) => {
    if (!socket) {
      return;
    }

    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    socket.close();
  }, []);

  const connect = useCallback(() => {
    const currentAddress = addressRef.current;
    const currentChainId = chainIdRef.current;
    const currentSessionKey = sessionKeyRef.current;
    if (
      !isAuthenticatedRef.current ||
      !currentAddress ||
      !currentSessionKey ||
      !currentChainId
    ) {
      return;
    }

    if (isManualDisconnectRef.current) {
      return;
    }

    const connectionId = ++connectionIdRef.current;
    clearReconnectTimeout();
    closeSocket(wsRef.current);
    wsRef.current = null;

    setStatusRef.current("connecting");

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = async () => {
        if (connectionId !== connectionIdRef.current || wsRef.current !== ws) {
          return;
        }
        setStatusRef.current("connected");
        setErrorRef.current(null);
        reconnectAttemptsRef.current = 0;

        try {
          const timestamp = Date.now();
          const signature = await signWebSocketAuth({
            sessionKey: currentSessionKey,
            chainId: currentChainId,
            user: currentAddress,
            timestamp: BigInt(timestamp),
          });
          if (connectionId !== connectionIdRef.current || wsRef.current !== ws) {
            return;
          }
          ws.send(
            JSON.stringify({
              type: "SUBSCRIBE",
              channels: ["orders", "positions", "fills"],
              partnerId: partnerChain.partnerId,
              chainId: String(partnerChain.chainId),
              partnerChainKey: partnerChain.partnerChainKey,
              user: currentAddress,
              timestamp,
              signature,
            }),
          );
        } catch {
          setErrorRef.current("WebSocket authentication failed");
          closeSocket(ws);
        }
      };

      ws.onmessage = (event) => {
        if (connectionId !== connectionIdRef.current || wsRef.current !== ws) {
          return;
        }
        try {
          const message = JSON.parse(event.data);
          setLastMessageRef.current(message);

          try {
            switch (message.type) {
              case "ORDER_UPDATE": {
                refreshAccountAndHistory(false);
                break;
              }
              case "POSITION_UPDATE": {
                requestAccountRefresh({
                  includeOrderHistory: false,
                  includeTrades: false,
                });
                break;
              }
              case "FILL": {
                const { data } = message as WSFillEvent;

                queueFillToast(data);
                refreshAccountAndHistory(true);
                break;
              }
            }
          } catch (handlerErr) {
            console.error("Error handling WebSocket message:", handlerErr);
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.onerror = () => {
        if (
          isManualDisconnectRef.current ||
          connectionId !== connectionIdRef.current ||
          wsRef.current !== ws
        ) {
          return;
        }
        setErrorRef.current("WebSocket connection error");
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        if (connectionId !== connectionIdRef.current) {
          return;
        }
        setStatusRef.current("disconnected");

        // Attempt to reconnect with exponential backoff
        if (!isManualDisconnectRef.current && isAuthenticatedRef.current) {
          const attempt = reconnectAttemptsRef.current;
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(
            RECONNECT_DELAY * Math.pow(2, attempt),
            MAX_RECONNECT_DELAY,
          );
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connectRef.current();
          }, delay);
        }
      };
    } catch {
      setStatusRef.current("disconnected");
      setErrorRef.current("Failed to connect");
      // Constructor threw — schedule reconnect since onclose won't fire
      if (!isManualDisconnectRef.current && isAuthenticatedRef.current) {
        const attempt = reconnectAttemptsRef.current;
        reconnectAttemptsRef.current += 1;
        const delay = Math.min(
          RECONNECT_DELAY * Math.pow(2, attempt),
          MAX_RECONNECT_DELAY,
        );
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connectRef.current();
        }, delay);
      }
    }
  }, [
    clearReconnectTimeout,
    closeSocket,
    partnerChain,
    queueFillToast,
    refreshAccountAndHistory,
    requestAccountRefresh,
    addressRef,
    chainIdRef,
    isAuthenticatedRef,
    sessionKeyRef,
    setErrorRef,
    setLastMessageRef,
    setStatusRef,
  ]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const closeConnection = useCallback(
    (manual: boolean) => {
      isManualDisconnectRef.current = manual;
      connectionIdRef.current += 1;
      connectedKeyRef.current = null;
      clearReconnectTimeout();

      closeSocket(wsRef.current);
      wsRef.current = null;

      setStatusRef.current("disconnected");
    },
    [clearReconnectTimeout, closeSocket, setStatusRef],
  );

  const cleanupConnection = useCallback(() => {
    closeConnection(false);
  }, [closeConnection]);

  useEffect(() => {
    cleanupConnectionRef.current = cleanupConnection;
  }, [cleanupConnection]);

  // Auto-connect when the actual feed input changes. Disconnect when tab is hidden.
  useEffect(() => {
    if (
      !isAuthenticated ||
      !address ||
      !chainId ||
      !sessionKey ||
      !isVisible
    ) {
      if (connectedKeyRef.current !== null || wsRef.current !== null) {
        cleanupConnection();
      }
      return;
    }

    if (isManualDisconnectRef.current) {
      return;
    }

    isManualDisconnectRef.current = false;
    connectedKeyRef.current = `${partnerChain.partnerChainKey}:${address}:${chainId}`;
    connect();
  }, [
    isAuthenticated,
    address,
    chainId,
    sessionKey,
    isVisible,
    partnerChain.partnerChainKey,
    cleanupConnection,
    connect,
  ]);

  useEffect(() => {
    return () => {
      cleanupConnectionRef.current();
    };
  }, []);
}
