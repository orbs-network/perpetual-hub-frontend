import type { ReactNode } from "react";
import SurfaceSeparator from "./ui/surface-separator";

export const APP_HEADER_HEIGHT_CLASS_NAME =
  "[--app-header-height:57px] min-[1000px]:[--app-header-height:52px]";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div
      className={`relative flex min-h-[100vh] flex-col pt-[var(--app-header-height)] ${APP_HEADER_HEIGHT_CLASS_NAME}`}
      data-testid="app-shell"
    >
      {children}
    </div>
  );
}

export function AppHeaderShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="fixed inset-x-0 top-0 z-50 h-[var(--app-header-height)] flex-shrink-0"
      data-testid="app-header-shell"
    >
      <div className="flex w-full flex-col">
        {children}
        <SurfaceSeparator direction="horizontal" />
      </div>
    </div>
  );
}
