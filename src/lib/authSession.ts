export const SESSION_CONNECTED_DURATION_MS = 24 * 60 * 60 * 1000;
export const MAX_SESSION_DURATION_MS = 14 * SESSION_CONNECTED_DURATION_MS;
export const STAY_CONNECTED_DURATION_MS = 7 * SESSION_CONNECTED_DURATION_MS;
export const DEFAULT_STAY_CONNECTED = true;
export type SessionPersistence = "local" | "session";

export function shouldPersistTradingSession(stayConnected?: boolean): boolean {
  return stayConnected ?? DEFAULT_STAY_CONNECTED;
}

export function getSessionPersistence(
  stayConnected?: boolean,
): SessionPersistence {
  return shouldPersistTradingSession(stayConnected) ? "local" : "session";
}

export function getSessionExpiresAt(
  timestampMs: number,
  stayConnected?: boolean,
): number {
  const duration = shouldPersistTradingSession(stayConnected)
    ? STAY_CONNECTED_DURATION_MS
    : SESSION_CONNECTED_DURATION_MS;
  return timestampMs + Math.min(duration, MAX_SESSION_DURATION_MS);
}
