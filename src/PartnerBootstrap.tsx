import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { loadPartnerChains } from './config/partners/loadChains';
import { useTranslation } from './hooks/useSafeTranslation';

export function PartnerBootstrap({ children, load = loadPartnerChains }: {
  children: ReactNode;
  load?: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const retryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    load().then(
      () => { if (active) setStatus('ready'); },
      () => { if (active) setStatus('error'); },
    );
    return () => { active = false; };
  }, [attempt, load]);

  useEffect(() => {
    if (status === 'error' && attempt > 0) retryRef.current?.focus();
  }, [attempt, status]);

  const screen = (
    <main className="flex min-h-dvh items-center justify-center bg-base p-6 text-content">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        {status !== 'error' ? (
          <div role="status" className="flex items-center gap-2 text-content-secondary">
            <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
            <span className="sr-only">{t('Loading supported chains…')}</span>
          </div>
        ) : (
          <>
            <p role="alert">{t('Unable to load supported chains. Please try again.')}</p>
            <button
              ref={retryRef}
              type="button"
              className="rounded bg-button-primary px-4 py-2 text-content-inverse hover:bg-button-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              onClick={() => { setStatus('loading'); setAttempt((value) => value + 1); }}
            >
              {t('Retry')}
            </button>
          </>
        )}
      </div>
    </main>
  );

  return status === 'ready' ? <Suspense fallback={screen}>{children}</Suspense> : screen;
}
