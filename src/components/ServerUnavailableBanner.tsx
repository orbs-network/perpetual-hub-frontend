import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Clock3, WifiOff } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { isPartnerApprovalPending } from '@/config/partners/availability';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useMarkets } from '@/hooks/useMarkets';
import { useTranslation } from '@/hooks/useSafeTranslation';
import { Button } from './ui/button';

import {
  SERVER_AVAILABLE_EVENT,
  SERVER_UNAVAILABLE_EVENT,
} from "@/lib/serverAvailability";

/** Reserve mobile status space; keep approval and service connectivity independent. */
export function ServerUnavailableBanner() {
  const [unavailable, setUnavailable] = useState(false);
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const pending = isPartnerApprovalPending();
  const markets = useMarkets();
  const queryClient = useQueryClient();
  const connectionError = unavailable || markets.hasServiceError;
  const showStatus = (isMobile && pending) || connectionError;
  const bannerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onUnavailable = () => setUnavailable(true);
    const onAvailable = () => setUnavailable(false);
    window.addEventListener(SERVER_UNAVAILABLE_EVENT, onUnavailable);
    window.addEventListener(SERVER_AVAILABLE_EVENT, onAvailable);
    return () => {
      window.removeEventListener(SERVER_UNAVAILABLE_EVENT, onUnavailable);
      window.removeEventListener(SERVER_AVAILABLE_EVENT, onAvailable);
    };
  }, []);

  useLayoutEffect(() => {
    const banner = bannerRef.current;
    const shell = banner?.closest<HTMLElement>('[data-testid="app-shell"]');
    if (!banner || !shell) return;
    const measure = () => {
      shell.style.setProperty('--app-status-height', `${banner.getBoundingClientRect().height}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(banner);
    return () => {
      observer.disconnect();
      shell.style.removeProperty('--app-status-height');
    };
  }, [showStatus]);

  if (!showStatus) return null;

  return (
    <section ref={bannerRef} role="status" aria-live="polite"
      className="sticky top-[var(--app-header-height)] z-40 shrink-0 border-b border-edge bg-surface text-content"
      data-testid="app-availability-status">
      {isMobile && pending && <div className="flex items-center gap-2 px-3 py-2 text-xs" data-testid="mobile-activation-status">
        <Clock3 aria-hidden="true" size={16} className="shrink-0 text-accent-primary" />
        <p>{t('Waiting for dPERPS team activation.')}</p>
      </div>}
      {connectionError && <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 border-t border-edge px-3 py-2 text-xs" data-testid="trading-connection-error">
        <WifiOff aria-hidden="true" size={16} className="shrink-0 text-content-secondary" />
        <p>{t('Unable to reach trading services.')}</p>
        <Button variant="outline" size="xs"
          onClick={() => {
            if (markets.hasServiceError) void markets.refetch();
            else void queryClient.invalidateQueries({ type: 'active' });
          }}>
          {t('Retry')}
        </Button>
      </div>}
    </section>
  );
}
