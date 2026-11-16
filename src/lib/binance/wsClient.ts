// Singleton Binance WebSocket connection manager.
//
// Design goals:
//   - Exactly one WebSocket per stream URL, regardless of how many React
//     components subscribe. Multiple subscribers share the same socket.
//   - Reference-counted subscribers. The socket is closed only when the last
//     subscriber unsubscribes.
//   - Reconnect with exponential backoff, but ONLY while subscribers exist.
//     If the last subscriber leaves while the socket is reconnecting, the
//     reconnect timer is cancelled.
//   - Defensive identity checks in every WebSocket event handler so stale
//     callbacks from a previous connection cannot mutate the current state
//     or spawn extra reconnect cycles. This is what historically caused
//     linear connection growth in the React-effect-scoped raw `new WebSocket`
//     pattern in `useBinancePrices` / `useOrderBook` / `BinanceDatafeed`.
//   - Pure TypeScript, no React dependency. All WS lifecycle lives here.
//     Hooks become thin wrappers that subscribe in an effect and unsubscribe
//     on cleanup.

const RECONNECT_DELAY_BASE_MS = 1000;
const RECONNECT_DELAY_MAX_MS = 30000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
const OPEN_READY_STATE = 1;

function getDefaultWebSocket(): typeof WebSocket | undefined {
  return typeof WebSocket === "undefined" ? undefined : WebSocket;
}

export interface BinanceWsSubscriber {
  /** Parsed JSON message from the stream. */
  onMessage: (data: unknown) => void;
  /** Fires every time the underlying socket transitions to OPEN. */
  onOpen?: () => void;
  /** Fires on socket error events. */
  onError?: (event: Event) => void;
  /** Fires when the socket closes (before reconnect). */
  onClose?: (event: CloseEvent) => void;
}

interface Connection {
  url: string;
  ws: WebSocket | null;
  subscribers: Set<BinanceWsSubscriber>;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectAttempts: number;
}

export interface BinanceWsClientOptions {
  /** Custom WebSocket constructor for tests. */
  webSocketImpl?: typeof WebSocket;
  /** Override max reconnect attempts (default 10). */
  maxReconnectAttempts?: number;
  /** Override base reconnect delay in ms (default 1000). */
  reconnectDelayBaseMs?: number;
  /** Override max reconnect delay in ms (default 30000). */
  reconnectDelayMaxMs?: number;
  /** Diagnostic logger. Defaults to `console.log` / `console.error`. */
  logger?: {
    log: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
}

export class BinanceWsClient {
  private readonly connections = new Map<string, Connection>();
  private readonly WS: typeof WebSocket | undefined;
  private readonly maxReconnectAttempts: number;
  private readonly reconnectDelayBaseMs: number;
  private readonly reconnectDelayMaxMs: number;
  private readonly logger: { log: (...a: unknown[]) => void; error: (...a: unknown[]) => void };

  constructor(opts: BinanceWsClientOptions = {}) {
    this.WS = opts.webSocketImpl ?? getDefaultWebSocket();
    this.maxReconnectAttempts = opts.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS;
    this.reconnectDelayBaseMs = opts.reconnectDelayBaseMs ?? RECONNECT_DELAY_BASE_MS;
    this.reconnectDelayMaxMs = opts.reconnectDelayMaxMs ?? RECONNECT_DELAY_MAX_MS;
    this.logger = opts.logger ?? {
      log: (...args) => console.log(...args),
      error: (...args) => console.error(...args),
    };
  }

  /**
   * Subscribe to a Binance WebSocket stream URL.
   *
   * - The first subscriber for a URL opens the underlying socket.
   * - Subsequent subscribers for the same URL share the existing socket.
   * - The returned function unsubscribes; when the subscriber count for a
   *   URL drops to zero, the socket is closed.
   * - Idempotent: calling the returned unsubscribe more than once is a no-op.
   */
  subscribe(url: string, subscriber: BinanceWsSubscriber): () => void {
    let conn = this.connections.get(url);
    if (!conn) {
      this.getWebSocketImpl();
      conn = {
        url,
        ws: null,
        subscribers: new Set(),
        reconnectTimer: null,
        reconnectAttempts: 0,
      };
      this.connections.set(url, conn);
    }
    conn.subscribers.add(subscriber);

    // If this is the first subscriber, open the socket. Otherwise, if the
    // socket is already OPEN, notify this new subscriber immediately so it
    // doesn't have to wait for a reconnect to receive `onOpen`.
    if (!conn.ws) {
      this.openSocket(conn);
    } else if (conn.ws.readyState === OPEN_READY_STATE) {
      try {
        subscriber.onOpen?.();
      } catch (err) {
        this.logger.error(`[BinanceWS] onOpen handler threw for ${url}:`, err);
      }
    }

    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      this.unsubscribe(url, subscriber);
    };
  }

  /** Diagnostic — number of distinct stream URLs with at least one subscriber. */
  getActiveConnectionCount(): number {
    return this.connections.size;
  }

  /** Diagnostic — subscriber count for a given URL. Zero if URL is not tracked. */
  getSubscriberCount(url: string): number {
    return this.connections.get(url)?.subscribers.size ?? 0;
  }

  /** Diagnostic — current readyState of a URL's socket, or `undefined` if none. */
  getReadyState(url: string): number | undefined {
    return this.connections.get(url)?.ws?.readyState;
  }

  /**
   * Tear down all connections. Intended for tests and full app teardown;
   * production code should rely on per-subscriber unsubscribe instead.
   */
  destroy(): void {
    for (const url of [...this.connections.keys()]) {
      this.closeConnection(url);
    }
  }

  private unsubscribe(url: string, subscriber: BinanceWsSubscriber): void {
    const conn = this.connections.get(url);
    if (!conn) return;
    conn.subscribers.delete(subscriber);
    if (conn.subscribers.size === 0) {
      this.closeConnection(url);
    }
  }

  private openSocket(conn: Connection): void {
    // Defensive: if this Connection object has been removed from the map
    // between the call site and here (e.g. last subscriber left synchronously),
    // do not open a socket.
    if (this.connections.get(conn.url) !== conn) return;
    if (conn.subscribers.size === 0) return;

    const WebSocketImpl = this.getWebSocketImpl();
    const ws = new WebSocketImpl(conn.url);
    conn.ws = ws;

    // Each handler validates that:
    //   1. The map still tracks THIS Connection object for `conn.url`.
    //      If a teardown + recreate happened, the map will hold a different
    //      Connection object and this handler must no-op.
    //   2. The Connection's current `ws` is still THIS WebSocket.
    //      If a reconnect replaced it, this handler is stale.
    // These two checks together prevent linear connection growth from
    // orphaned WebSockets re-triggering reconnect.
    const isStale = () =>
      this.connections.get(conn.url) !== conn || conn.ws !== ws;

    ws.onopen = () => {
      if (isStale()) return;
      conn.reconnectAttempts = 0;
      this.fanOut(conn, (sub) => sub.onOpen?.(), 'onOpen');
    };

    ws.onmessage = (event) => {
      if (isStale()) return;
      let data: unknown;
      try {
        data = JSON.parse(event.data);
      } catch (err) {
        this.logger.error(`[BinanceWS] parse error for ${conn.url}:`, err);
        return;
      }
      this.fanOut(conn, (sub) => sub.onMessage(data), 'onMessage');
    };

    ws.onerror = (event) => {
      if (isStale()) return;
      this.fanOut(conn, (sub) => sub.onError?.(event), 'onError');
    };

    ws.onclose = (event) => {
      // Note: we deliberately DO NOT bail on isStale() here for the bookkeeping
      // step — we still want to clear `conn.ws` if it points at this socket.
      // But we DO bail before scheduling a reconnect.
      if (conn.ws === ws) conn.ws = null;
      if (this.connections.get(conn.url) !== conn) return;
      this.fanOut(conn, (sub) => sub.onClose?.(event), 'onClose');
      if (conn.subscribers.size === 0) return;
      this.scheduleReconnect(conn);
    };
  }

  private getWebSocketImpl(): typeof WebSocket {
    if (!this.WS) {
      throw new Error("WebSocket is not available. Pass webSocketImpl when running outside a browser.");
    }
    return this.WS;
  }

  private fanOut(
    conn: Connection,
    fn: (sub: BinanceWsSubscriber) => void,
    label: string,
  ): void {
    // Snapshot to avoid mutation-during-iteration if a handler unsubscribes.
    const subs = [...conn.subscribers];
    for (const sub of subs) {
      try {
        fn(sub);
      } catch (err) {
        this.logger.error(`[BinanceWS] ${label} handler threw for ${conn.url}:`, err);
      }
    }
  }

  private scheduleReconnect(conn: Connection): void {
    if (conn.reconnectTimer) return;
    if (conn.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(
        `[BinanceWS] max reconnect attempts (${this.maxReconnectAttempts}) reached for ${conn.url}`,
      );
      return;
    }
    const delay = Math.min(
      this.reconnectDelayBaseMs * Math.pow(2, conn.reconnectAttempts),
      this.reconnectDelayMaxMs,
    );
    conn.reconnectAttempts += 1;
    this.logger.log(
      `[BinanceWS] reconnecting ${conn.url} in ${delay}ms (attempt ${conn.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );
    conn.reconnectTimer = setTimeout(() => {
      conn.reconnectTimer = null;
      // Re-validate before reopening: the connection may have been torn down
      // or already replaced while waiting.
      if (this.connections.get(conn.url) !== conn) return;
      if (conn.subscribers.size === 0) return;
      this.openSocket(conn);
    }, delay);
  }

  private closeConnection(url: string): void {
    const conn = this.connections.get(url);
    if (!conn) return;
    this.connections.delete(url);
    if (conn.reconnectTimer) {
      clearTimeout(conn.reconnectTimer);
      conn.reconnectTimer = null;
    }
    if (conn.ws) {
      // Null out handlers BEFORE close() so the close event from our own
      // teardown can't fire a stale callback that would have tried to
      // schedule a reconnect.
      conn.ws.onopen = null;
      conn.ws.onmessage = null;
      conn.ws.onerror = null;
      conn.ws.onclose = null;
      try {
        conn.ws.close();
      } catch {
        // close() can throw if the socket is in an invalid state — safe to ignore.
      }
      conn.ws = null;
    }
  }
}

/** Shared singleton instance for application use. */
export const binanceWs = new BinanceWsClient();
