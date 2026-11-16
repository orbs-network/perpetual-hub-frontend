import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { toast } from "sonner";
import { useSignTypedData } from "wagmi";
import {
  checkReferralCode,
  createReferralCode,
  normalizePartnerId,
  normalizeReferralCode,
} from "@/api/referrals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { partner } from "@/config/partners";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { useCurrentPartnerChain } from "@/hooks/useCurrentPartnerChain";
import { buildCreateReferralCodeTypedData } from "@/utils/signing";
import type { WalletAddress } from "./types";
import { isTradingNotEnabledError, isValidReferralCode } from "./utils";

const REFERRAL_CODE_EXISTS_MESSAGE = "Referral Code Already Exists";

function generateReferralCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("").toUpperCase();
}

export function CreateCodeForm({
  address,
  code,
  setCode,
  onCreated,
  onTradingNotEnabled,
}: {
  address: WalletAddress;
  code: string;
  setCode: (code: string) => void;
  onCreated: () => void;
  onTradingNotEnabled: () => void;
}) {
  const { t } = useTranslation();
  const { signTypedDataAsync } = useSignTypedData();
  const { chainId } = useCurrentPartnerChain();
  const [error, setError] = useState("");
  const autoGenerateCode = partner.featureFlags?.autoGenerateReferralCode === true;

  const mutation = useMutation({
    mutationFn: async (requestedCode: string) => {
      let normalizedCode = requestedCode;
      const partnerId = normalizePartnerId(partner.id);
      if (!isValidReferralCode(normalizedCode)) {
        throw new Error(
          t("Code Must Use 1-30 Letters, Numbers, Underscores, Or Dashes"),
        );
      }
      const maxAttempts = autoGenerateCode ? 3 : 1;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const existingCode = await checkReferralCode(partnerId, normalizedCode);
        if (!existingCode.valid) break;
        if (attempt === maxAttempts - 1) {
          throw new Error(t(REFERRAL_CODE_EXISTS_MESSAGE));
        }
        normalizedCode = generateReferralCode();
      }
      const timestamp = Date.now();
      const signature = await signTypedDataAsync(
        buildCreateReferralCodeTypedData({
          user: address,
          partnerId,
          code: normalizedCode,
          timestamp: BigInt(timestamp),
          chainId,
        }),
      );
      return createReferralCode({
        partnerId,
        user: address,
        code: normalizedCode,
        timestamp,
        signature,
      });
    },
    onSuccess: () => {
      setCode("");
      setError("");
      onCreated();
      toast.success(t("Referral Code Created"));
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : t("Failed To Create Code");
      if (isTradingNotEnabledError(message)) {
        setError("");
        onTradingNotEnabled();
        return;
      }
      setError(message);
      if (message === t(REFERRAL_CODE_EXISTS_MESSAGE)) {
        return;
      }
      toast.error(t("Failed To Create Code"));
    },
  });

  return (
    <form
      className="space-y-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (mutation.isPending) return;
        mutation.mutate(
          autoGenerateCode ? generateReferralCode() : normalizeReferralCode(code),
        );
      }}
    >
      {!autoGenerateCode ? (
        <>
          <label
            htmlFor="create-referral-code"
            className="block text-[12px] font-semibold text-content-muted"
          >
            {t("Create Code")}
          </label>
          <Input
            id="create-referral-code"
            value={code}
            onChange={(event) => {
              setCode(event.target.value.toUpperCase());
              setError("");
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
        </>
      ) : null}
      {error ? <div className="text-[12px] text-down">{error}</div> : null}
      <Button
        type="submit"
        className="w-full"
        loading={mutation.isPending}
        disabled={mutation.isPending || (!autoGenerateCode && !code.trim())}
      >
        <Gift size={15} />
        {t("Sign And Create")}
      </Button>
    </form>
  );
}
