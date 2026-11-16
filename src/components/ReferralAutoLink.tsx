import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAccount, useSignTypedData } from "wagmi";
import {
  getUserReferralSummary,
  linkReferralCode,
  normalizePartnerId,
  normalizeReferralCode,
} from "@/api/referrals";
import { partner } from "@/config/partners";
import {
  hasAcceptedTermsInState,
  useFirstInteractionStore,
} from "@/stores/firstInteractionStore";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { useCurrentPartnerChain } from "@/hooks/useCurrentPartnerChain";
import { useLatestRef } from "@/hooks/useLatestRef";
import { buildLinkReferralCodeTypedData } from "@/utils/signing";
import { ReferralJoinModal } from "./referral/ReferralJoinModal";

const REFERRAL_CODE_RE = /^[A-Z0-9_-]{1,30}$/;
const REFERRAL_QUERY_PARAM = "ref";

function useReferralCodeParam() {
  const location = useLocation();
  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    const code = normalizeReferralCode(params.get(REFERRAL_QUERY_PARAM) ?? "");
    return REFERRAL_CODE_RE.test(code) ? code : "";
  }, [location.search]);
}

function stripReferralCodeParam(search: string) {
  const params = new URLSearchParams(search);
  if (!params.has(REFERRAL_QUERY_PARAM)) return search;

  params.delete(REFERRAL_QUERY_PARAM);
  const nextSearch = params.toString();
  return nextSearch ? `?${nextSearch}` : "";
}

export function ReferralAutoLink() {
  const { t } = useTranslation();
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { chainId } = useCurrentPartnerChain();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dismissedPromptKeys, setDismissedPromptKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const code = useReferralCodeParam();
  const partnerId = normalizePartnerId(partner.id);
  const walletAddress = address;
  const walletAddressRef = useLatestRef(walletAddress);
  const hasAcceptedTerms = useFirstInteractionStore((state) =>
    hasAcceptedTermsInState(state.termsAcceptances, walletAddress),
  );
  const clearReferralCodeParam = useCallback(() => {
    const nextSearch = stripReferralCodeParam(location.search);
    if (nextSearch === location.search) return;

    navigate(
      {
        pathname: location.pathname,
        search: nextSearch,
        hash: location.hash,
      },
      { replace: true },
    );
  }, [location.hash, location.pathname, location.search, navigate]);

  const { data: referralSummary, isFetching: isReferralSummaryFetching } =
    useQuery({
      queryKey: ["referralSummary", partnerId, walletAddress],
      queryFn: ({ signal }) =>
        getUserReferralSummary(partnerId, walletAddress!, signal),
      enabled: !!walletAddress && !!code,
      retry: 1,
    });

  const { mutate: linkCode, isPending } = useMutation({
    mutationFn: async (targetCode: string) => {
      if (!walletAddress || !targetCode) {
        throw new Error(t("Wallet or referral code is not ready"));
      }
      const timestamp = Date.now();
      const signature = await signTypedDataAsync(
        buildLinkReferralCodeTypedData({
          user: walletAddress,
          partnerId,
          code: targetCode,
          timestamp: BigInt(timestamp),
          chainId,
        }),
      );
      if (walletAddressRef.current?.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error(t("Wallet Changed While Signing Referral"));
      }
      await linkReferralCode({
        partnerId,
        user: walletAddress,
        code: targetCode,
        timestamp,
        signature,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["referralSummary", partnerId, walletAddress],
      });
      clearReferralCodeParam();
      toast.success(t("Referral Code Linked"));
    },
    onError: () => {
      toast.error(t("Failed To Link Code"));
    },
  });

  const promptKey = useMemo(() => {
    if (!walletAddress || !code) return "";
    if (!hasAcceptedTerms) return "";
    return `${partnerId}:${walletAddress.toLowerCase()}:${code}`;
  }, [code, partnerId, hasAcceptedTerms, walletAddress]);
  const confirmCode = promptKey ? code : "";
  const joinDismissKey = promptKey ? `join:${promptKey}` : "";
  const showJoinPrompt =
    !!confirmCode &&
    !isReferralSummaryFetching &&
    !dismissedPromptKeys.has(joinDismissKey);
  const handleOpenChange = (open: boolean) => {
    if (open || isPending) return;

    if (!joinDismissKey) return;

    clearReferralCodeParam();
    setDismissedPromptKeys((previous) => {
      if (previous.has(joinDismissKey)) return previous;
      const next = new Set(previous);
      next.add(joinDismissKey);
      return next;
    });
  };

  return (
    <ReferralJoinModal
      code={confirmCode}
      isJoining={isPending}
      linkedCode={referralSummary?.linkedCode?.code}
      onJoin={() => linkCode(confirmCode)}
      onOpenChange={handleOpenChange}
      open={showJoinPrompt}
    />
  );
}
