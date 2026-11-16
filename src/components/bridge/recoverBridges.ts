import { useEffect } from "react";
import { useAccount } from "wagmi";
import { buildPendingBridge, type RouteLike } from "./bridgeRecord";
import { recallRouteLane } from "./bridgeRouteLanes";
import { usePendingBridgesStore } from "@/stores/pendingBridgesStore";
import { useBridgeEnabled } from "@/hooks/useBridgeEnabled";
import { isSameDepositLane } from "./bridgeStatus";
import { useDepositLane } from "./useDepositLane";

/** How often to look for bridges the widget progressed after we stopped listening. */
export const RECOVERY_INTERVAL_MS = 15_000;

/**
 * The LI.FI widget persists its own route execution state under
 * `<keyPrefix|li.fi>-widget-routes`.
 *
 * Matched by suffix rather than hardcoded, so setting `keyPrefix` on the widget
 * config later cannot silently switch recovery off.
 */
export function findWidgetRouteKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key?.endsWith("-widget-routes")) keys.push(key);
  }
  return keys;
}

/**
 * Pull the routes out of the widget's persisted zustand blob.
 *
 * Deliberately forgiving: this is a third-party storage format we do not own,
 * so anything unexpected yields no routes rather than an exception. A shape
 * change upstream degrades recovery to "does nothing", never to a crash.
 */
export function parseWidgetRoutes(raw: string | null): RouteLike[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as {
      state?: { routes?: Record<string, { route?: unknown }> };
    };
    const routes = parsed?.state?.routes;
    if (!routes || typeof routes !== "object") return [];
    return Object.values(routes)
      .map((entry) => entry?.route)
      .filter((route): route is RouteLike => !!route && typeof route === "object");
  } catch {
    return [];
  }
}

/** Every route the widget currently has persisted, across all key prefixes. */
export function readWidgetRoutes(): RouteLike[] {
  try {
    return findWidgetRouteKeys(localStorage).flatMap((key) =>
      parseWidgetRoutes(localStorage.getItem(key)),
    );
  } catch {
    return [];
  }
}

/**
 * Pick up bridges the widget progressed after the bridge page was unmounted.
 *
 * On unmount the widget moves execution to the background
 * (`updateRouteExecution(route, { executeInBackground: true })`), so a route
 * can acquire its source transaction — and finish — after our event listeners
 * are gone. That is the ordinary "start a bridge, go back to trading" flow, and
 * without this the watcher never learns the bridge exists: the funds arrive and
 * nothing deposits them.
 *
 * Recovery reads the widget's own persisted routes and records anything that
 * has a send hash. Everything downstream is unchanged — the store refuses a
 * hash that was already deposited, dedupes by hash, and keeps the original
 * `startedAt`; the watcher then decides what to do from LI.FI's status.
 *
 * A route whose starting lane we cannot recall is SKIPPED. Without it there is
 * no way to know which partner's contract the funds were meant for, and
 * guessing from the live url is the exact bug the lane exists to prevent.
 */
export function useRecoverBridges(): void {
  const { address } = useAccount();
  const addBridge = usePendingBridgesStore((s) => s.addBridge);
  const bridgeEnabled = useBridgeEnabled();
  const depositLane = useDepositLane();

  useEffect(() => {
    if (!bridgeEnabled || !address) return;

    const sweep = () => {
      for (const route of readWidgetRoutes()) {
        // Per route, because this whole blob is third-party. Nothing in the
        // pipeline throws on JSON-safe input today, but the shape is not ours
        // to guarantee — and one bad entry must never take the sweep down and
        // stop every OTHER bridge from being recovered.
        try {
          recover(route);
        } catch (error) {
          console.error("[bridge] could not recover route", route?.id, error);
        }
      }
    };

    const recover = (route: RouteLike) => {
      // The widget keeps routes from previous wallets. Recording them would be
      // harmless to act on — the watcher goes dormant on an account mismatch —
      // but the pending list is capped and keeps the OLDEST, so enough stale
      // routes could evict the bridge this user just started.
      //
      // Recovery REQUIRES a destination address, where live recording can fall
      // back to the connected wallet. On the page we know the user is standing
      // there starting this bridge; here we are reading durable storage and
      // cannot attribute ownership — defaulting to whoever is connected now
      // would let the sweep deposit this wallet's USDC for a route belonging to
      // someone else.
      const destination = route.toAddress;
      if (typeof destination !== "string") return;
      if (destination.toLowerCase() !== address.toLowerCase()) return;

      const lane = recallRouteLane(route.id);
      if (!lane) return;
      // Only the lane the app is on right now. A route for another partner
      // cannot be deposited until the user returns to it anyway, and the
      // pending list is capped keeping the OLDEST — so recording dormant routes
      // could evict the freshly finished bridge on this lane, every sweep, and
      // it would never be watched. Returning to that lane brings the route
      // back: the widget still has it, and the sweep re-adds it.
      if (!isSameDepositLane(lane, depositLane)) return;

      const pending = buildPendingBridge(route, address, lane);
      if (!pending) return;

      // Same reasoning for the clock. Without the send timestamp `addBridge`
      // stamps `Date.now()`, so an arbitrarily old stored route would look
      // fresh for another 24h — resurrecting a long-finished bridge and
      // re-running its deposit or its error toast.
      if (pending.startedAt === undefined) return;

      addBridge(pending);
    };

    sweep();
    const interval = setInterval(sweep, RECOVERY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [bridgeEnabled, address, addBridge, depositLane]);
}
