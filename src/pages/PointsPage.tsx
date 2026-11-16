import { useRef, useState } from "react";
import { toast } from "sonner";
import { partner } from "@/config/partners";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { PointsPageView } from "./points/PointsPageView";
import { downloadBlob, renderElementToPng } from "./points/shareImage";
import { usePointsDashboardData } from "./points/usePointsDashboardData";

export function PointsPage() {
  const { t } = useTranslation();
  const shareCardRef = useRef<HTMLDivElement | null>(null);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const pointsData = usePointsDashboardData();

  const saveImage = async () => {
    if (!shareCardRef.current || isSavingImage) return;

    setIsSavingImage(true);
    try {
      const blob = await renderElementToPng(shareCardRef.current);
      downloadBlob(blob, `${partner.id}-points-share.png`);
      toast.success(t("Image saved"));
    } catch {
      toast.error(t("Failed to save image"));
    } finally {
      setIsSavingImage(false);
    }
  };

  return (
    <PointsPageView
      {...pointsData}
      isSavingImage={isSavingImage}
      shareCardRef={shareCardRef}
      onSaveImage={saveImage}
    />
  );
}
