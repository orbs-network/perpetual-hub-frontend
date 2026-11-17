import { useEffect, useRef, useState, type RefObject } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  ChevronDown,
  LockKeyhole,
  Maximize,
  Minimize,
  Pencil,
  Trash2,
  UnlockKeyhole,
  X,
} from "lucide-react";
import type { ChartPeriod, ChartType, DrawingTool, TradingChartController } from "@/lib/chart/model";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { InlineSelect } from "@/components/ui/inline-select";
import { ChartTypeMenu } from "./ChartTypeMenu";
import { IndicatorMenu } from "./IndicatorMenu";
import { CHART_CONTROL_CLASS as controlClass, CHART_MENU_CLASS as menuClass } from "./controlStyles";
import {
  CHART_PERIODS,
  DRAWING_TOOLS,
  periodKey,
} from "./toolbarOptions";

const selectClass =
  "h-8 max-w-[132px] gap-1.5 rounded px-2 py-0 text-[11px] font-normal hover:bg-hover focus-visible:bg-hover focus-visible:text-content data-[state=open]:bg-hover";

export interface ChartToolbarProps {
  chart: TradingChartController | null;
  period: ChartPeriod;
  onPeriodChange: (period: ChartPeriod) => void;
  chartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;
  containerRef: RefObject<HTMLDivElement | null>;
  isMobile: boolean;
  symbol: string;
}

export function ChartToolbar({
  chart,
  period,
  onPeriodChange,
  chartType,
  onChartTypeChange,
  containerRef,
  isMobile,
  symbol,
}: ChartToolbarProps) {
  const { t } = useTranslation();
  const [drawingSelection, setDrawingSelection] = useState<{
    name: DrawingTool;
    chart: TradingChartController;
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
    const handleFullscreen = () => {
      setDrawingsOpen(false);
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
      chart?.cancelDrawing(id);
      activeDrawingRef.current = null;
      setDrawingSelection(null);
    };
    document.addEventListener("keydown", cancelDrawing);
    return () => {
      document.removeEventListener("keydown", cancelDrawing);
      if (activeDrawingRef.current)
        chart?.cancelDrawing(activeDrawingRef.current);
      activeDrawingRef.current = null;
    };
  }, [chart, symbol]);

  const startDrawing = (name: DrawingTool) => {
    if (!chart) return;
    if (activeDrawingRef.current) chart.cancelDrawing(activeDrawingRef.current);
    const id = chart.startDrawing(name, () => {
      activeDrawingRef.current = null;
      setDrawingSelection(null);
      if (drawingsLockedRef.current) chart.setDrawingsLocked(true);
    });
    activeDrawingRef.current = id;
    setDrawingSelection({ name, chart, symbol });
    setDrawingsOpen(false);
  };

  const toggleDrawingLock = () => {
    const lock = !drawingsLocked;
    chart?.setDrawingsLocked(lock);
    drawingsLockedRef.current = lock;
    setDrawingsLocked(lock);
  };

  const removeDrawings = () => {
    chart?.clearDrawings();
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
        <ChartTypeMenu
          value={chartType}
          onValueChange={onChartTypeChange}
          disabled={!chart}
          contentContainer={menuContainer}
        />
        <IndicatorMenu
          key={chart ? "ready" : "loading"}
          chart={chart}
          contentContainer={menuContainer}
        />
        <Popover.Root
          open={drawingsOpen}
          onOpenChange={(open) => {
            if (open) {
              const drawings =
                chart?.getDrawings() ?? [];
              const locked =
                drawings.length > 0 &&
                drawings.every((drawing) => drawing.locked);
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
              collisionPadding={12}
              className={`${menuClass} w-52`}
              aria-label={t("Chart drawing tools")}
            >
              {DRAWING_TOOLS.map(({ name, label }) => (
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
                chart?.cancelDrawing(activeDrawingRef.current);
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
