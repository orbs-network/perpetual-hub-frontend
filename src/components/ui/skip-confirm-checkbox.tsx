import { Checkbox } from "./checkbox";
import { useTranslation } from "@/hooks/useSafeTranslation";

export function SkipConfirmCheckbox({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
      />
      <span className="text-[13px] text-content-secondary">
        {t("Don't Show This Again")}
      </span>
    </label>
  );
}
