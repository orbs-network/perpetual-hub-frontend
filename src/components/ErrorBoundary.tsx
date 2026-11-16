import type { ErrorInfo, ReactNode } from "react";
import {
  ErrorBoundary as ReactErrorBoundary,
  type FallbackProps,
} from "react-error-boundary";
import i18n from "@/i18n";
import { safeTranslate } from "@/hooks/useSafeTranslation";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  resetKey?: string;
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(String(error));
}

function handleError(error: unknown, info: ErrorInfo) {
  const normalizedError = normalizeError(error);
  console.error("[ErrorBoundary]", normalizedError, info.componentStack);
}

function DefaultErrorFallback({ resetErrorBoundary }: FallbackProps) {
  const translate = typeof i18n?.t === "function"
    ? i18n.t.bind(i18n)
    : undefined;
  const t = safeTranslate(translate, undefined);

  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center space-y-2">
        <p className="text-sm text-content-muted">
          {t("Something Went Wrong")}
        </p>
        <button
          onClick={() => resetErrorBoundary()}
          className="rounded-lg border border-edge bg-input-bg px-3 py-1.5 text-xs text-content-secondary transition-colors hover:bg-raised"
        >
          {t("Try again")}
        </button>
      </div>
    </div>
  );
}

export function ErrorBoundary({ children, fallback, resetKey }: Props) {
  const resetKeys = resetKey === undefined ? undefined : [resetKey];

  if (fallback !== undefined) {
    return (
      <ReactErrorBoundary
        fallback={fallback}
        onError={handleError}
        resetKeys={resetKeys}
      >
        {children}
      </ReactErrorBoundary>
    );
  }

  return (
    <ReactErrorBoundary
      FallbackComponent={DefaultErrorFallback}
      onError={handleError}
      resetKeys={resetKeys}
    >
      {children}
    </ReactErrorBoundary>
  );
}
