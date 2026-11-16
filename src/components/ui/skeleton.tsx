import { useEffect, useState, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded bg-content-muted/20", className)}
      {...props}
    />
  );
}

function SkeletonContainer({
  isLoading,
  children,
  className,
  loaderClassName,
  loader
}: {
  isLoading: boolean;
  children: ReactNode;
  className?: string;
  loaderClassName?: string;
  loader?: ReactNode;
}) {
  const [isContentVisible, setIsContentVisible] = useState(!isLoading);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIsContentVisible(!isLoading);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isLoading]);

  return (
    <div className={cn("relative h-full", className)}>
      <div
        className={cn(
          isLoading
            ? "invisible opacity-0"
            : "transition-opacity duration-200 ease-out",
          !isLoading && (isContentVisible ? "opacity-100" : "opacity-0"),
        )}
      >
        {children}
      </div>
      {isLoading && (
        loader ?? <Skeleton className={cn("absolute inset-0 h-full rounded-lg", loaderClassName)} />
      )}
    </div>
  );
}

export { Skeleton, SkeletonContainer };
