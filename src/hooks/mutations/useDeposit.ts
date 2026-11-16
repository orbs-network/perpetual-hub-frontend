import { getCollateralSymbol } from "@/utils/collateralDisplay";
import {
  useAccount,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { useMutation } from "@tanstack/react-query";
import { erc20Abi, formatUnits, padHex, type Hex } from "viem";
import { PROTOCOL_COLLATERAL_DECIMALS } from "../../config/constants";
import { useUserAccount } from "../useUserAccount";
import { toast } from "sonner";
import { isWalletAuthorizationError } from "@/lib/utils";
import { useMemo, useState } from "react";
import type { SignStep } from "@/components/ui/sign-transaction-overlay";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { useSupportedChainId } from "../useSupportedChainId";
import { useShouldSwitchToSupportedChain } from "../useSwitchToSupportedChain";
import {
  useContractAddress,
  useCollateralDecimals,
  useCollateralAddress,
} from "../useCurrentPartnerChain";
import {
  protocolToTokenAmount,
  tokenToProtocolAmount,
} from "@/utils/collateral";

type HexAddress = `0x${string}`;

const APPROVAL_ALLOWANCE_REFETCH_INTERVAL_MS = 3_000;
const APPROVAL_ALLOWANCE_TIMEOUT_MS = 60_000;
const DEPOSIT_SUCCESS_TOAST_DURATION_MS = 10_000;

const PERPETUAL_ABI = [
  {
    name: "depositForAccount",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "accountId", type: "bytes32" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

function toAccountId(address: HexAddress): Hex {
  return padHex(address, { size: 32 });
}

async function pollUntilChanged<T>(
  refetch: () => Promise<{ data: T }>,
  prevValue: T,
  { interval = 1000, maxAttempts = 30 } = {},
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, interval));
    const { data } = await refetch();
    if (data !== prevValue) return true;
  }
  return false;
}

async function waitForAllowance(
  refetchAllowance: () => Promise<{ data?: bigint }>,
  requiredAmount: bigint,
) {
  const deadline = Date.now() + APPROVAL_ALLOWANCE_TIMEOUT_MS;

  while (true) {
    const allowance = (await refetchAllowance()).data ?? 0n;
    if (allowance >= requiredAmount) return allowance;

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) return allowance;

    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.min(APPROVAL_ALLOWANCE_REFETCH_INTERVAL_MS, remainingMs),
      ),
    );
  }
}

function useDepositContracts() {
  const chainId = useSupportedChainId();
  const shouldSwitchChain = useShouldSwitchToSupportedChain();
  const collateralAddress = useCollateralAddress();
  const contractAddress = useContractAddress();
  const collateralDecimals = useCollateralDecimals();

  return useMemo(
    () => ({
      chainId,
      collateralAddress,
      contractAddress,
      collateralDecimals,
      canUseChainData: !!chainId && !!collateralAddress && !!contractAddress,
      shouldSwitchChain,
    }),
    [chainId, collateralDecimals, contractAddress, shouldSwitchChain, collateralAddress],
  );
}

// --- Query hooks ---

export function useUSDCBalance() {
  const { address } = useAccount();
  const { chainId, collateralDecimals, collateralAddress, canUseChainData } =
    useDepositContracts();

  const { data, isLoading, refetch } = useReadContract({
    address: collateralAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: {
      enabled: !!address && !!chainId && canUseChainData,
      refetchInterval: 20_000,
    },
  });
  const rawBalance = canUseChainData ? data ?? 0n : 0n;
  const balance = tokenToProtocolAmount(rawBalance, collateralDecimals);

  return {
    balance,
    rawBalance,
    balanceFormatted: balance
      ? formatUnits(balance, PROTOCOL_COLLATERAL_DECIMALS)
      : "0",
    isLoading: !chainId || (canUseChainData && isLoading),
    refetch,
  };
}

export function useAllowance() {
  const { address } = useAccount();
  const { chainId, collateralAddress, contractAddress, canUseChainData } =
    useDepositContracts();

  return useReadContract({
    address: collateralAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && contractAddress ? [address, contractAddress] : undefined,
    chainId,
    query: {
      enabled: !!address && canUseChainData,
      refetchInterval: 20_000,
      staleTime: 20_000,
    },
  });
}

export function useContractBalance() {
  const {
    chainId,
    collateralDecimals,
    collateralAddress,
    contractAddress,
    canUseChainData,
  } = useDepositContracts();
  const { data, isLoading, refetch } = useReadContract({
    address: collateralAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: contractAddress ? [contractAddress] : undefined,
    chainId,
    query: {
      enabled: canUseChainData,
      refetchInterval: 20_000,
    },
  });
  const rawBalance = canUseChainData ? data ?? 0n : 0n;
  const balance = tokenToProtocolAmount(rawBalance, collateralDecimals);

  return {
    balance,
    rawBalance,
    balanceFormatted: balance
      ? formatUnits(balance, PROTOCOL_COLLATERAL_DECIMALS)
      : "0",
    isLoading: !chainId || (canUseChainData && isLoading),
    refetch,
    isTotalDeposits: true,
  };
}



function useApproveUSDC() {
  const { t } = useTranslation();
  const { writeContractAsync } = useWriteContract();
  const {
    chainId,
    collateralAddress,
    contractAddress,
    shouldSwitchChain,
  } = useDepositContracts();
  const publicClient = usePublicClient({ chainId });

  return useMutation({
    mutationFn: async ({ amount, toastId }: { amount: bigint; toastId: string | number }) => {
      if (!chainId || !collateralAddress || !contractAddress) {
        throw new Error(t("Wallet chain is still loading"));
      }
      if (shouldSwitchChain) {
        throw new Error(t("Switch to supported chain first"));
      }
      if (!publicClient) throw new Error("Public RPC client not connected");
      const hash = await writeContractAsync({
        address: collateralAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [contractAddress, amount],
        chainId,
      });
      toast.loading(t("Approval Pending"), { id: toastId});
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new Error("Approval transaction reverted");
      }
    },
  });
}

export function useDepositFlow() {
  const { t } = useTranslation();
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const { writeContractAsync } = useWriteContract();
  const {
    chainId,
    collateralDecimals,
    contractAddress,
    shouldSwitchChain,
  } = useDepositContracts();
  const { refetch: refetchUSDC, rawBalance: usdcBalance } = useUSDCBalance();
  const { refetch: refetchContractBalance } = useContractBalance();
  const { data: userAccount, refetch: refetchUserAccount } = useUserAccount();
  const { mutateAsync: approveUSDC } = useApproveUSDC();
  const publicClient = usePublicClient({ chainId });
  const { refetch: refetchAllowance } = useAllowance();
  const [steps, setSteps] = useState<SignStep[]>([]);

  const mutation = useMutation({
    mutationFn: async ({
      amount,
      onSuccess,
    }: {
      amount: bigint;
      onSuccess: () => void;
    }) => {
      if (!address) throw new Error("Wallet not connected");
      if (!chainId) {
        throw new Error(t("Wallet chain is still loading"));
      }
      if (!contractAddress) {
        throw new Error(t("Contract address is still loading"));
      }
      if (shouldSwitchChain) {
        throw new Error(t("Switch to supported chain first"));
      }
      const tokenAmount = protocolToTokenAmount(amount, collateralDecimals);
      if (usdcBalance < tokenAmount) throw new Error(`Insufficient ${getCollateralSymbol()} balance`);
      if (!publicClient) throw new Error("Public RPC client not connected");
      // Single toast for the entire flow
      const toastId = "wallet-flow"
      const previousAccountBalance =
        userAccount?.accountSummary?.balance ?? 0n;

      try {
        // A cached allowance may have been consumed or revoked since the last poll.
        const { data: allowance } = await refetchAllowance({ throwOnError: true });
        if (allowance === undefined) {
          throw new Error("Token allowance is unavailable");
        }
        const needsApproval = allowance < tokenAmount;
        const approveStep: SignStep = { label: t("Approve {{collateralSymbol}}", { collateralSymbol: getCollateralSymbol() }), status: "pending" };
        const depositStep: SignStep = { label: t("Deposit {{collateralSymbol}}", { collateralSymbol: getCollateralSymbol() }), status: "pending" };
        setSteps(needsApproval ? [approveStep, depositStep] : [depositStep]);

        // Step 1: Approve (if needed)
        if (needsApproval) {
          setSteps([{ ...approveStep, status: "active" }, depositStep]);
          await approveUSDC({ amount: tokenAmount, toastId });

          const verifiedAllowance = await waitForAllowance(
            () => refetchAllowance({ throwOnError: true }),
            tokenAmount,
          );
          if (verifiedAllowance < tokenAmount) {
            throw new Error("Approval confirmed but allowance is still insufficient");
          }
          setSteps([{ ...approveStep, status: "done" }, { ...depositStep, status: "active" }]);
        } else {
          setSteps([{ ...depositStep, status: "active" }]);
        }

        // Step 2: Deposit
        toast.loading(t("Proceed in wallet"), { id: toastId })
        const depositHash = await writeContractAsync({
          address: contractAddress,
          abi: PERPETUAL_ABI,
          functionName: "depositForAccount",
          // The unchanged rollup contract accepts and records token-native
          // units. TEE normalization happens after this raw event is observed.
          args: [toAccountId(address), tokenAmount],
          chainId,
        });
        toast.loading(t("Deposit Pending"), { id: toastId});
        const receipt = await publicClient.waitForTransactionReceipt({ hash: depositHash });
        if (receipt.status !== "success") {
          throw new Error("Deposit transaction reverted");
        }
        onSuccess();
        toast.loading(t("Deposit confirmed. Updating your balance..."), {
          id: toastId,
        });

        const balanceUpdated = await pollUntilChanged(async () => {
          const result = await refetchUserAccount();
          return { data: result.data?.accountSummary?.balance ?? 0n };
        }, previousAccountBalance);

        await Promise.all([refetchUSDC(), refetchContractBalance()]);

        toast.success(
          t(
            balanceUpdated
              ? "Your balance has been updated."
              : "Deposit confirmed. Your balance is still updating.",
          ),
          {
            id: toastId,
            duration: DEPOSIT_SUCCESS_TOAST_DURATION_MS,
          },
        );
      } catch (err) {
        if (isWalletAuthorizationError(err)) {
          disconnect();
        }
        toast.error(t("Deposit failed"), { id: toastId, duration: 6000 });
        setSteps([]);
        throw err;
      }
    },
  });

  return { ...mutation, steps };
}
