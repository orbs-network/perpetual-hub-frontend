import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PublicDashboardShellProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  testId?: string;
};

export function PublicDashboardShell({
  children,
  className,
  innerClassName,
  testId,
}: PublicDashboardShellProps) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-1 flex-col px-3 py-8 sm:px-4 lg:px-8 lg:py-10",
        className,
      )}
      data-testid={testId}
    >
      <div
        className={cn(
          "mx-auto flex min-h-0 w-full max-w-[1312px] flex-1 flex-col gap-5",
          innerClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
