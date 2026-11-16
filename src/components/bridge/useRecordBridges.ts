import { useEffect, useRef } from "react";
import type { Route, RouteExtended } from "@lifi/sdk";
import { useWidgetEvents, WidgetEvent } from "@lifi/widget";
import { usePendingBridgesStore } from "@/stores/pendingBridgesStore";
import { buildPendingBridge } from "./bridgeRecord";
import { recallRouteLane, rememberRouteLane } from "./bridgeRouteLanes";
import type { DepositLane } from "./bridgeStatus";

/**
 * The widget's own emitter type, derived rather than restated so it cannot
 * drift from the version in use.
 */
export type WidgetEventEmitter = ReturnType<typeof useWidgetEvents>;

/**
 * Record a bridge as soon as it has a source transaction, so the app-wide
 * watcher can deposit the funds when they land.
 *
 * **Subscribes to `RouteExecutionUpdated`, not only `RouteExecutionCompleted`.**
 * Completion only fires once LI.FI considers the whole route done, and this
 * subscription lives only while the bridge page is mounted. The flow this
 * feature exists for — sign the source transaction, go back to trading, funds
 * arrive minutes later — unmounts the page long before completion, so recording
 * on completion alone means the watcher never learns about the bridge at all.
 *
 * `RouteExecutionUpdated` fires on every process change, so the record is
 * written on the first update that carries a send hash. Repeat events are
 * harmless: the store upserts by `txHash`.
 */
export function useRecordBridges(
  widgetEvents: WidgetEventEmitter,
  account: string | undefined,
  lane: DepositLane,
): void {
  const addBridge = usePendingBridgesStore((s) => s.addBridge);

  // The lane each route was STARTED on, frozen at first sight.
  //
  // The send hash arrives on a later event than the one that starts execution.
  // Reading the live chain selection when it finally arrives could record the
  // bridge against a different destination than the one execution started on. The lane is
  // captured on the first event for a route id and reused for the rest.
  const lanesByRoute = useRef(new Map<string, DepositLane>());

  // Read through a ref so the subscription below does not have to re-run (and
  // so re-subscription order cannot decide which lane a route is frozen to).
  const liveLane = useRef(lane);
  useEffect(() => {
    liveLane.current = lane;
  }, [lane]);

  useEffect(() => {
    const laneFor = (routeId: string | undefined): DepositLane => {
      if (!routeId) return liveLane.current;
      const cached = lanesByRoute.current.get(routeId);
      if (cached) return cached;

      // Storage first, and this is load-bearing. Leaving /bridge and coming
      // back gives this hook a fresh map while the widget RESUMES the same
      // route, so the live url — which may now point at a different partner —
      // would otherwise be frozen in as the lane. `upsertBridge` keeps the
      // first lane recorded for a tx hash, so nothing downstream could repair
      // it: the bridge would go dormant, or deposit into the wrong contract.
      //
      // Persisted as well as cached, because this ref dies with the page and a
      // bridge whose send hash only lands after the user leaves is recovered
      // later from the widget's own storage.
      const lane = recallRouteLane(routeId) ?? liveLane.current;
      lanesByRoute.current.set(routeId, lane);
      rememberRouteLane(routeId, lane);
      return lane;
    };

    const record = (route: Route | undefined) => {
      const pending = buildPendingBridge(
        route as RouteExtended | undefined,
        account,
        laneFor(route?.id),
      );
      // No send hash yet is the normal case on early updates, so a miss here is
      // expected rather than an error.
      if (pending) addBridge(pending);
    };

    // Started fires BEFORE any transaction exists, so the lane is frozen at the
    // earliest possible moment even though nothing can be recorded yet.
    const onStarted = (route: Route) => {
      laneFor(route?.id);
      record(route);
    };
    const onUpdated = (payload: { route: Route }) => record(payload?.route);
    const onCompleted = (route: Route) => record(route);

    widgetEvents.on(WidgetEvent.RouteExecutionStarted, onStarted);
    widgetEvents.on(WidgetEvent.RouteExecutionUpdated, onUpdated);
    widgetEvents.on(WidgetEvent.RouteExecutionCompleted, onCompleted);
    return () => {
      widgetEvents.off(WidgetEvent.RouteExecutionStarted, onStarted);
      widgetEvents.off(WidgetEvent.RouteExecutionUpdated, onUpdated);
      widgetEvents.off(WidgetEvent.RouteExecutionCompleted, onCompleted);
    };
  }, [widgetEvents, addBridge, account]);
}
