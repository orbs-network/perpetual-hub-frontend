import { Copy } from "lucide-react";
import { toast } from "sonner";
import type { UserReferralSummaryResponse } from "@/api/referrals";
import { Button } from "@/components/ui/button";
import { partner } from "@/config/partners";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { REFERRAL_SHARE_NOTE } from "./constants";
import { buildReferralShareUrl, copyText } from "./utils";

export function ShareCodeCard({
  summary,
}: {
  summary?: UserReferralSummaryResponse;
}) {
  const { t } = useTranslation();
  const createdCode = summary?.createdCode;
  const referralUrl = createdCode ? buildReferralShareUrl(createdCode.code) : "";

  const onCopyLink = async () => {
    if (!createdCode) return;
    try {
      await copyText(referralUrl);
      toast.success(t("Link Copied"));
    } catch {
      toast.error(t("Failed To Copy Link"));
    }
  };

  if (!createdCode) return null;

  return (
    <div className="px-8 pb-10 pt-5 text-center">
      <div className="flex min-w-0 items-center justify-center gap-2">
        <a
          className="min-w-0 break-all text-[14px] font-medium leading-5 text-accent-primary underline-offset-4 hover:underline"
          href={referralUrl}
          rel="noreferrer"
          target="_blank"
        >
          {referralUrl}
        </a>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0 rounded-[4px] text-accent-primary hover:bg-accent-primary/10 hover:text-accent-primary"
          aria-label={t("Copy Link")}
          onClick={onCopyLink}
        >
          <Copy size={16} />
        </Button>
      </div>
      <p className="mx-auto mt-12 max-w-[500px] text-[14px] font-medium leading-[1.35] text-content-muted">
        <span>{t(REFERRAL_SHARE_NOTE)}</span>
        <a
          className="block text-content-muted underline-offset-4 hover:text-accent-primary hover:underline"
          href={partner.docsUrl}
          rel="noreferrer"
          target="_blank"
        >
          {t("See the Docs for more.")}
        </a>
      </p>
    </div>
  );
}
