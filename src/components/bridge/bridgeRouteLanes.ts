import type { DepositLane } from "./bridgeStatus";

const STORAGE_KEY = "bridgeRouteLanes";

/**
 * Deliberately LONGER than the 24h pending-bridge TTL.
 *
 * A lane is stamped when the route starts, but a recovered bridge expires from
 * its SEND timestamp — which for approve-first and swap-first routes is later.
 * Matching the two would let the lane age out first, making a bridge that is
 * still well inside its own TTL unrecoverable: exactly the late-recorded routes
 * this exists to catch.
 */
const LANE_TTL_MS = 48 * 60 * 60 * 1000;

/** Bounded like every other list we persist. */
const MAX_LANES = 50;

interface StoredLane {
  routeId: string;
  lane: DepositLane;
  at: number;
}

/**
 * The deposit lane each LI.FI route was started on, persisted.
 *
 * `useRecordBridges` already freezes the lane per route id in memory, but that
 * ref dies with the bridge page — and recovering a bridge after the page is
 * gone is exactly what this exists for. A recovered route whose lane we cannot
 * resolve MUST NOT be deposited: without it we would be guessing which
 * partner's contract the funds were meant for.
 */
export function parseStoredLanes(raw: string | null, now: number): StoredLane[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is StoredLane => {
        const candidate = entry as Partial<StoredLane>;
        const lane = candidate?.lane as Partial<DepositLane> | undefined;
        return (
          typeof candidate?.routeId === "string" &&
          typeof candidate?.at === "number" &&
          typeof lane?.partnerChainKey === "string" &&
          (lane.contractAddress === undefined ||
            typeof lane.contractAddress === "string") &&
          (lane.collateralAddress === undefined || typeof lane.collateralAddress === "string")
        );
      })
      .filter((entry) => now - entry.at < LANE_TTL_MS)
      .sort((a, b) => b.at - a.at)
      .slice(0, MAX_LANES);
  } catch {
    return [];
  }
}

export function upsertLane(
  lanes: readonly StoredLane[],
  routeId: string,
  lane: DepositLane,
  now: number,
): StoredLane[] {
  // First write wins. A repeat event carries the LIVE lane, and the whole point
  // is to remember the one the route STARTED on.
  if (lanes.some((entry) => entry.routeId === routeId)) return [...lanes];
  return prune([{ routeId, lane, at: now }, ...lanes], now);
}

/**
 * Union two lane lists, keeping the earliest entry per route.
 *
 * Two tabs each starting a bridge do a read-modify-write of the whole array, so
 * the later write would otherwise drop the other tab's route — and a route with
 * no remembered lane is skipped by recovery, which is exactly the bridge that
 * then never gets deposited. Safe to union because the list only grows and the
 * first write per route is the one that counts.
 */
export function mergeLanes(
  a: readonly StoredLane[],
  b: readonly StoredLane[],
): StoredLane[] {
  const byRoute = new Map<string, StoredLane>();
  for (const entry of [...a, ...b]) {
    const existing = byRoute.get(entry.routeId);
    if (!existing || entry.at < existing.at) byRoute.set(entry.routeId, entry);
  }
  return [...byRoute.values()];
}

function prune(lanes: StoredLane[], now: number): StoredLane[] {
  return lanes
    .filter((entry) => now - entry.at < LANE_TTL_MS)
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_LANES);
}

function read(now: number): StoredLane[] {
  try {
    return parseStoredLanes(localStorage.getItem(STORAGE_KEY), now);
  } catch {
    return [];
  }
}

/** Remember the lane a route started on. Idempotent; the first write wins. */
export function rememberRouteLane(
  routeId: string | undefined,
  lane: DepositLane,
  now = Date.now(),
): void {
  if (!routeId || !lane.partnerChainKey) return;
  try {
    const next = upsertLane(read(now), routeId, lane, now);
    // Re-read and union at the moment of writing: another tab may have added a
    // route between our read and this write, and dropping it would leave that
    // bridge unrecoverable.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(prune(mergeLanes(read(now), next), now)),
    );
  } catch {
    // Unwritable storage. Recovery for this route will find no lane and skip
    // it, which is the safe failure — the funds are in the wallet and the
    // Deposit button still works.
  }
}

/** The lane a route was started on, or undefined if we never saw it start. */
export function recallRouteLane(
  routeId: string | undefined,
  now = Date.now(),
): DepositLane | undefined {
  if (!routeId) return undefined;
  return read(now).find((entry) => entry.routeId === routeId)?.lane;
}
