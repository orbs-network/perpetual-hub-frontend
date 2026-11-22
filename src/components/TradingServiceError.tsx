import { WifiOff } from 'lucide-react';
import { useMarkets } from '@/hooks/useMarkets';
import { useTranslation } from '@/hooks/useSafeTranslation';
import { Button } from './ui/button';

/** A failed public/config read is separate from the partner's activation state. */
export function TradingServiceError() {
  const { t } = useTranslation();
  const { refetch } = useMarkets();
  return (
    <div role="status" className="flex h-full min-h-[160px] w-full flex-col items-center justify-center gap-3 bg-surface p-4 text-center text-content" data-testid="trading-service-error">
      <WifiOff aria-hidden="true" size={22} className="shrink-0 text-content-secondary" />
      <p className="text-sm font-medium">{t('Market data is unavailable.')}</p>
      <p className="max-w-sm text-xs text-content-secondary">{t('Try again to load market data. Trading activation is separate.')}</p>
      <Button variant="outline" onClick={() => { void refetch(); }}>
        {t('Retry')}
      </Button>
    </div>
  );
}
