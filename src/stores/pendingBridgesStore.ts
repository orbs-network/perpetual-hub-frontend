import { create } from "zustand";

const STORAGE_KEY = "pendingBridges";
const SETTLED_KEY = "pendingBridges.settled";
const CLAIMS_KEY = "pendingBridges.claims";

/**
 * How long a tab's claim on a bridge is honoured.
 *
 * Long enough to cover a wallet prompt the user is slow to answer, short enough
 * that a tab closed mid-deposit does not strand the bridge for the rest of the
 * TTL.
 */
export const CLAIM_TTL_MS = 90 * 1000;

/** Identifies this tab. Claims from other tabs are the ones that matter. */
const TAB_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now());

/**
 * Bridges are abandoned far more often than they fail. A record older than this
 * is dropped rather than polled forever — LI.FI routes are minutes, not days,
 * and a stale entry firing a deposit prompt a week later would be alarming.
 */
export const PENDING_BRIDGE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Bounded so a user who bridges repeatedly cannot grow storage without limit.
 *
 * Set high enough that a real user never reaches it — records also expire after
 * 24h — because eviction means a bridge stops being watched.
 */
export const MAX_PENDING_BRIDGES = 25;

/**
 * Deposited bridges are remembered for longer than pending ones, and more of
 * them: the whole job of this list is to refuse a re-add, so it must outlive
 * every event that could still arrive for a route.
 */
export const SETTLED_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_SETTLED_BRIDGES = 100;

export interface PendingBridge {
  /** Source-chain transaction hash. The identity of the bridge, and all LI.FI
   *  needs to resolve status after a reload. */
  txHash: string;
  fromChainId: number;
  toChainId: number;
  /** Lowercased. The deposit must never run for a different account. */
  account: string;
  /** Human-readable amount, for the toast only — never used to size a deposit. */
  displayAmount: string;
  tokenSymbol: string;
  /**
   * Partner+chain lane the bridge was started for. The watcher is app-wide, so
   * without this a user who changes `?chain=` mid-bridge could have the deposit
   * land in a different chain's contract.
   */
  partnerChainKey: string;
  /**
   * The API-provided target when the bridge started. A later deployment can
   * change these addresses without changing the lane key; keep them immutable.
   */
  contractAddress?: string;
  collateralAddress?: string;
  /**
   * The bridge LI.FI routed through (`across`, `stargate`, …), passed to
   * `getStatus` as `bridge`. Optional: a route can legitimately have none
   * (same-chain swaps, or the `custom` placeholder), and status still resolves
   * for those — just less reliably for cross-chain ones.
   */
  tool?: string;
  startedAt: number;
}

/**
 * Drop expired entries and enforce the cap, newest first.
 *
 * At the cap the OLDEST are kept. They are closest to arriving, they are what
 * the watcher processes first, and — unlike the newest — nothing will re-record
 * them: the route that produced the newest bridge is still executing in the
 * widget and its next event puts it back.
 */
export function pruneBridges(
  bridges: readonly PendingBridge[],
  now: number,
  ttlMs: number = PENDING_BRIDGE_TTL_MS,
  max: number = MAX_PENDING_BRIDGES,
): PendingBridge[] {
  const live = bridges
    .filter((b) => now - b.startedAt < ttlMs)
    .sort((a, b) => a.startedAt - b.startedAt)
    .slice(0, max);
  return live.sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * Add or replace by txHash — a re-emitted event must not create a duplicate.
 *
 * The fields that decide WHERE the funds go and WHEN they expire are taken from
 * the EXISTING record, never the re-emitted one:
 *
 * - `partnerChainKey`, `contractAddress`, `collateralAddress` and `account`, because a
 *   repeat event carries the live deposit lane. A chain change or later API
 *   deployment must not rewrite an in-flight bridge's intended target.
 * - `startedAt`, because re-aging restarts the `NOT_FOUND` grace window (so an
 *   unresolvable bridge is never cleaned up) and reshuffles the oldest-first
 *   deposit order.
 *
 * Everything else is taken from the new event, which may carry detail the first
 * one lacked (the tool, a final amount).
 */
export function upsertBridge(
  bridges: readonly PendingBridge[],
  bridge: PendingBridge,
  now: number,
): PendingBridge[] {
  const existing = bridges.find((b) => b.txHash === bridge.txHash);
  const withoutDuplicate = bridges.filter((b) => b.txHash !== bridge.txHash);
  const merged = existing
    ? {
        ...bridge,
        account: existing.account,
        partnerChainKey: existing.partnerChainKey,
        contractAddress: existing.contractAddress,
        collateralAddress: existing.collateralAddress,
        startedAt: existing.startedAt,
      }
    : bridge;
  return pruneBridges([merged, ...withoutDuplicate], now);
}

/**
 * Bridges belonging to `account`, oldest first so the earliest bridge is
 * deposited first.
 *
 * Comparison is lowercased on both sides: the store writes lowercase, but a
 * caller passing a checksummed address from wagmi would otherwise silently
 * match nothing — and silently doing nothing is the worst failure here.
 */
export function bridgesForAccount(
  bridges: readonly PendingBridge[],
  account: string | undefined,
): PendingBridge[] {
  if (!account) return [];
  const target = account.toLowerCase();
  return bridges
    .filter((b) => b.account === target)
    .sort((a, b) => a.startedAt - b.startedAt);
}

/**
 * Validate whatever was in storage.
 *
 * Storage is user-writable and survives deploys, so the shape is not
 * guaranteed. Kept pure and exported so every rejection branch is testable
 * without reloading the module.
 */
export function parseStoredBridges(raw: string | null, now: number): PendingBridge[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(
      (b): b is PendingBridge =>
        !!b &&
        typeof b.txHash === "string" &&
        typeof b.account === "string" &&
        typeof b.fromChainId === "number" &&
        typeof b.toChainId === "number" &&
        // Required: without a lane we cannot know which partner contract the
        // funds were meant for, and guessing from the live url is exactly the
        // wrong-contract bug this field exists to prevent. Refusing to load is
        // the safe failure — the funds are in the wallet either way.
        typeof b.partnerChainKey === "string" &&
        // Optional, but if present they MUST be strings: the lane comparison
        // lowercases them, and one hand-edited record would otherwise throw
        // mid-pass and stop every other bridge in this tab from being polled.
        isOptionalString(b.contractAddress) &&
        isOptionalString(b.collateralAddress) &&
        isOptionalString(b.tool) &&
        typeof b.startedAt === "number",
    );
    return pruneBridges(valid, now);
  } catch {
    return [];
  }
}

/** A tab's exclusive claim on depositing one bridge. */
export interface BridgeClaim {
  tabId: string;
  at: number;
}

export type BridgeClaims = Record<string, BridgeClaim>;

/**
 * Take the claim if it is free or expired, otherwise report who holds it.
 *
 * Pure so the contested cases are testable without two browser tabs.
 */
export function acquireClaim(
  claims: BridgeClaims,
  txHash: string,
  tabId: string,
  now: number,
  ttlMs: number = CLAIM_TTL_MS,
): { claims: BridgeClaims; acquired: boolean } {
  const held = claims[txHash];
  const live = held && now - held.at < ttlMs;
  if (live && held.tabId !== tabId) return { claims, acquired: false };

  const next: BridgeClaims = { ...claims, [txHash]: { tabId, at: now } };
  // Expired claims from any tab are swept while we are here.
  for (const [hash, claim] of Object.entries(next)) {
    if (hash !== txHash && now - claim.at >= ttlMs) delete next[hash];
  }
  return { claims: next, acquired: true };
}

export function parseStoredClaims(raw: string | null): BridgeClaims {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const claims: BridgeClaims = {};
    for (const [hash, value] of Object.entries(parsed as Record<string, unknown>)) {
      const claim = value as Partial<BridgeClaim>;
      if (typeof claim?.tabId === "string" && typeof claim?.at === "number") {
        claims[hash] = { tabId: claim.tabId, at: claim.at };
      }
    }
    return claims;
  } catch {
    return {};
  }
}

/** A bridge whose funds have already been deposited. */
export interface SettledBridge {
  txHash: string;
  settledAt: number;
}

/**
 * Merge two settled lists, keeping the earliest settlement per hash.
 *
 * The settled list is monotone — a deposited bridge stays deposited — so
 * concurrent writers must UNION rather than overwrite. Without this, two tabs
 * that read before either writes end with the later write dropping the other's
 * just-settled hash, making that bridge watchable again and depositable twice.
 */
export function mergeSettled(
  a: readonly SettledBridge[],
  b: readonly SettledBridge[],
): SettledBridge[] {
  const byHash = new Map<string, SettledBridge>();
  for (const entry of [...a, ...b]) {
    const existing = byHash.get(entry.txHash);
    if (!existing || entry.settledAt < existing.settledAt) {
      byHash.set(entry.txHash, entry);
    }
  }
  return [...byHash.values()];
}

export function pruneSettled(
  settled: readonly SettledBridge[],
  now: number,
  ttlMs: number = SETTLED_TTL_MS,
  max: number = MAX_SETTLED_BRIDGES,
): SettledBridge[] {
  return settled
    .filter((s) => now - s.settledAt < ttlMs)
    .sort((a, b) => b.settledAt - a.settledAt)
    .slice(0, max);
}

export function parseStoredSettled(
  raw: string | null,
  now: number,
): SettledBridge[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return pruneSettled(
      parsed.filter(
        (s): s is SettledBridge =>
          !!s && typeof s.txHash === "string" && typeof s.settledAt === "number",
      ),
      now,
    );
  } catch {
    return [];
  }
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

/**
 * Drop pending records that are already settled.
 *
 * Another tab can deposit a bridge while this tab's widget re-emits the same
 * completed route; whichever write lands last, the pending and settled copies
 * would otherwise coexist and this tab would poll a deposited bridge for the
 * rest of its 24h life.
 */
export function reconcilePending(
  bridges: readonly PendingBridge[],
  settled: readonly SettledBridge[],
): PendingBridge[] {
  if (settled.length === 0) return [...bridges];
  const done = new Set(settled.map((s) => s.txHash));
  return bridges.filter((b) => !done.has(b.txHash));
}

/**
 * Whether localStorage can be read at all.
 *
 * In private browsing it can throw outright. Everything below then falls back
 * to the in-memory state: reading it as "empty" instead would make each
 * mutation drop the bridges added by the one before it, and forget settled
 * hashes — turning a degraded environment into a double-deposit.
 */
function storageReadable(): boolean {
  try {
    localStorage.getItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function load(): PendingBridge[] {
  try {
    return parseStoredBridges(localStorage.getItem(STORAGE_KEY), Date.now());
  } catch {
    // localStorage itself can throw in private browsing.
    return [];
  }
}

function loadSettled(): SettledBridge[] {
  try {
    return parseStoredSettled(localStorage.getItem(SETTLED_KEY), Date.now());
  } catch {
    return [];
  }
}

function readClaims(): BridgeClaims {
  try {
    return parseStoredClaims(localStorage.getItem(CLAIMS_KEY));
  } catch {
    return {};
  }
}

/**
 * Run `action` holding an exclusive cross-tab lock on this bridge, or skip it
 * entirely if another tab holds the lock.
 *
 * Two tabs can finish their status request at the same moment and both see
 * `DONE`; without exclusion both raise a wallet prompt and the second can
 * deposit again out of whatever USDC is in the wallet.
 *
 * The Web Locks API is used when available because it is a REAL mutex —
 * `ifAvailable` returns null rather than queueing, so the losing tab simply
 * retries on its next pass. The localStorage claim below is the fallback for
 * browsers without it; that one is racy (read-then-write, no compare-and-swap)
 * and is a mitigation, not a guarantee.
 *
 * Returns true if the action ran.
 */
export async function withBridgeDepositLock(
  txHash: string,
  action: () => Promise<void>,
): Promise<boolean> {
  const locks = (
    navigator as Navigator & {
      locks?: {
        request: (
          name: string,
          options: { ifAvailable: boolean },
          callback: (lock: unknown) => Promise<boolean>,
        ) => Promise<boolean>;
      };
    }
  ).locks;

  if (!locks) {
    if (!claimBridgeForDeposit(txHash)) return false;
    try {
      await action();
    } finally {
      releaseBridgeClaim(txHash);
    }
    return true;
  }

  return locks.request(
    `bridge-deposit:${txHash}`,
    { ifAvailable: true },
    async (lock) => {
      // null means another tab holds it. Skip; our next pass will retry.
      if (!lock) return false;
      await action();
      return true;
    },
  );
}

/**
 * Fallback claim for browsers without the Web Locks API.
 *
 * Writes and then re-reads: if the stored claim is no longer ours, the other
 * tab won and we back off. Without compare-and-swap this cannot be airtight —
 * two tabs that read before either writes can both believe they won — so it
 * narrows the window rather than closing it.
 */
export function claimBridgeForDeposit(txHash: string, now = Date.now()): boolean {
  try {
    const { claims, acquired } = acquireClaim(readClaims(), txHash, TAB_ID, now);
    if (!acquired) return false;
    localStorage.setItem(CLAIMS_KEY, JSON.stringify(claims));
    return readClaims()[txHash]?.tabId === TAB_ID;
  } catch {
    // Storage is unusable, so there is no way to coordinate with another tab —
    // and this fallback only runs when the Web Locks API is missing too, so
    // nothing else is providing exclusion either. Granting the claim here would
    // let every tab believe it won and each raise its own deposit prompt.
    //
    // Refusing means auto-deposit does not run in that environment. That is the
    // right side to fail on for money-moving code: the funds are in the wallet
    // and the Deposit button still works.
    return false;
  }
}

export function releaseBridgeClaim(txHash: string): void {
  try {
    const claims = readClaims();
    if (claims[txHash]?.tabId !== TAB_ID) return;
    delete claims[txHash];
    localStorage.setItem(CLAIMS_KEY, JSON.stringify(claims));
  } catch {
    // Nothing to release.
  }
}

function save(bridges: PendingBridge[], settled?: SettledBridge[]) {
  try {
    // SETTLED FIRST, deliberately. These are two independent writes and the
    // second can fail on its own under quota pressure. Writing the pending list
    // first would remove a deposited bridge and then fail to record that it was
    // deposited — leaving no pending record AND no guard, so the recovery sweep
    // could resurrect the route from widget storage and deposit it again.
    //
    // This order fails safe: the settlement lands, and a failed pending write
    // just leaves a stale record that `reconcilePending` drops on the next read.
    if (settled) {
      // Union at the moment of writing, not from the snapshot this mutation
      // started with: another tab may have settled a bridge in between, and
      // dropping its hash would make that bridge depositable a second time.
      localStorage.setItem(
        SETTLED_KEY,
        JSON.stringify(
          pruneSettled(mergeSettled(loadSettled(), settled), Date.now()),
        ),
      );
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bridges));
  } catch {
    // Private browsing / quota. The in-memory list still works for this session.
  }
}

interface PendingBridgesState {
  bridges: PendingBridge[];
  /** Already deposited. Kept so a repeat route event cannot resurrect them. */
  settled: SettledBridge[];
  addBridge: (bridge: Omit<PendingBridge, "startedAt" | "account"> & {
    account: string;
    startedAt?: number;
  }) => void;
  removeBridge: (txHash: string) => void;
  /**
   * This bridge is finished — deposited, failed, refunded or unresolvable.
   * Drops the record AND refuses the hash if anything tries to re-add it.
   *
   * `removeBridge` deliberately does NOT do this: it is the plain primitive and
   * leaves a hash re-addable.
   */
  markSettled: (txHash: string) => void;
  /** Re-read localStorage — another tab changed it. */
  syncFromStorage: () => void;
  /** Test seam. */
  reset: (bridges?: PendingBridge[], settled?: SettledBridge[]) => void;
}

/**
 * Apply a mutation to the state currently IN STORAGE, not to this tab's copy.
 *
 * Every write here serialises whole arrays, so writing from a stale in-memory
 * snapshot silently deletes whatever another tab added in the meantime — a
 * pending bridge simply stops being watched. Reading first makes each mutation
 * a read-modify-write against the shared source of truth.
 *
 * localStorage still has no compare-and-swap, so two tabs mutating in the exact
 * same tick can interleave; this shrinks the window from "the whole session" to
 * "between two adjacent statements". Depositing — the operation where a lost
 * write costs money — is additionally serialised by `withBridgeDepositLock`.
 */
function mutate(
  set: (partial: Partial<PendingBridgesState>) => void,
  get: () => PendingBridgesState,
  fn: (state: {
    bridges: PendingBridge[];
    settled: SettledBridge[];
  }) => { bridges: PendingBridge[]; settled?: SettledBridge[] },
): void {
  // Storage is the source of truth ONLY while it is readable. Where it is not,
  // this tab's memory is all there is, and treating it as empty would lose
  // every bridge on the next mutation.
  const readable = storageReadable();
  const current = readable
    ? {
        bridges: load(),
        // Settled is UNIONED with memory, not taken from storage alone: a
        // settlement whose write failed (quota) exists only in memory, and
        // dropping it here would let addBridge re-add an already-deposited
        // bridge. Safe because the list is monotone — unioning can never
        // wrongly forget one. `bridges` gets no such treatment: those are
        // removable, so a union would resurrect deleted records.
        settled: mergeSettled(loadSettled(), get().settled),
      }
    : { bridges: get().bridges, settled: get().settled };

  const result = fn(current);
  const settled = result.settled ?? current.settled;
  save(result.bridges, settled);

  // `save` unions the settled list with whatever landed in storage meanwhile,
  // so re-read it — but MERGE rather than replace. `save` swallows write
  // errors (quota), and a failed write means the re-read returns the old value;
  // taking it verbatim would drop the settlement we just made from memory too,
  // and a re-emitted route event could then deposit the same bridge again.
  const persistedSettled = readable
    ? mergeSettled(loadSettled(), settled)
    : settled;
  set({
    bridges: reconcilePending(result.bridges, persistedSettled),
    settled: persistedSettled,
  });
}

function hydrate(): { bridges: PendingBridge[]; settled: SettledBridge[] } {
  const settled = loadSettled();
  // Reconciled here too, not only on sync: a hash can legitimately be in both
  // lists after a cross-tab race, and a reload would otherwise mount the
  // watcher for an already-deposited bridge — needless polling, and a false
  // failure toast if LI.FI later answers FAILED for that historical tx.
  return { bridges: reconcilePending(load(), settled), settled };
}

export const usePendingBridgesStore = create<PendingBridgesState>((set, get) => ({
  ...hydrate(),

  addBridge: (bridge) => {
    const now = Date.now();
    mutate(set, get, (state) => {
      // A route event can be re-emitted after the deposit has already happened
      // — the widget is still mounted and LI.FI re-sends the completed route.
      // Re-adding it would have the watcher deposit a SECOND time, out of
      // whatever USDC is in the wallet, for funds already credited.
      if (state.settled.some((s) => s.txHash === bridge.txHash)) {
        return { bridges: state.bridges };
      }
      return {
        bridges: upsertBridge(
          state.bridges,
          {
            ...bridge,
            account: bridge.account.toLowerCase(),
            startedAt: bridge.startedAt ?? now,
          },
          now,
        ),
      };
    });
  },

  removeBridge: (txHash) => {
    mutate(set, get, (state) => ({
      bridges: state.bridges.filter((b) => b.txHash !== txHash),
    }));
  },

  markSettled: (txHash) => {
    const now = Date.now();
    mutate(set, get, (state) => ({
      bridges: state.bridges.filter((b) => b.txHash !== txHash),
      settled: pruneSettled(
        [
          { txHash, settledAt: now },
          ...state.settled.filter((s) => s.txHash !== txHash),
        ],
        now,
      ),
    }));
  },

  reset: (bridges = [], settled = []) => {
    save(bridges, settled);
    set({ bridges, settled });
  },

  syncFromStorage: () => {
    // Merged, never replaced. A settlement whose write failed exists only in
    // memory, and taking storage verbatim would drop it — so a later storage
    // event from another tab could make this tab forget an already-deposited
    // bridge and deposit it a second time. Safe because the list only grows.
    const settled = mergeSettled(loadSettled(), get().settled);
    set({ bridges: reconcilePending(load(), settled), settled });
  },
}));

/**
 * Keep every open tab agreeing on the bridge list.
 *
 * Without this a tab only ever sees the snapshot it took at startup: a bridge
 * started in another tab is never watched (so the funds are never deposited),
 * and a deposit completed in another tab is never learned about (so this tab
 * would happily prompt for it again).
 *
 * `storage` only fires in OTHER tabs, so this cannot loop with our own writes.
 * Returns an unsubscribe function.
 */
export function subscribeToBridgeStorage(): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY && event.key !== SETTLED_KEY) {
      return;
    }
    usePendingBridgesStore.getState().syncFromStorage();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
