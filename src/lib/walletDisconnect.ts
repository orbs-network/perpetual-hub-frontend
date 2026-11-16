import { disconnect, watchAccount, type Config } from "@wagmi/core";

const STORAGE_KEY = "wallet-disconnect";
const DISCONNECT_TIMEOUT_MS = 3_000;
let connectionVersion = 0;
const pending = new WeakMap<Config, Promise<boolean>>();
const resetRequired = new WeakSet<Config>();
type DisconnectState = "disconnected" | "reset" | "connected" | `connected:${string}`;
let memoryState: DisconnectState | undefined;
let resetNoticeConsumed = false;

function readDisconnectState(): DisconnectState | undefined {
  if (memoryState) return memoryState;
  for (const storage of ["sessionStorage", "localStorage"] as const) {
    try {
      const value = window[storage].getItem(STORAGE_KEY);
      if (value === "disconnected" || value === "reset" || value === "connected") return value;
      if (value?.startsWith("connected:")) return value as `connected:${string}`;
    } catch { /* Browser storage may be blocked. */ }
  }
}

function writeDisconnectState(value: DisconnectState): boolean {
  memoryState = value;
  if (value === "reset") resetNoticeConsumed = false;
  let durable = false;
  // The tab copy can supersede a durable value when localStorage is read-only.
  for (const storage of ["localStorage", "sessionStorage"] as const) {
    try {
      window[storage].setItem(STORAGE_KEY, value);
      if (storage === "localStorage") durable = true;
    } catch { /* Keep the in-memory fallback. */ }
  }
  return durable;
}

export function getWalletConnectionVersion(): number {
  return connectionVersion;
}

export function isWalletDisconnectPending(config: Config): boolean {
  return pending.has(config);
}

export function shouldReconnectWallet(): boolean {
  const state = readDisconnectState();
  const reset = new URL(window.location.href).searchParams.get("walletReset");
  if (reset) return state === `connected:${reset}`;
  if (state === "connected" || state?.startsWith("connected:")) return true;
  if (state) return false;
  return true;
}

export function allowWalletConnection(): void {
  const reset = new URL(window.location.href).searchParams.get("walletReset");
  writeDisconnectState(reset ? `connected:${reset}` : "connected");
}

// All UI entry points use Wagmi's explicit connect action ("connecting").
// Auto-restoration uses "reconnecting" and must never release this guard.
export function watchExplicitWalletConnections(config: Config): () => void {
  let attempt: { version: number; previous: string | null } | undefined;
  return config.subscribe((state) => state.status, (status) => {
    if (status === "connecting") {
      attempt = isWalletDisconnectPending(config) || resetRequired.has(config)
        ? undefined : { version: connectionVersion, previous: config.state.current };
      return;
    }
    if (status === "connected" && attempt &&
      attempt.version === connectionVersion &&
      config.state.current !== attempt.previous &&
      !isWalletDisconnectPending(config) && !resetRequired.has(config)) {
      allowWalletConnection();
    }
    attempt = undefined;
  });
}

// A wallet account switch ends this UI connection instead of silently adopting
// another account's saved trading session. Initial connect and chain changes
// do not log out; explicit disconnect already runs the same cleanup.
export function watchWalletAccountChanges(
  config: Config,
  logout: () => Promise<void>,
): () => void {
  return watchAccount(config, {
    onChange(account, previous) {
      if (isWalletDisconnectPending(config)) return;
      // Injected connectors can reconnect from a later wallet event. Keep the
      // logged-out UI disconnected until Wagmi's explicit connect action runs.
      if (account.isConnected && !previous.isConnected &&
        previous.status !== "connecting" && !shouldReconnectWallet()) {
        void logout();
        return;
      }
      if (!previous.isConnected || !previous.address) return;
      const changed = account.address &&
        account.address.toLowerCase() !== previous.address.toLowerCase();
      if (changed || account.isDisconnected) void logout();
    },
  });
}

export function consumeWalletResetNotice(): boolean {
  if (resetNoticeConsumed) return false;
  const hasResetUrl = new URL(window.location.href).searchParams.has("walletReset");
  if (readDisconnectState() !== "reset" && !(hasResetUrl && !shouldReconnectWallet())) return false;
  resetNoticeConsumed = true;
  return true;
}

// False means the caller must reload before permitting another connection.
// A timed-out disconnect cannot be cancelled and could otherwise clear a NEW
// connection when the old provider eventually responds.
export function disconnectAllWallets(config: Config): Promise<boolean> {
  const existing = pending.get(config);
  if (existing) return existing;
  connectionVersion++;
  const protectionPersisted = writeDisconnectState("disconnected");
  const connectionInFlight =
    config.state.status === "connecting" || config.state.status === "reconnecting";

  const operation = (async () => {
    let expired = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempts = async () => {
      let succeeded = true;
      // Wagmi disconnects only one connector and falls back to the next one.
      // Serialize mutations of its shared connection map.
      for (const { connector } of [...config.state.connections.values()]) {
        if (expired) return false;
        try {
          await disconnect(config, { connector });
        } catch {
          succeeded = false;
        }
      }
      return protectionPersisted && !connectionInFlight && succeeded && config.state.connections.size === 0;
    };
    try {
      const disconnected = await Promise.race([
        attempts(),
        new Promise<false>((resolve) => {
          timer = setTimeout(() => {
            expired = true;
            resolve(false);
          }, DISCONNECT_TIMEOUT_MS);
        }),
      ]);
      if (!disconnected) {
        resetRequired.add(config);
        writeDisconnectState("reset");
      }
      return disconnected;
    } finally {
      clearTimeout(timer);
    }
  })();
  pending.set(config, operation);
  void operation.finally(() => pending.delete(config)).catch(() => {});
  return operation;
}

export function getWalletResetUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete("s");
  url.searchParams.delete("v");
  // Bind later explicit connections to THIS reset, so a read-only old
  // "connected" preference cannot override the reload protection.
  url.searchParams.set("walletReset", window.crypto.randomUUID());
  return url.toString();
}

export function reloadWithoutWalletSession(): void {
  window.location.replace(getWalletResetUrl());
}
