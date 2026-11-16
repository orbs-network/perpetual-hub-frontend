import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useSafeTranslation";

export function PageHeader({
  action,
  align = "start",
  breadcrumbItems,
  className,
  description,
  title,
}: {
  action?: ReactNode;
  align?: "start" | "center";
  breadcrumbItems?: BreadcrumbItem[];
  className?: string;
  description?: ReactNode;
  title: ReactNode;
}) {
  const { t } = useTranslation();
  const backItem = breadcrumbItems
    ?.slice(0, -1)
    .reverse()
    .find((item) => item.href);
  const backLabel =
    typeof backItem?.label === "string"
      ? t("Back to {{page}}").replace("{{page}}", t(backItem.label))
      : t("Back");

  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-3 border-b border-edge/80 pb-4 md:flex-row md:items-center",
        align === "center" && "items-center text-center md:flex-col",
        className,
      )}
      data-testid="page-header"
    >
      <div
        className={cn(
          "min-w-0",
          align === "center" && "flex w-full flex-col items-center",
        )}
      >
        {breadcrumbItems?.length ? (
          <Breadcrumbs className="mb-2" items={breadcrumbItems} />
        ) : null}
        <div
          className={cn(
            "flex min-w-0 items-center gap-2.5",
            align === "center" && "justify-center",
          )}
        >
          {backItem?.href ? (
            <Link
              aria-label={backLabel}
              className={cn(
                buttonVariants({ size: "icon", variant: "outline" }),
                "h-8 w-8 shrink-0 rounded-md p-0",
              )}
              to={backItem.href}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          ) : null}
          <h1
            className="min-w-0 truncate text-[22px] font-semibold leading-6 text-content"
            data-testid="page-title"
          >
            {title}
          </h1>
        </div>
        {description ? (
          <div className="mt-1 max-w-3xl text-[12px] leading-5 text-content-muted">
            {description}
          </div>
        ) : null}
      </div>
      {action ? (
        <div
          className={cn(
            "flex min-w-0 flex-wrap items-center gap-2",
            align === "center" ? "justify-center" : "md:justify-end",
          )}
        >
          {action}
        </div>
      ) : null}
    </div>
  );
}
