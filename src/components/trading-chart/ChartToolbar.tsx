import { useEffect, useRef, useState, type RefObject } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  Check,
  ChevronDown,
  LockKeyhole,
  Maximize,
  Minimize,
  Pencil,
  SlidersHorizontal,
  Trash2,
  UnlockKeyhole,
  X,
} from "lucide-react";
import {
  getSupportedIndicators,
  getSupportedOverlays,
  type CandleType,
  type Chart,
  type Indicator,
  type Period,
} from "klinecharts";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { InlineSelect } from "@/components/ui/inline-select";
import { registerChartDrawingTools } from "./drawingTools";
import {
  CHART_PERIODS,
  CHART_TYPES,
  DRAWING_TOOLS,
  MAIN_PANE_INDICATORS,
  USER_DRAWING_GROUP,
  periodKey,
} from "./toolbarOptions";

const controlClass =
  "h-8 shrink-0 rounded px-2 text-[11px] text-content-secondary hover:bg-hover hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary disabled:cursor-not-allowed disabled:opacity-40";
const selectClass =
  "h-8 max-w-[132px] gap-1.5 rounded px-2 py-0 text-[11px] font-normal hover:bg-hover focus-visible:bg-hover focus-visible:text-content data-[state=open]:bg-hover";
const menuClass =
  "z-50 max-h-[min(420px,70dvh)] w-64 overflow-y-auto rounded border border-edge bg-raised p-2 text-xs text-content shadow-modal outline-none";

type IndicatorSummary = Pick<Indicator, "id" | "name" | "calcParams">;

export interface ChartToolbarProps {
  chart: Chart | null;
  period: Period;
  onPeriodChange: (period: Period) => void;
  containerRef: RefObject<HTMLDivElement | null>;
  isMobile: boolean;
  symbol: string;
}

export function ChartToolbar({
  chart,
  period,
  onPeriodChange,
  containerRef,
  isMobile,
  symbol,
}: ChartToolbarProps) {
  const { t } = useTranslation();
  const [chartType, setChartType] = useState<CandleType>("candle_solid");
  const [indicators, setIndicators] = useState<IndicatorSummary[]>([]);
  const [indicatorSearch, setIndicatorSearch] = useState("");
  const [indicatorError, setIndicatorError] = useState("");
  const [drawingSelection, setDrawingSelection] = useState<{
    name: string;
    chart: Chart;
    symbol: string;
  } | null>(null);
  const [drawingsOpen, setDrawingsOpen] = useState(false);
  const [drawingsLocked, setDrawingsLocked] = useState(false);
  const [fullscreenContainer, setFullscreenContainer] =
    useState<HTMLElement | null>(null);
  const [controlError, setControlError] = useState("");
  const activeDrawingRef = useRef<string | null>(null);
  const drawingsLockedRef = useRef(false);
  const drawingName =
    drawingSelection?.chart === chart && drawingSelection.symbol === symbol
      ? drawingSelection.name
      : null;

  useEffect(() => {
    registerChartDrawingTools();
  }, []);

  useEffect(() => {
    chart?.setStyles({ candle: { type: chartType } });
  }, [chart, chartType]);

  useEffect(() => {
    const handleFullscreen = () => {
      setFullscreenContainer(
        document.fullscreenElement === containerRef.current
          ? containerRef.current
          : null,
      );
      chart?.resize();
    };
    document.addEventListener("fullscreenchange", handleFullscreen);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreen);
  }, [chart, containerRef]);

  useEffect(() => {
    const cancelDrawing = (event: KeyboardEvent) => {
      const id = activeDrawingRef.current;
      if (event.key !== "Escape" || !id) return;
      chart?.removeOverlay({ id, groupId: USER_DRAWING_GROUP });
      activeDrawingRef.current = null;
      setDrawingSelection(null);
    };
    document.addEventListener("keydown", cancelDrawing);
    return () => {
      document.removeEventListener("keydown", cancelDrawing);
      if (activeDrawingRef.current)
        chart?.removeOverlay({
          id: activeDrawingRef.current,
          groupId: USER_DRAWING_GROUP,
        });
      activeDrawingRef.current = null;
    };
  }, [chart, symbol]);

  const refreshIndicators = () => {
    setIndicators(
      chart
        ?.getIndicators()
        .map(({ id, name, calcParams }) => ({ id, name, calcParams })) ?? [],
    );
    setIndicatorError("");
  };

  const toggleIndicator = (name: string) => {
    if (!chart) return;
    const existing = chart.getIndicators({ name });
    if (existing.length > 0) {
      existing.forEach(({ id }) => chart.removeIndicator({ id }));
    } else {
      chart.createIndicator(
        MAIN_PANE_INDICATORS.has(name)
          ? { name, paneId: "candle_pane" }
          : { name },
        true,
      );
    }
    refreshIndicators();
  };

  const updateParameters = (indicator: IndicatorSummary, text: string) => {
    const values = text.split(",").map((value) => Number(value.trim()));
    if (
      !text.trim() ||
      values.some((value) => !Number.isFinite(value) || value <= 0)
    ) {
      setIndicatorError(
        t("Enter positive indicator parameters separated by commas."),
      );
      return;
    }
    chart?.overrideIndicator({
      id: indicator.id,
      name: indicator.name,
      calcParams: values,
    });
    refreshIndicators();
  };

  const startDrawing = (name: string) => {
    if (!chart) return;
    if (activeDrawingRef.current) {
      chart.removeOverlay({
        id: activeDrawingRef.current,
        groupId: USER_DRAWING_GROUP,
      });
    }
    const id = chart.createOverlay({
      name,
      paneId: "candle_pane",
      groupId: USER_DRAWING_GROUP,
      onDrawEnd: ({ overlay }) => {
        if (activeDrawingRef.current === overlay.id) {
          activeDrawingRef.current = null;
          setDrawingSelection(null);
        }
        if (drawingsLockedRef.current)
          chart.overrideOverlay({ id: overlay.id, lock: true });
      },
    });
    activeDrawingRef.current = typeof id === "string" ? id : null;
    setDrawingSelection(
      typeof id === "string" ? { name, chart, symbol } : null,
    );
    setDrawingsOpen(false);
  };

  const toggleDrawingLock = () => {
    const lock = !drawingsLocked;
    chart?.overrideOverlay({ groupId: USER_DRAWING_GROUP, lock });
    drawingsLockedRef.current = lock;
    setDrawingsLocked(lock);
  };

  const removeDrawings = () => {
    chart?.removeOverlay({ groupId: USER_DRAWING_GROUP });
    activeDrawingRef.current = null;
    setDrawingSelection(null);
  };

  const toggleFullscreen = async () => {
    setControlError("");
    try {
      if (document.fullscreenElement === containerRef.current) {
        await document.exitFullscreen();
      } else {
        await containerRef.current?.requestFullscreen();
      }
    } catch {
      setControlError(t("Fullscreen is unavailable in this browser."));
    }
  };

  const selectedPeriod = periodKey(period);
  const fullscreen = fullscreenContainer !== null;
  const menuContainer = fullscreenContainer ?? undefined;
  const supportedIndicators = getSupportedIndicators().filter((name) =>
    name.toLowerCase().includes(indicatorSearch.toLowerCase()),
  );
  const supportedDrawings = new Set(getSupportedOverlays());

  return (
    <div
      className="relative z-20 flex h-11 min-w-0 shrink-0 items-center border-b border-edge bg-surface px-1"
      role="toolbar"
      aria-label={t("Chart controls")}
    >
      <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CHART_PERIODS.filter(({ label }) =>
          ["5m", "1h", "1D"].includes(label),
        ).map(({ label, period: option }) => (
          <button
            key={label}
            type="button"
            className={`${controlClass} ${selectedPeriod === periodKey(option) ? "bg-hover text-accent-primary" : ""}`}
            aria-label={`${t("Timeframe")} ${label}`}
            aria-pressed={selectedPeriod === periodKey(option)}
            onClick={() => onPeriodChange(option)}
          >
            {label}
          </button>
        ))}
        <InlineSelect
          ariaLabel={t("Chart timeframe")}
          triggerClassName={selectClass}
          contentClassName="min-w-24 overscroll-contain text-xs motion-reduce:animate-none"
          contentContainer={menuContainer}
          value={selectedPeriod}
          options={CHART_PERIODS.map(({ label, period: option }) => ({
            value: periodKey(option),
            label,
          }))}
          onValueChange={(value) => {
            const option = CHART_PERIODS.find(
              ({ period: option }) => periodKey(option) === value,
            );
            if (option) onPeriodChange(option.period);
          }}
        />
        <span className="mx-1 h-4 w-px shrink-0 bg-edge" aria-hidden="true" />
        <InlineSelect
          ariaLabel={t("Chart type")}
          triggerClassName={selectClass}
          contentClassName="min-w-36 overscroll-contain text-xs motion-reduce:animate-none"
          contentContainer={menuContainer}
          disabled={!chart}
          value={chartType}
          options={CHART_TYPES.map(({ value, label }) => ({
            value,
            label: t(label),
          }))}
          onValueChange={(value) => {
            const type = CHART_TYPES.find(
              (option) => option.value === value,
            )?.value;
            if (!type) return;
            setChartType(type);
          }}
        />
        <Popover.Root
          onOpenChange={(open) => {
            if (open) refreshIndicators();
          }}
        >
          <Popover.Trigger asChild>
            <button
              type="button"
              disabled={!chart}
              className={`${controlClass} inline-flex items-center gap-1.5`}
              aria-label={t("Indicators")}
            >
              <SlidersHorizontal size={13} aria-hidden="true" />
              <span className="hidden sm:inline">{t("Indicators")}</span>
            </button>
          </Popover.Trigger>
          <Popover.Portal container={menuContainer}>
            <Popover.Content
              align="start"
              sideOffset={4}
              className={menuClass}
              aria-label={t("Chart indicators")}
            >
              <input
                type="search"
                aria-label={t("Search indicators")}
                placeholder={t("Search indicators")}
                value={indicatorSearch}
                onChange={(event) => setIndicatorSearch(event.target.value)}
                className="mb-2 h-8 w-full rounded border border-edge bg-surface px-2 text-content outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
              />
              {indicators.length > 0 ? (
                <div className="mb-2 space-y-2 border-b border-edge pb-2">
                  {indicators.map((indicator) => (
                    <div
                      key={indicator.id}
                      className="flex min-w-0 items-center gap-2"
                    >
                      <label
                        htmlFor={`chart-indicator-${indicator.id}`}
                        className="w-10 shrink-0 font-medium"
                      >
                        {indicator.name}
                      </label>
                      {indicator.calcParams.length > 0 ? (
                        <input
                          key={`${indicator.id}:${indicator.calcParams.join(",")}`}
                          id={`chart-indicator-${indicator.id}`}
                          aria-label={`${indicator.name} ${t("parameters")}`}
                          defaultValue={indicator.calcParams
                            .map(String)
                            .join(", ")}
                          onBlur={(event) => {
                            if (
                              event.target.value !==
                              indicator.calcParams.map(String).join(", ")
                            )
                              updateParameters(indicator, event.target.value);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter")
                              event.currentTarget.blur();
                          }}
                          className="h-7 min-w-0 flex-1 rounded border border-edge bg-surface px-2 tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                        />
                      ) : (
                        <span className="flex-1 text-content-muted">—</span>
                      )}
                      <button
                        type="button"
                        aria-label={`${t("Remove indicator")} ${indicator.name}`}
                        className="rounded p-1 hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                        onClick={() => {
                          chart?.removeIndicator({ id: indicator.id });
                          refreshIndicators();
                        }}
                      >
                        <X size={13} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              {indicatorError ? (
                <p role="alert" className="mb-2 text-down">
                  {indicatorError}
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-1">
                {supportedIndicators.map((name) => {
                  const selected = indicators.some(
                    (indicator) => indicator.name === name,
                  );
                  return (
                    <button
                      type="button"
                      key={name}
                      aria-pressed={selected}
                      onClick={() => toggleIndicator(name)}
                      className="flex min-h-8 items-center justify-between rounded px-2 text-left hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                    >
                      <span>{name}</span>
                      {selected ? (
                        <Check
                          size={12}
                          className="text-accent-primary"
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {supportedIndicators.length === 0 ? (
                <p className="p-2 text-content-muted">
                  {t("No indicators found")}
                </p>
              ) : null}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <Popover.Root
          open={drawingsOpen}
          onOpenChange={(open) => {
            if (open) {
              const drawings =
                chart?.getOverlays({ groupId: USER_DRAWING_GROUP }) ?? [];
              const locked =
                drawings.length > 0 &&
                drawings.every((drawing) => drawing.lock);
              drawingsLockedRef.current = locked;
              setDrawingsLocked(locked);
            }
            setDrawingsOpen(open);
          }}
        >
          <Popover.Trigger asChild>
            <button
              type="button"
              disabled={!chart}
              className={`${controlClass} inline-flex items-center gap-1.5 ${drawingName ? "text-accent-primary" : ""}`}
              aria-label={t("Drawing tools")}
            >
              <Pencil size={13} aria-hidden="true" />
              <span className="hidden sm:inline">{t("Draw")}</span>
              <ChevronDown size={11} aria-hidden="true" />
            </button>
          </Popover.Trigger>
          <Popover.Portal container={menuContainer}>
            <Popover.Content
              align="start"
              sideOffset={4}
              className={`${menuClass} w-52`}
              aria-label={t("Chart drawing tools")}
            >
              {DRAWING_TOOLS.filter(({ name }) =>
                supportedDrawings.has(name),
              ).map(({ name, label }) => (
                <button
                  type="button"
                  key={name}
                  onClick={() => startDrawing(name)}
                  className="block min-h-8 w-full rounded px-2 text-left hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                >
                  {t(label)}
                </button>
              ))}
              <div className="mt-1 flex border-t border-edge pt-1">
                <button
                  type="button"
                  aria-label={t(
                    drawingsLocked ? "Unlock drawings" : "Lock drawings",
                  )}
                  aria-pressed={drawingsLocked}
                  className={`${controlClass} inline-flex flex-1 items-center gap-2`}
                  onClick={toggleDrawingLock}
                >
                  {drawingsLocked ? (
                    <UnlockKeyhole size={13} aria-hidden="true" />
                  ) : (
                    <LockKeyhole size={13} aria-hidden="true" />
                  )}
                  {t(drawingsLocked ? "Unlock" : "Lock")}
                </button>
                <button
                  type="button"
                  aria-label={t("Remove drawings")}
                  className={`${controlClass} inline-flex flex-1 items-center gap-2`}
                  onClick={removeDrawings}
                >
                  <Trash2 size={13} aria-hidden="true" />
                  {t("Clear")}
                </button>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        {drawingName ? (
          <button
            type="button"
            onClick={() => {
              if (activeDrawingRef.current)
                chart?.removeOverlay({
                  id: activeDrawingRef.current,
                  groupId: USER_DRAWING_GROUP,
                });
              activeDrawingRef.current = null;
              setDrawingSelection(null);
            }}
            className={`${controlClass} inline-flex items-center gap-1`}
            aria-label={t("Cancel drawing")}
          >
            <X size={13} aria-hidden="true" />
            <span className="hidden sm:inline">{t("Cancel")}</span>
          </button>
        ) : null}
      </div>
      {!isMobile ? (
        <button
          type="button"
          disabled={!chart}
          className={`${controlClass} ml-1 inline-flex w-8 items-center justify-center`}
          onClick={() => void toggleFullscreen()}
          aria-label={t(fullscreen ? "Exit fullscreen" : "Fullscreen chart")}
        >
          {fullscreen ? (
            <Minimize size={14} aria-hidden="true" />
          ) : (
            <Maximize size={14} aria-hidden="true" />
          )}
        </button>
      ) : null}
      {controlError ? (
        <p
          role="status"
          className="absolute right-2 top-full z-30 rounded border border-edge bg-raised px-3 py-2 text-xs text-content"
        >
          {controlError}
        </p>
      ) : null}
    </div>
  );
}
