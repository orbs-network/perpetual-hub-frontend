import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { useSignTypedData } from "wagmi";
import {
  linkReferralCode,
  normalizePartnerId,
  normalizeReferralCode,
} from "@/api/referrals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { partner } from "@/config/partners";
import { useCurrentPartnerChain } from "@/hooks/useCurrentPartnerChain";
import { useLatestRef } from "@/hooks/useLatestRef";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { buildLinkReferralCodeTypedData } from "@/utils/signing";
import type { WalletAddress } from "./types";
import { isValidReferralCode } from "./utils";

export function LinkCodeForm({
  address,
  initialCode,
  onLinked,
}: {
  address: WalletAddress;
  initialCode: string;
  onLinked: () => void;
}) {
  const { t } = useTranslation();
  const { signTypedDataAsync } = useSignTypedData();
  const { chainId } = useCurrentPartnerChain();
  const addressRef = useLatestRef(address);
  const [code, setCode] = useState(initialCode);

  const mutation = useMutation({
    mutationFn: async (normalizedCode: string) => {
      const partnerId = normalizePartnerId(partner.id);
      const timestamp = Date.now();
      const signature = await signTypedDataAsync(
        buildLinkReferralCodeTypedData({
          user: address,
          partnerId,
          code: normalizedCode,
          timestamp: BigInt(timestamp),
          chainId,
        }),
      );
      if (addressRef.current.toLowerCase() !== address.toLowerCase()) {
        throw new Error(t("Wallet Changed While Signing Referral"));
      }
      return linkReferralCode({
        partnerId,
        user: address,
        code: normalizedCode,
        timestamp,
        signature,
      });
    },
    onSuccess: () => {
      onLinked();
      toast.success(t("Referral Code Linked"));
    },
    onError: () => {
      toast.error(t("Failed To Link Code"));
    },
  });

  const normalizedCode = normalizeReferralCode(code);

  return (
    <form
      className="space-y-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!isValidReferralCode(normalizedCode)) {
          const message = t(
            "Code Must Use 1-30 Letters, Numbers, Underscores, Or Dashes",
          );
          toast.error(t("Failed To Link Code"), { description: message });
          return;
        }
        mutation.mutate(normalizedCode);
      }}
    >
      <label
        htmlFor="link-referral-code"
        className="block text-[12px] font-semibold text-content-muted"
      >
        {t("Invite Code")}
      </label>
      <Input
        id="link-referral-code"
        value={code}
        onChange={(event) => {
          setCode(event.target.value.toUpperCase());
        }}
        type="text"
        placeholder={t("Referral Code")}
        maxLength={30}
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        data-1p-ignore="true"
        data-bwignore="true"
        data-form-type="other"
        data-lpignore="true"
        spellCheck={false}
      />
      <Button
        type="submit"
        variant="secondary"
        className="w-full"
        loading={mutation.isPending}
        disabled={!code.trim()}
      >
        <Link2 size={15} />
        {t("Link Code")}
      </Button>
    </form>
  );
}
