import { useId, useRef, useState, type FormEvent } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Search, Settings2, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { getSupportedIndicators, isValidIndicatorParams, MAX_INDICATOR_PARAMETER, MAX_INDICATOR_PARAMETERS } from "@/lib/chart/indicators";
import type { ChartIndicator, TradingChartController } from "@/lib/chart/model";
import { INDICATOR_LABELS } from "./indicatorCatalog";
import { CHART_CONTROL_CLASS, CHART_MENU_CLASS } from "./controlStyles";

interface IndicatorMenuProps {
  chart: TradingChartController | null;
  contentContainer?: HTMLElement;
}

function IndicatorParameters({
  indicator,
  onApply,
}: {
  indicator: ChartIndicator;
  onApply: (values: number[]) => void;
}) {
  const { t } = useTranslation();
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(indicator.calcParams.join(", "));
  const [error, setError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = text.split(",").map((value) => Number(value.trim()));
    if (values.length > MAX_INDICATOR_PARAMETERS || values.some((value) => value > MAX_INDICATOR_PARAMETER)) {
      setError(t("Use up to {{count}} parameters, each no greater than {{max}}.", {
        count: MAX_INDICATOR_PARAMETERS,
        max: MAX_INDICATOR_PARAMETER,
      }));
      inputRef.current?.focus();
      return;
    }
    if (!text.trim() || !isValidIndicatorParams(indicator.name, values)) {
      setError(t("Enter positive indicator parameters separated by commas."));
      inputRef.current?.focus();
      return;
    }
    onApply(values);
    setError("");
  };

  return (
    <form onSubmit={submit} className="border-y border-edge px-2 py-3">
      <label htmlFor={inputId} className="mb-2 block text-[11px] text-content-secondary">
        {t("Indicator parameters")}
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id={inputId}
          name="indicator-parameters"
          aria-label={`${indicator.name} ${t("parameters")}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          autoComplete="off"
          spellCheck={false}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setError("");
          }}
          className="h-8 min-w-0 flex-1 rounded border border-edge bg-input-bg px-2 text-xs tabular-nums text-content outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
        />
        <button
          type="submit"
          className={`${CHART_CONTROL_CLASS} bg-hover text-content`}
        >
          {t("Apply")}
        </button>
      </div>
      {error ? <p id={errorId} role="alert" className="mt-2 text-xs text-down">{error}</p> : null}
    </form>
  );
}

export function IndicatorMenu({ chart, contentContainer }: IndicatorMenuProps) {
  const { t, i18n } = useTranslation();
  const [openFor, setOpenFor] = useState<{
    chart: TradingChartController;
    container?: HTMLElement;
  } | null>(null);
  const [indicators, setIndicators] = useState<ChartIndicator[]>([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const settingsId = useId();
  const open = chart !== null && openFor?.chart === chart && openFor.container === contentContainer;
  const query = search.trim().toLocaleLowerCase(i18n.language);
  const options = getSupportedIndicators()
    .map((name) => ({ name, label: t(INDICATOR_LABELS[name] ?? name) }))
    .filter(({ name, label }) =>
      `${name} ${label} ${INDICATOR_LABELS[name] ?? ""}`.toLocaleLowerCase(i18n.language).includes(query),
    )
    .sort((a, b) => a.label.localeCompare(b.label, i18n.language));

  const refreshIndicators = () => setIndicators(chart?.getIndicators() ?? []);

  const toggleIndicator = (name: string) => {
    if (!chart) return;
    const existing = chart.getIndicators().filter((indicator) => indicator.name === name);
    if (existing.length > 0) {
      existing.forEach(({ id }) => chart.removeIndicator(id));
      if (existing.some(({ id }) => id === editingId)) setEditingId(null);
    } else {
      chart.addIndicator(name);
    }
    refreshIndicators();
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpenFor(nextOpen && chart ? { chart, container: contentContainer } : null);
        if (nextOpen) {
          refreshIndicators();
          setSearch("");
          setEditingId(null);
        }
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={!chart}
          aria-label={t("Indicators")}
          className={`${CHART_CONTROL_CLASS} inline-flex items-center gap-1.5`}
        >
          <SlidersHorizontal size={13} aria-hidden="true" />
          <span className="hidden sm:inline">{t("Indicators")}</span>
          <ChevronDown size={11} aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal container={contentContainer}>
        <Popover.Content
          ref={contentRef}
          align="start"
          sideOffset={4}
          collisionPadding={12}
          aria-label={t("Chart indicators")}
          className={`${CHART_MENU_CLASS} flex w-80 flex-col overflow-hidden`}
          onCloseAutoFocus={() => setOpenFor((current) => current === openFor ? null : current)}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            // Keep the mobile keyboard closed until the user chooses to search.
            if (window.matchMedia("(pointer: coarse)").matches) {
              contentRef.current?.focus();
            } else {
              searchRef.current?.focus();
            }
          }}
        >
          <div className="mb-2 flex h-8 shrink-0 items-center gap-2 rounded border border-edge bg-surface px-2 focus-within:ring-2 focus-within:ring-accent-primary">
            <Search size={14} className="shrink-0 text-content-secondary" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              name="indicator-search"
              aria-label={t("Search indicators")}
              placeholder={`${t("Search indicators")}…`}
              autoComplete="off"
              spellCheck={false}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-full w-full min-w-0 bg-transparent text-xs text-content outline-none placeholder:text-content-muted"
            />
          </div>
          <div className="page-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {options.map(({ name, label }) => {
              const active = indicators.find((indicator) => indicator.name === name);
              const editing = active !== undefined && editingId === active.id;
              const panelId = `${settingsId}-${name}`;
              return (
                <div key={name}>
                  <div className="flex min-h-8 items-center rounded hover:bg-hover focus-within:bg-hover">
                    <button
                      type="button"
                      aria-pressed={Boolean(active)}
                      onClick={() => toggleIndicator(name)}
                      className="flex min-h-8 min-w-0 flex-1 touch-manipulation items-center gap-2 rounded px-2 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-primary"
                    >
                      <span className="min-w-0 flex-1 break-words">{label}</span>
                      <span className="shrink-0 text-[10px] text-content-secondary" translate="no">{name}</span>
                      {active ? <Check size={12} className="shrink-0 text-accent-primary" aria-hidden="true" /> : null}
                    </button>
                    {active && active.calcParams.length > 0 ? (
                      <button
                        type="button"
                        aria-label={`${label} ${t("Indicator settings")}`}
                        aria-expanded={editing}
                        aria-controls={editing ? panelId : undefined}
                        onClick={() => setEditingId(editing ? null : active.id)}
                        className="inline-flex h-8 w-8 shrink-0 touch-manipulation items-center justify-center rounded text-content-secondary outline-none hover:bg-active hover:text-content focus-visible:ring-2 focus-visible:ring-accent-primary"
                      >
                        <Settings2 size={13} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                  {editing ? (
                    <div id={panelId}>
                      <IndicatorParameters
                        key={active.id}
                        indicator={active}
                        onApply={(values) => {
                          chart?.updateIndicator(active.id, values);
                          refreshIndicators();
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
            {options.length === 0 ? (
              <p role="status" className="p-2 text-content-secondary">
                {t("No indicators found")}
              </p>
            ) : null}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
