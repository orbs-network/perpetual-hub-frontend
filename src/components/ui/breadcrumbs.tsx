import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: ReactNode;
  href?: string;
};

type BreadcrumbsProps = {
  className?: string;
  items: BreadcrumbItem[];
};

export function Breadcrumbs({ className, items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-[12px] text-content/65">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li
              key={item.href ?? String(item.label)}
              className="flex min-w-0 items-center gap-1"
            >
              {item.href && !isLast ? (
                <Link
                  className="min-w-0 truncate underline-offset-4 transition-colors hover:text-content hover:underline focus-visible:text-content focus-visible:underline"
                  to={item.href}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={cn(
                    "min-w-0 truncate",
                    isLast && "font-medium",
                  )}
                >
                  {item.label}
                </span>
              )}
              {!isLast ? (
                <ChevronRight
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0"
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
