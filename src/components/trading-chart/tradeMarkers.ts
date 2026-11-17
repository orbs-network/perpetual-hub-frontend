import type { SeriesMarker, Time, UTCTimestamp } from 'lightweight-charts';
import type { ThemeColors } from '@/config/partners';
import type { ChartTradeMarker } from '@/lib/chartTradeMarkers';
import type { ChartPeriod } from '@/lib/chart/model';

export function periodToResolution(period: ChartPeriod): string {
  switch (period.type) {
    case 'minute': return String(period.span);
    case 'hour': return String(period.span * 60);
    case 'day': return `${period.span}D`;
    case 'week': return `${period.span}W`;
    case 'month': return `${period.span}M`;
    default: return '60';
  }
}

export function toSeriesMarkers(markers: ChartTradeMarker[], theme: ThemeColors): SeriesMarker<Time>[] {
  return [...markers].sort((a, b) => a.displayTime - b.displayTime || a.stackIndex - b.stackIndex)
    .map(marker => ({
      id: `trade-${marker.id}`,
      time: marker.displayTime as UTCTimestamp,
      position: marker.side === 'BUY' ? 'atPriceBottom' : 'atPriceTop',
      price: marker.displayPrice,
      color: marker.side === 'BUY' ? theme.up : theme.down,
      shape: marker.side === 'BUY' ? 'arrowUp' : 'arrowDown',
      text: marker.label,
    }));
}
