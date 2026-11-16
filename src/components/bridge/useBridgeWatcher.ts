import { useCallback, useEffect, useRef } from "react";
import { useAccount, useConfig, useSwitchChain } from "wagmi";
import { getAccount } from "wagmi/actions";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useSafeTranslation";
import {
  useDepositFlow,
  useUSDCBalance,
} from "@/hooks/mutations/useDeposit";
import { useBridgeDestinationChainId } from "@/hooks/useBridgeEnabled";
import { useCollateralDecimals } from "@/hooks/useCurrentPartnerChain";
import { useShouldSwitchToSupportedChain } from "@/hooks/useSwitchToSupportedChain";
import { tokenToProtocolAmount } from "@/utils/collateral";
import {
  bridgesForAccount,
  PENDING_BRIDGE_TTL_MS,
  subscribeToBridgeStorage,
  usePendingBridgesStore,
  withBridgeDepositLock,
  type PendingBridge,
} from "@/stores/pendingBridgesStore";
import { fetchBridgeStatus } from "./fetchBridgeStatus";
import { useDepositLane } from "./useDepositLane";
import {
  canActOnBridge,
  interpretStatus,
  isSameDepositLane,
} from "./bridgeStatus";

/**
 * Whether this account has any bridge worth watching.
 *
 * Deliberately cheap: it touches the store and the connected address, nothing
 * else. `useBridgeWatcher` pulls in the deposit hooks, and those mount balance
 * reads that poll every 20s — mounting them app-wide would make every session
 * poll the deposit contract forever, including when bridging is disabled
 * and users who never open /bridge.
 *
 * Also owns the cross-tab listener, so a tab with no bridges of its own still
 * learns when another tab starts one.
 */
export function useHasPendingBridges(): boolean {
  const { address } = useAccount();
  const bridges = usePendingBridgesStore((s) => s.bridges);

  useEffect(() => subscribeToBridgeStorage(), []);

  return bridgesForAccount(bridges, address).length > 0;
}

/** LI.FI status is not real-time; polling faster just burns their rate limit. */
export const POLL_INTERVAL_MS = 15_000;

/**
 * How long to keep retrying when LI.FI says the funds arrived but our RPC does
 * not show them yet.
 *
 * `getStatus` can report `DONE` before the destination RPC we read has caught
 * up. Believing that read would deposit a stale, smaller amount — or settle an
 * empty wallet as "already deposited" — and the rest of the bridged USDC would
 * sit in the wallet forever. Waiting costs only a delay.
 */
export const BALANCE_CATCHUP_GRACE_MS = 5 * 60 * 1000;

const toastIdFor = (txHash: string) => `bridge-${txHash}`;

/**
 * Watches pending bridges anywhere in the app and deposits the funds when they
 * land.
 *
 * Mounted only while this account HAS a pending bridge — see
 * `useHasPendingBridges` for why — but app-wide, so a user can start a bridge
 * and go back to trading.
 * Bridges routinely take many minutes; tying this to `/bridge` would mean the
 * feature only worked if the user sat and watched it.
 *
 * Three properties this is built around:
 *
 * 1. **Never deposits for the wrong account.** A record whose account does not
 *    match the connected wallet goes dormant, not deleted — the user may switch
 *    back, and deleting would silently strand the funds.
 * 2. **One deposit at a time.** Two concurrent wallet prompts is a broken
 *    experience and risks double-spending an allowance, so bridges are handled
 *    oldest-first, sequentially.
 * 3. **Deposits what ARRIVED.** Never the quoted amount — bridges can deliver
 *    less — and never more than the wallet actually holds.
 */
export function useBridgeWatcher() {
  const { t } = useTranslation();
  const { address } = useAccount();
  const wagmiConfig = useConfig();
  const { switchChainAsync } = useSwitchChain();
  const destinationChainId = useBridgeDestinationChainId();
  const depositLane = useDepositLane();
  const collateralDecimals = useCollateralDecimals();
  const shouldSwitchChain = useShouldSwitchToSupportedChain();
  const { refetch: refetchUsdc, balance: usdcBalance } = useUSDCBalance();
  const { mutateAsync: deposit } = useDepositFlow();

  const bridges = usePendingBridgesStore((s) => s.bridges);
  const removeBridge = usePendingBridgesStore((s) => s.removeBridge);
  const markSettled = usePendingBridgesStore((s) => s.markSettled);

  // Re-entrancy guard. The interval keeps firing while a deposit is awaiting a
  // wallet signature, and a second pass would raise a second prompt.
  const busyRef = useRef(false);

  // When each bridge was FIRST seen as arrived, so the balance-catchup grace is
  // measured from arrival rather than from when the bridge started.
  const arrivedAtRef = useRef(new Map<string, number>());

  // Bridges this tab is currently showing an in-flight toast for. That toast has
  // no duration, so anything that stops us tracking a bridge has to take it
  // down — otherwise the user sits on the trading page watching a permanent
  // "Bridging…" banner for something this tab is no longer polling.
  const openToastsRef = useRef(new Set<string>());

  const handleArrived = useCallback(
    async (bridge: PendingBridge, receivedAmount: bigint) => {
      const id = toastIdFor(bridge.txHash);
      toast.loading(t("Funds arrived — depositing"), { id, duration: Infinity });

      openToastsRef.current.delete(bridge.txHash);
      let deposited = false;
      try {
        // The deposit flow refuses to run on the wrong chain, so the switch has
        // to happen first — and then we must RETURN rather than deposit here.
        //
        // `useDepositFlow`'s mutation closes over `shouldSwitchChain` from the
        // render that produced it. Switching does not rewrite that closure, so
        // depositing in this same pass throws "Switch to supported chain first"
        // even though the wallet is now on the right chain — a phantom failure
        // toast on a bridge that actually succeeded. The next poll runs against
        // a fresh render, where the flow sees the switched chain.
        if (shouldSwitchChain) {
          await switchChainAsync({ chainId: destinationChainId });
          toast.loading(t("Funds arrived — depositing"), {
            id,
            duration: Infinity,
          });
          return;
        }

        // The flow validates against the live balance, so read it after the
        // funds have landed rather than trusting a cached value.
        const fresh = await refetchUsdc();
        const rawBalance = fresh.data as bigint | undefined;
        // `isError` matters as much as a missing value: react-query hands back
        // the last CACHED data when a refetch fails, so a failed read would
        // otherwise look like a real (stale) balance — and after the grace it
        // would deposit too little, or settle an empty wallet as already
        // deposited, on a read that never actually succeeded.
        if (rawBalance === undefined || fresh.isError) {
          // The funds may well be there, so keep the record and try again on
          // the next pass.
          throw new Error(t("Could not read your wallet balance"));
        }

        // LI.FI can report DONE before our RPC shows the transfer. Acting on a
        // balance that has not caught up would deposit a stale, smaller amount
        // — or settle an empty wallet as "already deposited" — and strand the
        // rest of the bridged USDC.
        const now = Date.now();
        const firstSeen = arrivedAtRef.current.get(bridge.txHash) ?? now;
        arrivedAtRef.current.set(bridge.txHash, firstSeen);

        if (
          rawBalance < receivedAmount &&
          now - firstSeen < BALANCE_CATCHUP_GRACE_MS
        ) {
          toast.loading(t("Funds arrived — depositing"), {
            id,
            duration: Infinity,
          });
          return;
        }

        // Never try to spend more than is actually there. The received amount
        // is authoritative for intent; the balance is authoritative for what is
        // possible.
        const rawAmount =
          receivedAmount < rawBalance ? receivedAmount : rawBalance;
        if (rawAmount <= 0n) {
          // The grace has passed and the wallet is still empty — the user
          // deposited or moved the funds themselves. Retrying every 15s would
          // just re-show a toast forever. Settled, so a re-emitted route event
          // cannot bring it back either.
          toast.success(t("Bridged funds already deposited"), {
            id,
            duration: 6000,
          });
          markSettled(bridge.txHash);
          return;
        }

        // LI.FI and ERC-20 balanceOf return token-native units, while the
        // deposit flow deliberately exposes the protocol's 1e6 unit API.
        const amount = tokenToProtocolAmount(rawAmount, collateralDecimals);
        if (amount <= 0n) {
          // The transfer succeeded, but less than one protocol unit arrived.
          // Retrying cannot change that deterministic conversion and would show
          // the same failure every 15 seconds for a day. Leave the token dust in
          // the wallet and permanently settle this bridge record.
          markSettled(bridge.txHash);
          toast.error(
            t("Bridged amount is below deposit precision and remains in your wallet"),
            { id, duration: 12000 },
          );
          return;
        }

        // Same stale-closure trap as the chain switch above, and the more
        // likely one: the deposit flow validates against the balance captured
        // in ITS render, which for the headline case — bridging into an empty
        // wallet — is still zero. Depositing now would throw "Insufficient USDC
        // balance" on funds that are demonstrably there. Wait for the render
        // that has them.
        if (usdcBalance < amount) {
          toast.loading(t("Funds arrived — depositing"), {
            id,
            duration: Infinity,
          });
          return;
        }

        // Settled from onSuccess, which the flow calls as soon as the deposit
        // receipt is in — BEFORE the balance polling it does afterwards. If the
        // tab closed during that polling we would otherwise still have the
        // bridge pending and deposit it a second time on next load.
        // The wallet can change while this pass awaits the chain switch and the
        // balance read. `deposit` builds depositForAccount from the render's
        // address but SIGNS with whatever wallet is connected now — so a stale
        // pass could have wallet B deposit its own USDC into wallet A's trading
        // account. Read wagmi's live state, not this render's closure.
        const liveAddress = getAccount(wagmiConfig).address;
        if (!canActOnBridge(bridge.account, liveAddress)) {
          console.warn("[bridge] wallet changed mid-pass; not depositing");
          toast.dismiss(id);
          return;
        }

        await deposit({
          amount,
          onSuccess: () => {
            deposited = true;
            markSettled(bridge.txHash);
          },
        });

        toast.success(t("Bridged funds deposited"), { id, duration: 6000 });
      } catch (error) {
        if (deposited) {
          // The deposit itself landed; only the bookkeeping after it failed.
          // Calling that a failure would tell the user their money is missing.
          console.error("[bridge] post-deposit refresh failed", error);
          toast.success(t("Bridged funds deposited"), { id, duration: 6000 });
          return;
        }
        // The bridge itself succeeded — the money is in their wallet. Say so,
        // plainly, because "deposit failed" after a bridge reads as "lost".
        console.error("[bridge] auto-deposit failed", error);
        toast.error(
          t(
            "Your bridged funds arrived but the deposit did not complete. They are safe in your wallet — you can deposit them from the Deposit button.",
          ),
          { id, duration: 12000 },
        );
        // Deliberately NOT removed: leaving it lets a retry happen on the next
        // poll if the failure was transient (a rejected prompt, a blip).
      }
    },
    [
      t,
      collateralDecimals,
      wagmiConfig,
      switchChainAsync,
      shouldSwitchChain,
      destinationChainId,
      refetchUsdc,
      usdcBalance,
      deposit,
      markSettled,
    ],
  );

  // Unmount-only, deliberately separate from the polling effect below. That
  // effect's cleanup runs on every dependency change — including each store
  // write — so dismissing there would tear down the toast for a bridge that is
  // still in flight and re-show it a moment later.
  //
  // The watcher unmounts as soon as the account has no actionable bridges,
  // which is exactly what disconnecting or switching wallets causes. The toasts
  // have no duration, so without this the tab keeps a permanent banner for a
  // bridge nothing is polling any more.
  useEffect(
    () => () => {
      for (const txHash of openToastsRef.current) {
        toast.dismiss(toastIdFor(txHash));
      }
      openToastsRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    const mine = bridgesForAccount(bridges, address);

    // The TTL is applied on load and on write, but a tab left open for a day
    // would otherwise keep polling a record that should have expired — and
    // could raise a deposit prompt days after the bridge.
    const isExpired = (bridge: PendingBridge) =>
      Date.now() - bridge.startedAt >= PENDING_BRIDGE_TTL_MS;
    for (const bridge of mine.filter(isExpired)) {
      removeBridge(bridge.txHash);
    }

    // Everything this tab can actually act on right now. A record outside this
    // set is dormant (wrong wallet, wrong partner lane) or expired.
    const actionable = mine.filter(
      (bridge) =>
        !isExpired(bridge) &&
        canActOnBridge(bridge.account, address) &&
        isSameDepositLane(bridge, depositLane),
    );

    // Take down toasts for anything that dropped out of that set. This runs
    // BEFORE the early return on purpose: switching wallets removes the bridge
    // from `mine` entirely, so a check further down would never be reached.
    for (const txHash of openToastsRef.current) {
      if (!actionable.some((bridge) => bridge.txHash === txHash)) {
        toast.dismiss(toastIdFor(txHash));
        openToastsRef.current.delete(txHash);
      }
    }

    if (actionable.length === 0) return;

    let cancelled = false;

    const tick = async () => {
      // Held across the WHOLE pass, including the status request. Releasing it
      // only around the deposit let a slow LI.FI response (>15s, the poll
      // interval) admit a second tick, which could see the same DONE status and
      // raise a second switch/deposit prompt for one bridge.
      if (cancelled || busyRef.current) return;
      busyRef.current = true;
      try {
        await pass();
      } finally {
        busyRef.current = false;
      }
    };

    const pass = async () => {
      for (const bridge of actionable) {
        if (cancelled) return;
        // Re-checked per item, not just when the set was built: a pass awaits
        // network calls, and the wallet or lane can change underneath it.
        if (Date.now() - bridge.startedAt >= PENDING_BRIDGE_TTL_MS) {
          toast.dismiss(toastIdFor(bridge.txHash));
          openToastsRef.current.delete(bridge.txHash);
          removeBridge(bridge.txHash);
          continue;
        }
        // Dormant, not deleted — they may switch back to this wallet.
        if (!canActOnBridge(bridge.account, address)) continue;
        // The current API lane must still match the bridge's recorded target.
        if (!isSameDepositLane(bridge, depositLane)) continue;

        let status;
        try {
          // Loads @lifi/sdk on demand — see fetchBridgeStatus for why it is not
          // called inline.
          status = await fetchBridgeStatus(bridge);
        } catch (error) {
          // A transient status failure must not drop the record; the bridge is
          // still in flight and the funds still need depositing.
          console.error("[bridge] status check failed", error);
          continue;
        }
        if (cancelled) return;

        const outcome = interpretStatus(status, Date.now() - bridge.startedAt);
        const id = toastIdFor(bridge.txHash);

        if (outcome.kind === "pending") {
          toast.loading(
            `${t("Bridging")} ${bridge.displayAmount} ${bridge.tokenSymbol}…`,
            { id, duration: Infinity },
          );
          openToastsRef.current.add(bridge.txHash);
          continue;
        }

        if (outcome.kind === "arrived") {
          // Re-read first: another tab may have deposited this very bridge
          // while our status request was in flight.
          usePendingBridgesStore.getState().syncFromStorage();
          if (
            usePendingBridgesStore
              .getState()
              .settled.some((s) => s.txHash === bridge.txHash)
          ) {
            continue;
          }
          // busyRef only guards THIS tab. Two tabs can reach here at the same
          // moment, and two wallet prompts for one bridge is the bug.
          const ran = await withBridgeDepositLock(bridge.txHash, () =>
            handleArrived(bridge, outcome.receivedAmount),
          );
          if (!ran) continue; // another tab has it; retry next pass
          return; // one at a time; the next tick picks up any others
        }

        openToastsRef.current.delete(bridge.txHash);
        toast.error(
          outcome.kind === "failed"
            ? t("Your bridge failed. No funds were deposited.")
            : t("Your bridge did not complete as expected. Check your wallet balance."),
          { id, duration: 10000 },
        );
        console.warn("[bridge] not depositable", bridge.txHash, outcome.reason);
        // Settled, not merely removed. A failed, refunded or unresolvable
        // bridge is finished — retrying cannot change LI.FI's answer — and the
        // widget keeps the route in its own storage, so the recovery sweep
        // would re-add it every 15s and re-show this error forever.
        markSettled(bridge.txHash);
      }
    };

    void tick();
    const interval = setInterval(() => void tick(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    bridges,
    address,
    depositLane,
    t,
    handleArrived,
    removeBridge,
    markSettled,
  ]);
}
