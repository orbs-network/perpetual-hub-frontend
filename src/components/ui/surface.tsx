import { cn } from "@/lib/utils";
import  { type ReactNode } from "react";

function Surface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(`bg-surface rounded-lg p-[10px] ${className}`)}>{children}</div>
  );
}

export default Surface;
