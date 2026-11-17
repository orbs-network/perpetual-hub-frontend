import { ColorType, CrosshairMode, LineStyle, TickMarkType, type DeepPartial, type ChartOptions, type Time } from 'lightweight-charts';
import type { ThemeColors } from '@/config/partners';

export function getChartOptions(theme: ThemeColors, locale: string): DeepPartial<ChartOptions> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const date = (time: Time) => new Date(typeof time === 'number' ? time * 1000
    : typeof time === 'string' ? Date.parse(time) : Date.UTC(time.year, time.month - 1, time.day));
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone, ...options });
  const labels = {
    [TickMarkType.Year]: format({ year: 'numeric' }),
    [TickMarkType.Month]: format({ month: 'short' }),
    [TickMarkType.DayOfMonth]: format({ day: 'numeric' }),
    [TickMarkType.Time]: format({ hour: '2-digit', minute: '2-digit', hour12: false }),
    [TickMarkType.TimeWithSeconds]: format({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
  };
  const crosshairDate = format({ year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  return {
    layout: {
      background: { type: ColorType.Solid, color: theme.surface },
      textColor: theme['content-secondary'],
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: 11,
      // The full notice and link are rendered by the app below the chart.
      attributionLogo: false,
      panes: { separatorColor: theme.edge, separatorHoverColor: theme.hover, enableResize: true },
    },
    grid: {
      vertLines: { color: theme['edge-subtle'], style: LineStyle.Dotted },
      horzLines: { color: theme['edge-subtle'], style: LineStyle.Dotted },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: theme['content-muted'], labelBackgroundColor: theme.raised },
      horzLine: { color: theme['content-muted'], labelBackgroundColor: theme.raised },
    },
    leftPriceScale: { visible: false },
    rightPriceScale: { borderColor: theme.edge, minimumWidth: 64, scaleMargins: { top: 0.12, bottom: 0.08 } },
    timeScale: {
      borderColor: theme.edge, timeVisible: true, secondsVisible: false, rightOffset: 8, barSpacing: 6,
      tickMarkFormatter: (time: Time, type: TickMarkType) => labels[type].format(date(time)),
    },
    localization: { locale, timeFormatter: (time: Time) => crosshairDate.format(date(time)) },
    kineticScroll: { mouse: true, touch: true },
    handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
  };
}
