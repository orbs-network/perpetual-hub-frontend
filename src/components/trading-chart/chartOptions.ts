import type { DeepPartial, Locales, Styles } from "klinecharts";
import { registerLocale } from "klinecharts";
import type { ThemeColors } from "@/config/partners";

/** All chart colours come from the active partner, including live theme previews. */
export function getChartStyles(
  theme: ThemeColors,
  fontFamily = "Inter, Arial, sans-serif",
): DeepPartial<Styles> {
  const axis = {
    axisLine: { color: theme.edge },
    tickLine: { color: theme.edge },
    tickText: {
      color: theme["content-secondary"],
      family: fontFamily,
      size: 11,
    },
  };
  const crosshair = {
    line: { color: theme["content-muted"] },
    text: {
      color: theme.content,
      backgroundColor: theme.raised,
      borderColor: theme.edge,
      family: fontFamily,
    },
  };

  return {
    grid: {
      horizontal: { color: theme["edge-subtle"] },
      vertical: { color: theme["edge-subtle"] },
    },
    candle: {
      bar: {
        upColor: theme.up,
        downColor: theme.down,
        noChangeColor: theme["content-muted"],
        upBorderColor: theme.up,
        downBorderColor: theme.down,
        noChangeBorderColor: theme["content-muted"],
        upWickColor: theme.up,
        downWickColor: theme.down,
        noChangeWickColor: theme["content-muted"],
      },
      area: {
        lineColor: theme["accent-primary"],
        backgroundColor: theme.surface,
        point: { color: theme["accent-primary"], animation: false },
      },
      priceMark: {
        high: { color: theme["content-secondary"], textFamily: fontFamily },
        low: { color: theme["content-secondary"], textFamily: fontFamily },
        last: {
          upColor: theme.up,
          downColor: theme.down,
          noChangeColor: theme["content-muted"],
          text: { color: theme["content-inverse"], family: fontFamily },
        },
      },
      tooltip: {
        title: { color: theme.content, family: fontFamily },
        legend: { color: theme["content-secondary"], family: fontFamily },
        rect: {
          color: theme["tooltip-bg"],
          borderColor: theme.edge,
        },
      },
    },
    indicator: {
      ohlc: {
        upColor: theme.up,
        downColor: theme.down,
        noChangeColor: theme["content-muted"],
      },
      bars: [
        {
          upColor: theme.up,
          downColor: theme.down,
          noChangeColor: theme["content-muted"],
        },
      ],
      tooltip: {
        title: { color: theme.content, family: fontFamily },
        legend: { color: theme["content-secondary"], family: fontFamily },
      },
    },
    xAxis: axis,
    yAxis: axis,
    separator: { color: theme.edge, activeBackgroundColor: theme.hover },
    crosshair: { horizontal: crosshair, vertical: crosshair },
    overlay: {
      line: { color: theme["accent-primary"] },
      rect: {
        borderColor: theme["accent-primary"],
        color: /^#[\da-f]{6}$/i.test(theme["accent-primary"])
          ? `${theme["accent-primary"]}18`
          : "transparent",
      },
      point: {
        color: theme.surface,
        borderColor: theme["accent-primary"],
        activeColor: theme.surface,
        activeBorderColor: theme["accent-primary"],
      },
      text: {
        color: theme.content,
        borderColor: theme.edge,
        backgroundColor: theme.raised,
        family: fontFamily,
      },
    },
  };
}

const CHART_LOCALES: Record<string, Locales> = {
  en: {
    time: "Time: ",
    open: "Open: ",
    high: "High: ",
    low: "Low: ",
    close: "Close: ",
    volume: "Volume: ",
    change: "Change: ",
    turnover: "Turnover: ",
    second: "s",
    minute: "m",
    hour: "h",
    day: "D",
    week: "W",
    month: "M",
    year: "Y",
  },
  es: {
    time: "Hora: ",
    open: "Apertura: ",
    high: "Máximo: ",
    low: "Mínimo: ",
    close: "Cierre: ",
    volume: "Volumen: ",
    change: "Cambio: ",
    turnover: "Importe: ",
    second: "s",
    minute: "m",
    hour: "h",
    day: "D",
    week: "S",
    month: "M",
    year: "A",
  },
  fr: {
    time: "Heure : ",
    open: "Ouverture : ",
    high: "Haut : ",
    low: "Bas : ",
    close: "Clôture : ",
    volume: "Volume : ",
    change: "Variation : ",
    turnover: "Montant : ",
    second: "s",
    minute: "min",
    hour: "h",
    day: "J",
    week: "S",
    month: "M",
    year: "A",
  },
  ja: {
    time: "時間：",
    open: "始値：",
    high: "高値：",
    low: "安値：",
    close: "終値：",
    volume: "出来高：",
    change: "変動：",
    turnover: "売買代金：",
    second: "秒",
    minute: "分",
    hour: "時間",
    day: "日",
    week: "週",
    month: "月",
    year: "年",
  },
  zh: {
    time: "时间：",
    open: "开：",
    high: "高：",
    low: "低：",
    close: "收：",
    volume: "成交量：",
    change: "涨幅：",
    turnover: "成交额：",
    second: "秒",
    minute: "分",
    hour: "小时",
    day: "天",
    week: "周",
    month: "月",
    year: "年",
  },
};

export function registerChartLocale(language: string): string {
  const base = language.toLowerCase().replace("_", "-").split("-")[0];
  const locale = Object.hasOwn(CHART_LOCALES, base) ? base : "en";
  const name = `perpetual-${locale}`;
  registerLocale(name, CHART_LOCALES[locale]);
  return name;
}
